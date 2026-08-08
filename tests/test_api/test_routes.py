import pytest


@pytest.mark.asyncio
async def test_health(client):
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"


@pytest.mark.asyncio
async def test_chat_empty_message(client):
    response = await client.post("/api/v1/chat", json={"message": ""})
    assert response.status_code == 422  # Validation error


@pytest.mark.asyncio
async def test_agent_status(client):
    response = await client.get("/api/v1/status")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_career_assistant_chat_requires_login(client):
    response = await client.post(
        "/api/v1/assistant/chat",
        json={"message": "Hãy giúp tôi sửa CV", "history": [], "current_page": "cv"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_career_assistant_status_contract(client, monkeypatch):
    settings = type(
        "Settings",
        (),
        {
            "model_name": "gemini-test",
            "google_genai_api_key": "key",
            "weather_api_key": "weather-key",
        },
    )()
    monkeypatch.setattr("src.api.v1.assistant.get_settings", lambda: settings)

    response = await client.get("/api/v1/assistant/status")

    assert response.status_code == 200
    assert response.json() == {
        "agent_name": "Nova Career Assistant",
        "provider": "google_gemini",
        "model": "gemini-test",
        "configured": True,
        "weather_configured": True,
    }
