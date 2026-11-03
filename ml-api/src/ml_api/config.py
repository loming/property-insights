from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration from environment variables (MODEL_DIR, ROOT_PATH, ...)."""

    model_config = SettingsConfigDict(extra="ignore")

    # The gateway's path prefix (/ml-api) is set on the server, as UVICORN_ROOT_PATH: FastAPI 0.162
    # deprecates FastAPI(root_path=...).
    model_dir: Path = Path("artifacts")
    log_level: str = "INFO"
    max_body_bytes: int = 1_048_576


@lru_cache
def get_settings() -> Settings:
    return Settings()
