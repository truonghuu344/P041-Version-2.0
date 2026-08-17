from src.db.database import normalize_database_url


def test_normalize_database_url_postgresql_simple():
    raw = "postgresql://user:pass@localhost:5432/mydb"
    expected = "postgresql+asyncpg://user:pass@localhost:5432/mydb"
    assert normalize_database_url(raw) == expected


def test_normalize_database_url_sqlite():
    raw = "sqlite:///./test.db"
    expected = "sqlite+aiosqlite:///./test.db"
    assert normalize_database_url(raw) == expected


def test_normalize_database_url_strips_channel_binding():
    raw = "postgresql://user:pass@ep-test.neon.tech/neondb?sslmode=require&channel_binding=disable"
    normalized = normalize_database_url(raw)
    assert "channel_binding" not in normalized
    assert "ssl=require" in normalized
    assert normalized.startswith("postgresql+asyncpg://")


def test_normalize_database_url_preserves_other_params():
    raw = "postgresql://user:pass@ep-test.neon.tech/neondb?sslmode=require&channel_binding=prefer&gssencmode=disable&target_session_attrs=read-write"
    normalized = normalize_database_url(raw)
    assert "channel_binding" not in normalized
    assert "gssencmode" not in normalized
    assert "target_session_attrs" not in normalized
    assert "ssl=require" in normalized
