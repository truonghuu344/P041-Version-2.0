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
    cv_parser_mode: Literal["local", "gemini"] = "gemini"
    weather_api_key: str = ""

    # Voice Interview (Pipeline 3): Deepgram STT + Gemini Flash LLM + Edge TTS
    deepgram_api_key: str = ""
    openai_api_key: str = ""
    voice_llm_model: str = "gemini-3.5-flash"

    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgrespassword@localhost:5432/career_assistant_db"
    database_echo: bool = False

    # pgvector / Market JD RAG
    vector_search_enabled: bool = False
    vector_embedding_provider: Literal["auto", "gemini", "hashing"] = "auto"
    vector_embedding_model: str = "gemini-embedding-2"
    vector_dimensions: int = Field(default=768, ge=128, le=3072)
    vector_sync_on_startup: bool = True
    vector_auto_sync: bool = True

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
    cv_jd_embedding_provider: Literal["auto", "gemini", "hashing"] = "auto"
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

    @property
    def google_genai_api_key(self) -> str:
        """Ưu tiên GEMINI_API_KEY, sau đó dùng GOOGLE_API_KEY nếu đã cấu hình."""
        return self.gemini_api_key or self.google_api_key


@lru_cache
def get_settings() -> Settings:
    return Settings()
