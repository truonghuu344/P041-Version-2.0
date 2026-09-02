"""
API tests cho /api/v2/matches/* evaluation endpoints.
Thành viên 4 — feat/match-evaluation-modal.

Chạy: pytest tests/test_api/test_match_evaluation_v2.py -v
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from tests.helpers import register_and_login


async def _auth_headers(client: AsyncClient, email: str = "test4@example.com") -> dict[str, str]:
    """Đăng ký + đăng nhập thật rồi trả về header Authorization.

    Không skip khi auth hỏng: register_and_login assert nên lỗi đăng nhập
    làm test FAIL thay vì âm thầm bỏ qua.
    """
    _, headers = await register_and_login(client, email=email, full_name="Test Member 4")
    return headers


@pytest.mark.asyncio
class TestMatchEvaluationV2Auth:

    async def test_get_evaluation_no_auth_returns_401(self, client: AsyncClient):
        resp = await client.get("/api/v2/matches/some-id/evaluation")
        assert resp.status_code == 401

    async def test_get_evaluation_other_user_cannot_access(self, client: AsyncClient):
        headers = await _auth_headers(client, "user_b_v2@example.com")
        resp = await client.get(
            "/api/v2/matches/some-other-users-match-id/evaluation",
            headers=headers,
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
        headers = await _auth_headers(client, "user_404_v2@example.com")
        resp = await client.get(
            "/api/v2/matches/00000000-0000-0000-0000-000000000000/evaluation",
            headers=headers,
        )
        assert resp.status_code == 404

    async def test_evaluation_response_shape_on_404(self, client: AsyncClient):
        headers = await _auth_headers(client, "user_shape_v2@example.com")
        resp = await client.get(
            "/api/v2/matches/nonexistent/evaluation",
            headers=headers,
        )
        assert resp.status_code == 404
        body = resp.json()
        assert body["error"]["code"] == "MATCH_001"
        assert body["error"]["message"]


@pytest.mark.asyncio
class TestMatchEvaluationV2Schema:

    async def test_get_requirements_pagination_params(self, client: AsyncClient):
        headers = await _auth_headers(client, "user_page_v2@example.com")
        resp = await client.get(
            "/api/v2/matches/nonexistent/evaluation/criteria/required_skills/requirements?page=1&page_size=10",
            headers=headers,
        )
        assert resp.status_code != 422

    async def test_get_requirements_invalid_page_size_returns_422(self, client: AsyncClient):
        headers = await _auth_headers(client, "user_invalid_v2@example.com")
        resp = await client.get(
            "/api/v2/matches/some-id/evaluation/criteria/required_skills/requirements?page_size=9999",
            headers=headers,
        )
        assert resp.status_code == 422

    async def test_get_requirements_invalid_page_zero_returns_422(self, client: AsyncClient):
        headers = await _auth_headers(client, "user_page0_v2@example.com")
        resp = await client.get(
            "/api/v2/matches/some-id/evaluation/criteria/required_skills/requirements?page=0",
            headers=headers,
        )
        assert resp.status_code == 422
