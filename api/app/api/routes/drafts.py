from fastapi import APIRouter, Depends, Query, Response
from fastapi.responses import StreamingResponse

from app.api.deps import DraftServiceDep
from app.api.routes.auth import current_user
from app.api.sse import event_stream
from app.models import User
from app.schemas.drafts import (
    ApproveRequest,
    CreateDraftRequest,
    DraftOut,
    DraftStats,
    DraftSummary,
    EditRequest,
    RewriteRequest,
)

router = APIRouter(prefix="/drafts", tags=["drafts"])


@router.get("", response_model=list[DraftSummary])
async def list_drafts(service: DraftServiceDep, user: User = Depends(current_user), limit: int = Query(30, ge=1, le=100)) -> list[DraftSummary]:
    return await service.list_recent(user.id, limit)


@router.get("/stats", response_model=DraftStats)
async def draft_stats(service: DraftServiceDep, user: User = Depends(current_user)) -> DraftStats:
    return await service.stats(user.id)


@router.post("/stream", response_class=StreamingResponse)
async def write_draft(body: CreateDraftRequest, service: DraftServiceDep, user: User = Depends(current_user)) -> StreamingResponse:
    prepared = await service.prepare_new(body, user.id)
    return event_stream(service.run(prepared))


@router.get("/{draft_id}", response_model=DraftOut)
async def get_draft(draft_id: int, service: DraftServiceDep, user: User = Depends(current_user)) -> DraftOut:
    return await service.get(draft_id, user.id)


@router.post("/{draft_id}/rewrite/stream", response_class=StreamingResponse)
async def rewrite_draft(draft_id: int, body: RewriteRequest, service: DraftServiceDep, user: User = Depends(current_user)) -> StreamingResponse:
    prepared = await service.prepare_rewrite(draft_id, body, user.id)
    return event_stream(service.run(prepared))


@router.put("/{draft_id}", response_model=DraftOut)
async def edit_draft(draft_id: int, body: EditRequest, service: DraftServiceDep, user: User = Depends(current_user)) -> DraftOut:
    return await service.edit(draft_id, body, user.id)


@router.post("/{draft_id}/approve", response_model=DraftOut)
async def approve_draft(draft_id: int, body: ApproveRequest, service: DraftServiceDep, user: User = Depends(current_user)) -> DraftOut:
    return await service.approve(draft_id, body, user.id)


@router.delete("/{draft_id}", status_code=204)
async def discard_draft(draft_id: int, service: DraftServiceDep, user: User = Depends(current_user)) -> Response:
    await service.discard(draft_id, user.id)
    return Response(status_code=204)
