from __future__ import annotations

import asyncio
import hashlib
import logging
import math
import re
import unicodedata
import uuid
from collections.abc import Sequence
from functools import lru_cache
from typing import Any, Protocol

from src.config import Settings, get_settings
from src.services.job_catalog import (
    _score_job_for_cv,
    _search_text,
    load_enterprise_job_catalog,
    search_enterprise_jobs,
)

logger = logging.getLogger(__name__)


class JobRAGUnavailableError(RuntimeError):
    """Raised when semantic retrieval cannot be used safely."""


class EmbeddingProvider(Protocol):
    name: str
    vector_size: int

    async def embed_documents(self, texts: Sequence[str]) -> list[list[float]]: ...

    async def embed_query(self, text: str) -> list[float]: ...


def _normalized_embedding_text(value: str) -> str:
    text = unicodedata.normalize("NFD", value.casefold())
    text = "".join(char for char in text if unicodedata.category(char) != "Mn")
    return re.sub(r"\s+", " ", text).strip()


class HashingEmbeddingProvider:
    """Small offline embedding fallback based on signed word/character features."""

    name = "hashing-v1"

    def __init__(self, vector_size: int) -> None:
        self.vector_size = vector_size

    def _encode(self, text: str) -> list[float]:
        normalized = _normalized_embedding_text(text)
        words = re.findall(r"[a-z0-9+#.]{2,}", normalized)
        features: list[tuple[str, float]] = [(f"w:{word}", 1.0) for word in words]
        for word in words:
            padded = f"^{word}$"
            features.extend((f"c:{padded[index:index + 3]}", 0.35) for index in range(len(padded) - 2))

        vector = [0.0] * self.vector_size
        for feature, weight in features:
            digest = hashlib.blake2b(feature.encode("utf-8"), digest_size=8).digest()
            bucket = int.from_bytes(digest, "big") % self.vector_size
            sign = 1.0 if digest[0] & 1 else -1.0
            vector[bucket] += sign * weight

        norm = math.sqrt(sum(value * value for value in vector))
        return [value / norm for value in vector] if norm else vector

    async def embed_documents(self, texts: Sequence[str]) -> list[list[float]]:
        return [self._encode(text) for text in texts]

    async def embed_query(self, text: str) -> list[float]:
        return self._encode(text)


class GeminiEmbeddingProvider:
    """Gemini Embedding 2 adapter with retrieval-specific prompt formatting."""

    def __init__(self, *, api_key: str, model_name: str, vector_size: int) -> None:
        from google import genai

        self.name = model_name
        self.vector_size = vector_size
        self._client = genai.Client(api_key=api_key)

    async def _embed(self, text: str) -> list[float]:
        from google.genai import types

        last_error: Exception | None = None
        for attempt in range(3):
            try:
                response = await self._client.aio.models.embed_content(
                    model=self.name,
                    contents=text,
                    config=types.EmbedContentConfig(output_dimensionality=self.vector_size),
                )
                values = list(response.embeddings[0].values)
                if len(values) != self.vector_size:
                    raise ValueError(
                        f"Embedding dimension {len(values)} does not match {self.vector_size}."
                    )
                return values
            except Exception as exc:  # SDK/network errors vary by version.
                last_error = exc
                if attempt < 2:
                    await asyncio.sleep(2**attempt)
        raise JobRAGUnavailableError("Không thể tạo Gemini embedding.") from last_error

    async def embed_documents(self, texts: Sequence[str]) -> list[list[float]]:
        semaphore = asyncio.Semaphore(4)

        async def embed_one(text: str) -> list[float]:
            async with semaphore:
                return await self._embed(f"title: market job | text: {text}")

        return list(await asyncio.gather(*(embed_one(text) for text in texts)))

    async def embed_query(self, text: str) -> list[float]:
        return await self._embed(f"task: search result | query: {text}")


def _public_job(job: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in job.items() if not key.startswith("_")}


