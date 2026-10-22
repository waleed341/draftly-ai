import asyncio
import json
import logging
from datetime import timedelta

from celery import Celery
from sqlalchemy import select, update

from app.core.config import get_settings
from app.db.session import build_engine, build_session_factory
from app.domain.time import utcnow
from app.integrations.gmail import gmail_service, make_raw_email
from app.models import Draft, DraftApproval, GmailConnection, ScheduledEmail
from app.services.audit import record_audit

settings = get_settings()
celery = Celery("draftly", broker=settings.redis_url, backend=settings.redis_url)
celery.conf.update(task_serializer="json", accept_content=["json"], result_serializer="json",
                   timezone="UTC", enable_utc=True,
                   beat_schedule={"dispatch-due-drafts": {"task": "app.worker.dispatch_due", "schedule": 15.0}})
log = logging.getLogger(__name__)


async def _dispatch_due() -> int:
    engine = build_engine(settings.database_url)
    sessions = build_session_factory(engine)
    now = utcnow()
    handled = 0
    try:
        handled += await _recover_interrupted(sessions, now)
        async with sessions() as session:
            due = (await session.scalars(select(ScheduledEmail.id).where(
                ScheduledEmail.status == "scheduled", ScheduledEmail.send_at <= now).limit(100))).all()
        for item_id in due:
            async with sessions() as session:
                claimed = await session.execute(update(ScheduledEmail).where(
                    ScheduledEmail.id == item_id, ScheduledEmail.status == "scheduled",
                    ScheduledEmail.send_at <= now).values(status="sending", attempts=ScheduledEmail.attempts + 1,
                                                          last_attempt_at=now))
                if not claimed.rowcount:
                    await session.rollback()
                    continue
                await session.commit()
            handled += 1
            await _send_one(sessions, item_id)
    finally:
        await engine.dispose()
    return handled


async def _recover_interrupted(sessions, now) -> int:
    cutoff = now - timedelta(minutes=5)
    async with sessions() as session:
        stale = (await session.scalars(select(ScheduledEmail.id).where(
            ScheduledEmail.status.in_(["sending", "reconciling"]),
            ScheduledEmail.last_attempt_at <= cutoff).limit(100))).all()
    handled = 0
    for item_id in stale:
        async with sessions() as session:
            claim = await session.execute(update(ScheduledEmail).where(
                ScheduledEmail.id == item_id, ScheduledEmail.status.in_(["sending", "reconciling"]),
                ScheduledEmail.last_attempt_at <= cutoff).values(status="reconciling", last_attempt_at=now))
            if not claim.rowcount:
                await session.rollback()
                continue
            await session.commit()
        handled += 1
        async with sessions() as session:
            job = await session.get(ScheduledEmail, item_id)
            connection = await session.get(GmailConnection, job.gmail_connection_id)
            try:
                service = await asyncio.to_thread(gmail_service, connection.encrypted_refresh_token, settings)
                message_id = job.rfc_message_id.strip("<>")
                found = await asyncio.to_thread(service.users().messages().list(
                    userId="me", q=f"rfc822msgid:{message_id}").execute)
                if found.get("messages"):
                    job.status, job.gmail_message_id = "sent", found["messages"][0]["id"]
                    job.last_error = None
                    record_audit(session, actor_id=job.user_id, action="email.reconciled_sent",
                                 target_type="scheduled_email", target_id=str(job.id))
                else:
                    job.status = "uncertain"
                    job.last_error = "Draftly could not confirm whether Gmail accepted this email. Check Gmail before taking further action."
                    record_audit(session, actor_id=job.user_id, action="email.delivery_uncertain",
                                 target_type="scheduled_email", target_id=str(job.id))
            except Exception as exc:  # noqa: BLE001
                job.status = "uncertain"
                job.last_error = "Draftly could not check Gmail delivery status. Check Gmail before taking further action."
                log.warning("Scheduled email %s reconciliation error: %s", job.id, type(exc).__name__)
            await session.commit()
    return handled


async def _send_one(sessions, item_id: int) -> None:
    async with sessions() as session:
        job = await session.get(ScheduledEmail, item_id)
        approval = await session.get(DraftApproval, job.approval_id)
        connection = await session.get(GmailConnection, job.gmail_connection_id)
        draft = await session.scalar(select(Draft).where(
            Draft.id == job.draft_id, Draft.user_id == job.user_id).with_for_update())
        snapshot = json.loads(approval.snapshot) if approval else {}
        if (not approval or not connection or not connection.active or not draft or draft.status != "approved"
                or not draft.latest or draft.latest.id != approval.version_id or approval.user_id != job.user_id):
            job.status, job.last_error = "cancelled", "The approved draft or Gmail account is no longer current."
            await session.commit()
            return
        # A previous worker may have crashed after Gmail accepted the message. Search first;
        # never blindly repeat a send with an uncertain outcome.
        send_started = False
        try:
            service = await asyncio.to_thread(gmail_service, connection.encrypted_refresh_token, settings)
            if job.attempts > 1:
                found = await asyncio.to_thread(service.users().messages().list(
                    userId="me", q=f"rfc822msgid:{job.rfc_message_id}").execute)
                if found.get("messages"):
                    job.status = "sent"
                    job.gmail_message_id = found["messages"][0]["id"]
                    job.last_error = None
                    await session.commit()
                    return
            raw = make_raw_email(snapshot["subject"], snapshot["body"], snapshot["to"],
                                 snapshot.get("cc", []), snapshot.get("bcc", []), job.rfc_message_id)
            send_started = True
            result = await asyncio.to_thread(service.users().messages().send(
                userId="me", body={"raw": raw}).execute)
            job.status, job.gmail_message_id, job.last_error = "sent", result.get("id"), None
            record_audit(session, actor_id=job.user_id, action="email.gmail_accepted",
                         target_type="scheduled_email", target_id=str(job.id))
            await session.commit()
        except Exception as exc:  # noqa: BLE001
            response_status = getattr(getattr(exc, "resp", None), "status", None)
            if response_status and 400 <= response_status < 500 and response_status != 429:
                job.status = "failed"
                job.last_error = "Gmail rejected this send request. Check the connected account and draft details."
            elif send_started:
                # A request may have reached Gmail; only reconciliation may change this state.
                job.status = "uncertain"
                job.last_error = "Gmail delivery could not be confirmed. Check Gmail before taking further action."
            else:
                job.status = "scheduled"
                job.send_at = utcnow() + timedelta(seconds=min(3600, 30 * (2 ** (job.attempts - 1))))
                job.last_error = "Temporary Gmail connection issue. Draftly will retry with a delay."
            if job.attempts >= 5 and job.status == "scheduled":
                job.status = "failed"
            record_audit(session, actor_id=job.user_id, action=f"email.{job.status}",
                         target_type="scheduled_email", target_id=str(job.id),
                         details={"attempt": job.attempts})
            log.warning("Scheduled email %s delivery error: %s", job.id, type(exc).__name__)
            await session.commit()


@celery.task(name="app.worker.dispatch_due")
def dispatch_due() -> int:
    return asyncio.run(_dispatch_due())


async def run_local_scheduler() -> None:
    """Process approved scheduled sends locally without a Redis/Celery service."""
    log.info("Local email scheduler started; checking due emails every 15 seconds.")
    while True:
        try:
            await _dispatch_due()
        except Exception:
            log.exception("Local email scheduler failed; checking again in 15 seconds.")
        await asyncio.sleep(15)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    try:
        asyncio.run(run_local_scheduler())
    except KeyboardInterrupt:
        pass
