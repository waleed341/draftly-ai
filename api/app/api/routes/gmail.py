import asyncio
import json
import secrets
from datetime import UTC, timedelta

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from google_auth_oauthlib.flow import Flow
from pydantic import BaseModel
from sqlalchemy import select

from app.api.routes.auth import current_user
from app.domain.time import utcnow
from app.integrations.gmail import SCOPES, encrypt_token, gmail_service, make_raw_email, revoke_token
from app.models import (
    Draft,
    DraftApproval,
    DraftVersion,
    GmailConnection,
    GmailDraftLink,
    OAuthState,
    ScheduledEmail,
    User,
)
from app.services.audit import record_audit

router = APIRouter(prefix="/gmail", tags=["gmail"])


def _flow(request: Request, state: str | None = None, code_verifier: str | None = None) -> Flow:
    settings = request.app.state.settings
    if not settings.google_client_id or not settings.google_client_secret:
        raise HTTPException(status_code=503, detail="Google OAuth credentials are not configured.")
    flow = Flow.from_client_config(
        {"web": {"client_id": settings.google_client_id, "client_secret": settings.google_client_secret,
                 "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                 "token_uri": "https://oauth2.googleapis.com/token",
                 "redirect_uris": [settings.google_redirect_uri]}}, scopes=SCOPES, state=state,
        code_verifier=code_verifier)
    flow.redirect_uri = settings.google_redirect_uri
    return flow


@router.get("/connections")
async def connections(request: Request, user: User = Depends(current_user)) -> list[dict[str, int | str]]:
    async with request.app.state.sessions() as session:
        rows = (await session.scalars(select(GmailConnection).where(
            GmailConnection.user_id == user.id, GmailConnection.active.is_(True)))).all()
        return [{"id": row.id, "email": row.email, "connected_at": row.created_at.isoformat()} for row in rows]


@router.get("/connect")
async def connect(request: Request, user: User = Depends(current_user)) -> RedirectResponse:
    state = secrets.token_urlsafe(32)
    flow = _flow(request, state)
    url, _ = flow.authorization_url(access_type="offline", include_granted_scopes="true",
                                    prompt="consent", code_challenge_method="S256")
    async with request.app.state.sessions() as session:
        session.add(OAuthState(state=state, user_id=user.id, code_verifier=flow.code_verifier,
                               expires_at=utcnow() + timedelta(minutes=10)))
        await session.commit()
    return RedirectResponse(url)


@router.get("/callback")
async def callback(request: Request, state: str, code: str | None = None, error: str | None = None) -> RedirectResponse:
    async with request.app.state.sessions() as session:
        oauth_state = await session.get(OAuthState, state)
        expires_at = oauth_state.expires_at.replace(tzinfo=UTC) if oauth_state and oauth_state.expires_at.tzinfo is None else (oauth_state.expires_at if oauth_state else None)
        if not oauth_state or expires_at <= utcnow():
            raise HTTPException(status_code=400, detail="OAuth state is invalid or expired.")
        user_id = oauth_state.user_id
        verifier = oauth_state.code_verifier
        await session.delete(oauth_state)
        await session.commit()
    if error:
        return RedirectResponse(f"{request.app.state.settings.frontend_url}/?gmail=denied")
    if not code:
        raise HTTPException(status_code=400, detail="Google did not return an authorization code.")
    flow = _flow(request, state, verifier)
    await asyncio.to_thread(flow.fetch_token, code=code)
    credentials = flow.credentials
    if not credentials.refresh_token:
        raise HTTPException(status_code=400, detail="Google did not provide a refresh token. Revoke Draftly access and reconnect.")
    profile_response = await asyncio.to_thread(httpx.get, "https://openidconnect.googleapis.com/v1/userinfo",
                                               headers={"Authorization": f"Bearer {credentials.token}"}, timeout=10)
    profile_response.raise_for_status()
    profile = profile_response.json()
    email = profile.get("email")
    if not email or profile.get("email_verified") is not True:
        raise HTTPException(status_code=400, detail="Could not verify the connected Gmail address.")
    token = encrypt_token(credentials.refresh_token, request.app.state.settings)
    async with request.app.state.sessions() as session:
        existing = await session.scalar(select(GmailConnection).where(
            GmailConnection.user_id == user_id, GmailConnection.email == email))
        if existing:
            existing.encrypted_refresh_token = token
            existing.active = True
            connection_id = existing.id
        else:
            existing = GmailConnection(user_id=user_id, email=email, encrypted_refresh_token=token)
            session.add(existing)
            await session.flush()
            connection_id = existing.id
        record_audit(session, actor_id=user_id, action="gmail.connected", target_type="gmail_connection",
                     target_id=str(connection_id), details={"email": email})
        await session.commit()
    return RedirectResponse(f"{request.app.state.settings.frontend_url}/?gmail=connected")