def build_job_document(job: dict[str, Any]) -> str:
    """Build the canonical text embedded and stored for one market JD."""
    description = str(job.get("description") or "").strip()[:16_000]
    return "\n".join(
        (
            f"Vị trí: {job.get('title', '')}",
            f"Công ty: {job.get('company', '')}",
            f"Địa điểm: {job.get('location', '')}",
            f"Cấp bậc: {job.get('job_level', '')}",
            f"Hình thức: {job.get('employment_type', '')}; {job.get('remote_type', '')}",
            f"Lĩnh vực: {job.get('domain', '')}",
            f"Kỹ năng: {', '.join(job.get('skills') or [])}",
            f"Mô tả: {description}",
        )
    )


def _point_id(source_id: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"career-assistant:market-jd:{source_id}"))


def _content_hash(document: str, provider_name: str, vector_size: int) -> str:
    material = f"{provider_name}\0{vector_size}\0{document}".encode()
    return hashlib.sha256(material).hexdigest()


class MarketJobRAGService:
    def __init__(
        self,
        *,
        settings: Settings | None = None,
        client: Any | None = None,
        embedder: EmbeddingProvider | None = None,
    ) -> None:
        self.settings = settings or get_settings()
        self.collection_name = self.settings.qdrant_collection
        self._client = client
        self._embedder = embedder
        self._models: Any | None = None
        self._sync_lock = asyncio.Lock()

    def _get_client(self) -> Any:
        if self._client is not None:
            return self._client
        try:
            from qdrant_client import AsyncQdrantClient, models
        except ImportError as exc:
            raise JobRAGUnavailableError(
                "Thiếu qdrant-client. Hãy cài dependencies của dự án."
            ) from exc

        self._models = models
        self._client = AsyncQdrantClient(
            url=self.settings.qdrant_url,
            api_key=self.settings.qdrant_api_key or None,
            timeout=self.settings.qdrant_timeout_seconds,
        )
        return self._client

    def _get_models(self) -> Any:
        if self._models is None:
            try:
                from qdrant_client import models
            except ImportError as exc:
                raise JobRAGUnavailableError("Thiếu qdrant-client.") from exc
            self._models = models
        return self._models

    def _get_embedder(self) -> EmbeddingProvider:
        if self._embedder is not None:
            return self._embedder
        provider = self.settings.qdrant_embedding_provider
        api_key = self.settings.google_genai_api_key
        if provider == "gemini" or (provider == "auto" and api_key):
            if not api_key:
                raise JobRAGUnavailableError(
                    "QDRANT_EMBEDDING_PROVIDER=gemini cần GEMINI_API_KEY."
                )
            self._embedder = GeminiEmbeddingProvider(
                api_key=api_key,
                model_name=self.settings.qdrant_embedding_model,
                vector_size=self.settings.qdrant_vector_size,
            )
        else:
            self._embedder = HashingEmbeddingProvider(self.settings.qdrant_vector_size)
        return self._embedder

    async def _ensure_collection(self) -> None:
        client = self._get_client()
        models = self._get_models()
        if not await client.collection_exists(self.collection_name):
            await client.create_collection(
                collection_name=self.collection_name,
                vectors_config=models.VectorParams(
                    size=self.settings.qdrant_vector_size,
                    distance=models.Distance.COSINE,
                ),
            )
            return

        info = await client.get_collection(self.collection_name)
        vectors_config = info.config.params.vectors
        actual_size = getattr(vectors_config, "size", None)
        if actual_size is not None and actual_size != self.settings.qdrant_vector_size:
            raise JobRAGUnavailableError(
                f"Collection {self.collection_name} có vector size {actual_size}, "
                f"cấu hình yêu cầu {self.settings.qdrant_vector_size}."
            )

    async def _existing_points(self) -> dict[str, dict[str, Any]]:
        client = self._get_client()
        existing: dict[str, dict[str, Any]] = {}
        offset: Any | None = None
        while True:
            points, offset = await client.scroll(
                collection_name=self.collection_name,
                limit=256,
                offset=offset,
                with_payload=["source_id", "content_hash", "embedding_provider"],
                with_vectors=False,
            )
            for point in points:
                existing[str(point.id)] = dict(point.payload or {})
            if offset is None:
                break
        return existing

    async def sync_catalog(self) -> dict[str, Any]:
        """Incrementally upsert changed market JDs and remove stale Qdrant points."""
        async with self._sync_lock:
            await self._ensure_collection()
            client = self._get_client()
            models = self._get_models()
            embedder = self._get_embedder()
            catalog = list(load_enterprise_job_catalog())
            existing = await self._existing_points()

            pending: list[tuple[dict[str, Any], str, str, str]] = []
            valid_ids: set[str] = set()
            for job in catalog:
                document = build_job_document(job)
                point_id = _point_id(str(job["source_id"]))
                digest = _content_hash(document, embedder.name, embedder.vector_size)
                valid_ids.add(point_id)
                payload = existing.get(point_id, {})
                if payload.get("content_hash") != digest:
                    pending.append((job, document, point_id, digest))

            if pending:
                vectors = await embedder.embed_documents([item[1] for item in pending])
                points = []
                for (job, document, point_id, digest), vector in zip(pending, vectors, strict=True):
                    payload = _public_job(job)
                    payload.update(
                        {
                            "document": document,
                            "content_hash": digest,
                            "embedding_provider": embedder.name,
                        }
                    )
                    points.append(models.PointStruct(id=point_id, vector=vector, payload=payload))
                for start in range(0, len(points), 32):
                    await client.upsert(
                        collection_name=self.collection_name,
                        points=points[start : start + 32],
                        wait=True,
                    )

            stale_ids = sorted(set(existing) - valid_ids)
            if stale_ids:
                await client.delete(
                    collection_name=self.collection_name,
                    points_selector=models.PointIdsList(points=stale_ids),
                    wait=True,
                )

            return {
                "indexed": len(pending),
                "unchanged": len(catalog) - len(pending),
                "deleted": len(stale_ids),
                "total": len(catalog),
                "collection": self.collection_name,
                "embedding_provider": embedder.name,
            }

    async def search(
        self,
        *,
        query: str,
        cv_text: str | None,
        parsed_cv: dict[str, Any],
        limit: int,
    ) -> tuple[list[dict[str, Any]], int]:
        client = self._get_client()
        if not await client.collection_exists(self.collection_name):
            if not self.settings.qdrant_auto_sync:
                raise JobRAGUnavailableError("Collection JD thị trường chưa được khởi tạo.")
            await self.sync_catalog()

        query_parts = [query.strip()]
        if cv_text is not None:
            skills = parsed_cv.get("skills") or []
            if isinstance(skills, list):
                query_parts.append("Kỹ năng ứng viên: " + ", ".join(map(str, skills)))
            query_parts.append(str(parsed_cv.get("summary") or ""))
            if not skills and not parsed_cv.get("summary"):
                query_parts.append(cv_text[:3_000])
        retrieval_query = "\n".join(part for part in query_parts if part).strip()
        if not retrieval_query:
            raise JobRAGUnavailableError("Không có truy vấn ngữ nghĩa để tìm kiếm.")

        vector = await self._get_embedder().embed_query(retrieval_query)
        candidate_limit = min(100, max(20, limit * 4))
        response = await client.query_points(
            collection_name=self.collection_name,
            query=vector,
            limit=candidate_limit,
            with_payload=True,
        )
        catalog_by_id = {
            str(job["source_id"]): job for job in load_enterprise_job_catalog()
        }
        normalized_query = _search_text(query)
        query_terms = normalized_query.split()
        ranked: list[dict[str, Any]] = []
        for point in response.points:
            payload = dict(point.payload or {})
            job = catalog_by_id.get(str(payload.get("source_id") or ""))
            if job is None:
                continue
            semantic_score = max(0.0, min(100.0, (float(point.score) + 1.0) * 50.0))
            lexical_hits = sum(term in job["_search"] for term in query_terms)
            lexical_score = (lexical_hits / len(query_terms) * 100.0) if query_terms else 0.0
            retrieval_score = round(
                semantic_score * (0.75 if query_terms else 1.0)
                + lexical_score * (0.25 if query_terms else 0.0),
                1,
            )
            if cv_text is not None:
                result = _score_job_for_cv(job, cv_text, parsed_cv)
                result["match_score"] = round(
                    float(result["match_score"]) * 0.8 + semantic_score * 0.2,
                    1,
                )
            else:
                result = _public_job(job)
            result["retrieval_score"] = retrieval_score
            ranked.append(result)

        if cv_text is not None:
            ranked.sort(
                key=lambda item: (
                    -float(item.get("match_score") or 0),
                    -float(item.get("retrieval_score") or 0),
                    item["title"].casefold(),
                )
            )
        else:
            ranked.sort(
                key=lambda item: (
                    -float(item.get("retrieval_score") or 0),
                    item["title"].casefold(),
                )
            )
        return ranked[:limit], len(ranked)

    async def status(self) -> dict[str, Any]:
        if not self.settings.qdrant_enabled:
            return {
                "enabled": False,
                "available": False,
                "collection": self.collection_name,
                "points_count": 0,
                "embedding_model": self.settings.qdrant_embedding_model,
                "detail": "Qdrant RAG đang tắt bằng cấu hình.",
            }
        try:
            client = self._get_client()
            exists = await client.collection_exists(self.collection_name)
            info = await client.get_collection(self.collection_name) if exists else None
            return {
                "enabled": True,
                "available": exists,
                "collection": self.collection_name,
                "points_count": int(getattr(info, "points_count", 0) or 0),
                "embedding_model": self._get_embedder().name,
                "detail": "ready" if exists else "Collection chưa được đồng bộ.",
            }
        except Exception as exc:
            logger.warning("Qdrant status check failed: %s", exc)
            return {
                "enabled": True,
                "available": False,
                "collection": self.collection_name,
                "points_count": 0,
                "embedding_model": self.settings.qdrant_embedding_model,
                "detail": str(exc),
            }


