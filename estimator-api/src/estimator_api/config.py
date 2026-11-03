from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration from environment variables (DATABASE_URL, ML_API_URL, ...).

    The gateway's path prefix (/estimator-api) is set on the server, as UVICORN_ROOT_PATH.
    """

    model_config = SettingsConfigDict(extra="ignore")

    database_url: str = "sqlite+aiosqlite:///./estimates.db"
    ml_api_url: str = "http://localhost:8010"
    # Explicit timeouts, and retries on connection errors only (doc 02, C6).
    ml_connect_timeout: float = 2.0
    ml_read_timeout: float = 5.0
    ml_retries: int = 2
    model_info_ttl_seconds: float = 300.0
    log_level: str = "INFO"
    max_body_bytes: int = 1_048_576


@lru_cache
def get_settings() -> Settings:
    return Settings()
