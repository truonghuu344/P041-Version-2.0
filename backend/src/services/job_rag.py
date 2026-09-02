from __future__ import annotations

import asyncio
import hashlib
import logging
import math
import re
import unicodedata
from collections.abc import Sequence
from functools import lru_cache
from typing import Any, Protocol

from sqlalchemy import delete, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from src.config import Settings, get_settings
from src.db.database import AsyncSessionLocal
from src.db.models import MarketJobEmbedding
from src.services.job_catalog import (
    _score_job_for_cv,
    _search_text,
    load_enterprise_job_catalog,
    search_enterprise_jobs,
)

logger = logging.getLogger(__name__)
INDEX_NAME = "market_job_embeddings"


class JobRAGUnavailableError(RuntimeError):
    """Raised when semantic retrieval cannot be used safely."""


class EmbeddingProvider(Protocol):
    name: str
    vector_size: int

    async def embed_documents(self, texts: Sequence[str]) -> list[list[float]]: ...

    async def embed_query(self, text: str) -> list[float]: ...


def _normalized_embedding_text(value: str) -> str:
    text_value = unicodedata.normalize("NFD", value.casefold())
    text_value = "".join(char for char in text_value if unicodedata.category(char) != "Mn")
    return re.sub(r"\s+", " ", text_value).strip()


class HashingEmbeddingProvider:
    """Small offline embedding fallback based on signed word/character features."""

    name = "hashing-v1"

    def __init__(self, vector_size: int) -> None:
        self.vector_size = vector_size

    def _encode(self, content: str) -> list[float]:
        words = re.findall(r"[a-z0-9+#.]{2,}", _normalized_embedding_text(content))
        features: list[tuple[str, float]] = [(f"w:{word}", 1.0) for word in words]
        for word in words:
            padded = f"^{word}$"
            features.extend((f"c:{padded[index:index + 3]}", 0.35) for index in range(len(padded) - 2))
        vector = [0.0] * self.vector_size
        for feature, weight in features:
            digest = hashlib.blake2b(feature.encode("utf-8"), digest_size=8).digest()
            vector[int.from_bytes(digest, "big") % self.vector_size] += (1.0 if digest[0] & 1 else -1.0) * weight
        norm = math.sqrt(sum(value * value for value in vector))
        return [value / norm for value in vector] if norm else vector

    async def embed_documents(self, texts: Sequence[str]) -> list[list[float]]:
        return [self._encode(item) for item in texts]

    async def embed_query(self, text_value: str) -> list[float]:
        return self._encode(text_value)


class GeminiEmbeddingProvider:
    def __init__(self, *, api_key: str, model_name: str, vector_size: int) -> None:
        from google import genai

        self.name, self.vector_size = model_name, vector_size
        self._client = genai.Client(api_key=api_key)

    async def _embed(self, content: str) -> list[float]:
        from google.genai import types

        try:
            response = await asyncio.wait_for(
                self._client.aio.models.embed_content(
                    model=self.name,
                    contents=content,
                    config=types.EmbedContentConfig(output_dimensionality=self.vector_size),
                ),
                timeout=4.0,
            )
            vector = list(response.embeddings[0].values)
            if len(vector) != self.vector_size:
                raise ValueError("Embedding dimension does not match configuration.")
            return vector
        except Exception as exc:
            raise JobRAGUnavailableError("Không thể tạo Gemini embedding hoặc request bị timeout.") from exc

    async def embed_documents(self, texts: Sequence[str]) -> list[list[float]]:
        from google.genai import types

        if not texts:
            return []
        formatted = [f"title: market job | text: {item}" for item in texts]
        try:
            response = await asyncio.wait_for(
                self._client.aio.models.embed_content(
                    model=self.name,
                    contents=formatted,
                    config=types.EmbedContentConfig(output_dimensionality=self.vector_size),
                ),
                timeout=8.0,
            )
            return [list(emb.values) for emb in response.embeddings]
        except Exception as exc:
            raise JobRAGUnavailableError("Không thể tạo Gemini embedding hoặc request bị timeout.") from exc

    async def embed_query(self, text_value: str) -> list[float]:
        return await self._embed(f"task: search result | query: {text_value}")


def _public_job(job: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in job.items() if not key.startswith("_")}


def build_job_document(job: dict[str, Any]) -> str:
    return "\n".join(
        (
            f"Vị trí: {job.get('title', '')}", f"Công ty: {job.get('company', '')}",
            f"Địa điểm: {job.get('location', '')}", f"Cấp bậc: {job.get('job_level', '')}",
            f"Hình thức: {job.get('employment_type', '')}; {job.get('remote_type', '')}",
            f"Lĩnh vực: {job.get('domain', '')}", f"Kỹ năng: {', '.join(job.get('skills') or [])}",
            f"Mô tả: {str(job.get('description') or '').strip()[:16_000]}",
        )
    )


