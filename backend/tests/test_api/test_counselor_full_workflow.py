import pytest
from httpx import AsyncClient

from src.core.security import create_access_token
from src.db.models import StudentInternship
from tests.conftest import TestingSessionLocal
from tests.helpers import create_counselor


@pytest.mark.asyncio
async def test_counselor_full_workflow(client: AsyncClient):
    # 1. Counselor account is provisioned by Admin (public self-registration is
    #    student/enterprise only), then logs in with the issued credentials.
    counselor_data, counselor_headers = await create_counselor(
        client,
        email="counselor_full_test@univ.edu.vn",
        full_name="TS. Nguyễn Văn Minh",
    )

    # 2. Register Student
    student_res = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "student_counselor_test@univ.edu.vn",
            "password": "Password123!",
            "full_name": "Trần Thị Mai",
            "role": "student",
        },
    )
    assert student_res.status_code == 201
    student_data = student_res.json()
    student_token = create_access_token(
        data={"sub": student_data["id"], "role": "student", "email": student_data["email"]}
    )
    student_headers = {"Authorization": f"Bearer {student_token}"}

    # 3. Student grants consent to Counselor
    consent_res = await client.post(
        "/api/v1/counselor/consents",
        json={"counselor_email": "counselor_full_test@univ.edu.vn"},
        headers=student_headers,
    )
    assert consent_res.status_code == 201
    assert consent_res.json()["status"] == "active"

    # The counselor receives only internships for students with an active
    # assignment; this is shared storage, not a counselor-side demo record.
    async with TestingSessionLocal() as session:
        session.add(StudentInternship(
            student_id=student_data["id"], company_name="FPT Software",
            position="Backend Intern", location="TP. Ho Chi Minh",
            mentor_name="Enterprise Mentor", mentor_title="Tech Lead",
            current_week=1, total_weeks=12, progress_percent=8,
            status="ongoing", status_label="Dang thuc tap",
        ))
        await session.commit()

    # 4. Counselor Dashboard
    dash_res = await client.get("/api/v1/counselor/dashboard", headers=counselor_headers)
    assert dash_res.status_code == 200
    dash_data = dash_res.json()
    assert "total_students" in dash_data
    assert "partner_companies" in dash_data
    assert "open_talent_requests" in dash_data

    # 5. Counselor List Students (both unpaginated assignments and paginated student list)
    students_unpaginated = await client.get("/api/v1/counselor/students", headers=counselor_headers)
    assert students_unpaginated.status_code == 200
    assert len(students_unpaginated.json()) >= 1
    assert students_unpaginated.json()[0]["student_id"] == student_data["id"]

    students_paginated = await client.get("/api/v1/counselor/students?page=1&page_size=6", headers=counselor_headers)
    assert students_paginated.status_code == 200
    st_list_data = students_paginated.json()
    assert "items" in st_list_data
    assert len(st_list_data["items"]) >= 1

    # 6. Counselor Student Overview
    detail_res = await client.get(f"/api/v1/counselor/students/{student_data['id']}", headers=counselor_headers)
    assert detail_res.status_code == 200
    overview_data = detail_res.json()
    assert overview_data["student"]["id"] == student_data["id"]

    # 7. Counselor Verify Student Profile
    verify_res = await client.post(
        f"/api/v1/counselor/students/{student_data['id']}/verify",
        json={"feedback": "Hồ sơ năng lực tốt, đủ điều kiện tham gia thực tập.", "referral_note": "Tiến cử sang FPT Software"},
        headers=counselor_headers,
    )
    assert verify_res.status_code == 200
    assert verify_res.json()["status"] == "verified"

    # 8. Counselor Assign Task
    task_res = await client.post(
        f"/api/v1/counselor/students/{student_data['id']}/tasks",
        json={
            "title": "Bổ sung Dockerfile & unit test",
            "description": "Thêm unit test đạt coverage 80% cho project API.",
            "due_date": "2026-08-30",
            "priority": "high",
        },
        headers=counselor_headers,
    )
    assert task_res.status_code == 201
    assert task_res.json()["kind"] == "task"

    # 9. Counselor Opportunities
    opp_res = await client.get("/api/v1/counselor/opportunities", headers=counselor_headers)
    assert opp_res.status_code == 200
    assert isinstance(opp_res.json(), list)

    # 10. Counselor Partners
    partners_res = await client.get("/api/v1/counselor/partners", headers=counselor_headers)
    assert partners_res.status_code == 200
    partners = partners_res.json()
    assert len(partners) >= 1
    partner_id = partners[0]["id"]

    partner_detail_res = await client.get(f"/api/v1/counselor/partners/{partner_id}", headers=counselor_headers)
    assert partner_detail_res.status_code == 200
    assert partner_detail_res.json()["id"] == partner_id

    # 11. Counselor Internships
    intern_res = await client.get("/api/v1/counselor/internships", headers=counselor_headers)
    assert intern_res.status_code == 200
    internships = intern_res.json()
    assert len(internships) >= 1
    intern_id = internships[0]["id"]

    intern_detail_res = await client.get(f"/api/v1/counselor/internships/{intern_id}", headers=counselor_headers)
    assert intern_detail_res.status_code == 200
    assert intern_detail_res.json()["id"] == intern_id

    # 12. Counselor Profile Get & Update
    prof_res = await client.get("/api/v1/counselor/profile", headers=counselor_headers)
    assert prof_res.status_code == 200
    prof_data = prof_res.json()
    assert "work_email" in prof_data

    update_prof_res = await client.put(
        "/api/v1/counselor/profile",
        json={
            "full_name": "TS. Nguyễn Văn Minh Cập Nhật",
            "office_hours": "Thứ 2 & Thứ 4 (09:00 - 11:30)",
            "bio": "Cố vấn hướng nghiệp cao cấp",
        },
        headers=counselor_headers,
    )
    assert update_prof_res.status_code == 200
    assert update_prof_res.json()["full_name"] == "TS. Nguyễn Văn Minh Cập Nhật"
    assert update_prof_res.json()["office_hours"] == "Thứ 2 & Thứ 4 (09:00 - 11:30)"
