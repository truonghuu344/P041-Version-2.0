"""Versioned PostgreSQL migration runner used by the Docker release step.

Migration files are deliberately plain SQL so they remain reviewable and can be
run manually during incident recovery.  This runner records an SHA-256 checksum
per file and serializes deployments with a PostgreSQL advisory lock.
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

MIGRATIONS_DIR = Path("/app/migrations")
MIGRATION_TABLE = "schema_migrations"
# Stable application-specific lock ID. It prevents concurrent deploy instances
# from applying the same migration twice.
MIGRATION_LOCK_ID = 4_104_120_041


@dataclass(frozen=True)
class Migration:
    filename: str
    sql: str
    checksum: str


def discover_migrations(directory: Path = MIGRATIONS_DIR) -> list[Migration]:
    """Return SQL migrations in deterministic filename order."""
    if not directory.is_dir():
        raise RuntimeError(f"Migration directory does not exist: {directory}")

    migrations: list[Migration] = []
    for path in sorted(directory.glob("*.sql")):
        sql = path.read_text(encoding="utf-8")
        if not sql.strip():
            raise RuntimeError(f"Migration is empty: {path.name}")
        migrations.append(
            Migration(
                filename=path.name,
                sql=sql,
                checksum=hashlib.sha256(sql.encode("utf-8")).hexdigest(),
            )
        )
    return migrations


async def run_migrations(directory: Path = MIGRATIONS_DIR) -> int:
    """Apply unapplied migrations and return their count.

    A checksum mismatch is a hard failure: an already-applied migration must
    never be edited in place. Add a new migration instead.
    """
    from src.db.database import Base, engine

    migrations = discover_migrations(directory)
    async with engine.connect() as connection:
        if connection.dialect.name != "postgresql":
            raise RuntimeError("The deployment migration runner supports PostgreSQL only.")

        raw_connection = await connection.get_raw_connection()
        driver: Any = raw_connection.driver_connection
        await driver.execute(f"SELECT pg_advisory_lock({MIGRATION_LOCK_ID})")
        try:
            # A brand-new environment has no pre-migration schema for the SQL
            # files to alter. Bootstrap ORM tables first; existing databases
            # instead go directly through their versioned upgrades.
            has_users_table = await driver.fetchval("SELECT to_regclass('public.users') IS NOT NULL")
            if not has_users_table:
                from src.db import models  # noqa: F401 - registers all ORM tables

                # Keep SQLAlchemy's transaction separate from the raw asyncpg
                # session below: several legacy migrations contain BEGIN/COMMIT.
                async with engine.begin() as bootstrap_connection:
                    await bootstrap_connection.exec_driver_sql("CREATE EXTENSION IF NOT EXISTS vector")
                    await bootstrap_connection.run_sync(Base.metadata.create_all)
                logger.info("Bootstrapped schema for a new database.")

            await driver.execute(
                f"""
                CREATE TABLE IF NOT EXISTS {MIGRATION_TABLE} (
                    filename VARCHAR(255) PRIMARY KEY,
                    checksum CHAR(64) NOT NULL,
                    applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            applied_rows = await driver.fetch(f"SELECT filename, checksum FROM {MIGRATION_TABLE}")
            applied = {row["filename"]: row["checksum"] for row in applied_rows}

            for migration in migrations:
                recorded_checksum = applied.get(migration.filename)
                if recorded_checksum:
                    if recorded_checksum != migration.checksum:
                        raise RuntimeError(
                            f"Checksum mismatch for applied migration {migration.filename}. "
                            "Create a new migration; do not edit an existing one."
                        )
                    continue

                logger.info("Applying database migration %s", migration.filename)
                # Some migrations manage their own BEGIN/COMMIT because they
                # perform data repair. Execute the complete file as one server
                # command and write its record only after it succeeds.
                await driver.execute(migration.sql)
                await driver.execute(
                    f"INSERT INTO {MIGRATION_TABLE} (filename, checksum) VALUES ($1, $2)",
                    migration.filename,
                    migration.checksum,
                )
                applied[migration.filename] = migration.checksum
        finally:
            await driver.execute(f"SELECT pg_advisory_unlock({MIGRATION_LOCK_ID})")

    applied_count = sum(1 for migration in migrations if migration.filename in applied)
    logger.info("Database migrations are current (%s files tracked).", applied_count)
    return applied_count


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    asyncio.run(run_migrations())


if __name__ == "__main__":
    main()
