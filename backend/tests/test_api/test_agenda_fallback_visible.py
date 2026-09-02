"""Regression test cho issue #67 — bộ câu hỏi rơi về generic phải nhìn thấy được.

Trước đây `_call_llm` bọc mọi thứ trong một `except Exception` duy nhất:

- JSON hỏng (lỗi ngẫu nhiên, thường không lặp lại) không được thử lại.
- Timeout / thiếu key / lỗi mạng bị trộn chung với lỗi parse nên log không cho
  biết nguyên nhân thật.

Cả hai đều dẫn tới cùng một kết quả: `generated_by="fallback"`, người dùng nhận
bộ câu hỏi generic mà giao diện không hề báo.

Test này khoá hai hành vi: retry đúng MỘT lần cho riêng lỗi parse, và không
retry cho các lỗi khác. Việc hiển thị cảnh báo nằm ở frontend (app.js) nên
không kiểm được ở đây.
"""

from __future__ import annotations

import json
import sys
import types
from types import SimpleNamespace

import pytest

from src.services import interview_agenda_service as svc

SPEC = {
    "quotas": {"Giới thiệu": 1},
    "total": 1,
    "competencies": ["Giới thiệu"],
    "star_dimensions": ["situation"],
    "jd_title": "Backend Developer",
    "role_family": "backend",
    "jd_skills": ["Python"],
}


class _FakeResponse:
    def __init__(self, content: str) -> None:
        self.content = content


def _stub_settings(monkeypatch, *, api_key: str) -> None:
    """`google_genai_api_key` là property chỉ đọc nên phải thay cả get_settings."""
    stub = SimpleNamespace(
        google_genai_api_key=api_key,
        model_name="gemini-flash-test",
        llm_timeout_seconds=5,
        llm_max_retries=0,
    )
    monkeypatch.setattr(svc, "get_settings", lambda: stub)


def _install_fake_llm(monkeypatch, responses: list) -> dict[str, int]:
    """Ép `_call_llm` đi vào nhánh gọi LLM và trả lần lượt `responses`."""
    calls = {"count": 0}

    class _FakeLLM:
        def __init__(self, **_kwargs) -> None:
            pass

        async def ainvoke(self, _messages):
            index = calls["count"]
            calls["count"] += 1
            payload = responses[min(index, len(responses) - 1)]
            if isinstance(payload, Exception):
                raise payload
            return _FakeResponse(payload)

    _stub_settings(monkeypatch, api_key="fake-key-for-test")

    fake_module = types.ModuleType("langchain_google_genai")
    fake_module.ChatGoogleGenerativeAI = _FakeLLM
    monkeypatch.setitem(sys.modules, "langchain_google_genai", fake_module)

    messages_module = types.ModuleType("langchain_core.messages")
    messages_module.HumanMessage = lambda content: {"role": "user", "content": content}
    messages_module.SystemMessage = lambda content: {"role": "system", "content": content}
    monkeypatch.setitem(sys.modules, "langchain_core.messages", messages_module)

    return calls


@pytest.mark.asyncio
async def test_json_hong_duoc_thu_lai_dung_mot_lan(monkeypatch):
    """JSON hỏng lần 1, hợp lệ lần 2 -> dùng kết quả lần 2, không fallback."""
    broken = '{"questions": [ {"question_vi": "a" '  # thiếu dấu đóng
    good = '{"questions": [{"question_vi": "Giới thiệu bản thân?"}]}'
    calls = _install_fake_llm(monkeypatch, [broken, good])

    raw, generated_by = await svc._call_llm(SPEC, "CV text", "JD text")

    assert calls["count"] == 2, "Phải thử lại đúng 1 lần khi JSON hỏng"
    assert generated_by != "fallback", "Lần 2 parse được thì không được fallback"
    assert raw == json.loads(good)


@pytest.mark.asyncio
async def test_json_hong_ca_hai_lan_thi_fallback(monkeypatch):
    """Hỏng cả 2 lần -> fallback, và KHÔNG thử lần thứ 3."""
    broken = '{"questions": [ {"question_vi": "a" '
    calls = _install_fake_llm(monkeypatch, [broken, broken])

    raw, generated_by = await svc._call_llm(SPEC, "CV text", "JD text")

    assert calls["count"] == 2, "Chỉ được thử tối đa 2 lần"
    assert raw is None
    assert generated_by == "fallback"


@pytest.mark.asyncio
async def test_loi_khac_parse_thi_khong_retry(monkeypatch):
    """Timeout/mạng/auth -> fallback ngay, không tốn thêm một lượt gọi LLM."""
    calls = _install_fake_llm(monkeypatch, [TimeoutError("het thoi gian cho")])

    raw, generated_by = await svc._call_llm(SPEC, "CV text", "JD text")

    assert calls["count"] == 1, "Lỗi không phải parse thì không được retry"
    assert raw is None
    assert generated_by == "fallback"


@pytest.mark.asyncio
async def test_thieu_api_key_thi_fallback_khong_goi_llm(monkeypatch):
    """Không có key -> fallback ngay, không dựng client LLM."""
    _stub_settings(monkeypatch, api_key="")

    raw, generated_by = await svc._call_llm(SPEC, "CV text", "JD text")

    assert raw is None
    assert generated_by == "fallback"
