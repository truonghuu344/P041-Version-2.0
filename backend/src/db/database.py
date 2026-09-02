import logging
import os
import urllib.parse
from collections.abc import AsyncGenerator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool

from src.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


def normalize_database_url(url: str) -> str:
    """Normalize DATABASE_URL for SQLAlchemy async drivers (asyncpg, aiosqlite).

    - Converts sync driver prefixes to async variants.
    - Maps libpq's `sslmode` to asyncpg's `ssl`.
    - Strips parameters unsupported by asyncpg.connect (e.g. `channel_binding`,
      `gssencmode`, `target_session_attrs`).
    """
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    elif url.startswith("sqlite://"):
        url = url.replace("sqlite://", "sqlite+aiosqlite://", 1)

    if url.startswith("postgresql+asyncpg://"):
        parsed = urllib.parse.urlparse(url)
        if parsed.query:
            query_params = urllib.parse.parse_qs(parsed.query, keep_blank_values=True)
            # asyncpg accepts `ssl` query parameter (e.g. ssl=require), not `sslmode`
            if "sslmode" in query_params:
                sslmode_val = query_params.pop("sslmode")[0]
                if "ssl" not in query_params:
                    query_params["ssl"] = [sslmode_val]
            # Strip libpq-specific parameters unsupported by asyncpg
            for unsupported in ("channel_binding", "gssencmode", "target_session_attrs"):
                query_params.pop(unsupported, None)

            new_query = urllib.parse.urlencode(
                [(k, v) for k, values in query_params.items() for v in values]
            )
            parsed = parsed._replace(query=new_query)
            url = urllib.parse.urlunparse(parsed)

    return url


db_url = normalize_database_url(settings.database_url)

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
                await conn.execute(text("ALTER TABLE job_descriptions ADD COLUMN IF NOT EXISTS file_path VARCHAR(500)"))
                await conn.execute(
                    text("UPDATE job_descriptions SET is_published = TRUE WHERE is_system = TRUE")
                )
                await conn.execute(text("ALTER TABLE cv_chunks ADD COLUMN IF NOT EXISTS embedding_model VARCHAR(255)"))
                await conn.execute(text("ALTER TABLE cv_chunks ADD COLUMN IF NOT EXISTS embedding_json JSON"))
                for statement in (
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500)",
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50)",
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS major VARCHAR(255)",
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS university VARCHAR(255)",
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS cohort VARCHAR(100)",
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS gpa VARCHAR(20)",
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS target_role VARCHAR(255)",
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS skills_json JSON",
                    "ALTER TABLE cvs ADD COLUMN IF NOT EXISTS cv_status VARCHAR(30) NOT NULL DEFAULT 'pending'",
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
                    # Candidate application source (migration 20260822_08). Existing
                    # rows are direct student applications.
                    "ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS source VARCHAR(30) NOT NULL DEFAULT 'self'",
                    "ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS referred_by_counselor_id VARCHAR(36)",
                    "UPDATE job_applications SET source = 'self' WHERE source IS NULL",
                    # Admin verification workflow (migration 20260823_09). Existing
                    # enterprise profiles enter the review queue as pending.
                    "ALTER TABLE enterprise_profiles ADD COLUMN IF NOT EXISTS verification_status VARCHAR(30) NOT NULL DEFAULT 'pending'",
                    "ALTER TABLE enterprise_profiles ADD COLUMN IF NOT EXISTS verification_note TEXT",
                    "ALTER TABLE enterprise_profiles ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ",
                    "UPDATE enterprise_profiles SET verification_status = 'pending' WHERE verification_status IS NULL",
                    "CREATE INDEX IF NOT EXISTS ix_enterprise_profiles_verification_status ON enterprise_profiles (verification_status)",
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
            # Persistent Gap Analysis cache lookup: same user + immutable CV/JD
            # snapshots + pipeline version. Safe for both PostgreSQL and SQLite.
            await conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_cv_analyses_snapshot_cache "
                    "ON cv_analyses (user_id, cv_snapshot_id, jd_snapshot_id, pipeline_version, created_at DESC)"
                )
            )
            await conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_job_recommendation_runs_cache "
                    "ON job_recommendation_runs (user_id, cv_snapshot_id, trace_id, status, completed_at DESC)"
                )
            )
            # Một snapshot cho mỗi (nguồn, nội dung). create_all() tạo index
            # này cho database mới nhưng không thêm index vào bảng đã tồn tại.
            #
            # Là index UNIQUE nên nó sẽ fail trên database đã lỡ tích luỹ
            # snapshot trùng — dọn bằng
            # backend/migrations/20260823_10_uq_snapshot_source_hash.sql trước
            # khi khởi động. Safe cho cả PostgreSQL và SQLite.
            await conn.execute(
                text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS uq_cv_snapshot_source "
                    "ON cv_snapshots (cv_id, source_hash)"
                )
            )
            await conn.execute(
                text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS uq_jd_snapshot_source "
                    "ON jd_snapshots (jd_id, source_hash)"
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

            # Seed demo accounts if not existing
            demo_accounts = [
                ("counselor@cva.com", "counselor123", "Demo Counselor", "counselor"),
                ("student@cva.com", "student123", "Demo Student", "student"),
            ]
            for d_email, d_pass, d_name, d_role in demo_accounts:
                res_demo = await session.execute(select(User).where(User.email == d_email))
                if not res_demo.scalar_one_or_none():
                    session.add(
                        User(
                            email=d_email,
                            hashed_password=get_password_hash(d_pass),
                            full_name=d_name,
                            role=d_role,
                        )
                    )
                    await session.commit()
                    logger.info("Demo user seeded: %s (%s)", d_email, d_role)
    except Exception:
        logger.exception("Database initialization failed; application startup aborted")
        raise
