from pydantic import ValidationError

from src.schemas.job_recommendation import (
    JobRecommendationItem,
    JobRecommendationRequest,
    JobRecommendationRunResponse,
)


def test_job_recommendation_request_accepts_optional_filters():
    request = JobRecommendationRequest(cv_snapshot_id="snapshot-1", role="Backend", work_mode="Remote")

    assert request.cv_snapshot_id == "snapshot-1"
    assert request.location is None


def test_job_recommendation_response_requires_ranked_traceable_items():
    response = JobRecommendationRunResponse(
        run_id="run-1",
        status="COMPLETED",
        items=[
            JobRecommendationItem(
                rank=1,
                job_id="JD-001",
                title="Backend Engineer",
                company="Example Co",
                display_fit_score=82.0,
                raw_fit_score=84.2,
                fit_label="strong_fit",
                evidence_confidence="high",
                mandatory_requirement_failed=False,
                match_id="match-1",
            )
        ],
    )

    assert response.items[0].match_id == "match-1"


def test_job_recommendation_contract_rejects_unknown_fields_and_invalid_status():
    try:
        JobRecommendationRequest(cv_snapshot_id="snapshot-1", unsupported=True)
    except ValidationError:
        pass
    else:
        raise AssertionError("Unknown request fields must be rejected.")

    try:
        JobRecommendationRunResponse(run_id="run-1", status="UNKNOWN")
    except ValidationError:
        pass
    else:
        raise AssertionError("Unknown run statuses must be rejected.")
