import json
import pytest

from tests.helpers import register_and_login


@pytest.mark.asyncio
async def test_assistant_chat_stream_endpoint(client, monkeypatch):
    _user, headers = await register_and_login(client, email="stream_user@example.com")

    async def fake_astream_run(*, message, history, user_context):
        yield {
            "type": "metadata",
            "intent": "career_chat",
            "suggested_actions": [{"label": "Mở CV", "page": "cv"}],
            "provider": "google_gemini",
            "model": "gemini-test",
        }
        yield {"type": "chunk", "content": "Chào bạn, "}
        yield {"type": "chunk", "content": "tôi có thể giúp bạn tối ưu CV."}
        yield {
            "type": "done",
            "response": "Chào bạn, tôi có thể giúp bạn tối ưu CV.",
            "suggested_actions": [{"label": "Mở CV", "page": "cv"}],
            "tools_used": ["gemini_chat"],
            "provider": "google_gemini",
            "model": "gemini-test",
            "llm_succeeded": True,
        }

    monkeypatch.setattr(
        "src.api.v1.assistant.career_assistant_agent.astream_run",
        fake_astream_run,
    )

    response = await client.post(
        "/api/v1/assistant/chat/stream",
        headers=headers,
        json={"message": "Tư vấn CV cho tôi", "current_page": "cv"},
    )
    assert response.status_code == 200
    assert "text/event-stream" in response.headers.get("content-type", "")

    lines = response.text.strip().split("\n\n")
    events = []
    for block in lines:
        for line in block.split("\n"):
            if line.startswith("data: "):
                events.append(json.loads(line[6:]))

    event_types = [e.get("type") for e in events]
    assert "metadata" in event_types
    assert "chunk" in event_types
    assert "done" in event_types

    chunks = [e.get("content") for e in events if e.get("type") == "chunk"]
    assert "".join(chunks) == "Chào bạn, tôi có thể giúp bạn tối ưu CV."

    # Verify conversation is persisted and listed
    listing = await client.get("/api/v1/assistant/conversations", headers=headers)
    assert listing.status_code == 200
    conversations = listing.json()
    assert len(conversations) >= 1
    assert conversations[0]["title"] == "Tư vấn CV cho tôi"
