from fastapi import APIRouter, Request

from app.integrations.mail import list_connectors
from app.schemas.drafts import ConnectorOut

router = APIRouter(tags=["meta"])


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/connectors", response_model=list[ConnectorOut])
async def connectors(request: Request) -> list[ConnectorOut]:
    configured = bool(request.app.state.settings.google_client_id and request.app.state.settings.google_client_secret
                      and request.app.state.settings.gmail_token_key)
    return [ConnectorOut(key=c.key, name=c.name, description=c.description,
                         status="available" if c.key == "gmail" and configured else c.status)
            for c in list_connectors()]
