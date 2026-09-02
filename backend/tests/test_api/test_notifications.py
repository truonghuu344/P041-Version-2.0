import pytest
from httpx import AsyncClient

from src.services.notification_service import NotificationService
from tests.conftest import TestingSessionLocal
from tests.helpers import register_and_login


@pytest.mark.asyncio
async def test_notifications_crud_and_preferences(client: AsyncClient):
    # 1. Register candidate user
    user, headers = await register_and_login(
        client,
        email="candidate.notifications@example.com",
        full_name="Nguyễn Văn A",
        role="student",
    )

    # 2. Check initial unread count (seed notifications initialized)
    resp = await client.get("/api/v1/notifications/unread-count", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["unread_count"] == 3
    assert data["total_count"] == 3

    # 3. Trigger domain event notification
    async with TestingSessionLocal() as session:
        notifs = await NotificationService.trigger_job_published(
            db=session,
            job_id="job-backend-101",
            job_title="Backend Developer",
            company_name="ABC Technology",
            enterprise_user_id="enterprise-user-1",
            job_tags=["Hybrid", "Full-time"],
            job_location="TP. Hồ Chí Minh",
        )
        assert len(notifs) >= 1

    # 4. List notifications
    list_resp = await client.get("/api/v1/notifications", headers=headers)
    assert list_resp.status_code == 200
    items = list_resp.json()
    assert len(items) >= 1
    first_item = items[0]
    assert first_item["title"] == "Có công việc mới phù hợp với bạn"
    assert "ABC Technology vừa đăng vị trí Backend Developer" in first_item["message"]
    assert first_item["is_read"] is False
    notif_id = first_item["id"]

    # 5. Check updated unread count
    count_resp = await client.get("/api/v1/notifications/unread-count", headers=headers)
    assert count_resp.status_code == 200
    assert count_resp.json()["unread_count"] >= 1

    # 6. Mark single notification as read
    read_resp = await client.patch(f"/api/v1/notifications/{notif_id}/read", headers=headers)
    assert read_resp.status_code == 200
    assert read_resp.json()["is_read"] is True

    # 7. Mark all as read
    mark_all_resp = await client.post("/api/v1/notifications/mark-all-read", headers=headers)
    assert mark_all_resp.status_code == 200
    assert "updated_count" in mark_all_resp.json()

    # 8. Preferences get & update
    pref_get = await client.get("/api/v1/notifications/preferences", headers=headers)
    assert pref_get.status_code == 200
    assert pref_get.json()["email_job_alerts"] is True

    pref_update = await client.put(
        "/api/v1/notifications/preferences",
        headers=headers,
        json={"email_job_alerts": False, "inapp_job_alerts": True},
    )
    assert pref_update.status_code == 200
    assert pref_update.json()["email_job_alerts"] is False
    assert pref_update.json()["inapp_job_alerts"] is True
