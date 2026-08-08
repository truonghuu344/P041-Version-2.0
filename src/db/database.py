import logging
import os
from collections.abc import AsyncGenerator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
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
        # Import models trước create_all để Base.metadata luôn có đủ bảng, kể cả
        # khi init_db được gọi độc lập ngoài luồng import API router.
        from src.db.models import User

        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            # create_all không thêm index mới vào bảng đã tồn tại. Lệnh này
            # bảo vệ invariant một-admin cho cả PostgreSQL và SQLite.
            await conn.execute(
                text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS uq_users_single_admin "
                    "ON users (role) WHERE role = 'admin'"
                )
            )
        logger.info("Database tables initialized successfully.")

        # Seed default admin user admin@cva.com / admin123
        async with AsyncSessionLocal() as session:
            from sqlalchemy import select

            from src.core.security import get_password_hash

            admin_email = "admin@cva.com"
            stmt = select(User).where(User.role == "admin")
            res = await session.execute(stmt)
            existing_admin = res.scalar_one_or_none()

            if not existing_admin:
                email_result = await session.execute(select(User).where(User.email == admin_email))
                admin_user = email_result.scalar_one_or_none()
                if admin_user:
                    raise RuntimeError(
                        "Cannot seed the system Admin: admin@cva.com already belongs "
                        "to a non-admin account. Resolve the account explicitly."
                    )
                admin_user = User(
                    email=admin_email,
                    hashed_password=get_password_hash("admin123"),
                    full_name="System Administrator",
                    role="admin",
                )
                session.add(admin_user)
                await session.commit()
                logger.info("Default Admin user (admin@cva.com) seeded successfully.")
    except Exception:
        logger.exception("Database initialization failed; application startup aborted")
        raise
