from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="DRAFTLY_", env_file=".env", extra="ignore")

    llm_model: str = "ollama:gemma4:31b-cloud"
    ollama_base_url: str | None = None
    database_url: str = "sqlite+aiosqlite:///./draftly.db"
    request_timeout_seconds: float = 90
    step_pacing_seconds: float = 0

    @property
    def normalized_model(self) -> str:
        return self.llm_model.removeprefix("ollama:")
