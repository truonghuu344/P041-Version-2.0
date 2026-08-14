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
    # SQL echo can leak CV/JD content and raises UnicodeEncodeError on Windows
    # consoles whose legacy code page cannot represent Vietnamese text.
    "echo": settings.database_echo,
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
        if settings.app_env == "production":
            if not settings.initial_admin_password:
                raise RuntimeError("INITIAL_ADMIN_PASSWORD is required in production.")
            if len(settings.secret_key) < 32 or settings.secret_key == "super-secret-jwt-key-ai20k-p041-career-assistant":
                raise RuntimeError("A unique SECRET_KEY of at least 32 characters is required in production.")
            if settings.cors_origins.strip() == "*":
                raise RuntimeError("CORS_ORIGINS must be explicit in production.")
        # Import models trước create_all để Base.metadata luôn có đủ bảng, kể cả
        # khi init_db được gọi độc lập ngoài luồng import API router.
        from src.db.models import User

        async with engine.begin() as conn:
            if conn.dialect.name == "postgresql":
                await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            await conn.run_sync(Base.metadata.create_all)
            if conn.dialect.name == "postgresql":
                await conn.execute(
                    text(
                        "ALTER TABLE job_descriptions "
                        "ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT FALSE"
                    )
                )
                await conn.execute(
                    text("UPDATE job_descriptions SET is_published = TRUE WHERE is_system = TRUE")
                )
                await conn.execute(text("ALTER TABLE cv_chunks ADD COLUMN IF NOT EXISTS embedding_model VARCHAR(255)"))
                await conn.execute(text("ALTER TABLE cv_chunks ADD COLUMN IF NOT EXISTS embedding_json JSON"))
                for statement in (
                    "ALTER TABLE cv_analyses ADD COLUMN IF NOT EXISTS cv_snapshot_id VARCHAR(36)",
                    "ALTER TABLE cv_analyses ADD COLUMN IF NOT EXISTS jd_snapshot_id VARCHAR(36)",
                    "ALTER TABLE cv_analyses ADD COLUMN IF NOT EXISTS pipeline_version VARCHAR(40) NOT NULL DEFAULT '1.0'",
                    "ALTER TABLE matches ADD COLUMN IF NOT EXISTS cv_snapshot_id VARCHAR(36)",
                    "ALTER TABLE matches ADD COLUMN IF NOT EXISTS jd_snapshot_id VARCHAR(36)",
                    "ALTER TABLE matches ADD COLUMN IF NOT EXISTS pipeline_version VARCHAR(40) NOT NULL DEFAULT '1.0'",
                    "ALTER TABLE matches ADD COLUMN IF NOT EXISTS pipeline_config_json JSON",
                    "ALTER TABLE cv_snapshots ADD COLUMN IF NOT EXISTS raw_text TEXT NOT NULL DEFAULT ''",
                    "ALTER TABLE cv_snapshots ADD COLUMN IF NOT EXISTS pages_json JSON",
                    "ALTER TABLE jd_snapshots ADD COLUMN IF NOT EXISTS raw_text TEXT NOT NULL DEFAULT ''",
                    "ALTER TABLE jd_snapshots ADD COLUMN IF NOT EXISTS pages_json JSON",
                    "ALTER TABLE documents ADD COLUMN IF NOT EXISTS source_snapshot_id VARCHAR(36)",
                    "ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS cv_snapshot_id VARCHAR(36)",
                    "ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS jd_snapshot_id VARCHAR(36)",
                    "ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS match_id VARCHAR(64)",
                    "ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS language VARCHAR(16) NOT NULL DEFAULT 'vi'",
                    "ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS mode VARCHAR(16) NOT NULL DEFAULT 'text'",
                ):
                    await conn.execute(text(statement))
            # create_all không thêm index mới vào bảng đã tồn tại. Lệnh này
            # bảo vệ invariant một-admin cho cả PostgreSQL và SQLite.
            await conn.execute(
                text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS uq_users_single_admin "
                    "ON users (role) WHERE role = 'admin'"
                )
            )
        logger.info("Database tables initialized successfully.")

        # Seed the system administrator. Production deployments should provide
        # INITIAL_ADMIN_PASSWORD through the environment.
        async with AsyncSessionLocal() as session:
            from sqlalchemy import select

            from src.core.security import get_password_hash

            admin_email = "admin@cva.com"
            stmt = select(User).where(User.role == "admin")
            res = await session.execute(stmt)
            existing_admin = res.scalar_one_or_none()

            admin_password = settings.initial_admin_password or "admin123"

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
                    hashed_password=get_password_hash(admin_password),
                    full_name="System Administrator",
                    role="admin",
                )
                session.add(admin_user)
                await session.commit()
                logger.info("System Admin user seeded successfully.")
            elif settings.initial_admin_password:
                # Keep an explicitly configured deployment secret authoritative,
                # including for databases seeded by an earlier version.
                existing_admin.hashed_password = get_password_hash(settings.initial_admin_password)
                await session.commit()
                logger.info("System Admin password synchronized from environment.")
    except Exception:
        logger.exception("Database initialization failed; application startup aborted")
        raise
