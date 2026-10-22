import asyncio
import json
import logging
from collections.abc import AsyncIterator, Callable
from dataclasses import dataclass

from sqlalchemy import select

from app.agents.contracts import (
    DATE_TOOL_NAME,
    DraftWriter,
    PreviousVersion,
    TextDelta,
    ToolCalled,
    ToolReturned,
    WriteJob,
)
from app.core.config import Settings
from app.core.errors import ConflictError, InvalidRequestError, NotFoundError
from app.domain.enums import DraftStatus, Step, StepState, VersionSource
from app.domain.time import safe_zone, today_label
from app.models import Draft, DraftApproval, GmailConnection, ScheduledEmail
from app.repositories.uow import UnitOfWork
from app.schemas.drafts import (
    CheckDraftResponse,
    CheckOut,
    CreateDraftRequest,
    DraftOut,
    DraftStats,
    DraftSummary,
    EditRequest,
    RewriteRequest,
)
from app.schemas.events import (
    DateEvent,
    ErrorEvent,
    ReadyEvent,
    ResetEvent,
    StartedEvent,
    StepEvent,
    StreamEvent,
    TokenEvent,
)
from app.services.audit import record_audit
from app.services.mappers import to_draft_out, to_summary
from app.services.parsing import parse_draft
from app.services.safety import SafetyService

log = logging.getLogger(__name__)

NOT_FOUND = "We couldn't find that draft. It may have been discarded."
STILL_WRITING = "Draftly is still writing this draft. Wait for it to finish or stop it first."


class EmptyDraftError(Exception):
    pass


class DiscardedError(Exception):
    pass


@dataclass(frozen=True, slots=True)
class PreparedRun:
    draft_id: int
    user_id: int
    job: WriteJob
    source: VersionSource
    note: str | None = None


