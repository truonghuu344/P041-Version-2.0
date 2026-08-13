import os
import tempfile
from collections.abc import AsyncGenerator
from pathlib import Path

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

# Import app và các thành phần liên quan từ dự án của bạn
# Evals/tests must remain offline and reproducible even when a developer has a Gemini key in .env.
os.environ["CV_JD_EMBEDDING_PROVIDER"] = "hashing"
os.environ["MALWARE_SCAN_MODE"] = "disabled"
os.environ["GEMINI_API_KEY"] = ""
os.environ["GOOGLE_API_KEY"] = ""
os.environ["MAX_REQUEST_BODY_MB"] = "22"

from src.db.database import Base, get_db
from src.main import app

# Tuyệt đối không dùng DATABASE_URL của development/production trong test.
# SQLite in-memory cô lập hoàn toàn nên drop_all không thể xóa dữ liệu người dùng.
test_engine = create_async_engine(
    "sqlite+aiosqlite://",
    poolclass=StaticPool,
    echo=False,
)

TestingSessionLocal = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


def pytest_configure(config):
    """Đặt thư mục tmp_path ngoài repository để ACL sandbox không chặn Git."""
    has_explicit_basetemp = any(
        str(argument).startswith("--basetemp")
        for argument in config.invocation_params.args
    )
    if not has_explicit_basetemp:
        import uuid
        config.option.basetemp = str(Path(tempfile.gettempdir()) / f"p041-pytest-{uuid.uuid4().hex[:8]}")


@pytest_asyncio.fixture(scope="session", autouse=True)
async def dispose_test_database_engine():
    yield
    await test_engine.dispose()


@pytest_asyncio.fixture(scope="function", autouse=True)
async def setup_database():
    """Tự động tạo bảng sạch trước mỗi test case và dọn dẹp sau khi test xong."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

@pytest_asyncio.fixture(scope="function")
async def client() -> AsyncGenerator[AsyncClient, None]:
    """Cấp phát AsyncClient với get_db đã được override độc lập cho từng request."""
    async def _override_get_db():
        async with TestingSessionLocal() as session:
            yield session

    app.dependency_overrides[get_db] = _override_get_db

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        yield ac

    app.dependency_overrides.clear()
