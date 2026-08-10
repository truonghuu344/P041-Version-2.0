"""
Structured logging cho AI20K Agent.

Thiết kế:
- Dùng Python stdlib logging — không cần dependency mới
- Output JSON mỗi dòng (NDJSON) → dễ ingest bởi Docker logs, Cloud logging
- Mỗi log entry gồm: timestamp, level, request_id, message, và context fields
- RequestID được generate per-request và propagate qua toàn bộ call chain

Cách dùng:
    from src.logger import get_logger
    logger = get_logger(__name__)
    logger.info("CV uploaded", extra={"cv_id": cv_id, "file_size": size})
"""

import json
import logging
import sys
import uuid
from contextvars import ContextVar
from datetime import UTC, datetime
from typing import Any

# Context variable để propagate request_id xuyên suốt 1 request
_request_id_var: ContextVar[str] = ContextVar("request_id", default="")


def get_request_id() -> str:
    """Lấy request_id của request hiện tại (từ ContextVar)."""
    return _request_id_var.get()


def set_request_id(request_id: str) -> None:
    """Set request_id cho request hiện tại."""
    _request_id_var.set(request_id)


def new_request_id() -> str:
    """Tạo request_id mới dạng UUID-short (8 ký tự đầu đủ cho debug)."""
    return str(uuid.uuid4())[:8]


# ─── JSON Log Formatter ───────────────────────────────────────────────────────

class JsonFormatter(logging.Formatter):
    """
    Format mỗi log record thành 1 dòng JSON.

    Output example:
    {
      "ts": "2026-08-09T10:21:49Z",
      "level": "INFO",
      "logger": "src.api.routes",
      "request_id": "a1b2c3d4",
      "msg": "CV uploaded successfully",
      "cv_id": "uuid-here",
      "duration_ms": 123
    }
    """

    def format(self, record: logging.LogRecord) -> str:
        # Base log entry
        entry: dict[str, Any] = {
            "ts": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "level": record.levelname,
            "logger": record.name,
            "request_id": get_request_id() or "no-request",
            "msg": record.getMessage(),
        }

        # Thêm extra fields nếu có (ví dụ: cv_id, duration_ms, status_code)
        # Lọc bỏ các field mặc định của LogRecord để không spam output
        _stdlib_fields = {
            "name", "msg", "args", "levelname", "levelno", "pathname",
            "filename", "module", "exc_info", "exc_text", "stack_info",
            "lineno", "funcName", "created", "msecs", "relativeCreated",
            "thread", "threadName", "processName", "process", "message",
            "taskName",
        }
        for key, value in record.__dict__.items():
            if key not in _stdlib_fields:
                entry[key] = value

        # Exception info nếu có
        if record.exc_info:
            entry["exc"] = self.formatException(record.exc_info)

        return json.dumps(entry, ensure_ascii=False, default=str)


# ─── Logger Factory ───────────────────────────────────────────────────────────

def setup_logging(level: str = "INFO") -> None:
    """
    Setup root logger với JSON formatter.
    Gọi 1 lần duy nhất khi app khởi động (trong lifespan).
    """
    log_level = getattr(logging, level.upper(), logging.INFO)

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())

    root_logger = logging.getLogger()
    root_logger.handlers.clear()
    root_logger.addHandler(handler)
    root_logger.setLevel(log_level)

    # Giảm noise từ các thư viện bên ngoài
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    """
    Factory function — dùng thay vì logging.getLogger() trực tiếp.

    Usage:
        logger = get_logger(__name__)
    """
    return logging.getLogger(name)
