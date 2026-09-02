"""End-to-end regression cho cổng quản trị /admin/* (UI console + RBAC)."""

import pytest
from sqlalchemy import select

from src.db.models import (
    CounselorAssignment,
    JobApplication,
    Notification,
    StudentInternship,
    UsageEvent,
    User,
)
from tests.conftest import TestingSessionLocal
from tests.helpers import create_admin, insert_jd, register_and_login


async def _seed_internship(*, student_email: str, status: str = "ongoing", report_status: str = "delayed") -> None:
    async with TestingSessionLocal() as session:
        student = (
            await session.execute(select(User).where(User.email == student_email))
        ).scalar_one()
        session.add(
            StudentInternship(
                student_id=student.id,
                company_name="FPT Software",
                position="Backend Intern",
                location="TP.HCM",
                mentor_name="Trần Mentor",
                mentor_title="Team Lead",
                progress_percent=40,
                current_week=5,
                total_weeks=12,
                status=status,
                last_report_status=report_status,
                final_evaluation_json={"score": 8.5} if report_status == "reviewed" else None,
            )
        )
        await session.commit()


# ─── RBAC ─────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_admin_endpoints_reject_non_admin_roles(client):
    _student, student_headers = await register_and_login(client, email="rbac-student@example.com")
    guarded = [
        ("GET", "/api/v1/admin/dashboard"),
        ("GET", "/api/v1/admin/users/page"),
        ("GET", "/api/v1/admin/counselors"),
        ("GET", "/api/v1/admin/recruitment"),
        ("GET", "/api/v1/admin/internships/summary"),
        ("GET", "/api/v1/admin/system"),
        ("GET", "/api/v1/admin/audit-logs"),
        ("GET", "/api/v1/admin/notifications"),
    ]
    for method, path in guarded:
        response = await client.request(method, path, headers=student_headers)
        assert response.status_code == 403, f"{method} {path} -> {response.status_code}"

    broadcast = await client.post(
        "/api/v1/admin/notifications/broadcast",
        json={"title": "Bảo trì hệ thống", "message": "Hệ thống bảo trì lúc 22h.", "target_roles": ["student"]},
        headers=student_headers,
    )
    assert broadcast.status_code == 403


@pytest.mark.asyncio
async def test_admin_endpoints_require_authentication(client):
    response = await client.get("/api/v1/admin/dashboard")
    assert response.status_code in {401, 403}


