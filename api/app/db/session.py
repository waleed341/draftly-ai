from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.db.base import Base


def make_session_factory(database_url: str):
    engine = create_async_engine(database_url, connect_args={"check_same_thread": False} if database_url.startswith("sqlite") else {})
    sessions = async_sessionmaker(engine, expire_on_commit=False)

    async def initialize() -> None:
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
            await connection.execute(text(
                "UPDATE drafts SET status='needs_review' WHERE status='writing' "
                "AND EXISTS (SELECT 1 FROM draft_versions WHERE draft_versions.draft_id=drafts.id)"
            ))
            await connection.execute(text("UPDATE drafts SET status='failed' WHERE status='writing'"))

    return engine, sessions, initialize
