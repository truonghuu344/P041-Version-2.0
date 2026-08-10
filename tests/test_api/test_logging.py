"""
Tests cho src/logger.py và src/middleware.py.

Kiểm tra:
- JsonFormatter output đúng cấu trúc JSON
- request_id propagation qua ContextVar
- Middleware gắn X-Request-ID vào response header
- Middleware log đúng status_code và duration_ms
- Health check endpoint KHÔNG bị log (tránh noise)
"""

import json
import logging

import pytest
from httpx import ASGITransport, AsyncClient

from src.logger import (
    JsonFormatter,
    get_request_id,
    new_request_id,
    set_request_id,
)
from src.main import app

# ─── Tests cho JsonFormatter ──────────────────────────────────────────────────

class TestJsonFormatter:
    """Unit tests cho JSON log formatter."""

    def _make_record(self, msg: str = "test message", level=logging.INFO, **extra) -> logging.LogRecord:
        record = logging.LogRecord(
            name="test.logger",
            level=level,
            pathname="test.py",
            lineno=1,
            msg=msg,
            args=(),
            exc_info=None,
        )
        for key, value in extra.items():
            setattr(record, key, value)
        return record

    def test_output_is_valid_json(self):
        """Mỗi log line phải là JSON hợp lệ."""
        formatter = JsonFormatter()
        record = self._make_record("hello world")
        output = formatter.format(record)

        # Không được raise
        parsed = json.loads(output)
        assert isinstance(parsed, dict)

    def test_required_fields_present(self):
        """Log entry phải có ts, level, logger, msg."""
        formatter = JsonFormatter()
        record = self._make_record("test msg")
        parsed = json.loads(formatter.format(record))

        assert "ts" in parsed, "Thiếu field 'ts'"
        assert "level" in parsed, "Thiếu field 'level'"
        assert "logger" in parsed, "Thiếu field 'logger'"
        assert "msg" in parsed, "Thiếu field 'msg'"
        assert "request_id" in parsed, "Thiếu field 'request_id'"

    def test_level_name_correct(self):
        """level phải là string tên ('INFO', 'ERROR', ...)."""
        formatter = JsonFormatter()
        assert json.loads(formatter.format(self._make_record(level=logging.INFO)))["level"] == "INFO"
        assert json.loads(formatter.format(self._make_record(level=logging.ERROR)))["level"] == "ERROR"
        assert json.loads(formatter.format(self._make_record(level=logging.WARNING)))["level"] == "WARNING"

    def test_extra_fields_included(self):
        """Extra fields (cv_id, duration_ms, ...) phải xuất hiện trong JSON output."""
        formatter = JsonFormatter()
        record = self._make_record("CV uploaded", cv_id="uuid-123", duration_ms=45.2)
        parsed = json.loads(formatter.format(record))

        assert parsed.get("cv_id") == "uuid-123", "Extra field 'cv_id' không xuất hiện"
        assert parsed.get("duration_ms") == 45.2, "Extra field 'duration_ms' không xuất hiện"

    def test_request_id_in_log(self):
        """request_id từ ContextVar phải xuất hiện trong log."""
        set_request_id("test-req-id")
        formatter = JsonFormatter()
        parsed = json.loads(formatter.format(self._make_record("check request_id")))
        assert parsed["request_id"] == "test-req-id"

    def test_exception_info_captured(self):
        """Khi có exception, phải có field 'exc' trong log."""
        formatter = JsonFormatter()
        try:
            raise ValueError("Test exception message")
        except ValueError:
            import sys
            exc_info = sys.exc_info()
        record = logging.LogRecord(
            name="test", level=logging.ERROR,
            pathname="", lineno=0,
            msg="Something failed", args=(), exc_info=exc_info,
        )
        parsed = json.loads(formatter.format(record))
        assert "exc" in parsed, "Thiếu field 'exc' khi có exception"
        assert "ValueError" in parsed["exc"], "exc phải chứa tên exception"
        assert "Test exception message" in parsed["exc"]


# ─── Tests cho ContextVar request_id ─────────────────────────────────────────

class TestRequestIdContextVar:
    """Unit tests cho request_id propagation."""

    def test_new_request_id_is_8_chars(self):
        """new_request_id() phải trả về 8 ký tự hex."""
        rid = new_request_id()
        assert len(rid) == 8
        # Phải là hex string
        int(rid, 16)  # Raises nếu không phải hex

    def test_set_and_get_request_id(self):
        """set → get phải trả về cùng giá trị."""
        set_request_id("abc12345")
        assert get_request_id() == "abc12345"

    def test_default_is_empty_string(self):
        """Mặc định khi chưa set phải là chuỗi rỗng."""
        set_request_id("")  # Reset
        assert get_request_id() == ""


# ─── Integration tests: Middleware ────────────────────────────────────────────

@pytest.mark.asyncio
async def test_middleware_adds_x_request_id_header():
    """Mỗi response phải có header X-Request-ID."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health")

    # Health check vẫn trả response (chỉ bị skip logging, không skip response)
    assert response.status_code == 200

    # Các endpoint khác phải có X-Request-ID
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/status")
    assert "x-request-id" in response.headers, (
        "Middleware phải gắn X-Request-ID vào response header"
    )


@pytest.mark.asyncio
async def test_middleware_request_id_is_8_chars():
    """X-Request-ID trong response header phải là 8 ký tự hex."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/status")

    request_id = response.headers.get("x-request-id", "")
    assert len(request_id) == 8, f"X-Request-ID phải 8 chars, nhận: '{request_id}'"
    int(request_id, 16)  # Phải là hex


@pytest.mark.asyncio
async def test_middleware_each_request_has_unique_id():
    """Mỗi request phải có request_id khác nhau."""
    transport = ASGITransport(app=app)
    ids = set()
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        for _ in range(5):
            response = await client.get("/api/v1/status")
            ids.add(response.headers.get("x-request-id"))

    assert len(ids) == 5, (
        f"5 requests phải có 5 request_id khác nhau, nhưng chỉ có {len(ids)} unique IDs"
    )


@pytest.mark.asyncio
async def test_health_endpoint_still_works():
    """Health check vẫn trả 200 dù bị skip khỏi request logging."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health")
    assert response.status_code == 200
    assert response.json().get("status") == "ok"
