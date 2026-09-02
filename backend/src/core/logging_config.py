import contextvars
import logging
import os
import re
import sys
import traceback
from typing import Any

from src.config import Settings

SENSITIVE_KEYS = {
    "password",
    "pass",
    "secret",
    "token",
    "access_token",
    "refresh_token",
    "api_key",
    "apikey",
    "authorization",
    "cookie",
    "career_session",
    "smtp_password",
    "postgres_password",
    "mineru_api_token",
    "gemini_api_key",
    "google_api_key",
    "deepgram_api_key",
    "openai_api_key",
    "s3_secret_access_key",
    "s3_access_key_id",
    "initial_admin_password",
    "secret_key",
    "credit_card",
    "card_number",
    "cvv",
}

REDACTED_VALUE = "******"

# ContextVar to hold current request_id across async execution
request_id_ctx: contextvars.ContextVar[str] = contextvars.ContextVar("request_id_ctx", default="-")


def get_request_id() -> str:
    """Get the current request ID from ContextVar."""
    return request_id_ctx.get("-")


def set_request_id(request_id: str) -> None:
    """Set the current request ID into ContextVar."""
    request_id_ctx.set(request_id)


def log_error_with_context(
    logger: logging.Logger,
    service: str,
    error: Exception | str,
    req_data: Any = None,
    exc: Exception | None = None,
) -> None:
    """Log detailed error information including request_id, service name, sanitized request data,
    DB/API error message, and stack trace.
    """
    req_id = get_request_id()
    sanitized_data = mask_sensitive_data(req_data) if req_data is not None else "N/A"
    err_msg = str(error)
    stack_trace = traceback.format_exc() if (exc or isinstance(error, Exception)) else ""

    logger.error(
        "LỖI HỆ THỐNG | requestId=%s | service=%s | request_data=%s | error=%s",
        req_id,
        service,
        sanitized_data,
        err_msg,
    )
    if stack_trace and stack_trace.strip() != "NoneType: None":
        logger.error("STACK TRACE [requestId=%s]:\n%s", req_id, stack_trace)



def mask_sensitive_data(data: Any, max_depth: int = 5) -> Any:
    """Recursively mask sensitive values (passwords, tokens, API keys, secrets) in logs."""
    if max_depth <= 0:
        return data

    if isinstance(data, dict):
        masked_dict = {}
        for key, value in data.items():
            k_lower = str(key).lower()
            if any(sensitive in k_lower for sensitive in SENSITIVE_KEYS):
                masked_dict[key] = REDACTED_VALUE
            elif isinstance(value, (dict, list, tuple)):
                masked_dict[key] = mask_sensitive_data(value, max_depth - 1)
            elif isinstance(value, str) and len(value) > 20 and any(prefix in value for prefix in ["Bearer ", "AIzaSy", "sk-", "eyJh"]):
                masked_dict[key] = REDACTED_VALUE
            else:
                masked_dict[key] = value
        return masked_dict

    if isinstance(data, list):
        return [mask_sensitive_data(item, max_depth - 1) for item in data]

    if isinstance(data, tuple):
        return tuple(mask_sensitive_data(item, max_depth - 1) for item in data)

    if isinstance(data, str):
        # Mask authorization headers or bearer tokens if present in strings
        masked = re.sub(r"(Bearer\s+)[A-Za-z0-9\-_.]+", r"\1" + REDACTED_VALUE, data, flags=re.IGNORECASE)
        # Mask database connection strings: postgresql://user:password@host
        masked = re.sub(r"(://[^:]+:)[^@]+(@)", r"\1" + REDACTED_VALUE + r"\2", masked)
        return masked

    return data


class ColoredFormatter(logging.Formatter):
    """Clean, human-readable terminal log formatter with ANSI colors for development mode."""

    COLOR_CODES = {
        logging.DEBUG: "\033[36m",     # Cyan
        logging.INFO: "\033[32m",      # Green
        logging.WARNING: "\033[33m",   # Yellow
        logging.ERROR: "\033[31m",     # Red
        logging.CRITICAL: "\033[1;31m",# Bold Red
    }
    RESET_CODE = "\033[0m"

    def __init__(self, use_color: bool = True):
        super().__init__(
            fmt="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        self.use_color = use_color and sys.stdout.isatty() and os.name != "nt" or (os.environ.get("FORCE_COLOR") == "1")

    def format(self, record: logging.LogRecord) -> str:
        if isinstance(record.msg, str):
            record.msg = mask_sensitive_data(record.msg)

        original_levelname = record.levelname
        if self.use_color:
            color = self.COLOR_CODES.get(record.levelno, "")
            record.levelname = f"{color}{record.levelname}{self.RESET_CODE}"

        formatted = super().format(record)
        record.levelname = original_levelname
        return formatted


def setup_logging(app_env: str = "development", log_level_str: str = "INFO") -> logging.Logger:
    """Configure standardized application-wide logging."""
    level = getattr(logging, log_level_str.upper(), logging.INFO)

    root_logger = logging.getLogger()
    root_logger.setLevel(level)

    # Avoid duplicate handlers on reloads
    if not root_logger.handlers:
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(level)
        use_color = app_env == "development"
        console_handler.setFormatter(ColoredFormatter(use_color=use_color))
        root_logger.addHandler(console_handler)
    else:
        for handler in root_logger.handlers:
            handler.setLevel(level)

    # Silence overly verbose external loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("watchfiles").setLevel(logging.WARNING)
    logging.getLogger("asyncio").setLevel(logging.WARNING)
    logging.getLogger("multipart").setLevel(logging.WARNING)

    return logging.getLogger("career_assistant")


def log_startup_config(settings: Settings, logger: logging.Logger) -> None:
    """Log essential startup configuration safely with all secrets masked."""
    # Mask database URL
    db_masked = mask_sensitive_data(settings.database_url)

    logger.info("================================================================")
    logger.info("Starting %s [Env: %s]", settings.app_name, settings.app_env)
    logger.info("Host: %s:%d | Timezone: %s | Log Level: %s", settings.app_host, settings.app_port, settings.app_timezone, settings.log_level)
    logger.info("Database: %s", db_masked)
    logger.info("Storage Provider: %s (Bucket: %s)", settings.storage_provider, settings.s3_bucket or "local")
    logger.info("LLM Model: %s (Gemini Key: %s)", settings.model_name, "Configured" if settings.google_genai_api_key else "Not Set")
    logger.info("CV Parser: %s (LLM Structured Parse: %s)", settings.cv_parser_mode, settings.cv_structured_parse_llm_enabled)
    logger.info("OCR Provider: %s (MinerU Token: %s)", settings.ocr_provider, "Configured" if settings.mineru_api_token else "Not Set")
    logger.info("Vector Search: %s (Provider: %s)", "Enabled" if settings.vector_search_enabled else "Disabled", settings.vector_embedding_provider)
    logger.info("Voice STT/TTS: Deepgram=%s, Voice Model=%s", "Configured" if settings.deepgram_api_key else "Not Set", settings.voice_llm_model)
    logger.info("Rate Limit: %d req/min | Max Body: %d MB", settings.api_rate_limit_per_minute, settings.max_request_body_mb)
    logger.info("================================================================")
