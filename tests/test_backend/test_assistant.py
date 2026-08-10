import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

import src.backend.api.assistant as assistant_api
from src.backend.config import Settings
from src.backend.core.dependencies import get_current_user
from src.backend.db.database import get_db_session
from src.backend.db.models import User, UserRole
from src.backend.main import app
from src.backend.models.assistant import (
    AssistantChatRequest,
    AssistantChatResponse,
    AssistantStatusResponse,
    SuggestedAction,
)
from src.backend.services.assistant import (
    CareerAssistantAgent,
    CareerContextTools,
    ConversationNotFoundError,
    GenerationResult,
    MultiProviderTextGenerator,
    _has_usable_api_key,
)


def _user() -> User:
    return User(
        id=str(uuid.uuid4()),
        email="student@example.com",
        full_name="Student Example",
        role=UserRole.STUDENT,
        is_active=True,
        created_at=datetime.now(UTC),
    )


def _authenticated_client() -> TestClient:
    session = AsyncMock(spec=AsyncSession)

    async def fake_database_session():
        yield session

    async def fake_current_user():
        return _user()

    app.dependency_overrides[get_db_session] = fake_database_session
    app.dependency_overrides[get_current_user] = fake_current_user
    return TestClient(app)


def test_assistant_request_rejects_blank_or_oversized_messages() -> None:
    with pytest.raises(ValidationError):
        AssistantChatRequest(message="   ")
    with pytest.raises(ValidationError):
        AssistantChatRequest(message="x" * 4001)


def test_placeholder_api_keys_are_not_treated_as_configured() -> None:
    assert _has_usable_api_key("") is False
    assert _has_usable_api_key("sk-your-key-here") is False
    assert _has_usable_api_key("change-me-openai-key") is False
    assert _has_usable_api_key("provider-key-with-enough-random-characters") is True


def test_status_reports_missing_provider_configuration_for_placeholder_key() -> None:
    settings = Settings(
        _env_file=None,
        openai_api_key="sk-your-key-here",
        gemini_api_key="",
        weather_api_key="",
    )

    status = MultiProviderTextGenerator(settings).status()

    assert status.configured is False
    assert status.provider == "gemini"
    assert status.model == "gemini-3.6-flash"
    assert status.configuration_issue == "Set a valid GEMINI_API_KEY on the backend."


def test_explicit_gemini_provider_never_falls_back_to_openai() -> None:
    settings = Settings(
        _env_file=None,
        assistant_provider="gemini",
        gemini_api_key="valid-gemini-key-with-enough-characters",
        openai_api_key="valid-openai-key-with-enough-characters",
    )

    assert MultiProviderTextGenerator(settings)._provider_order() == ["gemini"]


@pytest.mark.parametrize(
    ("message", "expected"),
    [
        ("Thời tiết Hà Nội hôm nay thế nào?", "Hà Nội"),
        ("Cho tôi biết nhiệt độ ở TP. Hồ Chí Minh bây giờ", "TP. Hồ Chí Minh"),
        ("Ở Đà Nẵng có mưa không?", "Đà Nẵng"),
        ("Weather in Bangkok today", "Bangkok"),
    ],
)
def test_weather_location_is_extracted_from_natural_questions(
    message: str,
    expected: str,
) -> None:
    assert CareerContextTools._extract_weather_location(message) == expected


@pytest.mark.parametrize(
    ("code", "description"),
    [(0, "trời quang"), (3, "nhiều mây"), (63, "mưa"), (81, "mưa rào"), (95, "dông")],
)
def test_open_meteo_weather_codes_are_human_readable(
    code: int,
    description: str,
) -> None:
    assert CareerContextTools._weather_code_description(code) == description


@pytest.mark.asyncio
async def test_weather_tool_adds_verified_context_and_audit_name() -> None:
    tools = CareerContextTools(
        Settings(
            _env_file=None,
            weather_api_key="valid-weather-key-with-enough-characters",
        )
    )
    tools._load_weather = AsyncMock(
        return_value="Current weather (external WeatherAPI data): location=Hanoi, Vietnam"
    )

    context, tools_used = await tools.gather(
        AsyncMock(spec=AsyncSession),
        _user(),
        "Thời tiết Hà Nội hôm nay thế nào?",
        "dashboard",
    )

    assert "location=Hanoi, Vietnam" in context
    assert tools_used == ["user_profile", "current_weather"]
    tools._load_weather.assert_awaited_once_with("Hà Nội")


