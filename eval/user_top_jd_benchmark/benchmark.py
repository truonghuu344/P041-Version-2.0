"""Privacy-safe evaluation for one user's labelled Top-JD result.

The benchmark consumes an exported Top Jobs API response and a manually
labelled sheet.  It deliberately never reads or writes raw CV content.
"""

from __future__ import annotations

import math
from collections.abc import Mapping, Sequence
from typing import Any

VALID_LABELS = {"relevant", "not_relevant"}


def validate_labels(payload: Mapping[str, Any]) -> list[dict[str, Any]]:
    labels = payload.get("labels")
    if not isinstance(labels, list) or not 10 <= len(labels) <= 20:
        raise ValueError("labels must contain 10 to 20 manually labelled jobs.")
    seen: set[str] = set()
    result: list[dict[str, Any]] = []
    for item in labels:
        if not isinstance(item, Mapping):
            raise TypeError("Each label must be an object.")
        job_id = str(item.get("job_id") or "").strip()
        label = str(item.get("label") or "").strip()
        if not job_id or label not in VALID_LABELS or job_id in seen:
            raise ValueError("Each label needs a unique job_id and a valid label.")
        seen.add(job_id)
        role_relevant = item.get("role_relevant")
        application_ready = item.get("application_ready")
        if role_relevant is not None and not isinstance(role_relevant, bool):
            raise ValueError("role_relevant must be a boolean when provided.")
        if application_ready is not None and not isinstance(application_ready, bool):
            raise ValueError("application_ready must be a boolean when provided.")
        legacy_label = role_relevant is None or application_ready is None
        resolved_role_relevant = bool(role_relevant) if role_relevant is not None else label == "relevant"
        resolved_application_ready = (
            bool(application_ready)
            if application_ready is not None
            else resolved_role_relevant and not bool(item.get("mandatory_gap_expected", False))
        )
        result.append(
            {
                "job_id": job_id,
                "label": label,
                "role_relevant": resolved_role_relevant,
                "application_ready": resolved_application_ready,
                "legacy_label": legacy_label,
                "mandatory_gap_expected": bool(item.get("mandatory_gap_expected", False)),
                "note": str(item.get("note") or ""),
            }
        )
    label_values = {item["label"] for item in result}
    if label_values != VALID_LABELS:
        raise ValueError(
            "labels must include at least one relevant and one not_relevant job "
            "to measure ranking discrimination."
        )
    return result


def _ndcg_at_10(relevances: list[int]) -> float:
    def dcg(values: Sequence[int]) -> float:
        return sum((2**value - 1) / math.log2(index + 2) for index, value in enumerate(values[:10]))

    actual = dcg(relevances)
    ideal = dcg(sorted(relevances, reverse=True))
    return round(actual / ideal, 4) if ideal else 0.0


def evaluate_top_jobs(
    recommendation_response: Mapping[str, Any], label_payload: Mapping[str, Any]
) -> dict[str, Any]:
    """Evaluate a Top Jobs response against manual labels for one CV."""
    labels = validate_labels(label_payload)
    items = recommendation_response.get("items")
    if not isinstance(items, list):
        raise TypeError("recommendation response must contain an items list.")

    by_job = {str(item.get("job_id")): item for item in items if isinstance(item, Mapping)}
    role_relevant_ids = {item["job_id"] for item in labels if item["role_relevant"]}
    ready_ids = {
        item["job_id"] for item in labels
        if item["role_relevant"] and item["application_ready"]
    }
    rows: list[dict[str, Any]] = []
    for label in labels:
        item = by_job.get(label["job_id"])
        rows.append(
            {
                **label,
                "returned": item is not None,
                "rank": int(item.get("rank")) if item and item.get("rank") is not None else None,
                "fit_score": float(item.get("display_fit_score")) if item else None,
                "mandatory_requirement_failed": bool(item.get("mandatory_requirement_failed")) if item else None,
                "actual_role_relevant": bool(item.get("role_relevant")) if item else None,
                "actual_application_ready": bool(item.get("application_ready")) if item else None,
            }
        )

    returned_relevant = [row for row in rows if row["role_relevant"] and row["returned"]]
    relevant_ranks = sorted(row["rank"] for row in returned_relevant if row["rank"] is not None)
    precision_at_3 = sum(1 for rank in relevant_ranks if rank <= 3) / 3
    recall_at_10 = round(len(returned_relevant) / len(role_relevant_ids), 4) if role_relevant_ids else None
    mrr = round(1 / relevant_ranks[0], 4) if relevant_ranks else None

    ranked_items = sorted((item for item in items if isinstance(item, Mapping)), key=lambda item: int(item.get("rank") or 9999))
    relevances = [1 if str(item.get("job_id")) in role_relevant_ids else 0 for item in ranked_items]
    ready_ranks = sorted(
        row["rank"] for row in rows
        if row["application_ready"] and row["role_relevant"] and row["returned"] and row["rank"] is not None
    )
    ready_recall_at_10 = round(len(ready_ranks) / len(ready_ids), 4) if ready_ids else None
    ready_precision_at_3 = round(sum(1 for rank in ready_ranks if rank <= 3) / 3, 4)
    mandatory_cases = [row for row in rows if row["mandatory_gap_expected"] and row["returned"]]
    mandatory_false_negatives = [
        row for row in mandatory_cases
        if not row["mandatory_requirement_failed"] or float(row["fit_score"] or 0) > 49.0
    ]

    return {
        "benchmark_version": "1.0",
        "cv_snapshot_id": str(label_payload.get("cv_snapshot_id") or ""),
        "labelled_jobs": len(labels),
        "metrics": {
            "recall_at_10": recall_at_10,
            "precision_at_3": round(precision_at_3, 4),
            "mrr": mrr,
            "ndcg_at_10": _ndcg_at_10(relevances) if role_relevant_ids else None,
            "role_recall_at_10": recall_at_10,
            "ready_recall_at_10": ready_recall_at_10,
            "ready_precision_at_3": ready_precision_at_3,
            "mandatory_gap_false_negative_rate": round(
                len(mandatory_false_negatives) / len(mandatory_cases), 4
            ) if mandatory_cases else 0.0,
        },
        "misranked_jobs": [
            row for row in rows
            if (row["role_relevant"] and not row["returned"])
            or (not row["role_relevant"] and row["returned"] and (row["rank"] or 9999) <= 3)
        ],
        "warnings": [
            *(
                ["NO_ROLE_RELEVANT_LABELS: role recall metrics require at least one role-relevant JD."]
                if not role_relevant_ids else []
            ),
            *(
                ["LEGACY_LABELS_INFERRED: role_relevant/application_ready were inferred; migrate labels.json."]
                if any(row["legacy_label"] for row in labels) else []
            ),
        ],
        "rows": rows,
    }
