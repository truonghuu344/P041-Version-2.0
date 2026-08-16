from src.db.database import Base
from src.db.models import JobRecommendation, JobRecommendationRun


def test_job_recommendation_tables_preserve_run_and_match_traceability():
    run_table = Base.metadata.tables[JobRecommendationRun.__tablename__]
    recommendation_table = Base.metadata.tables[JobRecommendation.__tablename__]

    run_column_names = set(run_table.columns.keys())
    recommendation_column_names = set(recommendation_table.columns.keys())

    assert {
        "id",
        "user_id",
        "cv_snapshot_id",
        "status",
        "filter_json",
        "retrieval_config_json",
        "pipeline_version",
        "normalization_version",
        "embedding_model",
        "rubric_version",
        "trace_id",
        "created_at",
        "completed_at",
    }.issubset(run_column_names)
    assert {
        "id",
        "run_id",
        "job_id",
        "jd_snapshot_id",
        "rank",
        "raw_fit_score",
        "display_fit_score",
        "confidence",
        "mandatory_requirement_failed",
        "mandatory_gate_json",
        "match_id",
        "explanation_json",
        "created_at",
    }.issubset(recommendation_column_names)
    assert "evidence_json" not in recommendation_table.columns
    assert any(foreign_key.target_fullname == "matches.id" for foreign_key in recommendation_table.c.match_id.foreign_keys)
