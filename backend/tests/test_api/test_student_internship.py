import pytest

from src.db.models import StudentInternship
from tests.conftest import TestingSessionLocal
from tests.helpers import register_and_login


@pytest.mark.asyncio
async def test_student_can_submit_and_read_own_internship_report(client):
    student, headers = await register_and_login(client, email="intern-student@example.com")
    async with TestingSessionLocal() as session:
        intern = StudentInternship(
            student_id=student["id"], company_name="Example Co", position="Backend Intern",
            location="HCM", mentor_name="Mentor", mentor_title="Lead", current_week=2,
            total_weeks=12, progress_percent=15, status="ongoing", status_label="Đang thực tập",
        )
        session.add(intern)
        await session.commit()
        await session.refresh(intern)
        internship_id = intern.id
    saved = await client.put(f"/api/v1/candidates/internships/{internship_id}/reports/2", headers=headers, json={
        "title": "Tuần 2", "work_done": "Xây dựng API", "challenges": "Kiểm thử", "next_plan": "Hoàn thiện test",
    })
    assert saved.status_code == 200, saved.text
    detail = await client.get(f"/api/v1/candidates/internships/{internship_id}", headers=headers)
    assert detail.status_code == 200
    assert detail.json()["weekly_reports"][0]["work_done"] == "Xây dựng API"
