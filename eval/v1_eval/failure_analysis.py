"""Failure analysis module for audited CV-JD matching benchmark."""

from __future__ import annotations

from typing import Any

from eval.v1_eval.metrics import map_evidence_spans_to_chunks
from eval.v1_eval.schema import (
    EvidenceRelation,
    FailureCategory,
    FailureItem,
    RequirementOutcome,
)


def map_engine_classification_to_evidence_relation(
    engine_item: dict[str, Any],
) -> str:
    """Map raw engine pipeline output to canonical 6-relation evidence taxonomy.

    Allowed relations:
    - DIRECT
    - EQUIVALENT
    - INFERRED
    - ADJACENT
    - WEAK_EVIDENCE
    - NO_EVIDENCE
    """
    raw_class = str(
        engine_item.get("match_classification")
        or engine_item.get("relation")
        or engine_item.get("status")
        or ""
    ).upper()

    ev_strength = str(engine_item.get("evidence_strength") or "").upper()
    status = str(engine_item.get("status") or engine_item.get("evaluation_status") or "").upper()
    match_score = float(engine_item.get("match_score", 0.0))

    # 1. NO_EVIDENCE
    if raw_class in {"NO_EVIDENCE", "NOT_FOUND", "CONFLICTING", "CONFLICT", "MISSING"} or (status in {"NOT_FOUND", "CONFLICTING"} and match_score == 0.0):
        if raw_class not in {"DIRECT", "EQUIVALENT", "INFERRED", "ADJACENT"}:
            return EvidenceRelation.NO_EVIDENCE.value

    # 2. WEAK_EVIDENCE (e.g. declared only, weak evidence strength)
    if raw_class in {"WEAK_EVIDENCE", "DECLARED_ONLY", "UNCERTAIN"}:
        return EvidenceRelation.WEAK_EVIDENCE.value
    if ev_strength == "WEAK" and raw_class not in {"ADJACENT"}:
        return EvidenceRelation.WEAK_EVIDENCE.value

    # 3. DIRECT / EXACT_MATCH
    if raw_class in {"DIRECT", "EXACT_MATCH"}:
        if ev_strength in {"WEAK"} or (status == "PARTIALLY_SUPPORTED" and not engine_item.get("evidence")):
            return EvidenceRelation.WEAK_EVIDENCE.value
        return EvidenceRelation.DIRECT.value

    # 4. EQUIVALENT / NORMALIZED_MATCH
    if raw_class in {"EQUIVALENT", "NORMALIZED_MATCH"}:
        if ev_strength in {"WEAK"}:
            return EvidenceRelation.WEAK_EVIDENCE.value
        return EvidenceRelation.EQUIVALENT.value

    # 5. INFERRED
    if raw_class in {"INFERRED", "SEMANTIC_MATCH"}:
        return EvidenceRelation.INFERRED.value

    # 6. ADJACENT / PARTIAL_MATCH
    if raw_class in {"ADJACENT", "PARTIAL_MATCH", "RELATED"}:
        return EvidenceRelation.ADJACENT.value

    # Fallback status inspection
    if status == "SUPPORTED" and match_score >= 0.8:
        return EvidenceRelation.DIRECT.value
    elif status == "PARTIALLY_SUPPORTED" or (0.2 <= match_score < 0.8):
        return EvidenceRelation.WEAK_EVIDENCE.value

    return EvidenceRelation.NO_EVIDENCE.value


# Backward compatible alias
map_engine_classification_to_human_label = map_engine_classification_to_evidence_relation


def map_engine_status_to_requirement_outcome(
    engine_item: dict[str, Any],
) -> str:
    """Map raw engine evaluation status to canonical 4-outcome requirement satisfaction taxonomy.

    Allowed outcomes:
    - SATISFIED
    - PARTIAL
    - UNSATISFIED
    - UNKNOWN
    """
    status = str(
        engine_item.get("status")
        or engine_item.get("match_status")
        or engine_item.get("evaluation_status")
        or ""
    ).upper()

    match_score = float(engine_item.get("match_score", 0.0))

    if status in {"SUPPORTED", "MATCHED", "SATISFIED", "ELIGIBLE"} or match_score >= 0.8:
        return RequirementOutcome.SATISFIED.value
    elif status in {"PARTIALLY_SUPPORTED", "PARTIAL"} or (0.2 <= match_score < 0.8):
        return RequirementOutcome.PARTIAL.value
    elif status in {"UNCERTAIN", "UNKNOWN"}:
        return RequirementOutcome.UNKNOWN.value
    else:
        return RequirementOutcome.UNSATISFIED.value


