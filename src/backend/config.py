from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime settings loaded from environment variables and the local .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        env_ignore_empty=True,
        extra="ignore",
    )

    # Application
    app_name: str = "Career Assistant Backend"
    app_env: Literal["development", "production", "test"] = "development"
    app_host: str = "0.0.0.0"
    app_port: int = Field(default=8000, ge=1, le=65535)
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"
    secret_key: SecretStr = SecretStr("development-only-change-me")
    access_token_expire_minutes: int = Field(default=60, ge=5, le=1440)
    jwt_issuer: str = "career-assistant"
    jwt_audience: str = "career-assistant-api"
    auth_cookie_name: str = "career_access_token"

    # Database and vector store
    database_url: str = (
        "postgresql+asyncpg://career_assistant:change-me@localhost:5432/career_assistant"
    )
    database_pool_size: int = Field(default=5, ge=1, le=50)
    database_max_overflow: int = Field(default=10, ge=0, le=100)
    database_pool_timeout: int = Field(default=30, ge=1, le=120)
    database_healthcheck_timeout: float = Field(default=5.0, gt=0, le=30)
    chroma_persist_dir: Path = Path("./data/chroma")

    # Browser clients and authentication providers
    cors_origins: str = "http://localhost:3000,http://localhost:8080"
    google_oauth_client_id: str = ""

    # LLM providers. SecretStr prevents accidental disclosure in repr/log output.
    gemini_api_key: SecretStr = SecretStr("")
    openai_api_key: SecretStr = SecretStr("")

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @field_validator("database_url")
    @classmethod
    def normalize_postgresql_driver(cls, value: str) -> str:
        if value.startswith("postgres://"):
            return value.replace("postgres://", "postgresql+asyncpg://", 1)
        if value.startswith("postgresql://"):
            return value.replace("postgresql://", "postgresql+asyncpg://", 1)
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
