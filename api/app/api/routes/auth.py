import hashlib
import hmac
import logging
import secrets
from datetime import UTC, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pwdlib import PasswordHash
from pydantic import BaseModel, EmailStr, Field
from redis.asyncio import Redis
from sqlalchemy import select

from app.domain.time import utcnow
from app.integrations.verification_email import email_verification_configured, send_verification_code
from app.models import AccessRequest, EmailVerification, User, UserSession
from app.services.audit import record_audit

router = APIRouter(prefix="/auth", tags=["auth"])
log = logging.getLogger(__name__)
password_hash = PasswordHash.recommended()
SESSION_COOKIE = "draftly_session"
_DUMMY_HASH = password_hash.hash("not-a-real-user-password-constant")


class Credentials(BaseModel):
    email: EmailStr
    password: str = Field(min_length=12, max_length=256)


class RegistrationStart(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr


class VerifyRegistrationCode(BaseModel):
    email: EmailStr
    code: str = Field(pattern=r"^\d{6}$")


class CompleteRegistration(BaseModel):
    registration_token: str = Field(min_length=32, max_length=128)
    password: str = Field(min_length=12, max_length=256)


class UserOut(BaseModel):
    id: int
    email: str
    role: str
    status: str


class SessionOut(BaseModel):
    user: UserOut
    csrf_token: str


class PasswordChange(BaseModel):
    current_password: str = Field(min_length=1, max_length=256)
    new_password: str = Field(min_length=12, max_length=256)


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _expired(value) -> bool:
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value <= utcnow()


async def current_user(request: Request) -> User:
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        raise HTTPException(status_code=401, detail="Sign in to continue.")
    async with request.app.state.sessions() as session:
        result = await session.execute(select(UserSession, User).join(User).where(UserSession.token_hash == _hash(token)))
        row = result.first()
        if not row or _expired(row[0].expires_at) or row[1].status != "active":
            raise HTTPException(status_code=401, detail="Your session has expired.")
        if request.method not in {"GET", "HEAD", "OPTIONS"} and request.headers.get("x-csrf-token") != row[0].csrf_token:
            raise HTTPException(status_code=403, detail="Invalid CSRF token.")
        request.state.user = row[1]
        request.state.csrf_token = row[0].csrf_token
        return row[1]


async def admin_user(user: User = Depends(current_user)) -> User:
    if user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Super Admin access is required.")
    return user


async def _rate_limit(request: Request, action: str, limit: int, window_seconds: int) -> None:
    ip = request.client.host if request.client else "unknown"
    key = f"draftly:rate:{action}:{ip}"
    redis = Redis.from_url(request.app.state.settings.redis_url, decode_responses=True,
                           socket_connect_timeout=0.4, socket_timeout=0.4)
    try:
        count = await redis.incr(key)
        if count == 1:
            await redis.expire(key, window_seconds)
    except Exception as exc:
        if request.app.state.settings.cookie_secure:
            raise HTTPException(status_code=503, detail="Authentication rate limiting is unavailable.") from exc
        now = utcnow().timestamp()
        local = request.app.state.local_rate_limits
        start, count = local.get(key, (now, 0))
        if now - start >= window_seconds:
            start, count = now, 0
        count += 1
        local[key] = (start, count)
    finally:
        await redis.aclose()
    if count > limit:
        raise HTTPException(status_code=429, detail="Too many attempts. Wait a while and try again.")


def user_out(user: User) -> UserOut:
    return UserOut(id=user.id, email=user.email, role=user.role, status=user.status)


@router.post("/register", status_code=202)
async def register(body: Credentials, request: Request) -> dict[str, str]:
    del body, request
    raise HTTPException(status_code=410, detail="Use the email verification steps to create an account.")


def _verification_hash(settings, email: str, code: str) -> str:
    secret = settings.email_verification_secret or ""
    return hmac.new(secret.encode(), f"{email}:{code}".encode(), hashlib.sha256).hexdigest()


@router.post("/register/request-code", status_code=202)
async def request_registration_code(body: RegistrationStart, request: Request) -> dict[str, str]:
    settings = request.app.state.settings
    if not settings.registration_open:
        raise HTTPException(status_code=403, detail="Registration is currently closed.")
    if not email_verification_configured(settings):
        raise HTTPException(status_code=503, detail="Email sending is not set up yet. Configure the email settings and try again.")
    await _rate_limit(request, "register_code", 5, 3600)

    email = str(body.email).lower()
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Enter your name.")
    async with request.app.state.sessions() as session:
        existing_user = await session.scalar(select(User).where(User.email == email))
        if existing_user and existing_user.status != "pending":
            raise HTTPException(status_code=409, detail="An account with this email already exists. Sign in instead.")
        challenge = await session.get(EmailVerification, email)
        now = utcnow()
        if challenge and not _expired(challenge.expires_at):
            created_at = challenge.created_at
            if created_at.tzinfo is None:
                created_at = created_at.replace(tzinfo=UTC)
            if now - created_at < timedelta(seconds=60):
                raise HTTPException(status_code=429, detail="A code was sent recently. Check your inbox or wait a minute.")
            await session.delete(challenge)
            await session.flush()
        elif challenge:
            await session.delete(challenge)
            await session.flush()

        code = f"{secrets.randbelow(1_000_000):06d}"
        challenge = EmailVerification(
            email=email,
            name=name,
            code_hash=_verification_hash(settings, email, code),
            expires_at=now + timedelta(minutes=10),
        )
        session.add(challenge)
        await session.commit()

    try:
        await send_verification_code(settings, email, name, code)
    except Exception as exc:
        log.exception("Unable to send account verification email")
        async with request.app.state.sessions() as session:
            pending = await session.get(EmailVerification, email)
            if pending and hmac.compare_digest(pending.code_hash, _verification_hash(settings, email, code)):
                await session.delete(pending)
                await session.commit()
        raise HTTPException(status_code=502, detail="Could not send the verification email. Check the email settings and try again.") from exc
    return {"status": "sent", "message": "If this email can be registered, a verification code has been sent."}


@router.post("/register/verify-code")
async def verify_registration_code(body: VerifyRegistrationCode, request: Request) -> dict[str, str]:
    await _rate_limit(request, "verify_registration", 10, 900)
    email = str(body.email).lower()
    settings = request.app.state.settings
    async with request.app.state.sessions() as session:
        challenge = await session.get(EmailVerification, email)
        if challenge is None:
            raise HTTPException(status_code=400, detail="That code is invalid or expired. Request a new one.")
        if _expired(challenge.expires_at):
            await session.delete(challenge)
            await session.commit()
            raise HTTPException(status_code=400, detail="That code is invalid or expired. Request a new one.")
        if challenge.attempts >= 5:
            await session.delete(challenge)
            await session.commit()
            raise HTTPException(status_code=429, detail="Too many incorrect codes. Request a new one.")
        expected = _verification_hash(settings, email, body.code)
        if not hmac.compare_digest(challenge.code_hash, expected):
            challenge.attempts += 1
            await session.commit()
            raise HTTPException(status_code=400, detail="That code is invalid or expired. Request a new one.")
        registration_token = secrets.token_urlsafe(32)
        challenge.registration_token_hash = _hash(registration_token)
        challenge.expires_at = utcnow() + timedelta(minutes=10)
        await session.commit()
    return {"registration_token": registration_token}


@router.post("/register/complete", status_code=201)
async def complete_registration(body: CompleteRegistration, request: Request) -> dict[str, str]:
    if not request.app.state.settings.registration_open:
        raise HTTPException(status_code=403, detail="Registration is currently closed.")
    await _rate_limit(request, "complete_registration", 5, 900)
    async with request.app.state.sessions() as session:
        challenge = await session.scalar(select(EmailVerification).where(
            EmailVerification.registration_token_hash == _hash(body.registration_token)))
        if challenge is None or _expired(challenge.expires_at):
            if challenge:
                await session.delete(challenge)
                await session.commit()
            raise HTTPException(status_code=400, detail="Verify your email again before setting a password.")
        user = await session.scalar(select(User).where(User.email == challenge.email))
        if user and user.status != "pending":
            await session.delete(challenge)
            await session.commit()
            raise HTTPException(status_code=409, detail="An account with this email already exists. Sign in instead.")
        if user is None:
            user = User(email=challenge.email, name=challenge.name,
                        password_hash=password_hash.hash(body.password), role="user", status="active")
            session.add(user)
            await session.flush()
        else:
            # A verified mailbox proves ownership for older registrations awaiting approval.
            user.name = challenge.name
            user.password_hash = password_hash.hash(body.password)
            user.status = "active"
            access_request = await session.scalar(select(AccessRequest).where(AccessRequest.user_id == user.id))
            if access_request and access_request.status == "pending":
                access_request.status = "email_verified"
                access_request.reviewed_at = utcnow()
        record_audit(session, actor_id=user.id, action="account.email_verified", target_type="user",
                     target_id=str(user.id))
        await session.delete(challenge)
        await session.commit()
    return {"status": "created", "message": "Account created. Sign in with your email and password."}


@router.post("/login", response_model=SessionOut)
async def login(body: Credentials, request: Request, response: Response) -> SessionOut:
    await _rate_limit(request, "login", 10, 600)
    async with request.app.state.sessions() as session:
        user = await session.scalar(select(User).where(User.email == str(body.email).lower()))
        valid_password = password_hash.verify(body.password, user.password_hash if user else _DUMMY_HASH)
        if not user or not valid_password:
            raise HTTPException(status_code=401, detail="Email or password is incorrect.")
        if user.status == "pending":
            raise HTTPException(status_code=403, detail="Verify your email through Create account to activate your account.")
        if user.status != "active":
            raise HTTPException(status_code=403, detail="This account is suspended or unavailable.")
        token, csrf = secrets.token_urlsafe(48), secrets.token_urlsafe(32)
        session.add(UserSession(user_id=user.id, token_hash=_hash(token), csrf_token=csrf,
                                expires_at=utcnow() + timedelta(days=request.app.state.settings.session_days)))
        record_audit(session, actor_id=user.id, action="session.created", target_type="user", target_id=str(user.id))
        await session.commit()
        response.set_cookie(SESSION_COOKIE, token, max_age=request.app.state.settings.session_days * 86400,
                            httponly=True, secure=request.app.state.settings.cookie_secure,
                            samesite="lax", path="/")
        return SessionOut(user=user_out(user), csrf_token=csrf)


@router.get("/me", response_model=SessionOut)
async def me(request: Request, user: User = Depends(current_user)) -> SessionOut:
    return SessionOut(user=user_out(user), csrf_token=request.state.csrf_token)


@router.post("/logout", status_code=204)
async def logout(request: Request, response: Response, user: User = Depends(current_user)) -> Response:
    token = request.cookies.get(SESSION_COOKIE)
    async with request.app.state.sessions() as session:
        row = await session.scalar(select(UserSession).where(UserSession.token_hash == _hash(token or "")))
        if row:
            await session.delete(row)
            await session.commit()
    response.delete_cookie(SESSION_COOKIE, path="/")
    return response


@router.post("/change-password", status_code=204)
async def change_password(body: PasswordChange, request: Request,
                         user: User = Depends(current_user)) -> Response:
    if not password_hash.verify(body.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")
    async with request.app.state.sessions() as session:
        stored_user = await session.get(User, user.id)
        stored_user.password_hash = password_hash.hash(body.new_password)
        current_hash = _hash(request.cookies.get(SESSION_COOKIE, ""))
        sessions = (await session.scalars(select(UserSession).where(
            UserSession.user_id == user.id, UserSession.token_hash != current_hash))).all()
        for old in sessions:
            await session.delete(old)
        record_audit(session, actor_id=user.id, action="password.changed", target_type="user",
                     target_id=str(user.id))
        await session.commit()
    return Response(status_code=204)


@router.get("/admin/access-requests")
async def access_requests(request: Request, _: User = Depends(admin_user)) -> list[dict[str, str | int]]:
    async with request.app.state.sessions() as session:
        rows = (await session.execute(select(AccessRequest, User).join(
            User, User.id == AccessRequest.user_id).where(AccessRequest.status == "pending"))).all()
        return [{"id": req.id, "user_id": user.id, "email": user.email, "created_at": req.created_at.isoformat()}
                for req, user in rows]


@router.post("/admin/access-requests/{request_id}/{decision}")
async def decide_access(request_id: int, decision: str, request: Request,
                        admin: User = Depends(admin_user)) -> dict[str, str]:
    if decision not in {"approve", "reject"}:
        raise HTTPException(status_code=422, detail="Decision must be approve or reject.")
    async with request.app.state.sessions() as session:
        req = await session.get(AccessRequest, request_id)
        if req is None or req.status != "pending":
            raise HTTPException(status_code=404, detail="Pending request not found.")
        user = await session.get(User, req.user_id)
        req.status = decision + "d" if decision == "approve" else "rejected"
        req.reviewed_by, req.reviewed_at = admin.id, utcnow()
        user.status = "active" if decision == "approve" else "rejected"
        record_audit(session, actor_id=admin.id, action=f"access.{decision}d" if decision == "approve" else "access.rejected",
                     target_type="user", target_id=str(user.id))
        await session.commit()
    return {"status": req.status}


@router.get("/admin/audit-logs")
async def audit_logs(request: Request, _: User = Depends(admin_user)) -> list[dict]:
    from app.models import AuditLog

    async with request.app.state.sessions() as session:
        rows = (await session.scalars(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(500))).all()
        return [{"id": row.id, "actor_user_id": row.actor_user_id, "action": row.action,
                 "target_type": row.target_type, "target_id": row.target_id,
                 "details": row.details, "created_at": row.created_at.isoformat()} for row in rows]


@router.get("/admin/users")
async def admin_users(request: Request, _: User = Depends(admin_user)) -> list[dict]:
    async with request.app.state.sessions() as session:
        rows = (await session.scalars(select(User).order_by(User.created_at.desc()).limit(1000))).all()
        return [{"id": user.id, "email": user.email, "role": user.role, "status": user.status,
                 "created_at": user.created_at.isoformat()} for user in rows]


class UserUpdate(BaseModel):
    status: str = Field(pattern="^(active|suspended)$")


@router.patch("/admin/users/{user_id}")
async def update_user(user_id: int, body: UserUpdate, request: Request,
                      admin: User = Depends(admin_user)) -> dict[str, str | int]:
    if user_id == admin.id:
        raise HTTPException(status_code=409, detail="You cannot suspend your own Super Admin account.")
    async with request.app.state.sessions() as session:
        user = await session.get(User, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found.")
        if user.role == "super_admin":
            raise HTTPException(status_code=409, detail="Super Admin accounts can only be managed through secure server administration.")
        user.status = body.status
        record_audit(session, actor_id=admin.id, action=f"user.{body.status}", target_type="user",
                     target_id=str(user.id))
        await session.commit()
        return {"id": user.id, "email": user.email, "status": user.status}
