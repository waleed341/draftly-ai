from fastapi import APIRouter

from app.api.deps import DraftServiceDep
from app.schemas.drafts import CheckDraftRequest, CheckDraftResponse

router = APIRouter(prefix="/safety", tags=["safety"])


@router.post("/check", response_model=CheckDraftResponse)
async def check_draft(body: CheckDraftRequest, service: DraftServiceDep) -> CheckDraftResponse:
    """Re-run the safety checks while the person edits."""
    return service.check(body.subject, body.body)
