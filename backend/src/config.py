from functools import lru_cache
from pathlib import Path
from typing import Literal
from urllib.parse import quote

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        # Resolve from the repository root so `uvicorn src.main:app` works
        # when launched inside `backend/` as well as from the project root.
        env_file=Path(__file__).resolve().parents[2] / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # App
    app_name: str = "Career Assistant X"
    app_env: Literal["development", "production", "test"] = "development"
    app_port: int = Field(default=8000, ge=1, le=65535)
    app_host: str = "0.0.0.0"
    app_timezone: str = "Asia/Ho_Chi_Minh"
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"
    cors_origins: str = "*"

    # Security & JWT
    secret_key: str = "super-secret-jwt-key-ai20k-p041-career-assistant"
    initial_admin_password: str = ""
    google_oauth_client_id: str = ""
    algorithm: str = "HS256"
    jwt_token_version: int = 2
    access_token_expire_minutes: int = 10080
    api_rate_limit_per_minute: int = Field(default=120, ge=10, le=10_000)
    max_request_body_mb: int = Field(default=22, ge=1, le=100)
    document_max_file_size_mb: int = Field(default=20, ge=1, le=100)
    document_max_pages: int = Field(default=20, ge=1, le=100)
    malware_scan_mode: Literal["auto", "required", "disabled"] = "auto"
    clamav_host: str = "localhost"
    clamav_port: int = Field(default=3310, ge=1, le=65535)
    clamav_timeout_seconds: float = Field(default=5, ge=1, le=60)

    # Object storage. R2 exposes an S3-compatible private API; objects are
    # served through authenticated application endpoints rather than public URLs.
    storage_provider: Literal["local", "r2"] = "local"
    s3_endpoint_url: str = ""
    s3_bucket: str = ""
    s3_region: str = "auto"
    s3_access_key_id: str = ""
    s3_secret_access_key: str = ""
    file_url_ttl_seconds: int = Field(default=300, ge=60, le=3600)

    # Email / password reset OTP. Use a Gmail App Password, never an account password.
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = Field(default=587, ge=1, le=65535)
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from_email: str = ""
    password_reset_otp_expire_minutes: int = Field(default=10, ge=1, le=60)
    password_reset_otp_max_attempts: int = Field(default=5, ge=1, le=10)
    password_reset_otp_resend_seconds: int = Field(default=60, ge=0, le=3600)

    # LLM
    # Gemini Developer API. GOOGLE_API_KEY được hỗ trợ để tương thích với
    # tên biến môi trường chuẩn của SDK Google/LangChain.
    gemini_api_key: str = ""
    google_api_key: str = ""
    model_name: str = "gemini-3.5-flash"
    llm_temperature: float = Field(default=1.0, ge=0.0, le=2.0)
    llm_timeout_seconds: float = Field(default=45, ge=5, le=120)
    llm_max_retries: int = Field(default=1, ge=0, le=3)
    # Local-first: parsing uses deterministic extraction by default. A cloud
    # structured parse is an explicit, deployment-wide opt-in only.
    cv_parser_mode: Literal["local", "gemini"] = "local"
    cv_structured_parse_llm_enabled: bool = False
    # MinerU sends source documents to an external Agent API, so retain
    # Tesseract as the privacy-first default for CV/JD data.
    ocr_provider: Literal["mineru"] = "mineru"
    mineru_agent_base_url: str = "https://mineru.net/api/v1/agent"
    # Precision API token from MinerU Console. When present, it is preferred
    # over the public Agent API and enables the VLM parser.
    mineru_api_token: str = ""
    mineru_precision_base_url: str = "https://mineru.net/api/v4"
    mineru_model_version: Literal["pipeline", "vlm"] = "vlm"
    mineru_language: str = "en"
    mineru_enable_table: bool = True
    mineru_enable_formula: bool = False
    mineru_max_file_size_mb: int = Field(default=10, ge=1, le=200)
    mineru_timeout_seconds: float = Field(default=30, ge=5, le=120)
    mineru_poll_interval_seconds: float = Field(default=2, ge=0.5, le=10)
    mineru_poll_timeout_seconds: float = Field(default=120, ge=10, le=300)
    weather_api_key: str = ""

    # Voice Interview (Pipeline 3): Deepgram STT + Gemini LLM + gTTS
    deepgram_api_key: str = ""
    openai_api_key: str = ""
    voice_llm_model: str = "gemini-3.5-flash"
    voice_llm_fallback_model: str = "gemini-2.0-flash"

    # Database
    # `DATABASE_URL` is preferred for hosted databases. For the local Docker
    # stack, derive it from POSTGRES_* so the API never silently falls back to
    # a hard-coded `postgres` account.
    database_url: str = ""
    postgres_user: str = "career_assistant"
    postgres_password: str = ""
    postgres_db: str = "career_assistant"
    database_echo: bool = False

    @model_validator(mode="after")
    def resolve_database_url(self) -> "Settings":
        if not self.database_url:
            password = quote(self.postgres_password, safe="")
            self.database_url = (
                f"postgresql+asyncpg://{quote(self.postgres_user, safe='')}:{password}"
                f"@localhost:5432/{quote(self.postgres_db, safe='')}"
            )
        return self

    # pgvector / Market JD RAG
    vector_search_enabled: bool = False
    # Do not select a paid embedding API merely because a Gemini key exists.
    vector_embedding_provider: Literal["auto", "gemini", "hashing"] = "hashing"
    vector_embedding_model: str = "gemini-embedding-2"
    vector_dimensions: int = Field(default=768, ge=128, le=3072)
    vector_sync_on_startup: bool = False
    vector_auto_sync: bool = False

    # Top Jobs recommendation (BM25 + vector + weighted RRF + eligibility gate)
    job_recommend_bm25_k: int = Field(default=30, ge=1, le=200)
    job_recommend_vector_k: int = Field(default=30, ge=1, le=200)
    job_recommend_candidate_k: int = Field(default=30, ge=1, le=200)
    job_recommend_final_k: int = Field(default=10, ge=1, le=100)
    job_recommend_rrf_k: int = Field(default=60, ge=1, le=1000)
    job_recommend_bm25_weight: float = Field(default=1.0, ge=0.0, le=10.0)
    job_recommend_vector_weight: float = Field(default=1.0, ge=0.0, le=10.0)
    job_recommend_must_have_threshold: float = Field(default=0.50, ge=0.0, le=1.0)
    job_recommend_score_cap: float = Field(default=49.0, ge=0.0, le=100.0)

    # CV-JD Matching v1 (Requirement -> BM25/Vector -> RRF -> Evidence -> Rubric)
    cv_jd_embedding_provider: Literal["auto", "gemini", "hashing"] = "hashing"
    cv_jd_embedding_model: str = "gemini-embedding-2"
    cv_jd_embedding_dimensions: int = Field(default=768, ge=128, le=3072)
    cv_jd_bm25_top_k: int = Field(default=20, ge=1, le=100)
    cv_jd_semantic_top_k: int = Field(default=20, ge=1, le=100)
    cv_jd_semantic_min_score: float = Field(default=0.45, ge=0.0, le=1.0)
    cv_jd_rrf_k: int = Field(default=60, ge=1, le=1000)
    cv_jd_hybrid_top_k: int = Field(default=10, ge=1, le=100)
    cv_jd_evidence_max_per_requirement: int = Field(default=3, ge=1, le=10)
    cv_jd_score_decimal_places: int = Field(default=1, ge=0, le=4)
    cv_jd_extraction_min_confidence: float = Field(default=0.50, ge=0.0, le=1.0)
    cv_jd_rating_poor_max: float = Field(default=49.9, ge=0.0, le=100.0)
    cv_jd_rating_average_max: float = Field(default=69.9, ge=0.0, le=100.0)
    cv_jd_rating_good_max: float = Field(default=84.9, ge=0.0, le=100.0)
    # LLM may only draft explanatory guidance after deterministic scoring.
    # Keep it opt-in to make cost and data sharing explicit.
    match_explanation_llm_enabled: bool = False
    # Reuse a completed CV/JD analysis whenever both immutable snapshots and
    # this cache version match. Bump the version after changing prompt logic.
    gap_analysis_cache_enabled: bool = True
    gap_analysis_cache_version: str = "v1"

    @property
    def google_genai_api_key(self) -> str:
        """Ưu tiên GEMINI_API_KEY, sau đó dùng GOOGLE_API_KEY nếu đã cấu hình."""
        return self.gemini_api_key or self.google_api_key


@lru_cache
def get_settings() -> Settings:
    return Settings()
