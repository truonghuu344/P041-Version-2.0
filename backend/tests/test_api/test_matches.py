from sqlalchemy import select

from src.db.models import (
    CriterionEvaluationArtifact,
    CVChunkArtifact,
    DocumentArtifact,
    JDRequirementArtifact,
    MatchEvidenceArtifact,
    MatchResultArtifact,
    MatchRun,
    RetrievalArtifact,
)
from tests.conftest import TestingSessionLocal
from tests.helpers import insert_cv, insert_jd, register_and_login


async def test_match_job_api_completes_and_persists_traceability(client):
    user, headers = await register_and_login(client, email="match-job@example.com")
    cv = await insert_cv(
        email=user["email"],
        raw_text="[PAGE 1]\nDeveloped REST APIs with Python, FastAPI and PostgreSQL.",
        parsed_json={
            "skills": ["Python", "FastAPI", "PostgreSQL"],
            "experience": [
                {
                    "description": "Developed REST APIs with Python, FastAPI and PostgreSQL.",
                    "source_page": 1,
                }
            ],
        },
    )
    jd = await insert_jd(
        owner_email=user["email"],
        requirements_text="Python, FastAPI and PostgreSQL are required. Design REST APIs.",
    )

    started = await client.post(
        "/api/v1/matches",
        headers=headers,
        json={"candidate_id": cv.id, "job_id": jd.id},
    )
    assert started.status_code == 202, started.text
    match_id = started.json()["match_id"]
    status = await client.get(f"/api/v1/matches/{match_id}", headers=headers)
    assert status.status_code == 200
    assert status.json()["status"] == "COMPLETED"
    assert status.json()["current_step"] == "COMPLETED"
    assert status.json()["progress_percent"] == 100
    assert 0 <= status.json()["final_score"] <= 100

    evidence = await client.get(f"/api/v1/matches/{match_id}/evidence", headers=headers)
    report = await client.get(f"/api/v1/matches/{match_id}/report", headers=headers)
    assert evidence.status_code == 200
    assert report.status_code == 200
    assert report.json()["match_id"] == match_id

    async with TestingSessionLocal() as db:
        assert await db.get(MatchRun, match_id)
        for model in (
            DocumentArtifact,
            CVChunkArtifact,
            JDRequirementArtifact,
            RetrievalArtifact,
            MatchEvidenceArtifact,
            CriterionEvaluationArtifact,
            MatchResultArtifact,
        ):
            count = len(list((await db.execute(select(model))).scalars().all()))
            assert count > 0, model.__name__


async def test_match_api_returns_standard_error_envelope(client):
    _user, headers = await register_and_login(client, email="missing-match@example.com")
    response = await client.get("/api/v1/matches/MATCH_NOT_FOUND", headers=headers)
    assert response.status_code == 404
    assert response.json() == {
        "error": {"code": "MATCH_001", "message": "Match không tồn tại.", "retryable": False}
    }


async def test_match_api_requires_login(client):
    response = await client.post(
        "/api/v1/matches",
        json={"cv_id": "CV_ANY", "job_id": "JD_ANY"},
    )
    assert response.status_code == 401
