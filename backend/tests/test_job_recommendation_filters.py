from src.schemas.job_recommendation import JobRecommendationRequest
from src.services.job_recommendation_filters import apply_filters

JOBS = [
    {
        "source_id": "remote-platform",
        "title": "Platform Engineer",
        "location": "Ho Chi Minh City",
        "remote_type": "Remote",
        "employment_type": "Full-time",
        "job_level": "Middle",
        "domain": "Technology",
    },
    {
        "source_id": "hybrid-backend",
        "title": "Backend Developer",
        "location": "Ha Noi",
        "remote_type": "Hybrid",
        "employment_type": "Part-time",
        "job_level": "Junior",
        "domain": "Technology",
    },
]


def test_hard_filters_are_applied_before_retrieval_candidates():
    filters = JobRecommendationRequest(
        cv_snapshot_id="snapshot-1",
        location="Ho Chi Minh City",
        location_required=True,
        remote_only=True,
        job_type="Full-time",
    )

    jobs = apply_filters(JOBS, filters)

    assert [job["source_id"] for job in jobs] == ["remote-platform"]


def test_role_seniority_and_industry_are_soft_preferences_not_exclusions():
    filters = JobRecommendationRequest(
        cv_snapshot_id="snapshot-1",
        role="Backend Developer",
        seniority="Senior",
        industry="Finance",
    )

    jobs = apply_filters(JOBS, filters)

    assert {job["source_id"] for job in jobs} == {"remote-platform", "hybrid-backend"}
    platform = next(job for job in jobs if job["source_id"] == "remote-platform")
    assert platform["metadata_preference_score"] > 0
