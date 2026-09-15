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


# ── Điều tiết token cho embedding Gemini ────────────────────────────────────
#
# Trần của Gemini Embedding là TOKEN/phút (30.000 ở free tier), không phải
# request/phút. Nhúng cả catalog JD tốn ~68.000 token — gấp hơn hai lần trần
# một phút. Thiếu điều tiết là ăn 429 giữa chừng và hỏng cả mẻ đồng bộ.


def test_uoc_luong_token_luon_thua_khong_bao_gio_thieu():
    """Ước thiếu token là vượt trần rồi 429; ước thừa chỉ chậm hơn chút.

    Ba mốc dưới đo bằng `count_tokens` trên chính tài liệu JD của dự án:
    tỷ lệ thật dao động 3,6–5,1 ký tự/token tuỳ tài liệu.
    """
    from src.services.job_rag import _estimate_tokens

    for so_ky_tu, token_that in ((4685, 983), (2171, 602), (10198, 2006)):
        assert _estimate_tokens("x" * so_ky_tu) >= token_that


@pytest.mark.asyncio
async def test_bo_dieu_tiet_chan_khi_vuot_tran_trong_mot_phut():
    import asyncio

    from src.services.job_rag import _TokenRateLimiter

    lim = _TokenRateLimiter(1000)
    await asyncio.wait_for(lim.acquire(400), timeout=1)
    await asyncio.wait_for(lim.acquire(400), timeout=1)
    # 400 nữa là 1200 > 1000 → phải chặn lại, không được cho qua ngay.
    with pytest.raises(asyncio.TimeoutError):
        await asyncio.wait_for(lim.acquire(400), timeout=1)


@pytest.mark.asyncio
async def test_tai_lieu_lon_hon_ca_tran_van_di_duoc():
    """Nếu không có lối thoát này, một JD dài bất thường sẽ treo vĩnh viễn."""
    import asyncio

    from src.services.job_rag import _TokenRateLimiter

    lim = _TokenRateLimiter(100)
    await asyncio.wait_for(lim.acquire(5000), timeout=1)


@pytest.mark.asyncio
async def test_embed_documents_tra_dung_mot_vector_moi_tai_lieu():
    """Đây là lỗi đã làm đồng bộ vector chưa từng chạy được.

    `gemini-embedding-2` nhận `contents` là danh sách nhưng LUÔN chỉ trả về
    đúng 1 embedding — đã đo: gửi 10, 50, 100, 113 đều nhận 1. Cách gộp cũ khiến
    `zip(pending, vectors, strict=True)` trong `_sync_catalog_with` ném
    `ValueError: zip() argument 2 is shorter than argument 1`.
    """
    from src.services.job_rag import GeminiEmbeddingProvider

    provider = GeminiEmbeddingProvider.__new__(GeminiEmbeddingProvider)
    provider.name, provider.vector_size = "fake-embedding", 4
    from src.services.job_rag import EMBED_TOKENS_PER_MINUTE, _TokenRateLimiter

    provider._tokens = _TokenRateLimiter(EMBED_TOKENS_PER_MINUTE)

    da_goi: list[str] = []

    async def gia_lap(content: str) -> list[float]:
        da_goi.append(content)
        return [float(len(content))] * 4

    provider._embed = gia_lap

    vectors = await provider.embed_documents([f"tai lieu {i}" for i in range(7)])
    assert len(vectors) == 7, "phải có đúng một vector cho mỗi tài liệu"
    assert len(da_goi) == 7, "phải gọi embed riêng từng tài liệu, không gộp lô"
    assert all(len(v) == 4 for v in vectors)


@pytest.mark.asyncio
async def test_embed_query_cung_bi_dieu_tiet():
    """`embed_query` gọi thẳng `_embed`; nếu điều tiết đặt ở tầng gọi thì truy
    vấn sẽ lách qua và âm thầm cộng dồn vào trần chung."""
    import inspect

    from src.services.job_rag import GeminiEmbeddingProvider

    nguon = inspect.getsource(GeminiEmbeddingProvider._embed)
    assert "_tokens.acquire" in nguon, (
        "điều tiết token phải nằm trong _embed để mọi đường gọi đều được tính"
    )
