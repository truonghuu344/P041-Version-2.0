"""Apply the non-destructive auth compatibility migration to the configured database."""

from sqlalchemy import create_engine, inspect, text

from src.backend.config import get_settings


def main() -> None:
    database_url = get_settings().database_url.replace("+asyncpg", "")
    engine = create_engine(database_url)
    try:
        with engine.begin() as connection:
            inspector = inspect(connection)
            if "users" not in inspector.get_table_names():
                raise RuntimeError("The users table does not exist; run the initial Alembic migration first")

            columns = {column["name"] for column in inspector.get_columns("users")}
            if "hashed_password" not in columns:
                if "password_hash" not in columns:
                    raise RuntimeError("The users table has no supported password hash column")
                connection.execute(text("ALTER TABLE users RENAME COLUMN password_hash TO hashed_password"))

            connection.execute(
                text("ALTER TABLE users ADD COLUMN IF NOT EXISTS google_subject VARCHAR(255)")
            )
            connection.execute(
                text("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE")
            )
            connection.execute(text("ALTER TABLE users ALTER COLUMN hashed_password DROP NOT NULL"))
            connection.execute(
                text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_google_subject "
                    "ON users (google_subject) WHERE google_subject IS NOT NULL"
                )
            )
    finally:
        engine.dispose()

    print("Auth schema migration completed")


if __name__ == "__main__":
    main()
