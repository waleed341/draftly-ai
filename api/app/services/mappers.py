from app.models import Draft
from app.services.safety import check_output


def draft_out(draft: Draft) -> dict[str, object]:
    current = draft.versions[-1] if draft.versions else None
    subject, body = (current.subject, current.body) if current else ("", "")
    return {
        "id": draft.id, "idea": draft.idea, "timezone": draft.timezone, "status": draft.status,
        "subject": subject, "body": body, "checks": check_output(subject, body),
        "versions": [{"number": version.number, "subject": version.subject, "body": version.body,
                      "source": version.source, "created_at": version.created_at.isoformat()}
                     for version in draft.versions],
        "created_at": draft.created_at.isoformat(), "updated_at": draft.updated_at.isoformat(),
    }
