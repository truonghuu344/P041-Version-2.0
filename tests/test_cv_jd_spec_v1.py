from __future__ import annotations

import pytest

from src.services.cv_jd_matching import build_cv_jd_evidence, parse_job_description
from src.services.cv_jd_pipeline import normalize_structured_cv


@pytest.fixture
def hybrid_result():
    return build_cv_jd_evidence(
        cv_text=(
            "Backend Engineer. Developed REST APIs using Python, FastAPI and PostgreSQL. "
            "Built payment services from 2022-01 to 2025-01."
        ),
        parsed_cv={
            "skills": ["Python", "FastAPI", "Postgres"],
            "experience": [
                {
                    "description": "Backend engineering: developed REST APIs using Python, FastAPI and PostgreSQL for payments.",
                    "start_date": "2022-01",
                    "end_date": "2025-01",
                    "source_page": 2,
                }
            ],
        },
        jd_title="Backend Engineer",
        jd_requirements=(
            "Required Python, FastAPI and PostgreSQL. "
            "At least 2 years backend experience. "
            "Design and develop REST APIs. Docker is preferred."
        ),
    )


def test_each_atomic_requirement_has_independent_hybrid_retrieval(hybrid_result):
    requirement_ids = {item["requirement_id"] for group in hybrid_result["requirements"].values() for item in group}
    retrieval_ids = {item["requirement_id"] for item in hybrid_result["retrieval_results"]}
    assert retrieval_ids == requirement_ids
    assert all("bm25_results" in item and "semantic_results" in item for item in hybrid_result["retrieval_results"])
    assert all("hybrid_results" in item for item in hybrid_result["retrieval_results"])


def test_rrf_keeps_all_retrieval_scores_separate(hybrid_result):
    hybrid_items = [item for retrieval in hybrid_result["retrieval_results"] for item in retrieval["hybrid_results"]]
    assert hybrid_items
    assert all("fusion_score" in item and "fusion_rank" in item for item in hybrid_items)
    assert any("bm25_score" in item for item in hybrid_items)
    assert any("semantic_score" in item for item in hybrid_items)
    assert all(item["fusion_score"] < 0.1 for item in hybrid_items)


def test_matching_matrix_filters_chunk_types(hybrid_result):
    for retrieval in hybrid_result["retrieval_results"]:
        allowed = set(retrieval["allowed_chunk_types"])
        for item in retrieval["hybrid_results"]:
            chunk = next(chunk for chunk in hybrid_result["cv_chunks"] if chunk["chunk_id"] == item["chunk_id"])
            assert chunk["chunk_type"] in allowed


def test_final_score_is_sum_of_weighted_criteria_and_weights_equal_100(hybrid_result):
    assert sum(item["weight"] for item in hybrid_result["criteria"]) == pytest.approx(100.0)
    assert hybrid_result["final_score"] == pytest.approx(
        sum(item["weighted_score"] for item in hybrid_result["criteria"])
    )
    assert hybrid_result["match_score"] == hybrid_result["final_score"]


def test_evidence_traceability_chain_is_complete(hybrid_result):
    chunks = {item["chunk_id"]: item for item in hybrid_result["cv_chunks"]}
    for evidence in hybrid_result["evidence"]:
        assert evidence["requirement_id"]
        assert evidence["chunk_id"] in chunks
        chunk = chunks[evidence["chunk_id"]]
        assert evidence["source_section"] == chunk["source_section"]
        assert evidence["text"] == chunk["text"]


def test_education_criterion_is_disabled_when_jd_does_not_require_it(hybrid_result):
    assert "CRIT_EDUCATION" not in {item["criterion_id"] for item in hybrid_result["criteria"]}


def test_missing_preferred_skill_does_not_trigger_mandatory_failure(hybrid_result):
    docker = next(
        item
        for group in hybrid_result["requirements"].values()
        for item in group
        if item.get("normalized_value") == "Docker"
    )
    assert docker["mandatory"] is False
    assert hybrid_result["mandatory_requirement_failed"] is False


