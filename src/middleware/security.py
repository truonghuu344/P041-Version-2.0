from __future__ import annotations

import asyncio
import time
from collections import defaultdict, deque

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response


class ApiProtectionMiddleware(BaseHTTPMiddleware):
    """Protect direct API access and expose coarse request latency."""

    def __init__(self, app, *, requests_per_minute: int = 120, max_body_bytes: int = 12 * 1024 * 1024):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self.max_body_bytes = max_body_bytes
        self._requests: dict[str, deque[float]] = defaultdict(deque)
        self._lock = asyncio.Lock()

    async def dispatch(self, request: Request, call_next) -> Response:
        started = time.perf_counter()
        content_length = request.headers.get("content-length")
        if content_length and content_length.isdigit() and int(content_length) > self.max_body_bytes:
            return JSONResponse({"detail": "Request body is too large"}, status_code=413)

        if request.url.path.startswith("/api/") and not await self._allow_request(request):
            return JSONResponse(
                {"detail": "Too many requests. Please retry shortly."},
                status_code=429,
                headers={"Retry-After": "60"},
            )

        response = await call_next(request)
        elapsed_ms = (time.perf_counter() - started) * 1000
        response.headers["X-Response-Time-Ms"] = f"{elapsed_ms:.2f}"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), geolocation=(), payment=()"
        return response

    async def _allow_request(self, request: Request) -> bool:
        forwarded = request.headers.get("x-forwarded-for", "").split(",", maxsplit=1)[0].strip()
        client_ip = forwarded or (request.client.host if request.client else "unknown")
        key = f"{client_ip}:{request.url.path}"
        now = time.monotonic()
        cutoff = now - 60
        async with self._lock:
            bucket = self._requests[key]
            while bucket and bucket[0] < cutoff:
                bucket.popleft()
            if len(bucket) >= self.requests_per_minute:
                return False
            bucket.append(now)
            return True
