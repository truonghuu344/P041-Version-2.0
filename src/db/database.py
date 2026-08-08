import os
import logging
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool

from src.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

db_url = settings.database_url

if db_url.startswith("postgresql://"):
    db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
elif db_url.startswith("sqlite://"):
    db_url = db_url.replace("sqlite://", "sqlite+aiosqlite://", 1)

# Sử dụng NullPool khi chạy test để không giữ connection trong pool
engine_kwargs = {
    "echo": (settings.app_env == "development"),
    "future": True,
}
if settings.app_env == "testing" or "pytest" in os.environ.get("_", ""):
    engine_kwargs["poolclass"] = NullPool

engine = create_async_engine(db_url, **engine_kwargs)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

class Base(DeclarativeBase):
    pass

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency cung cấp AsyncSession cho FastAPI routes."""
    session = AsyncSessionLocal()
    try:
        yield session
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()

async def init_db() -> None:
    """Tự động khởi tạo cấu trúc bảng trong Database & seed tài khoản Admin."""
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables initialized successfully.")

        # Seed default admin user admin@cva.com / admin123
        async with AsyncSessionLocal() as session:
            from sqlalchemy import select
            from src.db.models import User
            from src.core.security import get_password_hash

            admin_email = "admin@cva.com"
            stmt = select(User).where(User.email == admin_email)
            res = await session.execute(stmt)
            existing_admin = res.scalar_one_or_none()

            if not existing_admin:
                admin_user = User(
                    email=admin_email,
                    hashed_password=get_password_hash("admin123"),
                    full_name="System Administrator",
                    role="admin",
                )
                session.add(admin_user)
                await session.commit()
                logger.info("Default Admin user (admin@cva.com) seeded successfully.")
    except Exception as e:
        logger.error(f"Database initialization error: {e}")