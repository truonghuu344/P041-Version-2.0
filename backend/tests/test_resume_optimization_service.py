from __future__ import annotations

from types import SimpleNamespace

import pytest

from src.services import resume_optimization_service as service


def _analysis(suggestion: dict | None = None) -> dict:
    return {
        "criteria": [
            {"criterion_id": "CRIT_REQUIRED_SKILL", "raw_score": 80},
            {"criterion_id": "CRIT_EXPERIENCE", "raw_score": 60},
        ],
        "requirements": {
            "required_skills": [
                {"requirement_type": "JD_REQUIRED_SKILL", "requirement": "Python"},
                {"requirement_type": "JD_REQUIRED_SKILL", "requirement": "Docker"},
            ]
        },
        "requirement_evidence": [
            {
                "requirement": "Python",
                "status": "matched",
                "score": 80,
                "reason": "Có bằng chứng.",
                "evidence": [{"quote": "Built REST API using Python", "section": "experience"}],
            },
            {"requirement": "Docker", "status": "missing", "score": 0, "reason": "Không có bằng chứng.", "evidence": []},
        ],
        "hard_skills_matching": ["Python", "REST API"],
        "hard_skills_partial": [],
        "hard_skills_missing": ["Docker"],
        "strengths": ["Python"],
        "suggestions": [suggestion] if suggestion else [],
    }


@pytest.mark.asyncio
async def test_optimizer_fails_closed_for_placeholder_cv():
    result = await service.optimize_resume_for_jd(
        cv_text="fff\nff",
        parsed_cv={"summary": "fff", "skills": [], "experience": [], "projects": [], "education": []},
        jd_title="DevOps Engineer",
        jd_text="Docker, Kubernetes, CI/CD and Linux required",
        parsed_jd={},
        analysis=_analysis(),
    )
    assert result["status"] == "insufficient_evidence"
    assert result["changes"] == []
    assert result["project_blueprint"] is None
    assert "placeholder" in result["warnings"][0]


@pytest.mark.asyncio
async def test_optimizer_returns_full_evidence_checked_fallback(monkeypatch):
    monkeypatch.setattr(service, "get_settings", lambda: SimpleNamespace(google_genai_api_key=""))
    result = await service.optimize_resume_for_jd(
        cv_text="Built REST API using Python for internal tools",
        parsed_cv={"skills": ["Python", "REST API"], "experience": [{"description": "Built REST API using Python for internal tools"}]},
        jd_title="Backend Developer",
        jd_text="Required Python, REST API and Docker",
        parsed_jd={},
        analysis=_analysis(
            {
                "original_text": "Built REST API using Python for internal tools",
                "suggested_improvement": "Developed REST API using Python for internal tools",
                "reason": "Align Python and REST API wording.",
            }
        ),
    )

    assert result["target_role"] == "Backend Developer"
    assert result["changes"][0]["evidence"] == ["Built REST API using Python for internal tools"]
    assert result["fact_check"]["claims"][0]["status"] == "supported_rephrase"
    assert result["missing_skills_recommendations"][0]["skill"] == "Docker"
    assert all("Docker" not in item["optimized"] for item in result["changes"])
    assert set(result["match_analysis"]) == {
        "overall_score",
        "skill_match_score",
        "experience_match_score",
        "project_match_score",
        "keyword_match_score",
    }


@pytest.mark.asyncio
async def test_optimizer_removes_missing_skill_and_fake_metric(monkeypatch):
    monkeypatch.setattr(service, "get_settings", lambda: SimpleNamespace(google_genai_api_key=""))
    result = await service.optimize_resume_for_jd(
        cv_text="Built REST API using Python for internal tools",
        parsed_cv={
            "skills": ["Python", "REST API"],
            "experience": [{"description": "Built REST API using Python for internal tools"}],
        },
        jd_title="Backend Developer",
        jd_text="Required Python, Docker",
        parsed_jd={},
        analysis=_analysis(
            {
                "original_text": "Built REST API using Python for internal tools",
                "suggested_improvement": "Built Docker REST API using Python and reduced latency by 40%",
                "reason": "Unsafe draft",
            }
        ),
    )

    assert result["changes"] == []
    assert result["patches"] == []
    assert result["validation"]["no_fabricated_information"] is True
    assert result["validation"]["structure_preserved"] is True
    assert result["fact_check"]["passed"] is False
    assert result["fact_check"]["removed_claims"]


def test_user_edit_guard_rejects_new_scope_and_allows_supported_rephrase():
    common = {
        "original": "Built REST API using Python",
        "cv_text": "Built REST API using Python",
        "parsed_cv": {"skills": ["Python", "REST API"]},
        "missing_skills": ["Docker"],
    }
    assert service.validate_resume_change(optimized="Developed REST API using Python", **common) == ""
    assert "kỹ năng còn thiếu" in service.validate_resume_change(
        optimized="Developed Docker REST API using Python", **common
    )
    assert "số liệu" in service.validate_resume_change(
        optimized="Developed REST API using Python and improved latency by 40%", **common
    )
