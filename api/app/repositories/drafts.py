from collections.abc import Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.enums import DraftStatus
from app.domain.time import utcnow
from app.models import Draft, DraftVersion


class DraftRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get(self, draft_id: int, user_id: int) -> Draft | None:
        return await self._session.scalar(
            select(Draft).where(Draft.id == draft_id, Draft.user_id == user_id).with_for_update()
        )

    async def list_recent(self, limit: int, user_id: int) -> Sequence[Draft]:
        result = await self._session.execute(
            select(Draft).where(Draft.user_id == user_id).order_by(Draft.updated_at.desc(), Draft.id.desc()).limit(limit)
        )
        return result.scalars().all()

    async def count_by_status(self, user_id: int) -> dict[str, int]:
        result = await self._session.execute(select(Draft.status, func.count()).where(Draft.user_id == user_id).group_by(Draft.status))
        return {status: count for status, count in result.all()}

    async def add(self, *, user_id: int, idea: str, kind: str, tone: str, length: str, time_zone: str) -> Draft:
        draft = Draft(
            user_id=user_id, idea=idea, kind=kind, tone=tone, length=length, time_zone=time_zone,
            status=DraftStatus.WRITING, versions=[],
        )
        self._session.add(draft)
        await self._session.flush()
        return draft

    def add_version(
        self, draft: Draft, *, subject: str, body: str, source: str, note: str | None = None
    ) -> DraftVersion:
        version = DraftVersion(
            number=len(draft.versions) + 1, subject=subject, body=body, source=source, note=note
        )
        draft.versions.append(version)
        self.touch(draft)
        return version

    def set_status(self, draft: Draft, status: DraftStatus) -> None:
        draft.status = status
        draft.approved_at = utcnow() if status == DraftStatus.APPROVED else None
        self.touch(draft)

    def touch(self, draft: Draft) -> None:
        draft.updated_at = utcnow()

    async def delete(self, draft: Draft) -> None:
        await self._session.delete(draft)
