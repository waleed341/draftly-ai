import shutil
from pathlib import Path

from sqlalchemy.engine import URL, make_url
from sqlalchemy.ext.asyncio import (
    AsyncConnection,
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.db.base import Base


def build_engine(url: str) -> AsyncEngine:
    return create_async_engine(url, future=True)


def build_session_factory(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(engine, expire_on_commit=False, autoflush=False)


async def create_schema(engine: AsyncEngine) -> None:
    import app.models  # noqa: F401  (registers the tables)

    legacy_schema = False
    if engine.url.get_backend_name() == "sqlite":
        async with engine.connect() as conn:
            columns = await conn.exec_driver_sql("PRAGMA table_info(drafts)")
            id_column = next((row for row in columns if row[1] == "id"), None)
            legacy_schema = bool(id_column and "CHAR" in str(id_column[2]).upper())

    if engine.url.get_backend_name() == "sqlite":
        _backup_legacy_database(engine.url)
    async with engine.begin() as conn:
        if legacy_schema:
            await _migrate_legacy_schema(conn)
    await _upgrade_alembic(engine)


async def _upgrade_alembic(engine: AsyncEngine) -> None:
    from alembic import command
    from alembic.config import Config

    config = Config(str(Path(__file__).resolve().parents[2] / "alembic.ini"))

    def upgrade(connection) -> None:
        config.attributes["connection"] = connection
        command.upgrade(config, "head")

    async with engine.connect() as connection:
        await connection.run_sync(upgrade)


def _backup_legacy_database(database_url: str | URL) -> None:
    database = make_url(database_url).database
    if not database or database == ":memory:":
        return

    path = Path(database).resolve()
    if not path.is_file():
        return

    backup = path.with_name(f"{path.name}.pre-draftly-v1.bak")
    if not backup.exists():
        shutil.copy2(path, backup)


async def _migrate_legacy_schema(conn: AsyncConnection) -> None:
    """Copy drafts from the earlier UUID schema into the versioned integer schema."""
    await conn.exec_driver_sql("ALTER TABLE draft_versions RENAME TO draft_versions_legacy")
    await conn.exec_driver_sql("ALTER TABLE drafts RENAME TO drafts_legacy")
    await conn.exec_driver_sql("DROP INDEX IF EXISTS ix_draft_versions_draft_id")
    await conn.run_sync(Base.metadata.create_all)
    await conn.exec_driver_sql(
        """
        CREATE TEMP TABLE draft_id_map AS
        SELECT id AS old_id, ROW_NUMBER() OVER (ORDER BY created_at, id) AS new_id
        FROM drafts_legacy
        """
    )
    await conn.exec_driver_sql(
        """
        INSERT INTO drafts (id, idea, kind, tone, length, time_zone, status, created_at, updated_at, approved_at)
        SELECT id_map.new_id, drafts.idea, 'new', 'professional', 'medium', drafts.timezone,
               CASE drafts.status WHEN 'writing' THEN 'failed' ELSE drafts.status END,
               drafts.created_at, drafts.updated_at, NULL
        FROM drafts_legacy AS drafts
        JOIN draft_id_map AS id_map ON id_map.old_id = drafts.id
        """
    )
    await conn.exec_driver_sql(
        """
        INSERT INTO draft_versions (draft_id, number, subject, body, source, note, created_at)
        SELECT id_map.new_id, versions.number, versions.subject, versions.body,
               CASE versions.source WHEN 'generated' THEN 'written' ELSE versions.source END,
               NULL, versions.created_at
        FROM draft_versions_legacy AS versions
        JOIN draft_id_map AS id_map ON id_map.old_id = versions.draft_id
        """
    )
    await conn.exec_driver_sql("DROP TABLE draft_id_map")
    await conn.exec_driver_sql("DROP TABLE draft_versions_legacy")
    await conn.exec_driver_sql("DROP TABLE drafts_legacy")
