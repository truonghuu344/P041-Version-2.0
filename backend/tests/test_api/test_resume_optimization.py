from __future__ import annotations

from io import BytesIO

import pytest
from pypdf import PdfReader

from src.db.models import CVAnalysis, JobDescription
from tests.conftest import TestingSessionLocal
from tests.helpers import register_and_login


@pytest.mark.asyncio
async def test_resume_optimizer_endpoint_generates_reviewable_changes_and_guards_edits(client):
    user, headers = await register_and_login(client, email="resume-optimizer@example.com")
    created = await client.post(
        "/api/v1/cvs/manual",
        headers=headers,
        json={
            "title": "Backend CV",
            "template_name": "modern",
            "personal_info": {"full_name": "Evidence User", "email": user["email"]},
            "summary": "Backend developer using Python",
            "skills": ["Python", "REST API"],
            "education": [],
            "experience": [{"role": "Intern", "description": "Built REST API using Python for internal tools"}],
            "projects": [],
        },
    )
    assert created.status_code == 201, created.text
    cv_id = created.json()["id"]

    async with TestingSessionLocal() as session:
        jd = JobDescription(
            title="Backend Developer",
            requirements_text="Required Python, REST API and Docker",
            normalized_json={"seniority": "junior"},
            is_system=True,
            is_published=True,
        )
        session.add(jd)
        await session.flush()
        analysis = CVAnalysis(
            user_id=user["id"],
            cv_id=cv_id,
            jd_id=jd.id,
            match_score=65,
            gap_analysis_json={
                "criteria": [
                    {"criterion_id": "CRIT_REQUIRED_SKILL", "raw_score": 70},
                    {"criterion_id": "CRIT_EXPERIENCE", "raw_score": 60},
                ],
                "requirements": {
                    "required_skills": [
                        {"requirement_type": "JD_REQUIRED_SKILL", "requirement": "Python"},
                        {"requirement_type": "JD_REQUIRED_SKILL", "requirement": "Docker"},
                    ]
                },
                "requirement_evidence": [],
                "hard_skills_matching": ["Python", "REST API"],
                "hard_skills_partial": [],
                "hard_skills_missing": ["Docker"],
                "strengths": ["Python"],
                "integrity_guardrail": "passed",
                "suggestions": [
                    {
                        "original_text": "Built REST API using Python for internal tools",
                        "suggested_improvement": "Developed REST API using Python for internal tools",
                        "reason": "Align verified Python and REST API evidence.",
                    }
                ],
            },
            optimized_suggestions_json=[],
        )
        session.add(analysis)
        await session.commit()
        analysis_id = analysis.id

    optimized = await client.post(
        f"/api/v1/analysis/{analysis_id}/optimize",
        headers=headers,
        json={"language": "vi", "optimization_mode": "balanced"},
    )
    assert optimized.status_code == 200, optimized.text
    body = optimized.json()
    assert body["status"] == "completed"
    assert body["target_job_title"] == "Backend Developer"
    assert body["target_role"] == "Backend Developer"
    assert body["changes"][0]["original"] == "Built REST API using Python for internal tools"
    assert body["changes"][0]["block_id"] == "experience-001-description"
    assert body["patches"][0]["block_id"] == "experience-001-description"
    assert body["patches"][0]["original_text"] == body["changes"][0]["original"]
    assert body["validation"] == {
        "no_fabricated_information": True,
        "no_unverified_metrics": True,
        "no_duplicate_patch_ids": True,
        "all_patch_ids_exist_in_input": True,
        "language_consistent": True,
        "structure_preserved": True,
    }
    assert body["changes"][0]["evidence"]
    assert body["fact_check"]["claims"][0]["status"] == "supported_rephrase"
    assert body["missing_skills_recommendations"][0]["skill"] == "Docker"
    assert all("Docker" not in item["optimized"] for item in body["changes"])

    unsafe_edit = await client.put(
        f"/api/v1/analysis/{analysis_id}/suggestions",
        headers=headers,
        json={
            "suggestion_index": 0,
            "accepted": True,
            "final_text": "Developed Docker REST API using Python and reduced latency by 40%",
        },
    )
    assert unsafe_edit.status_code == 422

    safe_edit = await client.put(
        f"/api/v1/analysis/{analysis_id}/suggestions",
        headers=headers,
        json={
            "suggestion_index": 0,
            "accepted": True,
            "final_text": "Developed REST API using Python for internal tools",
        },
    )
    assert safe_edit.status_code == 200, safe_edit.text
    assert safe_edit.json()["accepted"] is True

    exported = await client.get(
        f"/api/v1/cvs/{cv_id}/export?analysis_id={analysis_id}&template=modern",
        headers=headers,
    )
    assert exported.status_code == 200, exported.text
    exported_text = "\n".join(page.extract_text() or "" for page in PdfReader(BytesIO(exported.content)).pages)
    assert "Developed REST API using Python for internal tools" in exported_text

    async with TestingSessionLocal() as session:
        stored_analysis = await session.get(CVAnalysis, analysis_id)
        assert stored_analysis is not None
        invalid_suggestion = dict(stored_analysis.optimized_suggestions_json[0])
        invalid_suggestion["block_id"] = "unknown-999"
        stored_analysis.optimized_suggestions_json = [invalid_suggestion]
        await session.commit()

    invalid_export = await client.get(
        f"/api/v1/cvs/{cv_id}/export?analysis_id={analysis_id}&template=modern",
        headers=headers,
    )
    invalid_text = "\n".join(page.extract_text() or "" for page in PdfReader(BytesIO(invalid_export.content)).pages)
    assert "Built REST API using Python for internal tools" in invalid_text
    assert "Developed REST API using Python for internal tools" not in invalid_text
