"""Vé dùng một lần để mở WebSocket, thay cho việc nhét JWT vào URL.

Trình duyệt không cho đặt header `Authorization` trên WebSocket, và cookie
`career_session` là SameSite=Lax nên KHÔNG được gửi trong handshake cross-site
(production: frontend Vercel, backend Render là hai site khác nhau). Vì vậy
thông tin xác thực buộc phải đi qua URL.

Cái sai không nằm ở "dùng URL" mà ở "dùng JWT phiên". URL bị ghi lại ở access
log, reverse proxy, CDN, APM, lịch sử trình duyệt và header `Referer`; một JWT
còn hạn nằm ở đó là thông tin đăng nhập bị lộ, dùng lại được cho MỌI endpoint
cho tới khi hết hạn.

Vé ở đây thu hẹp thiệt hại xuống gần như bằng không:
  - ngẫu nhiên, không mang thông tin gì
  - sống 30 giây
  - dùng một lần, redeem xong là biến mất
  - gắn chặt vào đúng một `session_id` của đúng một người dùng

Kho lưu trong tiến trình. Đủ cho triển khai một instance như hiện tại; nếu sau
này chạy nhiều instance sau load balancer thì phải chuyển sang Redis (đã có
trong requirements) vì vé cấp ở instance này sẽ không redeem được ở instance
kia.
"""

from __future__ import annotations

import secrets
import time
from dataclasses import dataclass

TICKET_TTL_SECONDS = 30.0

# Chặn kho phình vô hạn nếu vé được cấp mà không ai dùng.
_MAX_TICKETS = 10_000


@dataclass(frozen=True)
class _Ticket:
    user_id: str
    session_id: str
    expires_at: float


_tickets: dict[str, _Ticket] = {}


def _purge_expired(now: float) -> None:
    for key in [k for k, v in _tickets.items() if v.expires_at <= now]:
        _tickets.pop(key, None)


def issue(user_id: str, session_id: str) -> str:
    """Cấp một vé mới cho cặp (người dùng, phiên)."""
    now = time.monotonic()
    _purge_expired(now)
    if len(_tickets) >= _MAX_TICKETS:
        # Hết chỗ nghĩa là đang bị lạm dụng hoặc rò rỉ; bỏ vé cũ nhất để dịch
        # vụ vẫn chạy thay vì từ chối người dùng thật.
        oldest = min(_tickets, key=lambda k: _tickets[k].expires_at)
        _tickets.pop(oldest, None)

    ticket = secrets.token_urlsafe(32)
    _tickets[ticket] = _Ticket(
        user_id=user_id,
        session_id=session_id,
        expires_at=now + TICKET_TTL_SECONDS,
    )
    return ticket


def redeem(ticket: str, session_id: str) -> str | None:
    """Đổi vé lấy user_id. Trả None nếu vé sai, hết hạn, hoặc lệch phiên.

    Vé bị xoá ngay khi tra ra, kể cả khi lệch `session_id`: một vé chỉ được
    trình một lần, trình sai thì mất luôn.
    """
    if not ticket:
        return None
    now = time.monotonic()
    _purge_expired(now)

    entry = _tickets.pop(ticket, None)
    if entry is None:
        return None
    if entry.expires_at <= now:
        return None
    if entry.session_id != session_id:
        return None
    return entry.user_id


def clear() -> None:
    """Dọn kho. Chỉ dùng trong test."""
    _tickets.clear()