@pytest.mark.asyncio
async def test_weather_tool_forbids_inventing_live_data_when_not_configured() -> None:
    tools = CareerContextTools(Settings(_env_file=None, weather_api_key=""))

    context, tools_used = await tools.gather(
        AsyncMock(spec=AsyncSession),
        _user(),
        "Thời tiết Hà Nội hôm nay thế nào?",
        "dashboard",
    )

    assert "WeatherAPI is not configured" in context
    assert tools_used == ["user_profile"]


@pytest.mark.asyncio
async def test_gemini_generation_uses_generate_content_api(monkeypatch) -> None:
    captured: dict = {}

    class FakeResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict:
            return {
                "candidates": [{"content": {"parts": [{"text": "Xin chào từ Gemini"}]}}],
                "modelVersion": "gemini-3.6-flash",
            }

    class FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, traceback) -> None:
            return None

        async def post(self, url: str, *, headers: dict, json: dict) -> FakeResponse:
            captured.update(url=url, headers=headers, json=json)
            return FakeResponse()

    monkeypatch.setattr(
        "src.backend.services.assistant.httpx.AsyncClient",
        lambda **_kwargs: FakeClient(),
    )
    generator = MultiProviderTextGenerator(
        Settings(
            _env_file=None,
            assistant_provider="gemini",
            gemini_api_key="valid-gemini-key-with-enough-characters",
            gemini_model="gemini-3.6-flash",
        )
    )

    result = await generator.generate(
        "user-id",
        [{"role": "user", "content": "Xin chào"}],
        "User profile: test",
    )

    assert result.succeeded is True
    assert result.provider == "gemini"
    assert result.text == "Xin chào từ Gemini"
    assert captured["url"].endswith("models/gemini-3.6-flash:generateContent")
    assert captured["json"]["contents"][0]["role"] == "user"
    assert captured["headers"]["x-goog-api-key"]


def test_status_endpoint_is_available_without_authentication(monkeypatch) -> None:
    monkeypatch.setattr(
        assistant_api.assistant_service.agent,
        "status",
        lambda: AssistantStatusResponse(
            configured=True,
            provider="openai",
            model="test-model",
            weather_configured=False,
        ),
    )

    response = TestClient(app).get("/api/v1/assistant/status")

    assert response.status_code == 200
    assert response.json()["provider"] == "openai"


def test_chat_endpoint_requires_authentication() -> None:
    response = TestClient(app).post(
        "/api/v1/assistant/chat",
        json={"message": "Giúp tôi sửa CV", "current_page": "cv"},
    )

    assert response.status_code == 401


def test_chat_endpoint_returns_agent_result(monkeypatch) -> None:
    expected = AssistantChatResponse(
        conversation_id=str(uuid.uuid4()),
        response="Ba ưu tiên cho CV của bạn...",
        suggested_actions=[SuggestedAction(label="Mở trang CV", page="cv")],
        llm_succeeded=True,
        provider="openai",
        model="test-model",
        tools_used=["user_profile", "user_cvs"],
    )
    chat = AsyncMock(return_value=expected)
    monkeypatch.setattr(assistant_api.assistant_service, "chat", chat)
    client = _authenticated_client()
    try:
        response = client.post(
            "/api/v1/assistant/chat",
            json={"message": "Giúp tôi sửa CV", "current_page": "cv"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["response"] == expected.response
    assert response.json()["suggested_actions"][0]["page"] == "cv"
    chat.assert_awaited_once()


def test_foreign_conversation_is_hidden_as_not_found(monkeypatch) -> None:
    detail = AsyncMock(side_effect=ConversationNotFoundError())
    monkeypatch.setattr(assistant_api.assistant_service, "conversation_detail", detail)
    client = _authenticated_client()
    try:
        response = client.get(f"/api/v1/assistant/conversations/{uuid.uuid4()}")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 404
    assert response.json() == {"detail": "Conversation not found"}


@pytest.mark.asyncio
async def test_agent_returns_safe_cv_fallback_when_provider_fails() -> None:
    agent = CareerAssistantAgent()
    agent.tools.gather = AsyncMock(return_value=("User CVs: none uploaded.", ["user_profile", "user_cvs"]))
    agent.generator.generate = AsyncMock(
        return_value=GenerationResult(
            text="",
            provider="openai",
            model="test-model",
            succeeded=False,
            error_code="AuthenticationError",
        )
    )

    result = await agent.respond(
        AsyncMock(spec=AsyncSession),
        _user(),
        AssistantChatRequest(message="Tôi nên sửa CV từ đâu?", current_page="cv"),
        [],
    )

    assert result.generation.succeeded is False
    assert "Không thêm kỹ năng" in result.generation.text
    assert [action.page for action in result.actions] == ["cv", "gap"]
