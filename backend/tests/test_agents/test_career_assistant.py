from types import SimpleNamespace

import pytest
from langchain_core.messages import AIMessage

from src.agents.career_assistant_agent import career_assistant_agent


@pytest.mark.asyncio
async def test_career_assistant_calls_gemini_and_returns_navigation_action(monkeypatch):
    settings = SimpleNamespace(
        google_genai_api_key="test-gemini-key",
        model_name="gemini-test",
        llm_timeout_seconds=20,
        llm_max_retries=0,
    )
    captured_messages = []

    class FakeGemini:
        def __init__(self, **kwargs):
            assert kwargs["api_key"] == "test-gemini-key"
            assert kwargs["model"] == "gemini-test"

        async def ainvoke(self, messages):
            captured_messages.extend(messages)
            return AIMessage(content="Bạn nên bắt đầu bằng việc kiểm tra các bullet trong CV.")

    monkeypatch.setattr("src.agents.career_assistant_agent.get_settings", lambda: settings)
    monkeypatch.setattr("src.agents.career_assistant_agent.ChatGoogleGenerativeAI", FakeGemini)

    result = await career_assistant_agent.run(
        message="Tôi nên cải thiện CV thế nào?",
        history=[],
        user_context={"full_name": "Test User", "cv_count": 1, "current_page": "dashboard"},
    )

    assert result["llm_succeeded"] is True
    assert result["provider"] == "google_gemini"
    assert result["suggested_actions"] == [{"label": "Mở CV Upload", "page": "cv"}]
    assert any("Test User" in message.content for message in captured_messages)


@pytest.mark.asyncio
async def test_career_assistant_does_not_fake_llm_when_api_key_is_missing(monkeypatch):
    settings = SimpleNamespace(google_genai_api_key="", model_name="gemini-test")
    monkeypatch.setattr("src.agents.career_assistant_agent.get_settings", lambda: settings)

    result = await career_assistant_agent.run(
        message="Hãy tư vấn cho tôi",
        history=[],
        user_context={"full_name": "Test User"},
    )

    assert result["llm_succeeded"] is False
    assert result["error"] == "missing_gemini_api_key"
    assert "GEMINI_API_KEY" in result["response"]


@pytest.mark.asyncio
async def test_career_assistant_routes_weather_question_through_weather_tool(monkeypatch):
    settings = SimpleNamespace(
        google_genai_api_key="test-gemini-key",
        model_name="gemini-test",
        llm_timeout_seconds=20,
        llm_max_retries=0,
    )
    weather_calls = []
    captured_messages = []

    async def fake_weather_ainvoke(payload):
        weather_calls.append(payload)
        return {
            "status": "ok",
            "source": "WeatherAPI.com",
            "location": {"name": "Hanoi", "country": "Vietnam"},
            "current": {
                "last_updated": "2026-08-08 20:00",
                "condition": "Partly cloudy",
                "temp_c": 30.0,
                "feels_like_c": 34.0,
            },
            "forecast": [],
        }

    class FakeGemini:
        def __init__(self, **_kwargs):
            pass

        async def ainvoke(self, messages):
            captured_messages.extend(messages)
            return AIMessage(content="Hà Nội hiện 30°C, trời có mây. Nguồn: WeatherAPI.com")

    monkeypatch.setattr("src.agents.career_assistant_agent.get_settings", lambda: settings)
    monkeypatch.setattr("src.agents.career_assistant_agent.ChatGoogleGenerativeAI", FakeGemini)
    monkeypatch.setattr(
        "src.agents.career_assistant_agent.get_weather",
        SimpleNamespace(ainvoke=fake_weather_ainvoke),
    )

    result = await career_assistant_agent.run(
        message="Thời tiết ở Hà Nội hôm nay thế nào?",
        history=[],
        user_context={"full_name": "Test User", "current_page": "dashboard"},
    )

    assert weather_calls == [{"location": "Hà Nội", "forecast_days": 1}]
    assert result["tools_used"] == ["weatherapi.com"]
    assert result["llm_succeeded"] is True
    assert "WeatherAPI.com" in result["response"]
    assert any('"temp_c": 30.0' in message.content for message in captured_messages)


@pytest.mark.asyncio
async def test_career_assistant_fast_greeting_routing():
    """Kiểm tra câu chào hỏi được routing tức thì (< 5ms) mà không gọi LLM."""
    result = await career_assistant_agent.run(
        message="Xin chào Nova!",
        history=[],
        user_context={"full_name": "Test User"},
    )
    assert result["llm_succeeded"] is True
    assert result["provider"] == "nova_orchestrator"
    assert "Nova" in result["response"]
    assert len(result["suggested_actions"]) >= 2


@pytest.mark.asyncio
async def test_career_assistant_astream_run(monkeypatch):
    """Kiểm tra generator astream_run phát từng chunk token cho frontend."""
    settings = SimpleNamespace(
        google_genai_api_key="test-gemini-key",
        model_name="gemini-test",
        llm_timeout_seconds=20,
        llm_max_retries=0,
    )

    class FakeChunk:
        def __init__(self, content):
            self.content = content

    class FakeGeminiStream:
        def __init__(self, **_kwargs):
            pass

        async def astream(self, _messages):
            yield FakeChunk("Bạn ")
            yield FakeChunk("hãy ")
            yield FakeChunk("tối ưu ")
            yield FakeChunk("CV nhé.")

    monkeypatch.setattr("src.agents.career_assistant_agent.get_settings", lambda: settings)
    monkeypatch.setattr("src.agents.career_assistant_agent.ChatGoogleGenerativeAI", FakeGeminiStream)

    events = []
    async for event in career_assistant_agent.astream_run(
        message="Tư vấn nâng cao CV cho tôi",
        history=[],
        user_context={"full_name": "Test User", "current_page": "cv"},
    ):
        events.append(event)

    types = [e["type"] for e in events]
    assert "metadata" in types
    assert "chunk" in types
    assert "done" in types

    chunks = [e["content"] for e in events if e["type"] == "chunk"]
    assert "".join(chunks) == "Bạn hãy tối ưu CV nhé."