@router.delete("/connections/{connection_id}", status_code=204)
async def disconnect(connection_id: int, request: Request, user: User = Depends(current_user)):
    async with request.app.state.sessions() as session:
        connection = await session.scalar(select(GmailConnection).where(
            GmailConnection.id == connection_id, GmailConnection.user_id == user.id,
            GmailConnection.active.is_(True)).with_for_update())
        if not connection:
            raise HTTPException(status_code=404, detail="Gmail connection not found.")
        pending = await session.scalar(select(ScheduledEmail.id).where(
            ScheduledEmail.gmail_connection_id == connection.id,
            ScheduledEmail.status.in_(["scheduled", "sending", "reconciling", "uncertain"])))
        if pending:
            raise HTTPException(status_code=409, detail="Cancel pending sends and resolve any uncertain delivery before disconnecting Gmail.")
        encrypted_token = connection.encrypted_refresh_token
        connection_email = connection.email
        connection.active = False
        await session.commit()
    try:
        await asyncio.to_thread(revoke_token, encrypted_token, request.app.state.settings)
    except Exception as exc:
        async with request.app.state.sessions() as session:
            connection = await session.get(GmailConnection, connection_id)
            if connection:
                connection.active = True
                await session.commit()
        raise HTTPException(status_code=502, detail="Google could not revoke access. The connection is still active.") from exc
    async with request.app.state.sessions() as session:
        connection = await session.scalar(select(GmailConnection).where(
            GmailConnection.id == connection_id, GmailConnection.user_id == user.id,
            GmailConnection.active.is_(True)))
        if connection:
            connection.encrypted_refresh_token = ""
        record_audit(session, actor_id=user.id, action="gmail.disconnected", target_type="gmail_connection",
                     target_id=str(connection_id), details={"email": connection_email})
        await session.commit()


class SaveDraftRequest(BaseModel):
    connection_id: int


