from dataclasses import asdict
from datetime import UTC, datetime

from app.models import Draft
from app.schemas.drafts import CheckOut, DraftOut, DraftSummary, VersionOut
from app.services.safety import SafetyService


def _aware(value: datetime) -> datetime:
    # SQLite drops the zone; everything is stored in UTC.
    return value if value.tzinfo else value.replace(tzinfo=UTC)


def to_draft_out(draft: Draft, safety: SafetyService) -> DraftOut:
    latest = draft.latest
    subject, body = (latest.subject, latest.body) if latest else ("", "")
    checks = [CheckOut(**asdict(c)) for c in safety.check_draft(subject, body)] if latest else []
    return DraftOut(
        id=draft.id,
        idea=draft.idea,
        kind=draft.kind,
        tone=draft.tone,
        length=draft.length,
        status=draft.status,
        created_at=_aware(draft.created_at),
        updated_at=_aware(draft.updated_at),
        approved_at=_aware(draft.approved_at) if draft.approved_at else None,
        versions=[
            VersionOut(
                number=v.number, subject=v.subject, body=v.body, source=v.source, note=v.note,
                created_at=_aware(v.created_at),
            )
            for v in draft.versions
        ],
        checks=checks,
        blanks=safety.blanks(subject, body) if latest else [],
    )


def to_summary(draft: Draft) -> DraftSummary:
    latest = draft.latest
    return DraftSummary(
        id=draft.id,
        idea=draft.idea,
        subject=latest.subject if latest else None,
        status=draft.status,
        kind=draft.kind,
        version_count=len(draft.versions),
        updated_at=_aware(draft.updated_at),
    )
