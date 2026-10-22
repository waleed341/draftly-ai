import base64
from email.message import EmailMessage
from email.utils import formatdate

import httpx
from cryptography.fernet import Fernet
from fastapi import HTTPException
from google.auth.transport.requests import Request as GoogleRequest
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from app.core.config import Settings

SCOPES = ["https://www.googleapis.com/auth/gmail.compose", "https://www.googleapis.com/auth/userinfo.email", "openid"]


def encrypt_token(token: str, settings: Settings) -> str:
    key = settings.gmail_token_key
    if not key:
        raise HTTPException(status_code=503, detail="Gmail token encryption is not configured.")
    return Fernet(key.encode()).encrypt(token.encode()).decode()


def revoke_token(encrypted_token: str, settings: Settings) -> None:
    if not settings.gmail_token_key:
        raise HTTPException(status_code=503, detail="Gmail token encryption is not configured.")
    token = Fernet(settings.gmail_token_key.encode()).decrypt(encrypted_token.encode()).decode()
    response = httpx.post("https://oauth2.googleapis.com/revoke", params={"token": token}, timeout=10)
    if response.status_code not in {200, 400}:
        response.raise_for_status()


def gmail_service(encrypted_token: str, settings: Settings):
    if not settings.gmail_token_key or not settings.google_client_id or not settings.google_client_secret:
        raise HTTPException(status_code=503, detail="Gmail integration is not configured.")
    token = Fernet(settings.gmail_token_key.encode()).decrypt(encrypted_token.encode()).decode()
    credentials = Credentials(token=None, refresh_token=token,
                              token_uri="https://oauth2.googleapis.com/token",
                              client_id=settings.google_client_id, client_secret=settings.google_client_secret,
                              scopes=SCOPES)
    credentials.refresh(GoogleRequest())
    return build("gmail", "v1", credentials=credentials, cache_discovery=False)


def make_raw_email(subject: str, body: str, to: list[str], cc: list[str] | None = None,
                   bcc: list[str] | None = None, message_id: str | None = None) -> str:
    message = EmailMessage()
    message["To"] = ", ".join(to)
    if cc:
        message["Cc"] = ", ".join(cc)
    if bcc:
        message["Bcc"] = ", ".join(bcc)
    message["Subject"] = subject
    if message_id:
        message["Message-ID"] = message_id
        message["Date"] = formatdate(localtime=False, usegmt=True)
    message.set_content(body)
    return base64.urlsafe_b64encode(message.as_bytes()).decode().rstrip("=")
