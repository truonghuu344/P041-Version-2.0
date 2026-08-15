from __future__ import annotations

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from src.config import Settings
from src.db.database import Base
from src.services.job_rag import HashingEmbeddingProvider, JobRAGUnavailableError, MarketJobRAGService


class UnavailableEmbeddingProvider:
    name = "unavailable-test-provider"

    def __init__(self, vector_size: int) -> None:
        self.vector_size = vector_size

    async def embed_documents(self, _texts):
        raise JobRAGUnavailableError("test provider unavailable")

    async def embed_query(self, _text):
        raise JobRAGUnavailableError("test provider unavailable")


@pytest.fixture
async def rag_service():
    vector_size = 256
    engine = create_async_engine("sqlite+aiosqlite://")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    service = MarketJobRAGService(
        settings=Settings(
            vector_search_enabled=True,
            vector_embedding_provider="hashing",
            vector_dimensions=vector_size,
            vector_auto_sync=True,
        ),
        embedder=HashingEmbeddingProvider(vector_size),
        session_factory=async_sessionmaker(engine, expire_on_commit=False),
    )
    yield service
    await engine.dispose()


@pytest.mark.asyncio
async def test_pgvector_market_jd_sync_is_incremental_and_searchable(rag_service):
    first_sync = await rag_service.sync_catalog()
    second_sync = await rag_service.sync_catalog()

    assert first_sync["indexed"] == 98
    assert first_sync["unchanged"] == 0
    assert first_sync["deleted"] == 0
    assert first_sync["collection"] == "market_job_embeddings"
    assert second_sync["indexed"] == 0
    assert second_sync["unchanged"] == 98

    jobs, total = await rag_service.search(query="ShopBack", cv_text=None, parsed_cv={}, limit=10)

    assert total >= 10
    assert any(job["company"] == "ShopBack" for job in jobs)
    assert all(job["retrieval_score"] is not None for job in jobs)


@pytest.mark.asyncio
async def test_pgvector_reranks_semantic_candidates_for_cv_skills(rag_service):
    await rag_service.sync_catalog()
    jobs, _total = await rag_service.search(
        query="backend API",
        cv_text="Python FastAPI JavaScript REST API",
        parsed_cv={"skills": ["Python", "FastAPI", "JavaScript"], "projects": [{"name": "API"}]},
        limit=20,
    )

    scores = [job["match_score"] for job in jobs]
    assert scores == sorted(scores, reverse=True)
    assert any(job["matched_skills"] for job in jobs)


@pytest.mark.asyncio
async def test_auto_provider_falls_back_to_hashing_when_remote_embedding_is_unavailable():
    vector_size = 256
    engine = create_async_engine("sqlite+aiosqlite://")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    service = MarketJobRAGService(
        settings=Settings(
            vector_search_enabled=True,
            vector_embedding_provider="auto",
            vector_dimensions=vector_size,
            vector_auto_sync=True,
        ),
        embedder=UnavailableEmbeddingProvider(vector_size),
        session_factory=async_sessionmaker(engine, expire_on_commit=False),
    )

    try:
        result = await service.sync_catalog()
        assert result["indexed"] == 98
        assert result["embedding_provider"] == "hashing-v1"
        assert isinstance(service._get_embedder(), HashingEmbeddingProvider)
    finally:
        await engine.dispose()
