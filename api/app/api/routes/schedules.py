import json
import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy import select

from app.api.routes.auth import current_user
from app.domain.time import utcnow
from app.models import Draft, DraftApproval, DraftVersion, GmailConnection, ScheduledEmail, User
from app.services.audit import record_audit

router = APIRouter(prefix="/schedules", tags=["scheduling"])


def _utc_iso(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value.astimezone(UTC).isoformat()


class ScheduleCreate(BaseModel):
    approval_id: int
    send_at: datetime


class ScheduleUpdate(BaseModel):
    send_at: datetime


def _utc(value: datetime) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        raise HTTPException(status_code=422, detail="Schedule time must include a timezone.")
    return value.astimezone(UTC)


@router.get("")
async def list_schedules(request: Request, status_filter: str | None = Query(None, alias="status"),
                         user: User = Depends(current_user)) -> list[dict]:
    allowed = {"scheduled", "sending", "reconciling", "sent", "failed", "cancelled", "uncertain"}
    if status_filter and status_filter not in allowed:
        raise HTTPException(status_code=422, detail="Unknown schedule status.")
    async with request.app.state.sessions() as session:
        query = (select(ScheduledEmail, DraftVersion, GmailConnection)
                 .join(DraftApproval, DraftApproval.id == ScheduledEmail.approval_id)
                 .join(DraftVersion, DraftVersion.id == DraftApproval.version_id)
                 .join(GmailConnection, GmailConnection.id == ScheduledEmail.gmail_connection_id)
                 .where(ScheduledEmail.user_id == user.id))
        if status_filter:
            if status_filter == "failed":
                query = query.where(ScheduledEmail.status.in_(["failed", "uncertain"]))
            else:
                query = query.where(ScheduledEmail.status == status_filter)
        rows = (await session.execute(query.order_by(ScheduledEmail.send_at.desc()).limit(200))).all()
        return [{"id": row.id, "draft_id": row.draft_id, "recipient": row.recipient,
                 "subject": version.subject, "gmail_account": connection.email,
                 "send_at": _utc_iso(row.send_at), "status": row.status,
                 "attempts": row.attempts, "error": row.last_error} for row, version, connection in rows]


@router.post("")
async def schedule_email(body: ScheduleCreate, request: Request, user: User = Depends(current_user)) -> dict:
    send_at = _utc(body.send_at)
    if send_at <= utcnow():
        raise HTTPException(status_code=422, detail="Choose a time in the future.")
    async with request.app.state.sessions() as session:
        approval = await session.scalar(select(DraftApproval).where(
            DraftApproval.id == body.approval_id, DraftApproval.user_id == user.id))
        if not approval:
            raise HTTPException(status_code=404, detail="Approval not found.")
        draft = await session.scalar(select(Draft).where(
            Draft.id == approval.draft_id, Draft.user_id == user.id).with_for_update())
        if not draft or draft.status != "approved" or not draft.latest or draft.latest.id != approval.version_id:
            raise HTTPException(status_code=409, detail="This approval is no longer current. Review and approve the latest version.")
        snapshot = json.loads(approval.snapshot)
        to = snapshot.get("to") or []
        connection_id = snapshot.get("gmail_connection_id")
        if not to or not connection_id:
            raise HTTPException(status_code=422, detail="Approve with at least one recipient and a Gmail account selected.")
        connection = await session.scalar(select(GmailConnection).where(
            GmailConnection.id == connection_id, GmailConnection.user_id == user.id,
            GmailConnection.active.is_(True)).with_for_update())
        if not connection:
            raise HTTPException(status_code=403, detail="The approved Gmail account is not connected to your user.")
        if await session.scalar(select(ScheduledEmail.id).where(ScheduledEmail.approval_id == approval.id)):
            raise HTTPException(status_code=409, detail="This approval already has a scheduled send.")
        job = ScheduledEmail(user_id=user.id, draft_id=draft.id, approval_id=approval.id,
                             gmail_connection_id=connection.id, recipient=", ".join(to), send_at=send_at,
                             rfc_message_id=f"<{uuid.uuid4()}@draftly.local>")
        session.add(job)
        record_audit(session, actor_id=user.id, action="email.scheduled", target_type="scheduled_email",
                     target_id=str(approval.id), details={"send_at": send_at.isoformat()})
        await session.commit()
        await session.refresh(job)
        return {"id": job.id, "status": job.status, "send_at": _utc_iso(job.send_at)}


@router.patch("/{schedule_id}")
async def reschedule(schedule_id: int, body: ScheduleUpdate, request: Request,
                     user: User = Depends(current_user)) -> dict:
    send_at = _utc(body.send_at)
    if send_at <= utcnow():
        raise HTTPException(status_code=422, detail="Choose a time in the future.")
    async with request.app.state.sessions() as session:
        job = await session.scalar(select(ScheduledEmail).where(
            ScheduledEmail.id == schedule_id, ScheduledEmail.user_id == user.id))
        if not job:
            raise HTTPException(status_code=404, detail="Scheduled email not found.")
        if job.status != "scheduled":
            raise HTTPException(status_code=409, detail="Only a pending email can be rescheduled.")
        job.send_at = send_at
        record_audit(session, actor_id=user.id, action="email.rescheduled", target_type="scheduled_email",
                     target_id=str(job.id), details={"send_at": send_at.isoformat()})
        await session.commit()
        return {"id": job.id, "status": job.status, "send_at": _utc_iso(job.send_at)}


@router.delete("/{schedule_id}")
async def cancel(schedule_id: int, request: Request, user: User = Depends(current_user)) -> dict:
    async with request.app.state.sessions() as session:
        job = await session.scalar(select(ScheduledEmail).where(
            ScheduledEmail.id == schedule_id, ScheduledEmail.user_id == user.id))
        if not job:
            raise HTTPException(status_code=404, detail="Scheduled email not found.")
        if job.status != "scheduled":
            raise HTTPException(status_code=409, detail="A send already in progress cannot be cancelled.")
        job.status = "cancelled"
        record_audit(session, actor_id=user.id, action="email.cancelled", target_type="scheduled_email",
                     target_id=str(job.id))
        await session.commit()
        return {"id": job.id, "status": job.status}


@router.post("/{schedule_id}/retry")
async def retry_failed(schedule_id: int, request: Request, user: User = Depends(current_user)) -> dict:
    async with request.app.state.sessions() as session:
        job = await session.scalar(select(ScheduledEmail).where(
            ScheduledEmail.id == schedule_id, ScheduledEmail.user_id == user.id).with_for_update())
        if not job:
            raise HTTPException(status_code=404, detail="Scheduled email not found.")
        if job.status != "failed":
            raise HTTPException(status_code=409, detail="Only a confirmed failed send can be retried. Uncertain sends must be checked in Gmail first.")
        job.status = "scheduled"
        job.attempts = 0
        job.send_at = utcnow() + timedelta(seconds=5)
        job.last_error = None
        record_audit(session, actor_id=user.id, action="email.retry_requested", target_type="scheduled_email",
                     target_id=str(job.id))
        await session.commit()
        return {"id": job.id, "status": job.status, "send_at": _utc_iso(job.send_at)}
