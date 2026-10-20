from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import StreamingResponse

from app.api.routes.sse import encode
from app.repositories.drafts import DraftRepository
from app.schemas.drafts import Approval, DraftCreate, DraftEdit, SafetyCheckRequest
from app.services.draft_service import DraftService
from app.services.mappers import draft_out
from app.services.parsing import parse_email
from app.services.safety import check_input, check_output

router = APIRouter(prefix="/api")


def service_from(request: Request) -> DraftService:
    return request.app.state.draft_service


@router.post("/drafts/stream")
async def create_draft_stream(body: DraftCreate, request: Request):
    service = service_from(request)
    draft_id = await service.prepare_new(body)
    return StreamingResponse(encode(service.run(draft_id, body.timezone, body.idea)),
                            media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.post("/drafts")
async def create_draft(body: DraftCreate, request: Request):
    service = service_from(request)
    draft_id = await service.prepare_new(body)
    last = None
    async for event in service.run(draft_id, body.timezone, body.idea):
        if event["type"] == "error":
            raise HTTPException(502, event["message"])
        if event["type"] == "ready":
            last = event["draft"]
    return last


@router.get("/drafts")
async def history(request: Request):
    async with request.app.state.sessions() as session:
        drafts = await DraftRepository(session).list()
        return [draft_out(draft) for draft in drafts]


@router.get("/drafts/{draft_id}")
async def get_draft(draft_id: str, request: Request):
    async with request.app.state.sessions() as session:
        draft = await DraftRepository(session).get(draft_id)
        if not draft:
            raise HTTPException(404, "We couldn't find that draft.")
        return draft_out(draft)


@router.post("/drafts/{draft_id}/rewrite")
async def rewrite_draft(draft_id: str, request: Request, body: SafetyCheckRequest | None = None):
    service = service_from(request)
    timezone, idea, previous = await service.prepare_rewrite(draft_id, body.text if body else None)
    return StreamingResponse(encode(service.run(draft_id, timezone, idea, previous)),
                            media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.put("/drafts/{draft_id}/edit")
async def edit_draft(draft_id: str, body: DraftEdit, request: Request):
    check_input(f"{body.subject}\n{body.body}")
    async with request.app.state.sessions() as session:
        repo = DraftRepository(session)
        draft = await repo.get(draft_id)
        if not draft:
            raise HTTPException(404, "We couldn't find that draft.")
        if draft.status == "writing":
            raise HTTPException(409, "This draft is still being written.")
        await repo.add_version(draft, body.subject, body.body, "edited")
        draft.status = "needs_review"
        await session.commit()
        await session.refresh(draft)
        return draft_out(draft)


@router.post("/drafts/{draft_id}/approve")
async def approve_draft(draft_id: str, body: Approval, request: Request):
    if not body.reviewed:
        raise HTTPException(422, "Please confirm that you reviewed the draft first.")
    async with request.app.state.sessions() as session:
        draft = await DraftRepository(session).get(draft_id)
        if not draft:
            raise HTTPException(404, "We couldn't find that draft.")
        if draft.status == "writing":
            raise HTTPException(409, "This draft is still being written.")
        draft.status = "approved"
        await session.commit()
        await session.refresh(draft)
        return draft_out(draft)


@router.delete("/drafts/{draft_id}", status_code=204)
async def discard_draft(draft_id: str, request: Request):
    async with request.app.state.sessions() as session:
        draft = await DraftRepository(session).get(draft_id)
        if not draft:
            raise HTTPException(404, "We couldn't find that draft.")
        await session.delete(draft)
        await session.commit()
    return Response(status_code=204)


@router.post("/safety/check")
async def safety_check(body: SafetyCheckRequest):
    check_input(body.text)
    subject, content = parse_email(body.text)
    return {"checks": check_output(subject, content)}
