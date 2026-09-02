from src.db.migration_runner import discover_migrations


def test_discover_migrations_orders_files_and_hashes_contents(tmp_path):
    (tmp_path / "20260823_02_second.sql").write_text("SELECT 2;", encoding="utf-8")
    (tmp_path / "20260823_01_first.sql").write_text("SELECT 1;", encoding="utf-8")

    migrations = discover_migrations(tmp_path)

    assert [migration.filename for migration in migrations] == [
        "20260823_01_first.sql",
        "20260823_02_second.sql",
    ]
    assert migrations[0].checksum != migrations[1].checksum


def test_discover_migrations_rejects_empty_file(tmp_path):
    (tmp_path / "20260823_01_empty.sql").write_text(" \n", encoding="utf-8")

    try:
        discover_migrations(tmp_path)
    except RuntimeError as exc:
        assert "empty" in str(exc).lower()
    else:
        raise AssertionError("Expected empty migrations to be rejected")
