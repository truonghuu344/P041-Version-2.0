from __future__ import annotations

import pytest
from qdrant_client import AsyncQdrantClient

from src.config import Settings
from src.services.job_rag import HashingEmbeddingProvider, MarketJobRAGService


@pytest.mark.asyncio
async def test_qdrant_market_jd_sync_is_incremental_and_searchable():
    vector_size = 256
    settings = Settings(
        qdrant_enabled=True,
        qdrant_collection="test_market_jobs",
        qdrant_embedding_provider="hashing",
        qdrant_vector_size=vector_size,
        qdrant_auto_sync=True,
    )
    client = AsyncQdrantClient(location=":memory:")
    service = MarketJobRAGService(
        settings=settings,
        client=client,
        embedder=HashingEmbeddingProvider(vector_size),
    )

    first_sync = await service.sync_catalog()
    second_sync = await service.sync_catalog()

    assert first_sync == {
        "indexed": 98,
        "unchanged": 0,
        "deleted": 0,
        "total": 98,
        "collection": "test_market_jobs",
        "embedding_provider": "hashing-v1",
    }
    assert second_sync["indexed"] == 0
    assert second_sync["unchanged"] == 98

    jobs, total = await service.search(
        query="ShopBack",
        cv_text=None,
        parsed_cv={},
        limit=10,
    )

    assert total >= 10
    assert jobs
    assert any(job["company"] == "ShopBack" for job in jobs)
    assert all(job["retrieval_score"] is not None for job in jobs)

    await client.close()


@pytest.mark.asyncio
async def test_qdrant_reranks_semantic_candidates_for_cv_skills():
    vector_size = 256
    settings = Settings(
        qdrant_enabled=True,
        qdrant_collection="test_market_job_cv_ranking",
        qdrant_embedding_provider="hashing",
        qdrant_vector_size=vector_size,
    )
    client = AsyncQdrantClient(location=":memory:")
    service = MarketJobRAGService(
        settings=settings,
        client=client,
        embedder=HashingEmbeddingProvider(vector_size),
    )
    await service.sync_catalog()

    jobs, _total = await service.search(
        query="backend API",
        cv_text="Python FastAPI JavaScript REST API",
        parsed_cv={"skills": ["Python", "FastAPI", "JavaScript"], "projects": [{"name": "API"}]},
        limit=20,
    )

    scores = [job["match_score"] for job in jobs]
    assert scores == sorted(scores, reverse=True)
    assert any(job["matched_skills"] for job in jobs)

    await client.close()
