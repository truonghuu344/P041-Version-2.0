"""Semantic (vector) candidate retriever for Top Jobs.

This retriever queries the pre-computed JD embeddings stored in
``market_job_embeddings`` (pgvector).  It embeds the CV retrieval text once,
then finds the ``k`` nearest JD vectors by cosine distance.

Like BM25, the cosine similarity score is a **retrieval-only** signal.  It
must never be used directly as a CV-JD fit score; the later evidence/rubric
stage owns ``raw_fit_score`` and ``display_fit_score``.
"""

from __future__ import annotations

import logging
import math
from collections.abc import Sequence
from typing import Protocol, runtime_checkable

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from src.config import Settings, get_settings
from src.db.models import MarketJobEmbedding
from src.services.job_recommendations.bm25_retriever import RankedJob

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Lightweight embedding provider protocol (avoids importing job_rag at
# module level which pulls in job_catalog → agents → langgraph).
# ---------------------------------------------------------------------------


@runtime_checkable
class EmbeddingProvider(Protocol):
    """Minimal contract for an embedding provider."""

    name: str
    vector_size: int

    async def embed_query(self, text: str) -> list[float]: ...


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _cosine(left: Sequence[float], right: Sequence[float]) -> float:
    """In-memory cosine similarity for non-pgvector backends (SQLite tests)."""
    dot = sum(a * b for a, b in zip(left, right, strict=True))
    norm_left = math.sqrt(sum(v * v for v in left))
    norm_right = math.sqrt(sum(v * v for v in right))
    denominator = norm_left * norm_right
    return dot / denominator if denominator else 0.0


def _get_session_factory() -> async_sessionmaker[AsyncSession]:
    """Lazy import to avoid triggering engine creation at module load time."""
    from src.db.database import AsyncSessionLocal

    return AsyncSessionLocal


# ---------------------------------------------------------------------------
# Semantic retriever
# ---------------------------------------------------------------------------


class SemanticRetriever:
    """Nearest-neighbour retriever over the pre-indexed market JD catalog.

    Parameters
    ----------
    settings:
        Application settings (embedding provider config, vector dimensions).
    embedder:
        Explicit embedding provider.  When ``None`` the retriever resolves one
        from :class:`MarketJobRAGService` so that provider/model selection
        stays centralised.
    session_factory:
        SQLAlchemy async session factory.  Defaults to the application-wide
        ``AsyncSessionLocal``.
    """

    def __init__(
        self,
        *,
        settings: Settings | None = None,
        embedder: EmbeddingProvider | None = None,
        session_factory: async_sessionmaker[AsyncSession] | None = None,
    ) -> None:
        self._settings = settings or get_settings()
        self._embedder = embedder
        self._session_factory = session_factory

    def _resolve_session_factory(self) -> async_sessionmaker[AsyncSession]:
        if self._session_factory is not None:
            return self._session_factory
        self._session_factory = _get_session_factory()
        return self._session_factory

    def _get_embedder(self) -> EmbeddingProvider:
        if self._embedder is not None:
            return self._embedder
        # Lazy import: MarketJobRAGService pulls in the heavy dependency
        # chain only when we actually need an embedder at runtime.
        from src.services.job_rag import MarketJobRAGService

        rag = MarketJobRAGService(
            settings=self._settings,
            session_factory=self._resolve_session_factory(),
        )
        self._embedder = rag._get_embedder()  # noqa: SLF001
        return self._embedder

    # ------------------------------------------------------------------
    # pgvector fast path
    # ------------------------------------------------------------------

    async def _pgvector_search(
        self,
        session: AsyncSession,
        query_vector: list[float],
        limit: int,
    ) -> list[tuple[str, float]]:
        """Use the pgvector ``<=>`` cosine distance operator."""
        vector_literal = "[" + ",".join(f"{v:.12g}" for v in query_vector) + "]"
        rows = await session.execute(
            text(
                "SELECT source_id, "
                "1 - (embedding <=> CAST(:embedding AS vector)) AS score "
                "FROM market_job_embeddings "
                "ORDER BY embedding <=> CAST(:embedding AS vector) "
                "LIMIT :limit"
            ),
            {"embedding": vector_literal, "limit": limit},
        )
        return [(str(row.source_id), float(row.score)) for row in rows]

    # ------------------------------------------------------------------
    # In-memory fallback (SQLite / test environments)
    # ------------------------------------------------------------------

    async def _memory_search(
        self,
        session: AsyncSession,
        query_vector: list[float],
        limit: int,
    ) -> list[tuple[str, float]]:
        """Brute-force cosine similarity for non-pgvector backends."""
        all_rows = (await session.scalars(select(MarketJobEmbedding))).all()
        scored = [
            (row.source_id, _cosine(row.embedding, query_vector))
            for row in all_rows
            if row.embedding
        ]
        scored.sort(key=lambda item: -item[1])
        return scored[:limit]

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def retrieve(
        self,
        cv_retrieval_text: str,
        *,
        k: int = 30,
    ) -> list[RankedJob]:
        """Return at most ``k`` JD candidates ranked by cosine similarity.

        Parameters
        ----------
        cv_retrieval_text:
            The PII-free CV retrieval representation built by
            :func:`build_cv_retrieval_text`.
        k:
            Maximum number of candidates to return.

        Returns
        -------
        list[RankedJob]
            Ranked candidates.  ``score`` is the raw cosine similarity
            (retrieval signal only — **not** a fit score).
        """
        if k < 1:
            raise ValueError("k must be at least 1.")

        cv_text = (cv_retrieval_text or "").strip()
        if not cv_text:
            return []

        embedder = self._get_embedder()
        try:
            query_vector = await embedder.embed_query(cv_text)
        except Exception as exc:
            # Fallback to hashing embedding if Gemini/API is rate-limited (429) or unavailable
            from src.services.job_rag import HashingEmbeddingProvider

            if not isinstance(embedder, HashingEmbeddingProvider):
                logger.warning(
                    "Configured embedding provider failed; falling back to hashing embedder: %s",
                    exc,
                )
                self._embedder = HashingEmbeddingProvider(self._settings.vector_dimensions)
                query_vector = await self._embedder.embed_query(cv_text)
            else:
                raise

        factory = self._resolve_session_factory()
        async with factory() as session:
            is_pg = session.bind and session.bind.dialect.name == "postgresql"
            if is_pg:
                candidates = await self._pgvector_search(session, query_vector, k)
            else:
                candidates = await self._memory_search(session, query_vector, k)

        # Stable tie-breaking by source_id (same convention as BM25 retriever).
        candidates.sort(key=lambda item: (-item[1], item[0]))

        return [
            RankedJob(
                jd_snapshot_id=source_id,
                rank=index,
                score=round(score, 8),
            )
            for index, (source_id, score) in enumerate(candidates[:k], start=1)
        ]


# ---------------------------------------------------------------------------
# Convenience function
# ---------------------------------------------------------------------------


async def retrieve_semantic(
    cv_retrieval_text: str,
    *,
    k: int = 30,
) -> list[RankedJob]:
    """Convenience wrapper for the Top Jobs orchestration service."""
    return await SemanticRetriever().retrieve(cv_retrieval_text, k=k)
