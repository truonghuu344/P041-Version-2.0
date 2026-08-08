from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # App
    app_name: str = "Career Assistant X"
    app_env: Literal["development", "production", "test"] = "development"
    app_port: int = Field(default=8000, ge=1, le=65535)
    app_host: str = "0.0.0.0"
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"
    cors_origins: str = "*"

    # Security & JWT
    secret_key: str = "super-secret-jwt-key-ai20k-p041-career-assistant"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 10080

    # LLM
    # Gemini Developer API. GOOGLE_API_KEY được hỗ trợ để tương thích với
    # tên biến môi trường chuẩn của SDK Google/LangChain.
    gemini_api_key: str = ""
    google_api_key: str = ""
    model_name: str = "gemini-3.5-flash"
    llm_temperature: float = Field(default=1.0, ge=0.0, le=2.0)
    llm_timeout_seconds: float = Field(default=45, ge=5, le=120)
    llm_max_retries: int = Field(default=1, ge=0, le=3)
    cv_parser_mode: Literal["local", "gemini"] = "local"
    weather_api_key: str = ""

    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgrespassword@localhost:5432/career_assistant_db"

    # Vector Store
    chroma_persist_dir: str = "./data/chroma"

    @property
    def google_genai_api_key(self) -> str:
        """Ưu tiên GEMINI_API_KEY, sau đó dùng GOOGLE_API_KEY nếu đã cấu hình."""
        return self.gemini_api_key or self.google_api_key


@lru_cache
def get_settings() -> Settings:
    return Settings()
