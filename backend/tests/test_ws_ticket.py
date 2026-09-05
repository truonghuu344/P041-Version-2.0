"""Vé WebSocket: dùng một lần, hết hạn nhanh, gắn chặt vào một phiên.

Những tính chất này là toàn bộ lý do vé tồn tại. JWT phiên bị bỏ khỏi URL vì
URL bị ghi lại ở access log, proxy, CDN và lịch sử trình duyệt; nếu vé không
thực sự dùng-một-lần và ngắn hạn thì việc đổi sang vé chẳng cải thiện gì.
"""

from __future__ import annotations

import logging

import pytest

from src.core.logging_config import _StripQueryStringFilter
from src.services import ws_ticket_service


@pytest.fixture(autouse=True)
def _clean_store():
    ws_ticket_service.clear()
    yield
    ws_ticket_service.clear()


def test_ve_doi_duoc_dung_mot_lan_roi_mat():
    ticket = ws_ticket_service.issue("user-1", "session-1")
    assert ws_ticket_service.redeem(ticket, "session-1") == "user-1"
    # Trình lần hai phải trượt — nếu không, vé lọt log vẫn dùng lại được.
    assert ws_ticket_service.redeem(ticket, "session-1") is None


def test_ve_khong_mo_duoc_phien_khac():
    ticket = ws_ticket_service.issue("user-1", "session-1")
    assert ws_ticket_service.redeem(ticket, "session-2") is None
    # Trình sai phiên cũng đốt vé luôn, không cho thử lại đúng phiên.
    assert ws_ticket_service.redeem(ticket, "session-1") is None


def test_ve_het_han_thi_vo_dung(monkeypatch):
    now = [1000.0]
    monkeypatch.setattr(ws_ticket_service.time, "monotonic", lambda: now[0])
    ticket = ws_ticket_service.issue("user-1", "session-1")
    now[0] += ws_ticket_service.TICKET_TTL_SECONDS + 0.1
    assert ws_ticket_service.redeem(ticket, "session-1") is None


def test_ve_con_han_thi_dung_duoc(monkeypatch):
    now = [1000.0]
    monkeypatch.setattr(ws_ticket_service.time, "monotonic", lambda: now[0])
    ticket = ws_ticket_service.issue("user-1", "session-1")
    now[0] += ws_ticket_service.TICKET_TTL_SECONDS - 0.1
    assert ws_ticket_service.redeem(ticket, "session-1") == "user-1"


def test_ve_rong_hoac_bia_deu_truot():
    assert ws_ticket_service.redeem("", "session-1") is None
    assert ws_ticket_service.redeem("khong-ton-tai", "session-1") is None


def test_hai_ve_khac_nhau():
    a = ws_ticket_service.issue("user-1", "session-1")
    b = ws_ticket_service.issue("user-1", "session-1")
    assert a != b, "vé phải ngẫu nhiên, không được suy ra từ user/session"
    assert len(a) >= 32


def test_ttl_du_ngan():
    """TTL dài thì vé lọt log lại thành vấn đề như JWT."""
    assert ws_ticket_service.TICKET_TTL_SECONDS <= 60


def test_loc_log_cat_query_string():
    f = _StripQueryStringFilter()
    record = logging.LogRecord(
        name="uvicorn.access", level=logging.INFO, pathname=__file__, lineno=1,
        msg='%s - "%s"', args=("127.0.0.1", "WebSocket /api/v1/ws/interview/abc?ticket=SECRET"),
        exc_info=None,
    )
    assert f.filter(record) is True
    rendered = record.getMessage()
    assert "SECRET" not in rendered
    assert "/api/v1/ws/interview/abc" in rendered, "phải giữ lại đường dẫn để còn debug được"


def test_loc_log_khong_dung_toi_dong_khong_co_query():
    f = _StripQueryStringFilter()
    record = logging.LogRecord(
        name="uvicorn.access", level=logging.INFO, pathname=__file__, lineno=1,
        msg="%s", args=("GET /api/v1/health",), exc_info=None,
    )
    f.filter(record)
    assert record.getMessage() == "GET /api/v1/health"


class _FakeWS:
    """Chỉ cần .cookies cho _authenticate_ws."""

    def __init__(self, cookies: dict[str, str] | None = None) -> None:
        self.cookies = cookies or {}


def _make_jwt(user_id: str) -> str:
    import jwt as pyjwt

    from src.config import get_settings

    s = get_settings()
    return pyjwt.encode(
        {"sub": user_id, "ver": s.jwt_token_version},
        s.secret_key,
        algorithm=s.algorithm,
    )


@pytest.mark.asyncio
async def test_jwt_trong_query_bi_tu_choi():
    """Đây là chính lỗ hổng được vá — JWT không còn là chìa mở WebSocket.

    Nếu test này đỏ thì ai đó đã cho phép lại JWT qua query string, và token
    phiên lại rò ra access log, proxy, CDN, lịch sử trình duyệt.
    """
    from src.api.v1.ws_interview import _authenticate_ws

    token = _make_jwt("user-1")
    assert await _authenticate_ws(_FakeWS(), token, "session-1") is None


@pytest.mark.asyncio
async def test_ve_hop_le_mo_duoc_ws():
    from src.api.v1.ws_interview import _authenticate_ws

    ticket = ws_ticket_service.issue("user-1", "session-1")
    assert await _authenticate_ws(_FakeWS(), ticket, "session-1") == "user-1"


@pytest.mark.asyncio
async def test_ve_lech_phien_khong_mo_duoc_ws():
    from src.api.v1.ws_interview import _authenticate_ws

    ticket = ws_ticket_service.issue("user-1", "session-1")
    assert await _authenticate_ws(_FakeWS(), ticket, "session-khac") is None


@pytest.mark.asyncio
async def test_cookie_van_mo_duoc_khi_cung_site():
    """Chạy local qua proxy của Next là cùng site nên cookie vẫn phải dùng được."""
    from src.api.v1.ws_interview import _authenticate_ws

    ws = _FakeWS({"career_session": _make_jwt("user-9")})
    assert await _authenticate_ws(ws, None, "session-1") == "user-9"


@pytest.mark.asyncio
async def test_khong_ve_khong_cookie_thi_truot():
    from src.api.v1.ws_interview import _authenticate_ws

    assert await _authenticate_ws(_FakeWS(), None, "session-1") is None