def diagnose_failure_category(
    requirement: dict[str, Any],
    engine_eval: dict[str, Any],
    retrieval_result: dict[str, Any] | None,
    all_chunks: list[dict[str, Any]] | None,
    human_relation: str,
    engine_relation: str,
    human_outcome: str | None = None,
    engine_outcome: str | None = None,
) -> tuple[str, str]:
    """Diagnose the root-cause failure category for an incorrect prediction.

    Categories:
    - PARSING_ERROR
    - RETRIEVAL_MISS
    - RERANKING_ERROR
    - SEMANTIC_VALIDATION_ERROR
    - BOOLEAN_GROUP_ERROR
    - SCORING_ERROR
    - EXPLANATION_ERROR
    """
    all_chunks = all_chunks or []
    expected_spans = requirement.get("expected_evidence", [])
    mapped_chunk_ids = map_evidence_spans_to_chunks(expected_spans, all_chunks) if expected_spans else set()
    if not mapped_chunk_ids and requirement.get("expected_evidence_chunk_ids"):
        mapped_chunk_ids = set(requirement.get("expected_evidence_chunk_ids", []))

    # 1. Check Boolean Group Error
    if requirement.get("group_id") or requirement.get("group_operator") or engine_eval.get("group_id"):
        if engine_eval.get("is_satisfied_by_alternative") or engine_eval.get("group_status"):
            return (
                FailureCategory.BOOLEAN_GROUP_ERROR.value,
                "Lỗi phân giải nhóm logic Boolean (ANY_OF / ALL_OF) giữa các yêu cầu thành viên.",
            )

    # 2. Check Retrieval / Parsing if ground truth expected specific evidence
    if expected_spans and not mapped_chunk_ids:
        return (
            FailureCategory.PARSING_ERROR.value,
            "Đoạn trích bằng chứng (quote) từ CV không thể khớp với bất kỳ chunk nào được tạo từ CV.",
        )

    if mapped_chunk_ids and retrieval_result:
        hybrid_retrieved = [
            r.get("chunk_id") for r in retrieval_result.get("hybrid_results", [])
        ]
        bm25_retrieved = [
            r.get("chunk_id") for r in retrieval_result.get("bm25_results", [])
        ]
        semantic_retrieved = [
            r.get("chunk_id") for r in retrieval_result.get("semantic_results", [])
        ]

        in_hybrid = any(cid in hybrid_retrieved for cid in mapped_chunk_ids)
        in_bm25_or_sem = any(
            cid in bm25_retrieved or cid in semantic_retrieved for cid in mapped_chunk_ids
        )

        if not in_hybrid and not in_bm25_or_sem:
            return (
                FailureCategory.RETRIEVAL_MISS.value,
                f"Cả BM25 và Semantic search đều bỏ lỡ chunk bằng chứng kỳ vọng {list(mapped_chunk_ids)[:3]}.",
            )
        elif not in_hybrid and in_bm25_or_sem:
            return (
                FailureCategory.RERANKING_ERROR.value,
                f"Chunk bằng chứng {list(mapped_chunk_ids)[:3]} xuất hiện ở tầng tìm kiếm sơ cấp nhưng bị rớt khỏi Top-K ở bước Hybrid RRF.",
            )

    # 3. Check Semantic Validation Error
    if human_relation != engine_relation:
        return (
            FailureCategory.SEMANTIC_VALIDATION_ERROR.value,
            f"Phân loại quan hệ ngữ nghĩa sai: Ground truth là '{human_relation}', matcher phân loại thành '{engine_relation}'.",
        )

    if human_outcome and engine_outcome and human_outcome != engine_outcome:
        return (
            FailureCategory.SEMANTIC_VALIDATION_ERROR.value,
            f"Đánh giá mức độ thỏa mãn sai: Ground truth là '{human_outcome}', matcher đánh giá thành '{engine_outcome}'.",
        )

    # 4. Check Explanation Error
    reason = engine_eval.get("reason") or engine_eval.get("comparison") or ""
    if not reason or "Chưa có thông tin" in reason:
        return (
            FailureCategory.EXPLANATION_ERROR.value,
            "Thiếu giải thích đối sánh hoặc nội dung giải thích không đầy đủ.",
        )

    # 5. Fallback: Scoring Error
    return (
        FailureCategory.SCORING_ERROR.value,
        "Sai lệch trong tính điểm match_score hoặc gán trọng số tiêu chí.",
    )


