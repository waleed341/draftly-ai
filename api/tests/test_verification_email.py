import asyncio
import hmac
from collections.abc import AsyncIterator

import httpx
import pytest

from app.agents.contracts import WriteJob
from app.core.config import Settings
from app.integrations import verification_email
from app.main import create_app


class EmptyWriter:
    async def stream(self, _job: WriteJob) -> AsyncIterator:
        if False:
            yield None


def _gmail_settings(**overrides) -> Settings:
    values = {
        "email_verification_secret": "test-secret-for-email-code-hashing-0001",
        "email_smtp_host": "smtp.gmail.com",
        "email_smtp_port": 587,
        "email_smtp_username": "draftly-sender@example.test",
        "email_smtp_password": "test-app-password",
        "email_smtp_from": "Draftly <draftly-sender@example.test>",
        "email_smtp_use_ssl": False,
    }
    values.update(overrides)
    return Settings(**values)


def test_settings_load_smtp_environment_without_exposing_values(tmp_path):
    env_file = tmp_path / "settings.env"
    env_file.write_text(
        "\n".join(
            [
                "DRAFTLY_EMAIL_VERIFICATION_SECRET=" + ("x" * 40),
                "DRAFTLY_EMAIL_SMTP_HOST=smtp.gmail.com",
                "DRAFTLY_EMAIL_SMTP_PORT=587",
                "DRAFTLY_EMAIL_SMTP_USERNAME=sender@example.test",
                "DRAFTLY_EMAIL_SMTP_PASSWORD=mock-app-password",
                "DRAFTLY_EMAIL_SMTP_FROM=Draftly <sender@example.test>",
                "DRAFTLY_EMAIL_SMTP_USE_SSL=false",
            ]
        ),
        encoding="utf-8",
    )
    settings = Settings(_env_file=env_file)
    assert settings.email_smtp_host == "smtp.gmail.com"
    assert settings.email_smtp_port == 587
    assert settings.email_smtp_use_ssl is False
    assert all(
        [
            bool(settings.email_verification_secret),
            bool(settings.email_smtp_username),
            bool(settings.email_smtp_password),
            bool(settings.email_smtp_from),
        ]
    )
    assert verification_email.email_verification_configured(settings)


def test_gmail_delivery_uses_starttls_and_auth_without_network(monkeypatch):
    calls = []
    captured = {}

    class MockSMTP:
        def __init__(self, host, port, timeout):
            calls.append(("connect", host, port, timeout))

        def __enter__(self):
            return self

        def __exit__(self, *_exc):
            calls.append(("close",))

        def ehlo(self):
            calls.append(("ehlo",))

        def starttls(self):
            calls.append(("starttls",))

        def login(self, _username, _password):
            calls.append(("login",))

        def send_message(self, message):
            captured["to"] = message["To"]
            captured["from"] = message["From"]
            captured["body"] = message.get_content()
            calls.append(("send",))

    monkeypatch.setattr(verification_email.smtplib, "SMTP", MockSMTP)
    monkeypatch.setattr(
        verification_email.smtplib,
        "SMTP_SSL",
        lambda *_args, **_kwargs: pytest.fail("Gmail on port 587 must use STARTTLS, not implicit SSL"),
    )
    settings = _gmail_settings()
    assert verification_email.email_verification_configured(settings)

    asyncio.run(verification_email.send_verification_code(
        settings, "recipient@example.test", "Test User", "123456"
    ))

    assert calls == [
        ("connect", "smtp.gmail.com", 587, 15),
        ("ehlo",),
        ("starttls",),
        ("ehlo",),
        ("login",),
        ("send",),
        ("close",),
    ]
    assert captured["to"] == "recipient@example.test"
    assert captured["from"] == settings.email_smtp_from
    assert "123456" in captured["body"]


def test_verification_hash_is_secret_bound_and_not_plaintext():
    from app.api.routes.auth import _verification_hash

    settings = _gmail_settings()
    hashed = _verification_hash(settings, "person@example.test", "123456")
    assert len(hashed) == 64
    assert not hmac.compare_digest(hashed, "123456")
    assert hmac.compare_digest(hashed, _verification_hash(settings, "person@example.test", "123456"))
    assert not hmac.compare_digest(hashed, _verification_hash(settings, "other@example.test", "123456"))


@pytest.mark.asyncio
async def test_signup_verification_completes_with_mocked_email(monkeypatch):
    from app.api.routes import auth as auth_routes

    settings = _gmail_settings(database_url="sqlite+aiosqlite:///:memory:")
    app = create_app(settings=settings, writer=EmptyWriter())
    delivered = {}

    async def mock_send(_settings, recipient, name, code):
        delivered.update(recipient=recipient, name=name, code=code)

    async def no_rate_limit(*_args, **_kwargs):
        return None

    monkeypatch.setattr(auth_routes, "send_verification_code", mock_send)
    monkeypatch.setattr(auth_routes, "_rate_limit", no_rate_limit)
    monkeypatch.setattr(auth_routes.secrets, "randbelow", lambda _limit: 123456)

    async with app.router.lifespan_context(app), httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        requested = await client.post("/api/auth/register/request-code", json={
            "name": "Test User", "email": "recipient@example.com",
        })
        assert requested.status_code == 202
        assert "123456" not in requested.text
        assert delivered == {
            "recipient": "recipient@example.com", "name": "Test User", "code": "123456",
        }

        verified = await client.post("/api/auth/register/verify-code", json={
            "email": "recipient@example.com", "code": "123456",
        })
        assert verified.status_code == 200
        assert "123456" not in verified.text
        token = verified.json()["registration_token"]

        completed = await client.post("/api/auth/register/complete", json={
            "registration_token": token, "password": "secure-test-password-123",
        })
        assert completed.status_code == 201
        login = await client.post("/api/auth/login", json={
            "email": "recipient@example.com", "password": "secure-test-password-123",
        })
        assert login.status_code == 200

