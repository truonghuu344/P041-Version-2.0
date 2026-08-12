import pytest

from src.services.job_catalog import load_enterprise_job_catalog
from tests.helpers import insert_cv, register_and_login


def test_enterprise_job_catalog_is_backed_by_raw_jd_files():
    catalog = load_enterprise_job_catalog()
    assert len(catalog) == 98
    assert all(item["source_id"].startswith("JD-") for item in catalog)
    assert all(item["title"] and item["company"] for item in catalog)


@pytest.mark.asyncio
async def test_student_can_search_enterprise_jobs(client):
    _user, headers = await register_and_login(client, email="job-search@example.com")
    response = await client.get("/api/v1/jobs?q=ShopBack", headers=headers)

    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] >= 1
    assert payload["matched_by_cv"] is False
    assert payload["retrieval_mode"] in {"catalog", "qdrant", "keyword_fallback"}
    assert any(job["company"] == "ShopBack" for job in payload["jobs"])


@pytest.mark.asyncio
async def test_student_can_rank_jobs_using_an_owned_cv(client):
    _user, headers = await register_and_login(client, email="job-match@example.com")
    cv = await insert_cv(
        email="job-match@example.com",
        raw_text="Python JavaScript Software Engineering Algorithms FastAPI",
        parsed_json={"skills": ["Python", "JavaScript", "FastAPI"], "projects": [{"name": "API"}]},
    )

    response = await client.get(f"/api/v1/jobs?cv_id={cv.id}&limit=20", headers=headers)

    assert response.status_code == 200
    payload = response.json()
    assert payload["matched_by_cv"] is True
    assert payload["jobs"]
    scores = [job["match_score"] for job in payload["jobs"]]
    assert scores == sorted(scores, reverse=True)
    assert any(job["matched_skills"] for job in payload["jobs"])


@pytest.mark.asyncio
async def test_job_matching_rejects_another_users_cv(client):
    await register_and_login(client, email="job-owner@example.com")
    cv = await insert_cv(email="job-owner@example.com")
    _other, other_headers = await register_and_login(client, email="job-other@example.com")

    response = await client.get(f"/api/v1/jobs?cv_id={cv.id}", headers=other_headers)

    assert response.status_code == 404