def analyze_failures(
    benchmark_cases: list[Any],
    execution_results: list[dict[str, Any]],
) -> dict[str, Any]:
    """Perform comprehensive failure analysis across all benchmark cases."""
    failure_items: list[FailureItem] = []
    failures_by_category: dict[str, list[dict[str, Any]]] = {
        cat.value: [] for cat in FailureCategory
    }

    total_evaluated_requirements = 0
    total_mismatches = 0

    for case, exec_res in zip(benchmark_cases, execution_results, strict=False):
        case_id = getattr(case, "case_id", None) or case.get("case_id", "")
        reqs = getattr(case, "requirements", []) or case.get("requirements", [])

        engine_evals = exec_res.get("evaluated_requirements", [])
        engine_eval_map = {
            item.get("requirement_id"): item for item in engine_evals
        }
        retrieval_map = {
            item.get("requirement_id"): item for item in exec_res.get("retrieval_results", [])
        }
        all_chunks = exec_res.get("cv_chunks", [])

        for req in reqs:
            if hasattr(req, "to_dict"):
                req_dict = req.to_dict()
            elif hasattr(req, "__dataclass_fields__"):
                from dataclasses import asdict
                req_dict = asdict(req)
            elif isinstance(req, dict):
                req_dict = req
            else:
                req_dict = dict(req)

            req_id = req_dict.get("requirement_id", "")
            h_rel = req_dict.get("evidence_relation") or req_dict.get("human_label")
            h_out = req_dict.get("requirement_outcome")

            if not h_rel and not h_out:
                # Skip unlabeled requirements
                continue

            total_evaluated_requirements += 1
            engine_item = engine_eval_map.get(req_id, {})
            e_rel = map_engine_classification_to_evidence_relation(engine_item)
            e_out = map_engine_status_to_requirement_outcome(engine_item)

            relation_mismatch = (h_rel is not None and h_rel != e_rel)
            outcome_mismatch = (h_out is not None and h_out != e_out)

            if relation_mismatch or outcome_mismatch:
                total_mismatches += 1
                retrieval_res = retrieval_map.get(req_id)

                cat, reason = diagnose_failure_category(
                    requirement=req_dict,
                    engine_eval=engine_item,
                    retrieval_result=retrieval_res,
                    all_chunks=all_chunks,
                    human_relation=h_rel or "UNSPECIFIED",
                    engine_relation=e_rel,
                    human_outcome=h_out,
                    engine_outcome=e_out,
                )

                h_evidence = req_dict.get("expected_evidence", [])
                retrieved_ev = [
                    e.get("text") or e.get("quote") or e.get("chunk_id")
                    for e in engine_item.get("evidence", [])
                ]

                f_item = FailureItem(
                    case_id=case_id,
                    requirement_id=f"{req_id} ({req_dict.get('canonical_name', '')})",
                    human_evidence=[e if isinstance(e, dict) else e.to_dict() for e in h_evidence],
                    retrieved_evidence=[str(x) for x in retrieved_ev if x],
                    human_evidence_relation=h_rel or "N/A",
                    engine_evidence_relation=e_rel,
                    human_outcome=h_out or "N/A",
                    engine_outcome=e_out,
                    boolean_group=req_dict.get("group_id"),
                    scores={
                        "match_score": engine_item.get("match_score", 0.0),
                        "criterion_score": engine_item.get("criterion_score", 0.0),
                        "weight": engine_item.get("weight", 0.0),
                    },
                    failure_category=cat,
                    reason=reason,
                )
                failure_items.append(f_item)
                failures_by_category[cat].append(f_item.to_dict())

    return {
        "total_evaluated_requirements": total_evaluated_requirements,
        "total_mismatches": total_mismatches,
        "mismatch_rate": round(total_mismatches / total_evaluated_requirements, 4) if total_evaluated_requirements > 0 else 0.0,
        "failures_by_category_counts": {cat: len(items) for cat, items in failures_by_category.items()},
        "failures_by_category": failures_by_category,
        "failure_items": [item.to_dict() for item in failure_items],
    }
