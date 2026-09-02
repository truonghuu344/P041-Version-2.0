import pytest
from eval.user_top_jd_benchmark.benchmark import evaluate_top_jobs


def test_manual_top_jd_benchmark_reports_metrics_and_mandatory_false_negative():
    report = evaluate_top_jobs(
        {
            "items": [
                {"job_id": "jd-good", "rank": 1, "display_fit_score": 85, "mandatory_requirement_failed": False},
                {"job_id": "jd-bad", "rank": 2, "display_fit_score": 75, "mandatory_requirement_failed": False},
                {"job_id": "jd-gap", "rank": 3, "display_fit_score": 49, "mandatory_requirement_failed": True},
            ]
        },
        {
            "cv_snapshot_id": "cv-1",
            "labels": [
                {"job_id": "jd-good", "label": "relevant"},
                {"job_id": "jd-bad", "label": "not_relevant"},
                {"job_id": "jd-gap", "label": "not_relevant", "mandatory_gap_expected": True},
                {"job_id": "jd-04", "label": "not_relevant"},
                {"job_id": "jd-05", "label": "not_relevant"},
                {"job_id": "jd-06", "label": "not_relevant"},
                {"job_id": "jd-07", "label": "not_relevant"},
                {"job_id": "jd-08", "label": "not_relevant"},
                {"job_id": "jd-09", "label": "not_relevant"},
                {"job_id": "jd-10", "label": "not_relevant"},
            ],
        },
    )

    assert report["metrics"]["recall_at_10"] == 1.0
    assert report["metrics"]["precision_at_3"] == pytest.approx(1 / 3, abs=0.0001)
    assert report["metrics"]["mrr"] == 1.0
    assert report["metrics"]["mandatory_gap_false_negative_rate"] == 0.0
    assert report["misranked_jobs"][0]["job_id"] == "jd-bad"


def test_manual_top_jd_benchmark_marks_recall_metrics_unavailable_without_positive_labels():
    labels = [
        {"job_id": f"jd-{index}", "label": "not_relevant"}
        for index in range(10)
    ]
    with pytest.raises(ValueError, match="at least one relevant"):
        evaluate_top_jobs({"items": []}, {"labels": labels})


def test_manual_top_jd_benchmark_rejects_all_positive_labels():
    labels = [
        {"job_id": f"jd-{index}", "label": "relevant"}
        for index in range(10)
    ]
    with pytest.raises(ValueError, match="at least one relevant"):
        evaluate_top_jobs({"items": []}, {"labels": labels})


def test_benchmark_separates_role_relevance_from_application_readiness():
    report = evaluate_top_jobs(
        {"items": [{"job_id": "backend-gap", "rank": 1, "display_fit_score": 49, "mandatory_requirement_failed": True}]},
        {"labels": [
            {"job_id": "backend-gap", "label": "relevant", "role_relevant": True, "application_ready": False},
            {"job_id": "backend-ready", "label": "relevant", "role_relevant": True, "application_ready": True},
            *[{"job_id": f"other-{index}", "label": "not_relevant", "role_relevant": False, "application_ready": False} for index in range(8)],
        ]},
    )

    assert report["metrics"]["role_recall_at_10"] == 0.5
    assert report["metrics"]["ready_recall_at_10"] == 0.0
    assert report["warnings"] == []


def test_benchmark_warns_when_legacy_labels_are_inferred():
    report = evaluate_top_jobs(
        {"items": []},
        {"labels": [
            {"job_id": "legacy-relevant", "label": "relevant"},
            *[{"job_id": f"legacy-other-{index}", "label": "not_relevant"} for index in range(9)],
        ]},
    )

    assert "LEGACY_LABELS_INFERRED: role_relevant/application_ready were inferred; migrate labels.json." in report["warnings"]