# ─── Dashboard ────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_dashboard_counts_attention_and_recent_activity(client):
    _admin, admin_headers = await create_admin(client, email="dash-admin@example.com")
    await register_and_login(client, email="dash-student@example.com")
    async with TestingSessionLocal() as session:
        session.add(UsageEvent(event_name="cv_uploaded", metadata_json={"page": "cv"}))
        session.add(
            Notification(
                recipient_user_id=(
                    await session.execute(select(User).where(User.role == "admin"))
                ).scalar_one().id,
                recipient_role="admin",
                type="test_notice",
                title="Kiểm tra thông báo",
                message="Nội dung kiểm tra.",
                priority="normal",
                action_url="/notifications",
                is_read=False,
            )
        )
        await session.commit()

    response = await client.get("/api/v1/admin/dashboard", headers=admin_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["counts"]["users"] >= 2
    assert body["counts"]["students"] >= 1
    assert isinstance(body["recent_activity"], list)


# ─── Users ────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_users_page_supports_search_role_and_pagination(client):
    _admin, admin_headers = await create_admin(client, email="page-admin@example.com")
    for index in range(3):
        await register_and_login(client, email=f"paged{index}@example.com", full_name=f"Sinh Viên {index}")

    first_page = await client.get(
        "/api/v1/admin/users/page?limit=2&role=student", headers=admin_headers
    )
    assert first_page.status_code == 200
    page_body = first_page.json()
    assert len(page_body["items"]) == 2
    assert page_body["total"] >= 3

    searched = await client.get(
        "/api/v1/admin/users/page?search=Sinh+Viên+1", headers=admin_headers
    )
    assert searched.status_code == 200
    assert any("Sinh Viên 1" in item["full_name"] for item in searched.json()["items"])


@pytest.mark.asyncio
async def test_admin_can_create_update_and_delete_account(client):
    admin, admin_headers = await create_admin(client, email="crud-admin@example.com")

    created = await client.post(
        "/api/v1/admin/users",
        json={
            "email": "new-counselor@example.com",
            "password": "Password123!",
            "full_name": "Cố vấn Mới",
            "role": "counselor",
        },
        headers=admin_headers,
    )
    assert created.status_code == 201
    counselor = created.json()
    assert counselor["role"] == "counselor"

    renamed = await client.put(
        f"/api/v1/admin/users/{counselor['id']}",
        json={"full_name": "Cố vấn Đổi Tên"},
        headers=admin_headers,
    )
    assert renamed.status_code == 200
    assert renamed.json()["full_name"] == "Cố vấn Đổi Tên"

    deleted = await client.delete(f"/api/v1/admin/users/{counselor['id']}", headers=admin_headers)
    assert deleted.status_code == 204

    missing = await client.get(f"/api/v1/admin/users/{counselor['id']}", headers=admin_headers)
    assert missing.status_code == 404
    del admin


# ─── Counselors ───────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_counselor_assignments_listing(client):
    _admin, admin_headers = await create_admin(client, email="assign-admin@example.com")
    _student, _headers = await register_and_login(client, email="assigned-student@example.com")
    counselor_response = await client.post(
        "/api/v1/admin/users",
        json={
            "email": "assignment-counselor@example.com",
            "password": "Password123!",
            "full_name": "Cố vấn Phân Công",
            "role": "counselor",
        },
        headers=admin_headers,
    )
    counselor = counselor_response.json()
    async with TestingSessionLocal() as session:
        student = (
            await session.execute(select(User).where(User.email == "assigned-student@example.com"))
        ).scalar_one()
        session.add(
            CounselorAssignment(counselor_id=counselor["id"], student_id=student.id, status="active")
        )
        await session.commit()

    counselors = await client.get("/api/v1/admin/counselors", headers=admin_headers)
    target = next(row for row in counselors.json() if row["id"] == counselor["id"])
    assert target["active_assignments"] == 1

    assignments = await client.get(
        f"/api/v1/admin/counselors/{counselor['id']}/assignments", headers=admin_headers
    )
    assert assignments.status_code == 200
    items = assignments.json()
    assert len(items) == 1
    assert items[0]["student_email"] == "assigned-student@example.com"
    assert items[0]["status"] == "active"


@pytest.mark.asyncio
async def test_counselor_assignments_404_for_non_counselor(client):
    _admin, admin_headers = await create_admin(client, email="assign-404@example.com")
    student, _headers = await register_and_login(client, email="plain-student@example.com")
    response = await client.get(
        f"/api/v1/admin/counselors/{student['id']}/assignments", headers=admin_headers
    )
    assert response.status_code == 404


# ─── Recruitment & referrals ──────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_recruitment_reports_jobs_applications_referrals_stats(client):
    _admin, admin_headers = await create_admin(client, email="recruit-admin@example.com")
    _employer, _emp_headers = await register_and_login(client, email="recruit-employer@example.com")
    _student, _headers = await register_and_login(client, email="recruit-student@example.com")
    counselor_response = await client.post(
        "/api/v1/admin/users",
        json={
            "email": "referral-counselor@example.com",
            "password": "Password123!",
            "full_name": "Cố vấn Tiến Cử",
            "role": "counselor",
        },
        headers=admin_headers,
    )
    counselor = counselor_response.json()

    jd = await insert_jd(title="Java Intern", owner_email="recruit-employer@example.com")
    from tests.helpers import insert_cv

    cv = await insert_cv(email="recruit-student@example.com")

    async with TestingSessionLocal() as session:
        student = (
            await session.execute(select(User).where(User.email == "recruit-student@example.com"))
        ).scalar_one()
        session.add(
            JobApplication(
                jd_id=jd.id,
                student_id=student.id,
                cv_id=cv.id,
                match_score=72.5,
                status="submitted",
                source="counselor_referral",
                referred_by_counselor_id=counselor["id"],
            )
        )
        await session.commit()

    recruitment = await client.get("/api/v1/admin/recruitment", headers=admin_headers)
    assert recruitment.status_code == 200
    body = recruitment.json()
    assert any(job["title"] == "Java Intern" for job in body["jobs"])
    assert body["stats"]["total_jobs"] >= 1
    assert body["stats"]["total_referrals"] >= 1
    assert any(referral["counselor"] == "Cố vấn Tiến Cử" for referral in body["referrals"])
    assert any(app["source"] == "counselor_referral" for app in body["applications"])

    publish_toggle = await client.patch(
        f"/api/v1/admin/jobs/{jd.id}/publication?is_published=true", headers=admin_headers
    )
    assert publish_toggle.status_code == 200
    assert publish_toggle.json()["is_published"] is True


@pytest.mark.asyncio
async def test_job_publication_toggle_requires_admin(client):
    _student, student_headers = await register_and_login(client, email="pub-student@example.com")
    jd = await insert_jd(title="Secret Role")
    response = await client.patch(
        f"/api/v1/admin/jobs/{jd.id}/publication?is_published=false",
        headers=student_headers,
    )
    assert response.status_code == 403


# ─── Internships ──────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_internship_summary_list_and_detail(client):
    _admin, admin_headers = await create_admin(client, email="intern-admin@example.com")
    _student, _headers = await register_and_login(client, email="intern-student@example.com")
    await _seed_internship(student_email="intern-student@example.com")

    summary = await client.get("/api/v1/admin/internships/summary", headers=admin_headers)
    assert summary.status_code == 200
    summary_body = summary.json()
    assert summary_body["total"] >= 1
    assert summary_body["by_status"].get("ongoing", 0) >= 1
    assert summary_body["reports_by_status"].get("delayed", 0) >= 1

    listing = await client.get("/api/v1/admin/internships", headers=admin_headers)
    assert listing.status_code == 200
    rows = listing.json()
    assert rows[0]["student"]
    internship_id = rows[0]["id"]

    detail = await client.get(f"/api/v1/admin/internships/{internship_id}", headers=admin_headers)
    assert detail.status_code == 200
    detail_body = detail.json()
    assert detail_body["company"] == "FPT Software"
    assert detail_body["mentor_name"]
    assert detail_body["progress_percent"] == 40


@pytest.mark.asyncio
async def test_internship_detail_404_for_unknown_id(client):
    _admin, admin_headers = await create_admin(client, email="intern-404@example.com")
    response = await client.get(
        "/api/v1/admin/internships/00000000-0000-0000-0000-000000000000", headers=admin_headers
    )
    assert response.status_code == 404


# ─── System: audit logs, notifications, broadcast ────────────────────────────


@pytest.mark.asyncio
async def test_system_overview_includes_categories(client):
    _admin, admin_headers = await create_admin(client, email="sys-admin@example.com")
    response = await client.get("/api/v1/admin/system", headers=admin_headers)
    assert response.status_code == 200
    body = response.json()
    assert "notification_categories" in body
    assert "usage_event_count" in body
    assert "ai_log_count" in body


@pytest.mark.asyncio
async def test_audit_logs_feed_with_filters_and_pagination(client):
    _admin, admin_headers = await create_admin(client, email="audit-admin@example.com")
    _student, _headers = await register_and_login(client, email="audit-student@example.com")
    async with TestingSessionLocal() as session:
        session.add_all(
            [
                UsageEvent(event_name="match_run", duration_ms=1200),
                UsageEvent(event_name="interview_started", duration_ms=800),
            ]
        )
        await session.commit()

    feed = await client.get("/api/v1/admin/audit-logs?limit=1", headers=admin_headers)
    assert feed.status_code == 200
    feed_body = feed.json()
    assert feed_body["total"] >= 2
    assert len(feed_body["items"]) == 1
    assert feed_body["items"][0]["event_name"]

    filtered = await client.get(
        "/api/v1/admin/audit-logs?event=interview_started", headers=admin_headers
    )
    assert filtered.status_code == 200
    assert all(item["event_name"] == "interview_started" for item in filtered.json()["items"])

    searched = await client.get("/api/v1/admin/audit-logs?search=interview", headers=admin_headers)
    assert searched.status_code == 200
    assert len(searched.json()["items"]) >= 1


@pytest.mark.asyncio
async def test_notification_monitor_lists_cross_role_feed(client):
    _admin, admin_headers = await create_admin(client, email="notif-admin@example.com")
    _student, _headers = await register_and_login(client, email="notif-student@example.com")
    async with TestingSessionLocal() as session:
        student = (
            await session.execute(select(User).where(User.email == "notif-student@example.com"))
        ).scalar_one()
        session.add(
            Notification(
                recipient_user_id=student.id,
                recipient_role="student",
                type="application_viewed",
                category="application",
                title="Hồ sơ đã được xem",
                message="Doanh nghiệp đã xem hồ sơ của bạn.",
                priority="normal",
                action_url="/match",
                is_read=False,
            )
        )
        await session.commit()

    feed = await client.get("/api/v1/admin/notifications", headers=admin_headers)
    assert feed.status_code == 200
    body = feed.json()
    assert body["total"] >= 1
    assert body["items"][0]["recipient_name"]

    by_category = await client.get(
        "/api/v1/admin/notifications?category=application&unread_only=true", headers=admin_headers
    )
    assert by_category.status_code == 200
    assert by_category.json()["total"] >= 1


@pytest.mark.asyncio
async def test_broadcast_delivers_to_selected_roles_in_single_transaction(client):
    _admin, admin_headers = await create_admin(client, email="bcast-admin@example.com")
    await register_and_login(client, email="bcast-student1@example.com")
    await register_and_login(client, email="bcast-student2@example.com")
    await client.post(
        "/api/v1/admin/users",
        json={
            "email": "bcast-counselor@example.com",
            "password": "Password123!",
            "full_name": "Cố vấn Broadcast",
            "role": "counselor",
        },
        headers=admin_headers,
    )

    response = await client.post(
        "/api/v1/admin/notifications/broadcast",
        json={
            "title": "Bảo trì hệ thống cuối tuần",
            "message": "Hệ thống sẽ bảo trì từ 22:00 thứ Bảy.",
            "target_roles": ["student"],
            "priority": "important",
        },
        headers=admin_headers,
    )
    assert response.status_code == 201
    body = response.json()
    assert body["delivered"] == 2

    async with TestingSessionLocal() as session:
        notices = (
            await session.execute(select(Notification).where(Notification.type == "admin_broadcast"))
        ).scalars().all()
    assert len(notices) == 2
    assert all(notice.recipient_role == "student" for notice in notices)

    # Validation: at least one role must be targeted and unknown roles rejected.
    invalid = await client.post(
        "/api/v1/admin/notifications/broadcast",
        json={"title": "Thử nghiệm sai vai trò", "message": "Không hợp lệ.", "target_roles": ["admin"]},
        headers=admin_headers,
    )
    assert invalid.status_code == 422


# ─── AI logs remain admin-only ───────────────────────────────────────────────


@pytest.mark.asyncio
async def test_ai_log_console_stays_admin_only(client):
    _user, student_headers = await register_and_login(client, email="ailog-student@example.com")
    assert (await client.get("/api/v1/admin/ai-logs", headers=student_headers)).status_code == 403
    _admin, admin_headers = await create_admin(client, email="ailog-admin@example.com")
    stats = await client.get("/api/v1/admin/ai-logs/stats", headers=admin_headers)
    assert stats.status_code == 200
