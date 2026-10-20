from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Draft, DraftVersion


class DraftRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get(self, draft_id: str) -> Draft | None:
        return await self.session.get(Draft, draft_id)

    async def list(self, limit: int = 50) -> list[Draft]:
        result = await self.session.scalars(select(Draft).order_by(Draft.updated_at.desc()).limit(limit))
        return list(result)

    async def add(self, draft: Draft) -> None:
        self.session.add(draft)
        await self.session.flush()

    async def add_version(self, draft: Draft, subject: str, body: str, source: str) -> DraftVersion:
        version = DraftVersion(draft_id=draft.id, number=len(draft.versions) + 1,
                               subject=subject, body=body, source=source)
        self.session.add(version)
        await self.session.flush()
        return version
