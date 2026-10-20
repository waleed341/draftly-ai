import json
from collections.abc import AsyncIterator

import httpx
import pytest

from app.agents.contracts import TextDelta, ToolCalled, ToolReturned, WriteJob
from app.core.config import Settings
from app.main import create_app
from app.models import Draft


class FakeWriter:
    async def stream(self, job: WriteJob) -> AsyncIterator:
        yield TextDelta("temporary chatter that must not appear")
        yield ToolCalled("get_today_date")
        yield ToolReturned("get_today_date", "Tuesday, 20 October 2026, 09:00 PM PKT")
        subject = "SUBJECT: A thoughtful note\n---\nHello [Name],\nThank you for your help.\n\nDate: Tuesday, 20 October 2026, 09:00 PM PKT"
        if job.rewrite_from:
            subject = subject.replace("A thoughtful note", "Thank you again")
        for chunk in (subject[:24], subject[24:61], subject[61:]):
            yield TextDelta(chunk)


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def client():
    app = create_app(Settings(database_url="sqlite+aiosqlite:///:memory:", step_pacing_seconds=0), FakeWriter())
    async with app.router.lifespan_context(app), httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        yield client


def parse_events(response: httpx.Response) -> list[dict]:
    return [json.loads(line.removeprefix("data: ")) for line in response.text.splitlines() if line.startswith("data: ")]


@pytest.mark.asyncio
async def test_stream_resets_model_chatter_and_returns_reviewable_draft(client):
    response = await client.post("/api/drafts/stream", json={"idea": "Thank my teammate", "timezone": "UTC"})
    assert response.status_code == 200
    events = parse_events(response)
    assert events[0]["type"] == "started"
    assert "reset" in [event["type"] for event in events]
    ready = next(event["draft"] for event in events if event["type"] == "ready")
    assert ready["subject"] == "A thoughtful note"
    assert "temporary chatter" not in ready["body"]
    assert "20 October 2026" in ready["body"]
    assert ready["status"] == "needs_review"


@pytest.mark.asyncio
async def test_blocked_input_fails_before_stream(client):
    response = await client.post("/api/drafts/stream", json={"idea": "Write a threatening email to my coworker", "timezone": "UTC"})
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_invalid_timezone_fails_before_stream(client):
    response = await client.post("/api/drafts/stream", json={"idea": "Write a thank you", "timezone": "Mars/Olympus"})
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_rewrite_conflict_while_draft_is_writing(client):
    created = await client.post("/api/drafts", json={"idea": "Thank my teammate", "timezone": "UTC"})
    draft_id = created.json()["id"]
    app = client._transport.app
    async with app.state.sessions() as session:
        draft = await session.get(Draft, draft_id)
        draft.status = "writing"
        await session.commit()
    response = await client.post(f"/api/drafts/{draft_id}/rewrite", json={"text": "Make it warmer"})
    assert response.status_code == 409


@pytest.mark.asyncio
async def test_edit_rewrite_review_and_approve_flow(client):
    created = await client.post("/api/drafts", json={"idea": "Thank my teammate", "timezone": "UTC"})
    assert created.status_code == 200
    draft_id = created.json()["id"]
    edited = await client.put(f"/api/drafts/{draft_id}/edit", json={"subject": "My edited subject", "body": "Hello [Name]."})
    assert edited.status_code == 200
    assert edited.json()["status"] == "needs_review"
    rewritten = await client.post(f"/api/drafts/{draft_id}/rewrite", json={"text": "Make it warmer"})
    assert rewritten.status_code == 200
    ready = next(event["draft"] for event in parse_events(rewritten) if event["type"] == "ready")
    assert ready["versions"][-1]["source"] == "rewrite"
    assert ready["subject"] == "Thank you again"
    rejected = await client.post(f"/api/drafts/{draft_id}/approve", json={"reviewed": False})
    assert rejected.status_code == 422
    approved = await client.post(f"/api/drafts/{draft_id}/approve", json={"reviewed": True})
    assert approved.status_code == 200
    assert approved.json()["status"] == "approved"


@pytest.mark.asyncio
async def test_discard_and_missing_draft_responses(client):
    created = await client.post("/api/drafts", json={"idea": "Thank my teammate", "timezone": "UTC"})
    draft_id = created.json()["id"]
    discarded = await client.delete(f"/api/drafts/{draft_id}")
    assert discarded.status_code == 204
    missing = await client.get(f"/api/drafts/{draft_id}")
    assert missing.status_code == 404


@pytest.mark.asyncio
async def test_safety_endpoint_reports_blanks(client):
    response = await client.post("/api/safety/check", json={"text": "SUBJECT: Hello\n---\nHi [Name], call me at 555-010-3434."})
    assert response.status_code == 200
    checks = response.json()["checks"]
    assert next(check for check in checks if check["key"] == "personal_details")["passed"] is False
    assert next(check for check in checks if check["key"] == "blanks")["passed"] is False
