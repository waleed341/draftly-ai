from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from app import models  # noqa: F401
from app.agents.langchain_writer import LangChainDraftWriter
from app.api.routes.drafts import router
from app.core.config import Settings
from app.db.session import make_session_factory
from app.services.draft_service import DraftService


def create_app(settings: Settings | None = None, writer=None) -> FastAPI:
    config = settings or Settings()
    engine, sessions, initialize_db = make_session_factory(config.database_url)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        await initialize_db()
        yield
        await engine.dispose()

    app = FastAPI(title="Draftly", version="1.0.0", lifespan=lifespan)
    app.state.sessions = sessions
    app.state.draft_service = DraftService(sessions, writer or LangChainDraftWriter(config))
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE"],
        allow_headers=["Content-Type"],
    )
    app.include_router(router)

    @app.get("/", include_in_schema=False)
    async def home() -> RedirectResponse:
        return RedirectResponse(url="http://localhost:3000")

    @app.get("/health", include_in_schema=False)
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
