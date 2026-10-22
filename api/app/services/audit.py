import json

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AuditLog


def record_audit(session: AsyncSession, *, actor_id: int | None, action: str,
                 target_type: str, target_id: str, details: dict | None = None) -> None:
    """Persist security-relevant metadata only; never pass email content or credentials."""
    session.add(AuditLog(actor_user_id=actor_id, action=action, target_type=target_type,
                         target_id=target_id, details=json.dumps(details or {}, sort_keys=True)))
