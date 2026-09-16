"""Cache embedding phải sống sót qua khởi động lại và không được phình vô hạn.

Trước đây cache ghi ra `data/cache/embedding_vectors.json`. Trên nền tảng có hệ
thống file phù du (Render gói free) file đó biến mất mỗi lần restart, nên cùng
một đoạn CV bị nhúng lại và tốn quota. Nó cũng không có trần nào: một dict cấp
module phình mãi, mỗi vector 768 chiều chiếm hàng chục KB.

Test ở đây khoá lại ba tính chất: vòng tròn ghi-nạp, trần kích thước, và việc
trúng cache thì KHÔNG gọi nhà cung cấp trả phí.
"""

from __future__ import annotations

import pytest
import pytest_asyncio

from src.services import cv_jd_pipeline as pipeline
from tests.conftest import TestingSessionLocal


@pytest_asyncio.fixture
async def db_session():
    """Phiên DB dùng chung engine test mà `setup_database` đã dựng bảng sẵn."""
    async with TestingSessionLocal() as session:
        yield session


@pytest.fixture(autouse=True)
def _clean_cache():
    """Mỗi test bắt đầu từ cache rỗng — trạng thái cấp module dễ rò rỉ sang nhau."""
    pipeline._EMBEDDING_CACHE.clear()
    pipeline._PENDING_CACHE_WRITES.clear()
    yield
    pipeline._EMBEDDING_CACHE.clear()
    pipeline._PENDING_CACHE_WRITES.clear()


def _key(dimensions: int, suffix: str) -> str:
    return f"gemini-embedding-2:{dimensions}:{'a' * 60}{suffix}"


def test_vector_tra_phi_duoc_xep_hang_ghi_xuong_db():
    pipeline._remember_embedding(_key(4, "01"), {0: 1.0, 2: 0.5}, persist=True)

    assert _key(4, "01") in pipeline._EMBEDDING_CACHE
    assert _key(4, "01") in pipeline._PENDING_CACHE_WRITES


def test_vector_hashing_khong_ghi_xuong_db():
    """Hashing thuần CPU: tính lại rẻ hơn một vòng truy vấn DB."""
    pipeline._remember_embedding(_key(4, "02"), {1: 1.0}, persist=False)

    assert _key(4, "02") in pipeline._EMBEDDING_CACHE
    assert pipeline._PENDING_CACHE_WRITES == {}


def test_cache_khong_vuot_qua_tran(monkeypatch):
    monkeypatch.setattr(pipeline, "_MAX_CACHE_ENTRIES", 3)

    for index in range(6):
        pipeline._remember_embedding(_key(4, f"{index:02d}"), {0: float(index)}, persist=False)

    assert len(pipeline._EMBEDDING_CACHE) == 3
    # Giữ ba mục vào sau cùng, loại ba mục vào sớm nhất.
    assert _key(4, "00") not in pipeline._EMBEDDING_CACHE
    assert _key(4, "05") in pipeline._EMBEDDING_CACHE


def test_ghi_de_muc_da_co_khong_lam_phinh_cache(monkeypatch):
    monkeypatch.setattr(pipeline, "_MAX_CACHE_ENTRIES", 2)

    pipeline._remember_embedding(_key(4, "aa"), {0: 1.0}, persist=False)
    pipeline._remember_embedding(_key(4, "bb"), {0: 2.0}, persist=False)
    pipeline._remember_embedding(_key(4, "aa"), {0: 9.0}, persist=False)

    assert len(pipeline._EMBEDDING_CACHE) == 2
    assert pipeline._EMBEDDING_CACHE[_key(4, "aa")] == {0: 9.0}


@pytest.mark.asyncio
async def test_vong_tron_ghi_roi_nap_lai_qua_db(db_session):
    """Ghi xuống DB rồi xoá RAM rồi nạp lại — phải ra đúng vector cũ."""
    cache_key = _key(4, "rt")
    pipeline._remember_embedding(cache_key, {0: 1.0, 3: -0.5}, persist=True)

    written = await pipeline.flush_embedding_cache(db_session)
    assert written == 1
    assert pipeline._PENDING_CACHE_WRITES == {}

    pipeline._EMBEDDING_CACHE.clear()
    loaded = await pipeline.load_embedding_cache(db_session)

    assert loaded == 1
    # Chiều bằng 0 bị bỏ khi dựng lại dict thưa, đúng như lúc tạo.
    assert pipeline._EMBEDDING_CACHE[cache_key] == {0: 1.0, 3: -0.5}


@pytest.mark.asyncio
async def test_khong_co_gi_moi_thi_khong_cham_db(db_session):
    assert await pipeline.flush_embedding_cache(db_session) == 0


@pytest.mark.asyncio
async def test_khoa_sai_dinh_dang_bi_bo_qua_chu_khong_no(db_session):
    """Khoá không đọc được số chiều thì bỏ, không ghi một vector cụt."""
    pipeline._PENDING_CACHE_WRITES["khoa-hong"] = {0: 1.0}

    assert await pipeline.flush_embedding_cache(db_session) == 0
    assert pipeline._PENDING_CACHE_WRITES == {}


def test_trung_cache_thi_khong_goi_nha_cung_cap(monkeypatch):
    """Tính chất quan trọng nhất: trúng cache phải cắt hẳn lời gọi API."""

    class _NoCallClient:
        class models:  # noqa: N801 - bắt chước hình dạng client của google-genai
            @staticmethod
            def embed_content(**_kwargs):
                raise AssertionError("Đã trúng cache mà vẫn gọi nhà cung cấp trả phí")

    service = pipeline.GeminiEmbeddingService.__new__(pipeline.GeminiEmbeddingService)
    service.dimensions = 4
    service.name = "gemini-embedding-2"
    service._client = _NoCallClient()

    text = "kỹ sư backend Python"
    import hashlib

    cache_key = f"{service.name}:{service.dimensions}:{hashlib.sha256(text.encode()).hexdigest()}"
    pipeline._remember_embedding(cache_key, {0: 1.0}, persist=False)

    assert service.embed_batch([text]) == [{0: 1.0}]
