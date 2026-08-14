from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest

from src.agents.career_assistant_agent import _plan_assistant_action, career_assistant_agent
from src.agents.tools.datetime_tool import get_current_datetime


@pytest.mark.parametrize(
    "message",
    [
        "Bây giờ là mấy giờ?",
        "Hôm nay ngày bao nhiêu?",
        "Giờ hiện tại",
        "What's the time?",
    ],
)
def test_datetime_intent_does_not_offer_unrelated_navigation(message):
    result = _plan_assistant_action({"message": message})
    assert result == {"intent": "datetime", "suggested_actions": []}


def test_career_time_management_question_is_not_datetime_intent():
    result = _plan_assistant_action({"message": "Cách quản lý thời gian khi đi làm?"})
    assert result["intent"] == "career_chat"


@pytest.mark.asyncio
async def test_datetime_tool_returns_exact_timezone_aware_value(monkeypatch):
    fixed = datetime(2026, 8, 12, 17, 45, 30, tzinfo=timezone(timedelta(hours=7)))
    monkeypatch.setattr(
        "src.agents.tools.datetime_tool._now_in_timezone",
        lambda timezone_name: fixed,
    )

    result = await get_current_datetime.ainvoke({"timezone_name": "Asia/Ho_Chi_Minh"})

    assert result == {
        "status": "ok",
        "source": "system_clock",
        "timezone": "Asia/Ho_Chi_Minh",
        "utc_offset": "+07:00",
        "date": "12/08/2026",
        "time": "17:45:30",
        "weekday": "Thứ Tư",
        "iso8601": "2026-08-12T17:45:30+07:00",
    }


@pytest.mark.asyncio
async def test_career_assistant_answers_datetime_without_gemini(monkeypatch):
    async def fake_datetime_ainvoke(payload):
        assert payload == {"timezone_name": "Asia/Tokyo"}
        return {
            "status": "ok",
            "source": "system_clock",
            "timezone": "Asia/Tokyo",
            "utc_offset": "+09:00",
            "date": "12/08/2026",
            "time": "19:45:30",
            "weekday": "Thứ Tư",
            "iso8601": "2026-08-12T19:45:30+09:00",
        }

    monkeypatch.setattr(
        "src.agents.career_assistant_agent.get_settings",
        lambda: SimpleNamespace(app_timezone="Asia/Ho_Chi_Minh"),
    )
    monkeypatch.setattr(
        "src.agents.career_assistant_agent.get_current_datetime",
        SimpleNamespace(ainvoke=fake_datetime_ainvoke),
    )

    result = await career_assistant_agent.run(
        message="Hôm nay là ngày mấy và bây giờ là mấy giờ?",
        history=[],
        user_context={"timezone": "Asia/Tokyo"},
    )

    assert result["response"] == ("Hiện tại là 19:45:30, Thứ Tư, ngày 12/08/2026 (múi giờ Asia/Tokyo, UTC+09:00).")
    assert result["provider"] == "system_clock"
    assert result["model"] == "deterministic_datetime"
    assert result["tools_used"] == ["system_clock"]
