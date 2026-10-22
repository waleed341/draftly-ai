import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.agents.contracts import DraftWriter
from app.api.routes import auth, drafts, gmail, meta, safety, schedules
from app.core.config import Settings, get_settings
from app.core.errors import register_error_handlers
from app.core.logging import configure_logging
from app.db.session import build_engine, build_session_factory, create_schema
from app.repositories.uow import UnitOfWork
from app.services.draft_service import DraftService
from app.services.safety import SafetyService

log = logging.getLogger(__name__)


def create_app(settings: Settings | None = None, writer: DraftWriter | None = None) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings.log_level)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        engine = build_engine(settings.database_url)
        await create_schema(engine)
        session_factory = build_session_factory(engine)
        app.state.sessions = session_factory
        app.state.settings = settings
        app.state.local_rate_limits = {}
        draft_writer = writer
        if draft_writer is None:
            from app.agents.langchain_writer import LangChainDraftWriter

            draft_writer = LangChainDraftWriter(settings)
            log.info("Writer ready with model %s", settings.llm_model)
        app.state.draft_service = DraftService(
            uow_factory=lambda: UnitOfWork(session_factory),
            writer=draft_writer,
            safety=SafetyService(),
            settings=settings,
        )
        yield
        await engine.dispose()

    app = FastAPI(title=settings.app_name, lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
        allow_credentials=True,
    )
    register_error_handlers(app)
    for router in (meta.router, auth.router, drafts.router, safety.router, gmail.router, schedules.router):
        app.include_router(router, prefix="/api")
    return app


# Module-level app for `uv run fastapi dev` / `fastapi run` (they look for `app` in app/main.py).
app = create_app()
