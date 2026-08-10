from io import StringIO

from alembic.config import Config
from alembic.operations import Operations
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory

from src.backend.db.models import Base


def test_migration_history_has_one_head() -> None:
    scripts = ScriptDirectory.from_config(Config("alembic.ini"))

    assert scripts.get_heads() == ["20260810_0001"]
    assert scripts.get_revision("20260810_0001").down_revision is None


def test_initial_migration_creates_and_drops_all_model_tables() -> None:
    scripts = ScriptDirectory.from_config(Config("alembic.ini"))
    migration = scripts.get_revision("20260810_0001").module

    upgrade_output = StringIO()
    upgrade_context = MigrationContext.configure(
        dialect_name="postgresql",
        opts={"as_sql": True, "output_buffer": upgrade_output},
    )
    migration.op = Operations(upgrade_context)
    migration.upgrade()

    upgrade_sql = upgrade_output.getvalue()
    for table_name in Base.metadata.tables:
        assert f"CREATE TABLE {table_name}" in upgrade_sql

    downgrade_output = StringIO()
    downgrade_context = MigrationContext.configure(
        dialect_name="postgresql",
        opts={"as_sql": True, "output_buffer": downgrade_output},
    )
    migration.op = Operations(downgrade_context)
    migration.downgrade()

    downgrade_sql = downgrade_output.getvalue()
    for table_name in Base.metadata.tables:
        assert f"DROP TABLE {table_name}" in downgrade_sql
