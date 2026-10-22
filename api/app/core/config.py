from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime settings. Every field can be set with a DRAFTLY_ environment variable."""

    model_config = SettingsConfigDict(env_prefix="DRAFTLY_", env_file=".env", extra="ignore")

    app_name: str = "Draftly API"
    database_url: str = "sqlite+aiosqlite:///./draftly.db"
    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    # "provider:model", passed to LangChain's init_chat_model.
    llm_model: str = "ollama:gemma4:31b-cloud"
    llm_base_url: str | None = None
    llm_temperature: float = 0.6
    llm_timeout_seconds: float = 120.0

    # Short pause between visible steps so the progress is readable. 0 in tests.
    step_pacing_seconds: float = 0.35

    idea_max_chars: int = 2000
    log_level: str = "INFO"
    cookie_secure: bool = False
    session_days: int = 7
    super_admin_email: str | None = None
    google_client_id: str | None = None
    google_client_secret: str | None = None
    google_redirect_uri: str = "http://localhost:8000/api/gmail/callback"
    gmail_token_key: str | None = None
    frontend_url: str = "http://localhost:3000"
    registration_open: bool = True
    redis_url: str = "redis://localhost:6379/0"
    email_verification_secret: str | None = None
    email_smtp_host: str | None = None
    email_smtp_port: int = 587
    email_smtp_username: str | None = None
    email_smtp_password: str | None = None
    email_smtp_from: str | None = None
    email_smtp_use_ssl: bool = False


@lru_cache
def get_settings() -> Settings:
    return Settings()