@lru_cache(maxsize=1)
def get_market_job_rag() -> MarketJobRAGService:
    return MarketJobRAGService()


async def search_market_jobs(
    *,
    query: str = "",
    cv_text: str | None = None,
    parsed_cv: dict[str, Any] | None = None,
    limit: int = 60,
) -> tuple[list[dict[str, Any]], int, str]:
    settings = get_settings()
    parsed = parsed_cv or {}
    if not settings.qdrant_enabled or (not query.strip() and cv_text is None):
        jobs, total = search_enterprise_jobs(
            query=query,
            cv_text=cv_text,
            parsed_cv=parsed,
            limit=limit,
        )
        return jobs, total, "catalog"

    try:
        jobs, total = await get_market_job_rag().search(
            query=query,
            cv_text=cv_text,
            parsed_cv=parsed,
            limit=limit,
        )
        if total == 0 and (query.strip() or cv_text):
            # Qdrant answered without raising, but returned zero hits while the
            # caller actually gave us a keyword or CV to search on. This can
            # legitimately mean "no match", but it's indistinguishable from an
            # empty/unsynced collection (e.g. embedding quota exhausted during
            # sync_market_jobs_safely()). Try the deterministic keyword catalog
            # as a fallback — it costs nothing and, if the collection genuinely
            # is empty, it's the only way to return real results.
            logger.warning(
                "Qdrant search returned 0 hits for query=%r cv_text=%s; "
                "trying keyword catalog fallback.",
                query,
                bool(cv_text),
            )
            fallback_jobs, fallback_total = search_enterprise_jobs(
                query=query,
                cv_text=cv_text,
                parsed_cv=parsed,
                limit=limit,
            )
            if fallback_total > 0:
                return fallback_jobs, fallback_total, "keyword_fallback"
        return jobs, total, "qdrant"
    except Exception:
        logger.warning("Qdrant RAG unavailable; using deterministic catalog fallback.", exc_info=True)
        jobs, total = search_enterprise_jobs(
            query=query,
            cv_text=cv_text,
            parsed_cv=parsed,
            limit=limit,
        )
        return jobs, total, "keyword_fallback"


async def sync_market_jobs_safely() -> None:
    try:
        result = await get_market_job_rag().sync_catalog()
        logger.info("Market JD Qdrant sync completed: %s", result)
    except Exception:
        logger.exception("Market JD Qdrant startup sync failed; keyword fallback remains active.")
