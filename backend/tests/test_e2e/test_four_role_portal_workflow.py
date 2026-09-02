"""Real ASGI workflow over an isolated SQLite database for portal roles.

This is intentionally not a mocked service test: every request uses the mounted
FastAPI routers, authentication and the same seed data visible to the portals.
"""

import pytest
from httpx import AsyncClient

from tests.helpers import create_admin, create_counselor, register_and_login


@pytest.mark.asyncio
async def test_three_role_seeded_portal_workflow(client: AsyncClient):
    student, student_headers = await register_and_login(
        client, email="e2e.student@example.com", full_name="E2E Student", role="student"
    )
    _counselor, counselor_headers = await create_counselor(
        client, email="e2e.counselor@example.com", full_name="E2E Counselor"
    )
    _admin, admin_headers = await create_admin(client, email="e2e.admin@example.com")

    # Student: authenticated profile, CV area and notification modal data.
    assert (await client.get("/api/v1/auth/me", headers=student_headers)).status_code == 200
    assert (await client.get("/api/v1/cvs", headers=student_headers)).status_code == 200
    assert (await client.get("/api/v1/notifications", headers=student_headers)).status_code == 200
    profile_payload = {"profile": {"personalInfo": {"phone": "0900000000"}, "skills": ["Python"]}}
    assert (
        await client.put("/api/v1/candidates/profile", headers=student_headers, json=profile_payload)
    ).status_code == 200
    saved_profile = await client.get("/api/v1/candidates/profile", headers=student_headers)
    assert saved_profile.status_code == 200
    assert saved_profile.json()["profile"] == profile_payload["profile"]

    # Consent establishes the relationship that gates every counselor detail/modal action.
    consent = await client.post(
        "/api/v1/counselor/consents",
        headers=student_headers,
        json={"counselor_email": "e2e.counselor@example.com"},
    )
    assert consent.status_code == 201, consent.text

    # Counselor: dashboard and the assigned-student drill-down that powers its task/feedback modals.
    assert (await client.get("/api/v1/auth/me", headers=counselor_headers)).status_code == 200
    dashboard = await client.get("/api/v1/counselor/dashboard", headers=counselor_headers)
    assert dashboard.status_code == 200
    students = await client.get("/api/v1/counselor/students?page=1&page_size=6", headers=counselor_headers)
    assert students.status_code == 200
    assert any(item["id"] == student["id"] for item in students.json()["items"])

    # Admin: reads the live role data seeded above rather than a fixture response.
    assert (await client.get("/api/v1/auth/me", headers=admin_headers)).status_code == 200
    admin_dashboard = await client.get("/api/v1/admin/dashboard", headers=admin_headers)
    assert admin_dashboard.status_code == 200
    users = await client.get("/api/v1/admin/users/page?limit=100", headers=admin_headers)
    assert users.status_code == 200
    seeded_emails = {item["email"] for item in users.json()["items"]}
    assert {student["email"], "e2e.counselor@example.com", "e2e.admin@example.com"} <= seeded_emails
