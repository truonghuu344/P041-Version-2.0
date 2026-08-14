from __future__ import annotations

from datetime import datetime, timedelta, timezone, tzinfo
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from langchain_core.tools import tool

DEFAULT_TIMEZONE = "Asia/Ho_Chi_Minh"

_WEEKDAYS_VI = (
    "Thứ Hai",
    "Thứ Ba",
    "Thứ Tư",
    "Thứ Năm",
    "Thứ Sáu",
    "Thứ Bảy",
    "Chủ Nhật",
)


def _resolve_timezone(timezone_name: str) -> tzinfo:
    """Resolve an IANA timezone, with a safe UTC+7 fallback for Vietnam."""
    try:
        return ZoneInfo(timezone_name)
    except ZoneInfoNotFoundError:
        if timezone_name == DEFAULT_TIMEZONE:
            return timezone(timedelta(hours=7), name="UTC+07:00")
        raise


def _now_in_timezone(timezone_name: str) -> datetime:
    return datetime.now(_resolve_timezone(timezone_name))


def _format_utc_offset(value: datetime) -> str:
    raw = value.strftime("%z")
    return f"{raw[:3]}:{raw[3:]}" if len(raw) == 5 else raw


@tool
def get_current_datetime(timezone_name: str = DEFAULT_TIMEZONE) -> dict[str, str]:
    """Lấy ngày và giờ hiện tại từ đồng hồ hệ thống theo múi giờ IANA.

    Args:
        timezone_name: Tên múi giờ IANA, mặc định là Asia/Ho_Chi_Minh.

    Returns:
        Ngày, giờ, thứ, ISO-8601 và UTC offset tại thời điểm tool được gọi.
    """
    normalized_timezone = timezone_name.strip() or DEFAULT_TIMEZONE
    try:
        current = _now_in_timezone(normalized_timezone)
    except (ZoneInfoNotFoundError, ValueError):
        return {
            "status": "error",
            "message": f"Múi giờ không hợp lệ: {normalized_timezone}",
        }

    return {
        "status": "ok",
        "source": "system_clock",
        "timezone": normalized_timezone,
        "utc_offset": _format_utc_offset(current),
        "date": current.strftime("%d/%m/%Y"),
        "time": current.strftime("%H:%M:%S"),
        "weekday": _WEEKDAYS_VI[current.weekday()],
        "iso8601": current.isoformat(timespec="seconds"),
    }
