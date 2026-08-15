from __future__ import annotations

import re
import uuid
from typing import Any


class PipelineError(Exception):
    """Typed CV-JD pipeline error rendered with the specification's error envelope."""

    def __init__(self, code: str, message: str, *, status_code: int = 400, retryable: bool = False) -> None:
        super().__init__(f"{code}: {message}")
        self.code = code
        self.message = message
        self.status_code = status_code
        self.retryable = retryable

    def payload(self) -> dict[str, dict[str, Any]]:
        return {
            "error": {
                "code": self.code,
                "message": self.message,
                "retryable": self.retryable,
            }
        }


class CVVariantError(Exception):
    """API v2 error envelope with a trace identifier for support/audit."""

    def __init__(
        self,
        code: str,
        message: str,
        *,
        status_code: int = 400,
        retryable: bool = False,
        trace_id: str | None = None,
    ) -> None:
        super().__init__(f"{code}: {message}")
        self.code = code
        self.message = message
        self.status_code = status_code
        self.retryable = retryable
        self.trace_id = trace_id or uuid.uuid4().hex

    def payload(self) -> dict[str, Any]:
        return {
            "code": self.code,
            "message": self.message,
            "trace_id": self.trace_id,
            "retryable": self.retryable,
        }


def pipeline_error_from_message(
    message: str,
    fallback_code: str,
    *,
    status_code: int,
    retryable: bool = False,
) -> PipelineError:
    prefix, separator, remainder = str(message).partition(":")
    code = prefix.strip() if separator and re.fullmatch(r"[A-Z]+_\d{3}", prefix.strip()) else fallback_code
    detail = remainder.strip() if code != fallback_code or separator else str(message).strip()
    return PipelineError(code, detail or str(message), status_code=status_code, retryable=retryable)
