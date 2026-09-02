from __future__ import annotations

import logging
import time
import uuid

import jwt
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from src.config import get_settings
from src.core.logging_config import log_error_with_context, mask_sensitive_data, set_request_id

logger = logging.getLogger("api.request")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Logs each incoming request and response with format:
    METHOD | endpoint | user | role | status | duration | requestId
    Also captures errors and details for debugging.
    """

    def __init__(self, app):
        super().__init__(app)
        self.settings = get_settings()

    async def dispatch(self, request: Request, call_next) -> Response:
        started_at = time.perf_counter()

        # 1. Extract or generate requestId
        request_id = (
            request.headers.get("x-request-id")
            or request.headers.get("X-Request-ID")
            or f"req_{uuid.uuid4().hex[:12]}"
        )
        set_request_id(request_id)
        request.state.request_id = request_id

        # 2. Resolve user & role from Authorization header or cookie
        user, role = self._extract_user_and_role(request)

        # 3. Extract path and query params (safely masked)
        path = request.url.path
        raw_query = str(request.url.query)
        masked_query = mask_sensitive_data(raw_query) if raw_query else ""
        query_suffix = f"?{masked_query}" if masked_query else ""
        full_endpoint = f"{path}{query_suffix}"

        is_healthcheck = path in ["/health", "/ready"]

        # Log request receipt in development
        if self.settings.app_env == "development" and not is_healthcheck:
            logger.debug(
                "--> INCOMING: %s | %s | %s | %s | requestId=%s",
                request.method,
                full_endpoint,
                user,
                role,
                request_id,
            )

        try:
            response = await call_next(request)
            duration_ms = (time.perf_counter() - started_at) * 1000
            status_code = response.status_code

            # Standardized log format: METHOD | endpoint | user | role | status | duration
            log_line = f"{request.method} | {full_endpoint} | {user} | {role} | {status_code} | {duration_ms:.2f}ms | requestId={request_id}"

            if is_healthcheck:
                logger.debug(log_line)
            elif status_code >= 500:
                logger.error(log_line)
            elif status_code >= 400:
                logger.warning(log_line)
            else:
                logger.info(log_line)

            response.headers["X-Request-ID"] = request_id
            return response

        except Exception as exc:
            duration_ms = (time.perf_counter() - started_at) * 1000
            log_line = f"{request.method} | {full_endpoint} | {user} | {role} | 500 Internal Error | {duration_ms:.2f}ms | requestId={request_id}"
            logger.error(log_line)
            log_error_with_context(
                logger=logger,
                service=f"API Endpoint {request.method} {path}",
                error=exc,
                req_data={"query": masked_query, "user": user, "role": role},
                exc=exc,
            )
            raise exc

    def _extract_user_and_role(self, request: Request) -> tuple[str, str]:
        """Safely parse JWT claims (sub / role / email) without DB query or throwing."""
        token = None
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:].strip()
        if not token:
            token = request.cookies.get("career_session")

        if not token:
            return "anonymous", "guest"

        try:
            payload = jwt.decode(
                token,
                self.settings.secret_key,
                algorithms=[self.settings.algorithm],
                options={"verify_exp": False},
            )
            role = payload.get("role", "unknown")
            user_id = payload.get("sub", "")
            email = payload.get("email", "")
            user = email or (user_id[:8] if user_id else "unknown")
            return user, role
        except Exception:
            return "invalid_token", "guest"

