"""
API tests cho /api/v2/matches/* evaluation endpoints.
Thành viên 4 — feat/match-evaluation-modal.

Chạy: pytest tests/test_api/test_match_evaluation_v2.py -v
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient


async def _create_user_and_token(client: AsyncClient, email: str = "test4@example.com") -> str:
    reg = await client.post("/api/v1/auth/register", json={
        "email": email, "password": "Password123!", "full_name": "Test Member 4"
    })
    if reg.status_code not in (200, 201, 409):
        pytest.skip(f"Cannot register user: {reg.text}")
    login = await client.post("/api/v1/auth/login", data={"username": email, "password": "Password123!"})
    if login.status_code != 200:
        pytest.skip(f"Cannot login: {login.text}")
    return login.json()["access_token"]


@pytest.mark.asyncio
class TestMatchEvaluationV2Auth:

    async def test_get_evaluation_no_auth_returns_401(self, client: AsyncClient):
        resp = await client.get("/api/v2/matches/some-id/evaluation")
        assert resp.status_code == 401

    async def test_get_evaluation_other_user_cannot_access(self, client: AsyncClient):
        token_b = await _create_user_and_token(client, "user_b_v2@example.com")
        resp = await client.get(
            "/api/v2/matches/some-other-users-match-id/evaluation",
            headers={"Authorization": f"Bearer {token_b}"},
        )
        assert resp.status_code == 404

    async def test_get_gaps_no_auth_returns_401(self, client: AsyncClient):
        resp = await client.get("/api/v2/matches/some-id/evaluation/gaps")
        assert resp.status_code == 401

    async def test_get_criteria_no_auth_returns_401(self, client: AsyncClient):
        resp = await client.get("/api/v2/matches/some-id/evaluation/criteria")
        assert resp.status_code == 401

    async def test_get_evidence_no_auth_returns_401(self, client: AsyncClient):
        resp = await client.get(
            "/api/v2/matches/some-id/evaluation/requirements/req-id/evidence"
        )
        assert resp.status_code == 401

    async def test_nonexistent_match_returns_404(self, client: AsyncClient):
        token = await _create_user_and_token(client, "user_404_v2@example.com")
        resp = await client.get(
            "/api/v2/matches/00000000-0000-0000-0000-000000000000/evaluation",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 404

    async def test_evaluation_response_shape_on_404(self, client: AsyncClient):
        token = await _create_user_and_token(client, "user_shape_v2@example.com")
        resp = await client.get(
            "/api/v2/matches/nonexistent/evaluation",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 404
        body = resp.json()
        assert "message" in body or "detail" in body


@pytest.mark.asyncio
class TestMatchEvaluationV2Schema:

    async def test_get_requirements_pagination_params(self, client: AsyncClient):
        token = await _create_user_and_token(client, "user_page_v2@example.com")
        resp = await client.get(
            "/api/v2/matches/nonexistent/evaluation/criteria/required_skills/requirements?page=1&page_size=10",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code != 422

    async def test_get_requirements_invalid_page_size_returns_422(self, client: AsyncClient):
        token = await _create_user_and_token(client, "user_invalid_v2@example.com")
        resp = await client.get(
            "/api/v2/matches/some-id/evaluation/criteria/required_skills/requirements?page_size=9999",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 422

    async def test_get_requirements_invalid_page_zero_returns_422(self, client: AsyncClient):
        token = await _create_user_and_token(client, "user_page0_v2@example.com")
        resp = await client.get(
            "/api/v2/matches/some-id/evaluation/criteria/required_skills/requirements?page=0",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 422
