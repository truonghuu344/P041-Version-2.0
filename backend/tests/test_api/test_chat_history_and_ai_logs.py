import pytest

from tests.helpers import create_admin, register_and_login


def _agent_result(response: str = "Câu trả lời từ Nova") -> dict:
    return {
        "response": response,
        "provider": "google_gemini",
        "model": "gemini-test",
        "llm_succeeded": True,
        "suggested_actions": [{"label": "Mở CV Upload", "page": "cv"}],
        "tools_used": ["weatherapi.com"],
    }


@pytest.mark.asyncio
async def test_chat_is_persisted_and_can_be_continued(client, monkeypatch):
    _user, headers = await register_and_login(client, email="history@example.com")
    agent_calls = []

    async def fake_run(*, message, history, user_context):
        agent_calls.append({"message": message, "history": history, "context": user_context})
        return _agent_result(f"Nova trả lời: {message}")

    monkeypatch.setattr("src.api.v1.assistant.career_assistant_agent.run", fake_run)

    first = await client.post(
        "/api/v1/assistant/chat",
        headers=headers,
        json={"message": "Hãy giúp tôi sửa CV", "current_page": "cv"},
    )
    assert first.status_code == 200, first.text
    first_body = first.json()
    assert first_body["conversation_id"]
    assert first_body["user_message_id"]
    assert first_body["assistant_message_id"]

    second = await client.post(
        "/api/v1/assistant/chat",
        headers=headers,
        json={
            "message": "Tôi nên sửa phần kỹ năng thế nào?",
            "current_page": "cv",
            "conversation_id": first_body["conversation_id"],
        },
    )
    assert second.status_code == 200
    assert second.json()["conversation_id"] == first_body["conversation_id"]
    assert agent_calls[1]["history"] == [
        {"role": "user", "content": "Hãy giúp tôi sửa CV"},
        {"role": "assistant", "content": "Nova trả lời: Hãy giúp tôi sửa CV"},
    ]

    listing = await client.get("/api/v1/assistant/conversations", headers=headers)
    assert listing.status_code == 200
    assert listing.json()[0]["message_count"] == 4
    assert listing.json()[0]["title"] == "Hãy giúp tôi sửa CV"

    detail = await client.get(
        f"/api/v1/assistant/conversations/{first_body['conversation_id']}",
        headers=headers,
    )
    assert detail.status_code == 200
    assert [message["role"] for message in detail.json()["messages"]] == [
        "user",
        "assistant",
        "user",
        "assistant",
    ]
    assert detail.json()["messages"][1]["suggested_actions"][0]["page"] == "cv"


@pytest.mark.asyncio
async def test_user_cannot_read_continue_or_delete_another_users_conversation(client, monkeypatch):
    _owner, owner_headers = await register_and_login(client, email="chat-owner@example.com")
    _other, other_headers = await register_and_login(client, email="chat-other@example.com")

    async def fake_run(**_kwargs):
        return _agent_result()

    monkeypatch.setattr("src.api.v1.assistant.career_assistant_agent.run", fake_run)
    created = await client.post(
        "/api/v1/assistant/chat",
        headers=owner_headers,
        json={"message": "Prompt riêng tư", "current_page": "dashboard"},
    )
    conversation_id = created.json()["conversation_id"]

    assert (
        await client.get(
            f"/api/v1/assistant/conversations/{conversation_id}",
            headers=other_headers,
        )
    ).status_code == 404
    assert (
        await client.post(
            "/api/v1/assistant/chat",
            headers=other_headers,
            json={"message": "Tiếp tục trái phép", "conversation_id": conversation_id},
        )
    ).status_code == 404
    assert (
        await client.delete(
            f"/api/v1/assistant/conversations/{conversation_id}",
            headers=other_headers,
        )
    ).status_code == 404