@router.post("/drafts/{draft_id}")
async def save_gmail_draft(draft_id: int, body: SaveDraftRequest, request: Request,
                           user: User = Depends(current_user)) -> dict[str, str]:
    async with request.app.state.sessions() as session:
        draft = await session.scalar(select(Draft).where(Draft.id == draft_id, Draft.user_id == user.id))
        if not draft or draft.status != "approved" or not draft.latest:
            raise HTTPException(status_code=409, detail="Approve the current draft before saving it to Gmail.")
        approval = await session.scalar(select(DraftApproval).where(
            DraftApproval.draft_id == draft.id, DraftApproval.user_id == user.id,
            DraftApproval.version_id == draft.latest.id).order_by(DraftApproval.id.desc()))
        connection = await session.scalar(select(GmailConnection).where(
            GmailConnection.id == body.connection_id, GmailConnection.user_id == user.id,
            GmailConnection.active.is_(True)))
        if not approval or not connection:
            raise HTTPException(status_code=403, detail="Approval or Gmail connection is unavailable.")
        snapshot = json.loads(approval.snapshot)
        if snapshot.get("gmail_connection_id") not in {None, connection.id}:
            raise HTTPException(status_code=409, detail="Reapprove this draft for the selected Gmail account.")
        raw = make_raw_email(draft.latest.subject, draft.latest.body, snapshot.get("to", []),
                             snapshot.get("cc", []), snapshot.get("bcc", []))
        token = connection.encrypted_refresh_token
        link = await session.scalar(select(GmailDraftLink).where(
            GmailDraftLink.user_id == user.id, GmailDraftLink.draft_id == draft.id,
            GmailDraftLink.version_id == draft.latest.id, GmailDraftLink.gmail_connection_id == connection.id))
        record_audit(session, actor_id=user.id, action="gmail.draft_save_requested", target_type="draft",
                     target_id=str(draft_id), details={"connection_id": connection.id})
        await session.commit()
    def upsert_gmail_draft():
        service = gmail_service(token, request.app.state.settings)
        if link is None:
            return service.users().drafts().create(userId="me", body={"message": {"raw": raw}}).execute()
        return service.users().drafts().update(userId="me", id=link.gmail_draft_id,
                                                body={"message": {"raw": raw}}).execute()

    result = await asyncio.to_thread(upsert_gmail_draft)
    async with request.app.state.sessions() as session:
        if link is None:
            session.add(GmailDraftLink(user_id=user.id, draft_id=draft_id, version_id=approval.version_id,
                                       gmail_connection_id=body.connection_id, gmail_draft_id=result["id"]))
        else:
            link = await session.get(GmailDraftLink, link.id)
            link.updated_at = utcnow()
        record_audit(session, actor_id=user.id, action="gmail.draft_saved", target_type="draft",
                     target_id=str(draft_id), details={"gmail_draft_id": result["id"]})
        await session.commit()
    return {"status": "saved", "gmail_draft_id": result["id"]}


@router.get("/drafts")
async def list_gmail_drafts(request: Request, user: User = Depends(current_user)) -> list[dict]:
    async with request.app.state.sessions() as session:
        rows = (await session.execute(select(GmailDraftLink, DraftVersion).join(
            DraftVersion, DraftVersion.id == GmailDraftLink.version_id).where(
                GmailDraftLink.user_id == user.id).order_by(GmailDraftLink.updated_at.desc()))).all()
        return [{"id": link.id, "draft_id": link.draft_id, "gmail_draft_id": link.gmail_draft_id,
                 "subject": version.subject, "updated_at": link.updated_at.isoformat()} for link, version in rows]


@router.delete("/drafts/{link_id}", status_code=204)
async def delete_gmail_draft(link_id: int, request: Request, user: User = Depends(current_user)):
    async with request.app.state.sessions() as session:
        link = await session.scalar(select(GmailDraftLink).where(
            GmailDraftLink.id == link_id, GmailDraftLink.user_id == user.id))
        if not link:
            raise HTTPException(status_code=404, detail="Gmail draft not found.")
        connection = await session.scalar(select(GmailConnection).where(
            GmailConnection.id == link.gmail_connection_id, GmailConnection.user_id == user.id,
            GmailConnection.active.is_(True)))
        if not connection:
            raise HTTPException(status_code=404, detail="Gmail connection not found.")
        token, gmail_id = connection.encrypted_refresh_token, link.gmail_draft_id
    await asyncio.to_thread(lambda: gmail_service(token, request.app.state.settings).users().drafts().delete(
        userId="me", id=gmail_id).execute())
    async with request.app.state.sessions() as session:
        link = await session.scalar(select(GmailDraftLink).where(
            GmailDraftLink.id == link_id, GmailDraftLink.user_id == user.id))
        if link:
            await session.delete(link)
            record_audit(session, actor_id=user.id, action="gmail.draft_deleted", target_type="gmail_draft",
                         target_id=str(link_id))
            await session.commit()
