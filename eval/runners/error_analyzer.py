"""Root-cause error analysis for CV-JD ranking inversions and requirement mismatches."""

from __future__ import annotations

from typing import Any

ERROR_LAYERS = [
    "RETRIEVAL_ERROR",
    "REQUIREMENT_EXTRACTION_ERROR",
    "SEMANTIC_MATCH_ERROR",
    "EXPERIENCE_CALCULATION_ERROR",
    "IMPORTANCE_ERROR",
    "PREFERRED_GUARDRAIL_ERROR",
    "HARD_CONSTRAINT_ERROR",
    "FINAL_RANKING_ERROR",
    "OTHER",
]


def diagnose_inversion(
    job_id: str,
    cand_better: dict[str, Any],  # Higher human relevance
    cand_worse: dict[str, Any],   # Lower human relevance
    eval_better: dict[str, Any],  # System match result for cand_better
    eval_worse: dict[str, Any],   # System match result for cand_worse
) -> dict[str, Any]:
    """Diagnose the root-cause layer of a pairwise ranking inversion."""
    cv_better_id = cand_better.get("cv_id")
    cv_worse_id = cand_worse.get("cv_id")
    h_better = cand_better.get("human_relevance", 0)
    h_worse = cand_worse.get("human_relevance", 0)
    s_better = eval_better.get("final_score", eval_better.get("match_score", 0.0))
    s_worse = eval_worse.get("final_score", eval_worse.get("match_score", 0.0))

    reqs_better = {r.get("requirement_id"): r for r in eval_better.get("evaluated_requirements", [])}
    reqs_worse = {r.get("requirement_id"): r for r in eval_worse.get("evaluated_requirements", [])}

    req_diffs = []
    preferred_inflation = 0.0
    exp_gap = 0.0
    semantic_false_positive = False

    all_req_ids = sorted(list(set(reqs_better.keys()) | set(reqs_worse.keys())))
    for req_id in all_req_ids:
        rb = reqs_better.get(req_id, {})
        rw = reqs_worse.get(req_id, {})

        score_b = float(rb.get("weighted_score", 0.0))
        score_w = float(rw.get("weighted_score", 0.0))
        delta = round(score_w - score_b, 2)  # positive means worse candidate got more points

        req_text = rb.get("text") or rw.get("text") or req_id
        req_type = rb.get("type") or rw.get("type") or "REQUIRED"
        req_group = rb.get("group") or rw.get("group") or "skills"

        if delta != 0.0:
            req_diffs.append(
                {
                    "requirement_id": req_id,
                    "requirement_text": req_text,
                    "requirement_type": req_type,
                    "group": req_group,
                    "score_expected_better": score_b,
                    "score_expected_worse": score_w,
                    "delta_favoring_worse": delta,
                }
            )

        if req_type == "PREFERRED" and delta > 5.0:
            preferred_inflation += delta
        if req_group == "experience_seniority" and delta > 5.0:
            exp_gap += delta
        if rw.get("match_classification") == "SEMANTIC_MATCH" and score_w > score_b:
            semantic_false_positive = True

    req_diffs.sort(key=lambda x: abs(x["delta_favoring_worse"]), reverse=True)

    # Determine most likely failure layer
    likely_layer = "FINAL_RANKING_ERROR"
    diagnosis_reason = "Tổng hợp điểm số chênh lệch trên nhiều tiêu chí nhỏ."

    if eval_better.get("eligibility_status") != "ELIGIBLE" or eval_worse.get("eligibility_status") != "ELIGIBLE":
        likely_layer = "HARD_CONSTRAINT_ERROR"
        diagnosis_reason = (
            f"Trạng thái điều kiện cứng khác biệt: "
            f"{cv_better_id} ({eval_better.get('eligibility_status')}) vs {cv_worse_id} ({eval_worse.get('eligibility_status')})."
        )
    elif preferred_inflation >= 15.0:
        likely_layer = "PREFERRED_GUARDRAIL_ERROR"
        diagnosis_reason = f"Ứng viên điểm thấp tích lũy quá nhiều điểm từ các kỹ năng phụ PREFERRED (+{preferred_inflation:.1f}đ)."
    elif exp_gap >= 15.0:
        likely_layer = "EXPERIENCE_CALCULATION_ERROR"
        diagnosis_reason = f"Chênh lệch điểm kinh nghiệm/thời gian làm việc chi phối bảng xếp hạng (+{exp_gap:.1f}đ)."
    elif semantic_false_positive:
        likely_layer = "SEMANTIC_MATCH_ERROR"
        diagnosis_reason = "Khớp ngữ nghĩa (Semantic Match) gán điểm cho từ khóa tương đồng không chính xác."
    elif req_diffs and req_diffs[0]["delta_favoring_worse"] >= 20.0:
        top_req = req_diffs[0]
        likely_layer = "REQUIREMENT_EXTRACTION_ERROR" if top_req["requirement_type"] == "REQUIRED" else "IMPORTANCE_ERROR"
        diagnosis_reason = f"Yêu cầu '{top_req['requirement_text']}' tạo ra khoảng cách điểm đột biến (+{top_req['delta_favoring_worse']:.1f}đ)."

    return {
        "job_id": job_id,
        "inverted_pair": f"{cv_better_id} (Human={h_better}, Sys={s_better}) < {cv_worse_id} (Human={h_worse}, Sys={s_worse})",
        "human_ranking": f"{cv_better_id} ({h_better}) > {cv_worse_id} ({h_worse})",
        "system_ranking": f"{cv_worse_id} ({s_worse}) > {cv_better_id} ({s_better})",
        "score_difference": round(s_worse - s_better, 2),
        "likely_failure_layer": likely_layer,
        "diagnosis_reason": diagnosis_reason,
        "top_contributing_requirements": req_diffs[:5],
    }


def analyze_dataset_errors(
    inversions: list[dict[str, Any]],
    candidate_evals: dict[str, dict[str, Any]],
    candidate_cases: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    """Aggregate errors across all inverted candidate pairs in a benchmark run."""
    layer_counts: dict[str, int] = {layer: 0 for layer in ERROR_LAYERS}
    detailed_reports = []

    for inv in inversions:
        job_id = inv.get("job_id", "")
        better_id = inv["expected_better"]
        worse_id = inv["expected_worse"]

        cand_better = candidate_cases.get(better_id, {})
        cand_worse = candidate_cases.get(worse_id, {})
        eval_better = candidate_evals.get(better_id, {})
        eval_worse = candidate_evals.get(worse_id, {})

        diagnosis = diagnose_inversion(job_id, cand_better, cand_worse, eval_better, eval_worse)
        layer = diagnosis["likely_failure_layer"]
        if layer in layer_counts:
            layer_counts[layer] += 1
        else:
            layer_counts["OTHER"] += 1
        detailed_reports.append(diagnosis)

    return {
        "total_inversions": len(inversions),
        "inversions_by_layer": layer_counts,
        "detailed_inversion_diagnostics": detailed_reports,
    }