@pytest.mark.asyncio
async def test_user_can_delete_own_conversation(client, monkeypatch):
    _user, headers = await register_and_login(client, email="delete-chat@example.com")

    async def fake_run(**_kwargs):
        return _agent_result()

    monkeypatch.setattr("src.api.v1.assistant.career_assistant_agent.run", fake_run)
    created = await client.post(
        "/api/v1/assistant/chat",
        headers=headers,
        json={"message": "Cuộc trò chuyện cần xóa"},
    )
    conversation_id = created.json()["conversation_id"]

    deleted = await client.delete(
        f"/api/v1/assistant/conversations/{conversation_id}",
        headers=headers,
    )
    assert deleted.status_code == 204
    assert (await client.get("/api/v1/assistant/conversations", headers=headers)).json() == []


@pytest.mark.asyncio
async def test_admin_can_view_prompt_response_and_ai_log_metadata(client, monkeypatch):
    _user, user_headers = await register_and_login(
        client,
        email="prompt-author@example.com",
        full_name="Prompt Author",
    )
    _admin, admin_headers = await create_admin(client)

    async def fake_run(**_kwargs):
        return _agent_result("Hà Nội hiện 30°C. Nguồn: WeatherAPI.com")

    monkeypatch.setattr("src.api.v1.assistant.career_assistant_agent.run", fake_run)
    prompt = "Thời tiết ở Hà Nội hôm nay thế nào?"
    chat = await client.post(
        "/api/v1/assistant/chat",
        headers=user_headers,
        json={"message": prompt, "current_page": "dashboard"},
    )
    assert chat.status_code == 200

    logs = await client.get(
        "/api/v1/admin/ai-logs",
        headers=admin_headers,
        params={"search": "prompt-author@example.com"},
    )
    assert logs.status_code == 200, logs.text
    body = logs.json()
    assert body["total"] == 1
    log = body["items"][0]
    assert log["user_email"] == "prompt-author@example.com"
    assert log["user_full_name"] == "Prompt Author"
    assert log["prompt"] == prompt
    assert log["response"] == "Hà Nội hiện 30°C. Nguồn: WeatherAPI.com"
    assert log["provider"] == "google_gemini"
    assert log["model"] == "gemini-test"
    assert log["llm_succeeded"] is True
    assert log["tools_used"] == ["weatherapi.com"]
    assert log["latency_ms"] >= 0

    stats = await client.get("/api/v1/admin/ai-logs/stats", headers=admin_headers)
    assert stats.status_code == 200
    assert stats.json() == {
        "total_requests": 1,
        "successful_requests": 1,
        "failed_requests": 0,
        "unique_users": 1,
    }


@pytest.mark.asyncio
async def test_ai_logs_are_admin_only(client):
    _user, headers = await register_and_login(client, email="not-admin-log@example.com")
    assert (await client.get("/api/v1/admin/ai-logs", headers=headers)).status_code == 403
    assert (await client.get("/api/v1/admin/ai-logs/stats", headers=headers)).status_code == 403


@pytest.mark.asyncio
async def test_agent_failure_is_returned_safely_and_written_to_ai_log(client, monkeypatch):
    _user, user_headers = await register_and_login(client, email="failed-ai-call@example.com")
    _admin, admin_headers = await create_admin(client)

    async def failing_run(**_kwargs):
        raise RuntimeError("provider secret must not be returned")

    monkeypatch.setattr("src.api.v1.assistant.career_assistant_agent.run", failing_run)
    chat = await client.post(
        "/api/v1/assistant/chat",
        headers=user_headers,
        json={"message": "Prompt gây lỗi"},
    )
    assert chat.status_code == 200
    assert chat.json()["llm_succeeded"] is False
    assert "provider secret" not in chat.text

    logs = await client.get(
        "/api/v1/admin/ai-logs",
        headers=admin_headers,
        params={"success": "false"},
    )
    assert logs.status_code == 200
    assert logs.json()["total"] == 1
    assert logs.json()["items"][0]["error_code"] == "RuntimeError"
    assert "provider secret" not in logs.text