def _content_hash(document: str, provider_name: str, vector_size: int) -> str:
    return hashlib.sha256(f"{provider_name}\0{vector_size}\0{document}".encode()).hexdigest()


def _cosine(left: Sequence[float], right: Sequence[float]) -> float:
    denominator = math.sqrt(sum(value * value for value in left)) * math.sqrt(sum(value * value for value in right))
    return sum(a * b for a, b in zip(left, right, strict=True)) / denominator if denominator else 0.0


class MarketJobRAGService:
    def __init__(self, *, settings: Settings | None = None, embedder: EmbeddingProvider | None = None,
                 session_factory: async_sessionmaker[AsyncSession] | None = None) -> None:
        self.settings = settings or get_settings()
        self._embedder = embedder
        self._session_factory = session_factory or AsyncSessionLocal
        self._sync_lock = asyncio.Lock()

    def _get_embedder(self) -> EmbeddingProvider:
        if self._embedder is not None:
            return self._embedder
        if self.settings.vector_embedding_provider == "gemini" or (
            self.settings.vector_embedding_provider == "auto" and self.settings.google_genai_api_key
        ):
            if not self.settings.google_genai_api_key:
                raise JobRAGUnavailableError("VECTOR_EMBEDDING_PROVIDER=gemini cần GEMINI_API_KEY.")
            self._embedder = GeminiEmbeddingProvider(api_key=self.settings.google_genai_api_key,
                model_name=self.settings.vector_embedding_model, vector_size=self.settings.vector_dimensions)
        else:
            self._embedder = HashingEmbeddingProvider(self.settings.vector_dimensions)
        return self._embedder

    async def sync_catalog(self) -> dict[str, Any]:
        """Incrementally store the market-JD semantic index in PostgreSQL/pgvector."""
        async with self._sync_lock:
            embedder = self._get_embedder()
            try:
                return await self._sync_catalog_with(embedder)
            except JobRAGUnavailableError as exc:
                if self.settings.vector_embedding_provider != "auto" or isinstance(embedder, HashingEmbeddingProvider):
                    raise
                logger.warning(
                    "Configured embedding provider is unavailable; retrying market-JD sync with hashing fallback: %s",
                    exc,
                )
                self._embedder = HashingEmbeddingProvider(self.settings.vector_dimensions)
                return await self._sync_catalog_with(self._embedder)

    async def _sync_catalog_with(self, embedder: EmbeddingProvider) -> dict[str, Any]:
        """Synchronize the catalog with one resolved embedding provider."""
        catalog = list(load_enterprise_job_catalog())
        async with self._session_factory() as session:
            existing = {row.source_id: row for row in (await session.scalars(select(MarketJobEmbedding))).all()}
            pending: list[tuple[dict[str, Any], str, str]] = []
            valid_ids: set[str] = set()
            for job in catalog:
                source_id = str(job["source_id"])
                document = build_job_document(job)
                digest = _content_hash(document, embedder.name, embedder.vector_size)
                valid_ids.add(source_id)
                if source_id not in existing or existing[source_id].content_hash != digest:
                    pending.append((job, document, digest))
            vectors = await embedder.embed_documents([item[1] for item in pending]) if pending else []
            for (job, document, digest), vector in zip(pending, vectors, strict=True):
                source_id = str(job["source_id"])
                row = existing.get(source_id)
                if row is None:
                    session.add(MarketJobEmbedding(source_id=source_id, document=document, content_hash=digest,
                        embedding_provider=embedder.name, embedding=vector))
                else:
                    row.document, row.content_hash, row.embedding_provider, row.embedding = document, digest, embedder.name, vector
            stale_ids = set(existing) - valid_ids
            if stale_ids:
                await session.execute(delete(MarketJobEmbedding).where(MarketJobEmbedding.source_id.in_(stale_ids)))
            await session.commit()
        return {"indexed": len(pending), "unchanged": len(catalog) - len(pending), "deleted": len(stale_ids),
                "total": len(catalog), "collection": INDEX_NAME, "embedding_provider": embedder.name}

    async def _semantic_candidates(self, vector: list[float], limit: int) -> list[tuple[str, float]]:
        async with self._session_factory() as session:
            if session.bind and session.bind.dialect.name == "postgresql":
                vector_literal = "[" + ",".join(f"{value:.12g}" for value in vector) + "]"
                rows = await session.execute(text(
                    "SELECT source_id, 1 - (embedding <=> CAST(:embedding AS vector)) AS score "
                    "FROM market_job_embeddings ORDER BY embedding <=> CAST(:embedding AS vector) LIMIT :limit"
                ), {"embedding": vector_literal, "limit": limit})
                return [(str(row.source_id), float(row.score)) for row in rows]
            rows = (await session.scalars(select(MarketJobEmbedding))).all()
            return sorted(((row.source_id, _cosine(row.embedding, vector)) for row in rows), key=lambda item: -item[1])[:limit]

    async def search(self, *, query: str, cv_text: str | None, parsed_cv: dict[str, Any], limit: int) -> tuple[list[dict[str, Any]], int]:
        async with self._session_factory() as session:
            count = await session.scalar(select(func.count()).select_from(MarketJobEmbedding))
        if not count:
            if not self.settings.vector_auto_sync:
                raise JobRAGUnavailableError("Chỉ mục JD chưa được khởi tạo.")
            await self.sync_catalog()
        parts = [query.strip()]
        if cv_text is not None:
            skills = parsed_cv.get("skills") or []
            if isinstance(skills, list):
                parts.append("Kỹ năng ứng viên: " + ", ".join(map(str, skills)))
            parts.extend((str(parsed_cv.get("summary") or ""), cv_text[:3_000] if not skills and not parsed_cv.get("summary") else ""))
        retrieval_query = "\n".join(part for part in parts if part).strip()
        embedder = self._get_embedder()
        try:
            query_vector = await embedder.embed_query(retrieval_query)
        except Exception as exc:
            if not isinstance(embedder, HashingEmbeddingProvider):
                logger.warning(
                    "Configured embedding provider failed in search_jobs; falling back to hashing: %s",
                    exc,
                )
                self._embedder = HashingEmbeddingProvider(self.settings.vector_dimensions)
                query_vector = await self._embedder.embed_query(retrieval_query)
            else:
                raise
        candidates = await self._semantic_candidates(query_vector, min(100, max(20, limit * 4)))
        catalog = {str(job["source_id"]): job for job in load_enterprise_job_catalog()}
        terms = _search_text(query).split()
        ranked: list[dict[str, Any]] = []
        for source_id, score in candidates:
            job = catalog.get(source_id)
            if job is None:
                continue
            semantic_score = max(0.0, min(100.0, (score + 1.0) * 50.0))
            lexical = (sum(term in job["_search"] for term in terms) / len(terms) * 100.0) if terms else 0.0
            result = _score_job_for_cv(job, cv_text, parsed_cv) if cv_text is not None else _public_job(job)
            result["retrieval_score"] = round(semantic_score * (0.75 if terms else 1) + lexical * (0.25 if terms else 0), 1)
            if cv_text is not None:
                result["match_score"] = round(float(result["match_score"]) * 0.8 + semantic_score * 0.2, 1)
            ranked.append(result)
        ranked.sort(key=lambda item: (-float(item.get("match_score") if cv_text is not None else item["retrieval_score"]),
            -float(item["retrieval_score"]), item["title"].casefold()))
        return ranked[:limit], len(ranked)

    async def status(self) -> dict[str, Any]:
        if not self.settings.vector_search_enabled:
            return {"enabled": False, "available": False, "collection": INDEX_NAME, "points_count": 0,
                    "embedding_model": self.settings.vector_embedding_model, "detail": "pgvector RAG đang tắt bằng cấu hình."}
        try:
            async with self._session_factory() as session:
                count = int(await session.scalar(select(func.count()).select_from(MarketJobEmbedding)) or 0)
            return {"enabled": True, "available": True, "collection": INDEX_NAME, "points_count": count,
                    "embedding_model": self._get_embedder().name, "detail": "ready" if count else "Chỉ mục chưa được đồng bộ."}
        except Exception as exc:
            logger.warning("pgvector status check failed: %s", exc)
            return {"enabled": True, "available": False, "collection": INDEX_NAME, "points_count": 0,
                    "embedding_model": self.settings.vector_embedding_model, "detail": str(exc)}


