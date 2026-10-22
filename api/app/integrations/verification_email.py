import asyncio
import smtplib
from email.message import EmailMessage

from app.core.config import Settings


def email_verification_configured(settings: Settings) -> bool:
    base_configured = bool(
        settings.email_smtp_host
        and settings.email_smtp_from
        and settings.email_verification_secret
        and len(settings.email_verification_secret) >= 32
    )
    has_username, has_password = bool(settings.email_smtp_username), bool(settings.email_smtp_password)
    if not base_configured or has_username != has_password:
        return False
    if (settings.email_smtp_host or "").lower() == "smtp.gmail.com":
        return has_username and has_password and settings.email_smtp_port == 587 and not settings.email_smtp_use_ssl
    return True


def _send(settings: Settings, recipient: str, name: str, code: str) -> None:
    message = EmailMessage()
    message["Subject"] = "Your Draftly verification code"
    message["From"] = settings.email_smtp_from or ""
    message["To"] = recipient
    message.set_content(
        f"Hi {name},\n\nYour Draftly verification code is {code}. "
        "It expires in 10 minutes. If you did not request this code, you can ignore this email.\n"
    )

    if settings.email_smtp_use_ssl:
        with smtplib.SMTP_SSL(settings.email_smtp_host, settings.email_smtp_port, timeout=15) as server:
            if settings.email_smtp_username:
                server.login(settings.email_smtp_username, settings.email_smtp_password or "")
            server.send_message(message)
        return

    with smtplib.SMTP(settings.email_smtp_host, settings.email_smtp_port, timeout=15) as server:
        server.ehlo()
        server.starttls()
        server.ehlo()
        if settings.email_smtp_username:
            server.login(settings.email_smtp_username, settings.email_smtp_password or "")
        server.send_message(message)


async def send_verification_code(settings: Settings, recipient: str, name: str, code: str) -> None:
    await asyncio.to_thread(_send, settings, recipient, name, code)
