"""
Middleware ghi log cho mỗi HTTP request/response.

Mỗi request sẽ được log 2 lần:
  1. REQUEST IN  — khi nhận request (method, path, client IP)
  2. RESPONSE OUT — khi trả response (status_code, duration_ms)

Ngoài ra: exception handler toàn cục log traceback đầy đủ cho 5xx errors.
"""

import time

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from src.logger import get_logger, new_request_id, set_request_id

logger = get_logger(__name__)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware ghi log structured cho mỗi HTTP request.

    Log fields:
    - request_id: UUID-short, unique per request
    - method: GET / POST / ...
    - path: URL path (không gồm query string để tránh log sensitive data)
    - client_ip: IP của caller
    - status_code: HTTP status code của response
    - duration_ms: Thời gian xử lý (milliseconds)
    - error: Chi tiết lỗi nếu 5xx

    Các path bị skip (health check):
    - GET /health — tránh spam log khi healthcheck Docker liên tục gọi
    """

    _SKIP_PATHS = {"/health"}

    async def dispatch(self, request: Request, call_next) -> Response:
        # Skip health check để tránh noise
        if request.url.path in self._SKIP_PATHS:
            return await call_next(request)

        # Gán request_id mới — propagate qua ContextVar
        request_id = new_request_id()
        set_request_id(request_id)

        # Đưa request_id vào request.state để handler dùng nếu cần
        request.state.request_id = request_id

        client_ip = (
            request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
            or (request.client.host if request.client else "unknown")
        )

        # ── Log REQUEST IN ──
        logger.info(
            "→ %s %s",
            request.method,
            request.url.path,
            extra={
                "event": "request_in",
                "method": request.method,
                "path": request.url.path,
                "client_ip": client_ip,
            },
        )

        start_time = time.perf_counter()

        try:
            response = await call_next(request)
        except Exception as exc:
            # Lỗi không được catch bởi route handler → log traceback đầy đủ
            duration_ms = round((time.perf_counter() - start_time) * 1000, 1)
            logger.error(
                "✗ UNHANDLED %s %s → 500 (%.1fms)",
                request.method,
                request.url.path,
                duration_ms,
                exc_info=True,
                extra={
                    "event": "unhandled_exception",
                    "method": request.method,
                    "path": request.url.path,
                    "status_code": 500,
                    "duration_ms": duration_ms,
                    "exc_type": type(exc).__name__,
                    "exc_msg": str(exc),
                },
            )
            return JSONResponse(
                status_code=500,
                content={
                    "detail": "Internal server error",
                    "request_id": request_id,
                },
            )

        duration_ms = round((time.perf_counter() - start_time) * 1000, 1)
        status_code = response.status_code

        # ── Log RESPONSE OUT ──
        log_fn = logger.warning if status_code >= 400 else logger.info
        symbol = "✓" if status_code < 400 else "✗"

        log_fn(
            "%s %s %s → %d (%.1fms)",
            symbol,
            request.method,
            request.url.path,
            status_code,
            duration_ms,
            extra={
                "event": "response_out",
                "method": request.method,
                "path": request.url.path,
                "status_code": status_code,
                "duration_ms": duration_ms,
            },
        )

        # Gắn request_id vào response header để trace từ client
        response.headers["X-Request-ID"] = request_id
        return response