class DraftService:
    def __init__(
        self,
        uow_factory: Callable[[], UnitOfWork],
        writer: DraftWriter,
        safety: SafetyService,
        settings: Settings,
    ) -> None:
        self._uow = uow_factory
        self._writer = writer
        self._safety = safety
        self._pace = settings.step_pacing_seconds

    # Reads

    async def list_recent(self, user_id: int, limit: int = 30) -> list[DraftSummary]:
        async with self._uow() as uow:
            return [to_summary(d) for d in await uow.drafts.list_recent(limit, user_id)]

    async def stats(self, user_id: int) -> DraftStats:
        async with self._uow() as uow:
            counts = await uow.drafts.count_by_status(user_id)
        return DraftStats(
            total=sum(counts.values()),
            needs_review=counts.get(DraftStatus.NEEDS_REVIEW, 0),
            approved=counts.get(DraftStatus.APPROVED, 0),
        )

    async def get(self, draft_id: int, user_id: int) -> DraftOut:
        async with self._uow() as uow:
            return to_draft_out(await self._require(uow, draft_id, user_id), self._safety)

    def check(self, subject: str, body: str) -> CheckDraftResponse:
        return CheckDraftResponse(
            checks=[CheckOut(key=c.key, label=c.label, passed=c.passed, message=c.message)
                    for c in self._safety.check_draft(subject, body)],
            blanks=self._safety.blanks(subject, body),
        )

    # Writing: validate and persist first, so errors become proper HTTP responses before any streaming.

    async def prepare_new(self, request: CreateDraftRequest, user_id: int) -> PreparedRun:
        self._safety.check_idea(request.idea)
        zone = safe_zone(request.time_zone).key
        async with self._uow() as uow:
            draft = await uow.drafts.add(
                user_id=user_id, idea=request.idea, kind=request.kind, tone=request.tone, length=request.length, time_zone=zone
            )
            await uow.commit()
        job = WriteJob(idea=request.idea, kind=request.kind, tone=request.tone, length=request.length,
                       time_zone=zone)
        return PreparedRun(draft_id=draft.id, user_id=user_id, job=job, source=VersionSource.WRITTEN)

    async def prepare_rewrite(self, draft_id: int, request: RewriteRequest, user_id: int) -> PreparedRun:
        instructions = (request.instructions or "").strip() or None
        if instructions:
            self._safety.check_idea(instructions)
        async with self._uow() as uow:
            draft = await self._require(uow, draft_id, user_id)
            if draft.status == DraftStatus.WRITING:
                raise ConflictError(STILL_WRITING, code="still_writing")
            latest = draft.latest
            if latest is None:
                raise ConflictError("There's nothing to rewrite yet. Start a new draft.", code="no_draft")
            await self._invalidate_pending_schedules(uow, draft, user_id)
            if request.tone:
                draft.tone = request.tone
            if request.length:
                draft.length = request.length
            uow.drafts.set_status(draft, DraftStatus.WRITING)
            await uow.commit()
            job = WriteJob(
                idea=draft.idea, kind=draft.kind, tone=draft.tone, length=draft.length,
                time_zone=draft.time_zone,
                previous=PreviousVersion(subject=latest.subject, body=latest.body), instructions=instructions,
            )
        return PreparedRun(draft_id=draft_id, user_id=user_id, job=job, source=VersionSource.REWRITE, note=instructions)

    async def run(self, prepared: PreparedRun) -> AsyncIterator[StreamEvent]:
        """Stream one writing run. Always ends with `ready` or `error`, unless the client goes away."""
        try:
            async for event in self._run(prepared):
                yield event
        except (asyncio.CancelledError, GeneratorExit):
            log.info("Draft %s: run interrupted by the client", prepared.draft_id)
            await asyncio.shield(self._interrupt(prepared.draft_id, prepared.user_id))
            raise
        except DiscardedError:
            yield ErrorEvent(message=NOT_FOUND)
        except Exception as exc:
            log.exception("Draft %s: run failed", prepared.draft_id)
            await self._interrupt(prepared.draft_id, prepared.user_id)
            yield ErrorEvent(message=_friendly(exc))

    async def _run(self, prepared: PreparedRun) -> AsyncIterator[StreamEvent]:
        job = prepared.job
        yield StartedEvent(draft_id=prepared.draft_id)
        yield StepEvent(step=Step.UNDERSTAND, state=StepState.ACTIVE)
        await self._pause()
        yield StepEvent(step=Step.UNDERSTAND, state=StepState.DONE)
        yield StepEvent(step=Step.DATE_CHECK, state=StepState.ACTIVE)

        parts: list[str] = []
        date_done = False
        writing = False
        async for event in self._writer.stream(job):
            match event:
                case ToolCalled():
                    if parts:  # chatter before the tool call is not part of the email
                        parts.clear()
                        yield ResetEvent()
                case ToolReturned(name=name) if name == DATE_TOOL_NAME and not date_done:
                    date_done = True
                    yield DateEvent(value=today_label(job.time_zone))
                    yield StepEvent(step=Step.DATE_CHECK, state=StepState.DONE)
                case TextDelta(text=text):
                    if not writing:
                        writing = True
                        yield StepEvent(step=Step.WRITING, state=StepState.ACTIVE)
                    parts.append(text)
                    yield TokenEvent(text=text)

        if not date_done:  # the model skipped the tool: the server's date is still right
            yield DateEvent(value=today_label(job.time_zone))
            yield StepEvent(step=Step.DATE_CHECK, state=StepState.DONE)
        if not writing:
            yield StepEvent(step=Step.WRITING, state=StepState.ACTIVE)
        yield StepEvent(step=Step.WRITING, state=StepState.DONE)
        yield StepEvent(step=Step.CHECKING, state=StepState.ACTIVE)
        await self._pause()

        subject, body = parse_draft("".join(parts))
        if not body:
            raise EmptyDraftError
        async with self._uow() as uow:
            draft = await uow.drafts.get(prepared.draft_id, prepared.user_id)
            if draft is None:
                raise DiscardedError
            uow.drafts.add_version(draft, subject=subject[:300], body=body, source=prepared.source,
                                   note=prepared.note)
            uow.drafts.set_status(draft, DraftStatus.NEEDS_REVIEW)
            await uow.commit()
            out = to_draft_out(draft, self._safety)

        yield StepEvent(step=Step.CHECKING, state=StepState.DONE)
        yield StepEvent(step=Step.REVIEW, state=StepState.ACTIVE)
        yield ReadyEvent(draft=out)

    async def _interrupt(self, draft_id: int, user_id: int) -> None:
        try:
            async with self._uow() as uow:
                draft = await uow.drafts.get(draft_id, user_id)
                if draft is not None and draft.status == DraftStatus.WRITING:
                    fallback = DraftStatus.NEEDS_REVIEW if draft.versions else DraftStatus.FAILED
                    uow.drafts.set_status(draft, fallback)
                    await uow.commit()
        except Exception:
            log.exception("Draft %s: could not reset status", draft_id)

    async def _pause(self) -> None:
        if self._pace > 0:
            await asyncio.sleep(self._pace)

    # Changes made by the person

    async def edit(self, draft_id: int, request: EditRequest, user_id: int) -> DraftOut:
        async with self._uow() as uow:
            draft = await self._require(uow, draft_id, user_id)
            if draft.status == DraftStatus.WRITING:
                raise ConflictError(STILL_WRITING, code="still_writing")
            latest = draft.latest
            if latest is None or (latest.subject, latest.body) != (request.subject, request.body):
                await self._invalidate_pending_schedules(uow, draft, user_id)
                uow.drafts.add_version(draft, subject=request.subject, body=request.body,
                                       source=VersionSource.EDITED)
                uow.drafts.set_status(draft, DraftStatus.NEEDS_REVIEW)
                await uow.commit()
            return to_draft_out(draft, self._safety)

    async def approve(self, draft_id: int, request, user_id: int) -> DraftOut:
        if not request.reviewed:
            raise InvalidRequestError(
                "Please confirm you've read the draft before approving it.", code="not_reviewed"
            )
        async with self._uow() as uow:
            draft = await self._require(uow, draft_id, user_id)
            if draft.status == DraftStatus.WRITING:
                raise ConflictError(STILL_WRITING, code="still_writing")
            if draft.status == DraftStatus.APPROVED:
                raise ConflictError("This draft is already approved.", code="already_approved")
            latest = draft.latest
            if latest is None:
                raise ConflictError("There's no draft to approve yet.", code="no_draft")
            blanks = self._safety.blanks(latest.subject, latest.body)
            if blanks:
                raise ConflictError(
                    f"Fill in the blanks before approving: {', '.join(blanks[:4])}", code="blanks_left"
                )
            if not request.gmail_connection_id:
                raise InvalidRequestError("Connect and select a Gmail account before approving this email.",
                                          code="gmail_account_required")
            connection = await uow.session.scalar(
                select(GmailConnection).where(
                    GmailConnection.id == request.gmail_connection_id,
                    GmailConnection.user_id == user_id,
                )
            )
            if not connection:
                raise InvalidRequestError("That Gmail account is not connected to your user.", code="gmail_account_invalid")
            uow.drafts.set_status(draft, DraftStatus.APPROVED)
            snapshot = {
                "subject": latest.subject,
                "body": latest.body,
                "to": request.to,
                "cc": request.cc,
                "bcc": request.bcc,
                "gmail_connection_id": request.gmail_connection_id,
                "version_id": latest.id,
            }
            approval = DraftApproval(draft_id=draft.id, version_id=latest.id,
                                     user_id=user_id, snapshot=json.dumps(snapshot, sort_keys=True))
            uow.session.add(approval)
            record_audit(uow.session, actor_id=user_id, action="draft.approved", target_type="draft",
                         target_id=str(draft.id), details={"version_id": latest.id})
            await uow.session.flush()
            await uow.commit()
            result = to_draft_out(draft, self._safety)
            result.approval_id = approval.id
            return result

    async def discard(self, draft_id: int, user_id: int) -> None:
        async with self._uow() as uow:
            draft = await self._require(uow, draft_id, user_id)
            history = await uow.session.scalar(select(ScheduledEmail.id).where(ScheduledEmail.draft_id == draft.id))
            if history:
                raise ConflictError("This draft has scheduled-send history and cannot be discarded.",
                                    code="schedule_history_exists")
            await uow.drafts.delete(draft)
            await uow.commit()

    @staticmethod
    async def _invalidate_pending_schedules(uow: UnitOfWork, draft: Draft, user_id: int) -> None:
        rows = (await uow.session.scalars(select(ScheduledEmail).where(
            ScheduledEmail.draft_id == draft.id, ScheduledEmail.user_id == user_id,
            ScheduledEmail.status.in_(["scheduled", "sending", "reconciling"])).with_for_update())).all()
        if any(row.status in {"sending", "reconciling"} for row in rows):
            raise ConflictError("An email from this draft is already being processed. Wait for its status before editing.",
                                code="schedule_in_progress")
        for row in rows:
            row.status = "cancelled"
            row.last_error = "The draft changed after approval, so the scheduled email was cancelled."
            record_audit(uow.session, actor_id=user_id, action="email.cancelled_draft_changed",
                         target_type="scheduled_email", target_id=str(row.id))

    @staticmethod
    async def _require(uow: UnitOfWork, draft_id: int, user_id: int) -> Draft:
        draft = await uow.drafts.get(draft_id, user_id)
        if draft is None:
            raise NotFoundError(NOT_FOUND)
        return draft


def _friendly(exc: Exception) -> str:
    if isinstance(exc, EmptyDraftError):
        return "Draftly couldn't finish this draft. Please try again."
    if isinstance(exc, TimeoutError):
        return "Draftly took too long to answer. Please try again."
    if getattr(exc, "status_code", None) == 429:
        return "Draftly is busy right now. Please try again in a few minutes."
    if isinstance(exc, ConnectionError | OSError) or "connect" in type(exc).__name__.lower():
        return "Draftly couldn't reach its writing service. Please try again in a moment."
    return "Something went wrong while writing. Please try again."