@lru_cache(maxsize=1)
def get_market_job_rag() -> MarketJobRAGService:
    return MarketJobRAGService()


async def search_market_jobs(*, query: str = "", cv_text: str | None = None, parsed_cv: dict[str, Any] | None = None,
                             limit: int = 60) -> tuple[list[dict[str, Any]], int, str]:
    settings, parsed = get_settings(), parsed_cv or {}
    if not settings.vector_search_enabled or (not query.strip() and cv_text is None):
        jobs, total = search_enterprise_jobs(query=query, cv_text=cv_text, parsed_cv=parsed, limit=limit)
        return jobs, total, "catalog"
    try:
        jobs, total = await get_market_job_rag().search(query=query, cv_text=cv_text, parsed_cv=parsed, limit=limit)
        if total:
            return jobs, total, "pgvector"
    except Exception:
        logger.warning("pgvector RAG unavailable; using deterministic catalog fallback.", exc_info=True)
    jobs, total = search_enterprise_jobs(query=query, cv_text=cv_text, parsed_cv=parsed, limit=limit)
    return jobs, total, "keyword_fallback"


async def sync_market_jobs_safely() -> None:
    try:
        logger.info("Market JD pgvector sync completed: %s", await get_market_job_rag().sync_catalog())
    except Exception:
        logger.exception("Market JD pgvector startup sync failed; keyword fallback remains active.")