def test_java_is_not_matched_by_javascript():
    result = build_cv_jd_evidence(
        cv_text="Built web interfaces with JavaScript.",
        parsed_cv={"skills": ["JavaScript"]},
        jd_title="Java Developer",
        jd_requirements="Java is required.",
    )
    java = next(
        item for group in result["requirements"].values() for item in group if item.get("normalized_value") == "Java"
    )
    assert java["status"] == "NOT_FOUND"
    assert java["match_classification"] == "NOT_FOUND"


def test_processing_state_machine_and_embedding_artifacts_are_complete(hybrid_result):
    assert [item["pipeline_step"] for item in hybrid_result["processing_trace"]] == [
        "PENDING",
        "PARSING",
        "EXTRACTING",
        "NORMALIZING",
        "CHUNKING",
        "INDEXING",
        "RETRIEVING",
        "EVALUATING",
        "COMPLETED",
    ]
    assert {item["chunk_id"] for item in hybrid_result["embedding_records"]} == {
        item["chunk_id"] for item in hybrid_result["cv_chunks"]
    }


def test_structured_cv_preserves_complete_taxonomy_and_other_content():
    structured = normalize_structured_cv(
        "Python\nOpen source maintainer",
        {
            "skills": ["Python"],
            "languages": [{"name": "English", "source_page": 2}],
            "awards": [{"name": "Hackathon Winner"}],
            "publications": [{"name": "Reliable APIs"}],
            "volunteer": [{"description": "Mentored students"}],
            "other": [{"text": "Open source maintainer"}],
        },
    )
    for key in (
        "candidate",
        "summary",
        "skills",
        "experience",
        "projects",
        "education",
        "certifications",
        "languages",
        "awards",
        "publications",
        "volunteer",
        "other",
        "chunks",
    ):
        assert key in structured
    assert structured["other"][0]["source_text"] == "Open source maintainer"


def test_jd_parser_emits_full_job_schema_languages_and_deduplicates_required_skill():
    jd = parse_job_description(
        title="Senior Backend Developer",
        requirements_text=(
            "Python is required. Python is also preferred. English B2 is required. "
            "Work hybrid full-time on payment products."
        ),
        metadata={"job_id": "JOB_1", "location": "HCM"},
    )
    assert jd["job"] == {
        "job_id": "JOB_1",
        "title_original": "Senior Backend Developer",
        "title_normalized": "backend engineer",
        "seniority": "senior",
        "summary": "Python is required.",
        "location": "HCM",
        "work_mode": "hybrid",
        "employment_type": "full_time",
    }
    python_requirements = [
        item for item in jd["requirements"] if item.get("skill_normalized") == "Python"
    ]
    assert len(python_requirements) == 1
    assert python_requirements[0]["mandatory"] is True
    assert any(item["requirement_type"] == "JD_LANGUAGE" for item in jd["requirements"])


def test_overlapping_experience_months_are_not_double_counted():
    result = build_cv_jd_evidence(
        cv_text="Java Engineer from 2022-01 to 2024-01. Java Consultant from 2023-01 to 2025-01.",
        parsed_cv={
            "skills": ["Java"],
            "experience": [
                {"description": "Java Engineer", "start_date": "2022-01", "end_date": "2024-01"},
                {"description": "Java Consultant", "start_date": "2023-01", "end_date": "2025-01"},
            ],
        },
        jd_title="Java Engineer",
        jd_requirements="At least 4 years of Java experience.",
    )
    experience = next(
        item for group in result["requirements"].values() for item in group
        if item["requirement_type"] == "JD_EXPERIENCE"
    )
    assert experience["candidate_relevant_years"] == pytest.approx(3.08, abs=0.01)
    assert experience["status"] == "PARTIALLY_SUPPORTED"


def test_invalid_custom_rubric_weight_is_rejected():
    with pytest.raises(ValueError, match="RUBRIC_001"):
        build_cv_jd_evidence(
            cv_text="Python",
            parsed_cv={"skills": ["Python"]},
            jd_title="Developer",
            jd_requirements="Python is required.",
            rubric={"criteria": [{"criterion_id": "CRIT_REQUIRED_SKILL", "weight": 90, "enabled": True}]},
        )
