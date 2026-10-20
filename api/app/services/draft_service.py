import asyncio
import logging
import uuid
from collections.abc import AsyncIterator

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.agents.contracts import DraftWriter, TextDelta, ToolCalled, ToolReturned, WriteJob
from app.domain.time import safe_zone
from app.models import Draft
from app.repositories.drafts import DraftRepository
from app.schemas.drafts import DraftCreate
from app.services.mappers import draft_out
from app.services.parsing import parse_email
from app.services.safety import check_input, check_output

logger = logging.getLogger(__name__)


class DraftService:
    def __init__(self, sessions: async_sessionmaker, writer: DraftWriter):
        self.sessions = sessions
        self.writer = writer

    async def prepare_new(self, request: DraftCreate) -> str:
        check_input(request.idea)
        try:
            safe_zone(request.timezone)
        except ValueError as exc:
            raise HTTPException(422, "Please choose a valid time zone.") from exc
        draft_id = str(uuid.uuid4())
        async with self.sessions() as session:
            repo = DraftRepository(session)
            await repo.add(Draft(id=draft_id, idea=request.idea, timezone=request.timezone, status="writing"))
            await session.commit()
        return draft_id

    async def prepare_rewrite(self, draft_id: str, instruction: str | None = None) -> tuple[str, str, str]:
        async with self.sessions() as session:
            repo = DraftRepository(session)
            draft = await repo.get(draft_id)
            if not draft:
                raise HTTPException(404, "We couldn't find that draft.")
            if draft.status == "writing":
                raise HTTPException(409, "This draft is still being written.")
            request = instruction.strip() if instruction and instruction.strip() else draft.idea
            check_input(request)
            previous = f"SUBJECT: {draft.versions[-1].subject}\n---\n{draft.versions[-1].body}" if draft.versions else ""
            draft.status = "writing"
            await session.commit()
            return draft.timezone, request, previous

    async def _set_status(self, draft_id: str, status: str) -> None:
        async with self.sessions() as session:
            draft = await DraftRepository(session).get(draft_id)
            if draft:
                draft.status = status
                await session.commit()

    async def _interrupt(self, draft_id: str) -> None:
        async with self.sessions() as session:
            draft = await DraftRepository(session).get(draft_id)
            if draft:
                draft.status = "needs_review" if draft.versions else "failed"
                await session.commit()

    async def run(self, draft_id: str, timezone: str, idea: str, rewrite_from: str | None = None) -> AsyncIterator[dict[str, object]]:
        text = ""
        date_value = ""
        try:
            yield {"type": "started", "draft_id": draft_id}
            yield {"type": "step", "step": "understand", "state": "running"}
            check_input(idea)
            yield {"type": "step", "step": "understand", "state": "complete"}
            yield {"type": "step", "step": "date_check", "state": "running"}
            yield {"type": "step", "step": "writing", "state": "running"}
            async for item in self.writer.stream(WriteJob(idea=idea, timezone=timezone, rewrite_from=rewrite_from)):
                if isinstance(item, ToolCalled):
                    if text:
                        text = ""
                        yield {"type": "reset"}
                elif isinstance(item, ToolReturned):
                    if item.name == "get_today_date":
                        date_value = item.value
                        yield {"type": "date", "value": date_value}
                        yield {"type": "step", "step": "date_check", "state": "complete"}
                elif isinstance(item, TextDelta):
                    text += item.text
                    yield {"type": "token", "text": item.text}

            if not date_value:
                from app.domain.time import today_label
                date_value = today_label(safe_zone(timezone))
                yield {"type": "date", "value": date_value}
                yield {"type": "step", "step": "date_check", "state": "complete"}
            subject, body = parse_email(text)
            if date_value not in body:
                body = f"{body.rstrip()}\n\nDate: {date_value}".strip()
                text = f"SUBJECT: {subject}\n---\n{body}"
            yield {"type": "step", "step": "checking", "state": "running"}
            check_output(subject, body)
            yield {"type": "step", "step": "checking", "state": "complete"}
            async with self.sessions() as session:
                repo = DraftRepository(session)
                draft = await repo.get(draft_id)
                if not draft:
                    raise HTTPException(404, "We couldn't find that draft.")
                await repo.add_version(draft, subject, body, "rewrite" if rewrite_from else "generated")
                draft.status = "needs_review"
                await session.commit()
                await session.refresh(draft)
                result = draft_out(draft)
            yield {"type": "step", "step": "your_review", "state": "complete"}
            yield {"type": "ready", "draft": result}
        except asyncio.CancelledError:
            await asyncio.shield(self._interrupt(draft_id))
            raise
        except Exception as exc:
            logger.exception("Draft run failed", exc_info=exc)
            await self._interrupt(draft_id)
            message = "We couldn't finish that draft. Please try again."
            if isinstance(exc, HTTPException):
                message = str(exc.detail)
            yield {"type": "error", "message": message}
