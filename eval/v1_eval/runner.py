"""Audited evaluation runner for V1 CV-JD Matching Engine Benchmark."""

from __future__ import annotations

import json
import logging
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT / "backend") not in sys.path:
    sys.path.insert(0, str(ROOT / "backend"))

from src.services.cv_jd_pipeline import PipelineConfig, run_cv_jd_pipeline  # noqa: E402
from eval.v1_eval.failure_analysis import (  # noqa: E402
    analyze_failures,
    map_engine_classification_to_evidence_relation,
    map_engine_status_to_requirement_outcome,
)
from eval.v1_eval.metrics import (  # noqa: E402
    EVIDENCE_RELATION_ORDER,
    REQUIREMENT_OUTCOME_ORDER,
    calculate_annotator_agreement,
    calculate_boolean_group_metrics,
    calculate_classification_metrics,
    calculate_critical_gap_metrics,
    calculate_evidence_relation_special_rates,
    calculate_layered_retrieval_metrics,
    calculate_rating_correlation,
    map_evidence_spans_to_chunks,
)
from eval.v1_eval.schema import (  # noqa: E402
    BenchmarkCase,
    DataOrigin,
    EvidenceRelation,
    RequirementOutcome,
)

logger = logging.getLogger(__name__)


def _format_metrics_table(domain_metrics: dict[str, Any], prefix: str = "") -> list[str]:
    lines = []
    return lines


def generate_markdown_report(report: dict[str, Any]) -> str:
    """Format full audited evaluation report into GitHub Flavored Markdown."""
    meta = report.get("metadata", {})
    overall = report.get("overall_metrics", {})
    by_origin = report.get("by_origin", {})
    fa = report.get("failure_analysis", {})
    agreement = report.get("annotator_agreement", {})

    lines: list[str] = []
    lines.append("# 📊 V1 CV–JD Matching Engine Audit & Benchmark Report\n")
    lines.append(f"- **Run Timestamp (UTC)**: `{meta.get('timestamp_utc')}`")
    lines.append(f"- **Pipeline Version**: `{meta.get('pipeline_version', '1.0')}`")
    lines.append(f"- **Total Benchmark Cases**: `{meta.get('total_cases', 0)}` (`{meta.get('real_cases', 0)}` REAL, `{meta.get('synthetic_cases', 0)}` SYNTHETIC)\n")

    # 1. Executive Summary Table
    lines.append("## 1. Executive Summary & REAL vs SYNTHETIC Performance\n")
    lines.append("| Metric Domain | Metric Name | OVERALL | REAL Data | SYNTHETIC Data | Description |")
    lines.append("| :--- | :--- | :---: | :---: | :---: | :--- |")

    def _get_val(src: dict[str, Any], path: list[str], fmt: str = ".4f", is_pct: bool = False) -> str:
        cur = src
        for p in path:
            if not isinstance(cur, dict):
                return "N/A"
            cur = cur.get(p)
        if cur is None:
            return "N/A"
        try:
            val = float(cur)
            if is_pct:
                return f"{val * 100:.2f}%"
            return f"{val:{fmt}}"
        except Exception:
            return str(cur)

    # Retrieval
    lines.append(f"| **Retrieval** | Recall@1 (RRF) | `{_get_val(overall, ['retrieval_layers', 'hybrid', 'recall_at_1'])}` | `{_get_val(by_origin.get('REAL', {}), ['retrieval_layers', 'hybrid', 'recall_at_1'])}` | `{_get_val(by_origin.get('SYNTHETIC', {}), ['retrieval_layers', 'hybrid', 'recall_at_1'])}` | Evidence chunk in Top 1 |")
    lines.append(f"| **Retrieval** | Recall@3 (RRF) | `{_get_val(overall, ['retrieval_layers', 'hybrid', 'recall_at_3'])}` | `{_get_val(by_origin.get('REAL', {}), ['retrieval_layers', 'hybrid', 'recall_at_3'])}` | `{_get_val(by_origin.get('SYNTHETIC', {}), ['retrieval_layers', 'hybrid', 'recall_at_3'])}` | Evidence chunk in Top 3 |")
    lines.append(f"| **Retrieval** | Recall@5 (RRF) | `{_get_val(overall, ['retrieval_layers', 'hybrid', 'recall_at_5'])}` | `{_get_val(by_origin.get('REAL', {}), ['retrieval_layers', 'hybrid', 'recall_at_5'])}` | `{_get_val(by_origin.get('SYNTHETIC', {}), ['retrieval_layers', 'hybrid', 'recall_at_5'])}` | Evidence chunk in Top 5 |")
    lines.append(f"| **Retrieval** | MRR | `{_get_val(overall, ['retrieval_layers', 'hybrid', 'mrr'])}` | `{_get_val(by_origin.get('REAL', {}), ['retrieval_layers', 'hybrid', 'mrr'])}` | `{_get_val(by_origin.get('SYNTHETIC', {}), ['retrieval_layers', 'hybrid', 'mrr'])}` | Mean Reciprocal Rank |")
    lines.append(f"| **Retrieval** | nDCG@5 | `{_get_val(overall, ['retrieval_layers', 'hybrid', 'ndcg_at_5'])}` | `{_get_val(by_origin.get('REAL', {}), ['retrieval_layers', 'hybrid', 'ndcg_at_5'])}` | `{_get_val(by_origin.get('SYNTHETIC', {}), ['retrieval_layers', 'hybrid', 'ndcg_at_5'])}` | Graded ranking quality Top-5 |")

    # Evidence Relation Classification
    lines.append(f"| **Evidence Relation** | Macro F1 | `{_get_val(overall, ['evidence_relation', 'f1_macro'])}` | `{_get_val(by_origin.get('REAL', {}), ['evidence_relation', 'f1_macro'])}` | `{_get_val(by_origin.get('SYNTHETIC', {}), ['evidence_relation', 'f1_macro'])}` | Unweighted F1 across 6 relations |")
    lines.append(f"| **Evidence Relation** | Weighted F1 | `{_get_val(overall, ['evidence_relation', 'f1_weighted'])}` | `{_get_val(by_origin.get('REAL', {}), ['evidence_relation', 'f1_weighted'])}` | `{_get_val(by_origin.get('SYNTHETIC', {}), ['evidence_relation', 'f1_weighted'])}` | Support-weighted F1 |")
    lines.append(f"| **Evidence Relation** | NO_EVIDENCE FP Rate | `{_get_val(overall, ['evidence_relation_diagnostics', 'no_evidence_false_positive_rate'], is_pct=True)}` | `{_get_val(by_origin.get('REAL', {}), ['evidence_relation_diagnostics', 'no_evidence_false_positive_rate'], is_pct=True)}` | `{_get_val(by_origin.get('SYNTHETIC', {}), ['evidence_relation_diagnostics', 'no_evidence_false_positive_rate'], is_pct=True)}` | Hallucinated evidence rate |")
    lines.append(f"| **Evidence Relation** | Evidence FN Rate | `{_get_val(overall, ['evidence_relation_diagnostics', 'evidence_false_negative_rate'], is_pct=True)}` | `{_get_val(by_origin.get('REAL', {}), ['evidence_relation_diagnostics', 'evidence_false_negative_rate'], is_pct=True)}` | `{_get_val(by_origin.get('SYNTHETIC', {}), ['evidence_relation_diagnostics', 'evidence_false_negative_rate'], is_pct=True)}` | Missed evidence rate |")
    lines.append(f"| **Evidence Relation** | INFERRED F1 | `{_get_val(overall, ['evidence_relation_diagnostics', 'inferred_f1'])}` | `{_get_val(by_origin.get('REAL', {}), ['evidence_relation_diagnostics', 'inferred_f1'])}` | `{_get_val(by_origin.get('SYNTHETIC', {}), ['evidence_relation_diagnostics', 'inferred_f1'])}` | Semantic inference precision/recall |")
    lines.append(f"| **Evidence Relation** | ADJACENT F1 | `{_get_val(overall, ['evidence_relation_diagnostics', 'adjacent_f1'])}` | `{_get_val(by_origin.get('REAL', {}), ['evidence_relation_diagnostics', 'adjacent_f1'])}` | `{_get_val(by_origin.get('SYNTHETIC', {}), ['evidence_relation_diagnostics', 'adjacent_f1'])}` | Related skill precision/recall |")

    # Requirement Outcome
    lines.append(f"| **Requirement Outcome** | Macro F1 | `{_get_val(overall, ['requirement_outcome', 'f1_macro'])}` | `{_get_val(by_origin.get('REAL', {}), ['requirement_outcome', 'f1_macro'])}` | `{_get_val(by_origin.get('SYNTHETIC', {}), ['requirement_outcome', 'f1_macro'])}` | Outcome (SATISFIED/PARTIAL/etc) |")
    lines.append(f"| **Requirement Outcome** | Accuracy | `{_get_val(overall, ['requirement_outcome', 'accuracy'], is_pct=True)}` | `{_get_val(by_origin.get('REAL', {}), ['requirement_outcome', 'accuracy'], is_pct=True)}` | `{_get_val(by_origin.get('SYNTHETIC', {}), ['requirement_outcome', 'accuracy'], is_pct=True)}` | Exact outcome accuracy |")

    # Critical Gap & Boolean Groups
    lines.append(f"| **Critical Gap** | Precision | `{_get_val(overall, ['critical_gap', 'critical_gap_precision'])}` | `{_get_val(by_origin.get('REAL', {}), ['critical_gap', 'critical_gap_precision'])}` | `{_get_val(by_origin.get('SYNTHETIC', {}), ['critical_gap', 'critical_gap_precision'])}` | Blocker detection precision |")
    lines.append(f"| **Critical Gap** | Recall | `{_get_val(overall, ['critical_gap', 'critical_gap_recall'])}` | `{_get_val(by_origin.get('REAL', {}), ['critical_gap', 'critical_gap_recall'])}` | `{_get_val(by_origin.get('SYNTHETIC', {}), ['critical_gap', 'critical_gap_recall'])}` | Blocker detection recall |")
    lines.append(f"| **Critical Gap** | F1-Score | `{_get_val(overall, ['critical_gap', 'critical_gap_f1'])}` | `{_get_val(by_origin.get('REAL', {}), ['critical_gap', 'critical_gap_f1'])}` | `{_get_val(by_origin.get('SYNTHETIC', {}), ['critical_gap', 'critical_gap_f1'])}` | Harmonic mean blocker F1 |")
    lines.append(f"| **Boolean Logic** | Group Accuracy | `{_get_val(overall, ['boolean_groups', 'boolean_group_accuracy'], is_pct=True)}` | `{_get_val(by_origin.get('REAL', {}), ['boolean_groups', 'boolean_group_accuracy'], is_pct=True)}` | `{_get_val(by_origin.get('SYNTHETIC', {}), ['boolean_groups', 'boolean_group_accuracy'], is_pct=True)}` | ANY_OF / ALL_OF accuracy |")

    # Overall Score Correlation
    lines.append(f"| **Overall Rating (0..100)** | Spearman $\\rho$ | `{_get_val(overall, ['rating_correlation', 'spearman_rho'])}` | `{_get_val(by_origin.get('REAL', {}), ['rating_correlation', 'spearman_rho'])}` | `{_get_val(by_origin.get('SYNTHETIC', {}), ['rating_correlation', 'spearman_rho'])}` | Monotonic rank alignment |")
    lines.append(f"| **Overall Rating (0..100)** | Score MAE | `{_get_val(overall, ['rating_correlation', 'mae'], fmt='.2f')}` | `{_get_val(by_origin.get('REAL', {}), ['rating_correlation', 'mae'], fmt='.2f')}` | `{_get_val(by_origin.get('SYNTHETIC', {}), ['rating_correlation', 'mae'], fmt='.2f')}` | Mean Absolute Error (pts) |\n")

    # 2. Multi-Layer Retrieval Progression
    lines.append("## 2. Multi-Layer Retrieval Progression Breakdown\n")
    lines.append("| Retrieval Stage | Recall@1 | Recall@3 | Recall@5 | MRR | nDCG@5 | Evaluated Queries |")
    lines.append("| :--- | :---: | :---: | :---: | :---: | :---: | :---: |")
    layers = overall.get("retrieval_layers", {})
    for l_key, l_title in [("bm25", "1. Lexical BM25 Search"), ("semantic", "2. Dense Vector Search"), ("hybrid", "3. RRF Hybrid Fusion"), ("final", "4. Final Evidence Selection")]:
        d = layers.get(l_key, {})
        lines.append(f"| **{l_title}** | `{d.get('recall_at_1', 0.0):.4f}` | `{d.get('recall_at_3', 0.0):.4f}` | `{d.get('recall_at_5', 0.0):.4f}` | `{d.get('mrr', 0.0):.4f}` | `{d.get('ndcg_at_5', 0.0):.4f}` | `{d.get('evaluated_queries', 0)}` |")
    lines.append("")

    # 3. Evidence Relation Confusion Matrix
    lines.append("## 3. Evidence Relation Confusion Matrix\n")
    cm_rel = overall.get("evidence_relation", {}).get("confusion_matrix", {})
    labels_rel = EVIDENCE_RELATION_ORDER
    lines.append("| Ground Truth \\ Engine Predicted | " + " | ".join(labels_rel) + " |")
    lines.append("| :--- | " + " | ".join([":---:"] * len(labels_rel)) + " |")
    for true_lbl in labels_rel:
        row_counts = [str(cm_rel.get(true_lbl, {}).get(pred_lbl, 0)) for pred_lbl in labels_rel]
        lines.append(f"| **{true_lbl}** | " + " | ".join(row_counts) + " |")
    lines.append("")

    # 4. Requirement Outcome Confusion Matrix
    lines.append("## 4. Requirement Outcome Confusion Matrix\n")
    cm_out = overall.get("requirement_outcome", {}).get("confusion_matrix", {})
    labels_out = REQUIREMENT_OUTCOME_ORDER
    lines.append("| Ground Truth \\ Engine Predicted | " + " | ".join(labels_out) + " |")
    lines.append("| :--- | " + " | ".join([":---:"] * len(labels_out)) + " |")
    for true_lbl in labels_out:
        row_counts = [str(cm_out.get(true_lbl, {}).get(pred_lbl, 0)) for pred_lbl in labels_out]
        lines.append(f"| **{true_lbl}** | " + " | ".join(row_counts) + " |")
    lines.append("")

    # 5. Multi-Annotator Agreement (if present)
    if agreement.get("multi_annotated_requirements", 0) > 0:
        lines.append("## 5. Multi-Annotator Agreement & Reliability\n")
        lines.append(f"- Multi-Annotated Requirements: **{agreement.get('multi_annotated_requirements')}** / {agreement.get('total_annotated_requirements')}")
        lines.append(f"- Evidence Relation Raw Agreement: `{agreement.get('evidence_relation_raw_agreement', 0.0) * 100:.2f}%` | Cohen's $\\kappa$: `{agreement.get('evidence_relation_cohen_kappa', 0.0):.4f}`")
        lines.append(f"- Requirement Outcome Raw Agreement: `{agreement.get('requirement_outcome_raw_agreement', 0.0) * 100:.2f}%` | Cohen's $\\kappa$: `{agreement.get('requirement_outcome_cohen_kappa', 0.0):.4f}`\n")

    # 6. Failure Analysis
    lines.append("## 6. Failure Analysis Breakdown\n")
    lines.append(f"Total Prediction Mismatches: **{fa.get('total_mismatches', 0)}** / {fa.get('total_evaluated_requirements', 0)} requirements (Mismatch Rate: `{fa.get('mismatch_rate', 0.0) * 100:.2f}%`)\n")
    lines.append("| Failure Category | Count | Share | Description |")
    lines.append("| :--- | :---: | :---: | :--- |")
    cat_counts = fa.get("failures_by_category_counts", {})
    total_mis = max(1, fa.get("total_mismatches", 0))
    for cat, count in cat_counts.items():
        prop = (count / total_mis) * 100
        lines.append(f"| `{cat}` | **{count}** | `{prop:.1f}%` | {cat} |")
    lines.append("")

    items = fa.get("failure_items", [])
    if items:
        lines.append("### Detailed Failure Diagnostics (Top Root Causes)\n")
        lines.append("| Case ID | Requirement | Human Rel / Out | Engine Rel / Out | Score | Failure Category | Reason |")
        lines.append("| :--- | :--- | :---: | :---: | :---: | :--- | :--- |")
        for item in items[:50]:
            sc = item.get("scores", {}).get("match_score", 0.0)
            h_str = f"{item.get('human_evidence_relation')} / {item.get('human_outcome')}"
            e_str = f"{item.get('engine_evidence_relation')} / {item.get('engine_outcome')}"
            lines.append(
                f"| `{item.get('case_id')}` | {item.get('requirement_id')} | **{h_str}** | **{e_str}** | `{sc:.2f}` | `{item.get('failure_category')}` | {item.get('reason')} |"
            )
        if len(items) > 50:
            lines.append(f"\n*... and {len(items) - 50} more failure items recorded in JSON report.*")
    lines.append("")

    return "\n".join(lines)


class V1BenchmarkRunner:
    """Benchmark runner for CV-JD matching pipeline evaluation."""

    def __init__(
        self,
        config: PipelineConfig | None = None,
        use_deterministic_embedding: bool = True,
    ) -> None:
        if use_deterministic_embedding:
            os.environ["CV_JD_EMBEDDING_PROVIDER"] = "hashing"
        self.config = config or PipelineConfig(
            embedding_provider="hashing" if use_deterministic_embedding else "gemini"
        )

    def run_case(self, case: BenchmarkCase) -> dict[str, Any]:
        """Execute matching engine for a single benchmark case."""
        case.validate()

        # Format requirements for pipeline
        req_dicts = []
        for req in case.requirements:
            req_dicts.append({
                "requirement_id": req.requirement_id,
                "text": req.text or req.canonical_name,
                "canonical_name": req.canonical_name,
                "normalized_value": req.canonical_name,
                "group": req.group,
                "type": req.required_level,
                "importance": req.importance,
                "mandatory": req.mandatory,
                "required_level": req.expected_proficiency,
                "expected_proficiency": req.expected_proficiency,
                "group_id": req.group_id,
                "group_operator": req.group_operator,
                "is_scorable": True,
            })

        start_t = time.perf_counter()
        result = run_cv_jd_pipeline(
            cv_text=case.cv_text,
            parsed_cv=case.cv_parsed,
            job_id=case.jd_id,
            requirements=req_dicts,
            jd_title=case.jd_title,
            config=self.config,
        )
        elapsed_ms = round((time.perf_counter() - start_t) * 1000, 2)
        result["execution_duration_ms"] = elapsed_ms
        return result

    def _evaluate_subset(
        self,
        cases: list[BenchmarkCase],
        exec_results: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """Evaluate a specific subset of cases (e.g. REAL, SYNTHETIC, or ALL)."""
        if not cases:
            return {}

        layer_queries: dict[str, list[dict[str, Any]]] = {
            "bm25": [],
            "semantic": [],
            "hybrid": [],
            "final": [],
        }

        y_true_rel: list[str] = []
        y_pred_rel: list[str] = []
        diag_rel_items: list[dict[str, Any]] = []

        y_true_out: list[str] = []
        y_pred_out: list[str] = []

        critical_gap_items: list[dict[str, Any]] = []
        boolean_group_results: list[dict[str, Any]] = []
        rating_pairs: list[tuple[float, float]] = []

        for case, exec_res in zip(cases, exec_results, strict=True):
            engine_evals = {
                item.get("requirement_id"): item
                for item in exec_res.get("evaluated_requirements", [])
            }
            retrieval_map = {
                item.get("requirement_id"): item
                for item in exec_res.get("retrieval_results", [])
            }
            all_chunks = exec_res.get("cv_chunks", [])

            # Evaluate Requirements
            for req in case.requirements:
                req_id = req.requirement_id
                engine_item = engine_evals.get(req_id, {})
                retrieval_item = retrieval_map.get(req_id, {})

                # 1. Map evidence spans to runtime chunks dynamically
                expected_spans = req.expected_evidence
                mapped_chunk_ids = map_evidence_spans_to_chunks(expected_spans, all_chunks) if expected_spans else set()
                if not mapped_chunk_ids and req.expected_evidence_chunk_ids:
                    mapped_chunk_ids = set(req.expected_evidence_chunk_ids)

                if mapped_chunk_ids:
                    bm25_ids = [r.get("chunk_id") for r in retrieval_item.get("bm25_results", []) if r.get("chunk_id")]
                    sem_ids = [r.get("chunk_id") for r in retrieval_item.get("semantic_results", []) if r.get("chunk_id")]
                    hybrid_ids = [r.get("chunk_id") for r in retrieval_item.get("hybrid_results", []) if r.get("chunk_id")]
                    final_ids = [e.get("chunk_id") for e in engine_item.get("evidence", []) if e.get("chunk_id")]

                    layer_queries["bm25"].append({"expected_chunk_ids": mapped_chunk_ids, "retrieved_chunk_ids": bm25_ids})
                    layer_queries["semantic"].append({"expected_chunk_ids": mapped_chunk_ids, "retrieved_chunk_ids": sem_ids})
                    layer_queries["hybrid"].append({"expected_chunk_ids": mapped_chunk_ids, "retrieved_chunk_ids": hybrid_ids})
                    layer_queries["final"].append({"expected_chunk_ids": mapped_chunk_ids, "retrieved_chunk_ids": final_ids})

                # 2. Evidence Relation Classification
                h_rel = req.evidence_relation
                if h_rel:
                    e_rel = map_engine_classification_to_evidence_relation(engine_item)
                    y_true_rel.append(h_rel)
                    y_pred_rel.append(e_rel)
                    diag_rel_items.append({
                        "human_evidence_relation": h_rel,
                        "engine_evidence_relation": e_rel,
                    })

                # 3. Requirement Outcome Classification
                h_out = req.requirement_outcome
                if h_out:
                    e_out = map_engine_status_to_requirement_outcome(engine_item)
                    y_true_out.append(h_out)
                    y_pred_out.append(e_out)

                # 4. Critical Gap Ground Truth
                is_mand = req.mandatory or req.hard_gate
                if h_rel or h_out or req.human_is_critical_gap is not None:
                    e_rel = map_engine_classification_to_evidence_relation(engine_item)
                    e_out = map_engine_status_to_requirement_outcome(engine_item)
                    critical_gap_items.append({
                        "mandatory": is_mand,
                        "hard_gate": req.hard_gate,
                        "human_is_critical_gap": req.human_is_critical_gap,
                        "human_requirement_outcome": h_out,
                        "human_evidence_relation": h_rel,
                        "engine_requirement_outcome": e_out,
                        "engine_evidence_relation": e_rel,
                    })

            # Evaluate Boolean Groups
            for bg in case.boolean_groups:
                # Find group items from engine evaluation
                grp_items = [
                    item for item in exec_res.get("evaluated_requirements", [])
                    if item.get("group_id") == bg.group_id or item.get("requirement_id") in bg.member_requirement_ids
                ]
                engine_grp_st = grp_items[0].get("group_status") if grp_items else "NOT_FOUND"
                # Map NOT_FOUND to UNSATISFIED
                if engine_grp_st == "NOT_FOUND":
                    engine_grp_st = "UNSATISFIED"
                elif engine_grp_st == "PARTIALLY_SUPPORTED":
                    engine_grp_st = "PARTIAL"

                boolean_group_results.append({
                    "group_id": bg.group_id,
                    "operator": bg.operator,
                    "human_group_status": bg.human_group_status or "SATISFIED",
                    "engine_group_status": engine_grp_st,
                })

            # Evaluate Overall Score (0..100 Canonical Scale)
            human_canonical_score = case.get_canonical_overall_score()
            if human_canonical_score is not None:
                engine_final_score = float(exec_res.get("final_score", 0.0))
                rating_pairs.append((engine_final_score, human_canonical_score))

        retrieval_layers = calculate_layered_retrieval_metrics(layer_queries)
        clf_rel = calculate_classification_metrics(y_true_rel, y_pred_rel, labels=EVIDENCE_RELATION_ORDER)
        diag_rel = calculate_evidence_relation_special_rates(diag_rel_items, clf_rel)
        clf_out = calculate_classification_metrics(y_true_out, y_pred_out, labels=REQUIREMENT_OUTCOME_ORDER)
        crit_gap = calculate_critical_gap_metrics(critical_gap_items)
        bg_metrics = calculate_boolean_group_metrics(boolean_group_results)
        rating_corr = calculate_rating_correlation(rating_pairs)

        return {
            "cases_count": len(cases),
            "retrieval_layers": retrieval_layers,
            "evidence_relation": clf_rel,
            "evidence_relation_diagnostics": diag_rel,
            "requirement_outcome": clf_out,
            "critical_gap": crit_gap,
            "boolean_groups": bg_metrics,
            "rating_correlation": rating_corr,
        }

    def evaluate_dataset(
        self,
        cases: list[BenchmarkCase],
        output_dir: Path | str | None = None,
    ) -> dict[str, Any]:
        """Run full evaluation across benchmark cases, segmented by REAL and SYNTHETIC data origin."""
        execution_results: list[dict[str, Any]] = []
        all_reqs_for_agreement = []

        for case in cases:
            exec_res = self.run_case(case)
            execution_results.append(exec_res)
            all_reqs_for_agreement.extend(case.requirements)

        real_cases = [c for c in cases if c.data_origin == DataOrigin.REAL.value]
        real_execs = [e for c, e in zip(cases, execution_results, strict=True) if c.data_origin == DataOrigin.REAL.value]

        synth_cases = [c for c in cases if c.data_origin == DataOrigin.SYNTHETIC.value]
        synth_execs = [e for c, e in zip(cases, execution_results, strict=True) if c.data_origin == DataOrigin.SYNTHETIC.value]

        overall_metrics = self._evaluate_subset(cases, execution_results)
        real_metrics = self._evaluate_subset(real_cases, real_execs) if real_cases else {}
        synth_metrics = self._evaluate_subset(synth_cases, synth_execs) if synth_cases else {}

        agreement = calculate_annotator_agreement(all_reqs_for_agreement)
        failure_report = analyze_failures(cases, execution_results)

        report = {
            "metadata": {
                "timestamp_utc": datetime.now(timezone.utc).isoformat(),
                "pipeline_version": "1.0",
                "total_cases": len(cases),
                "real_cases": len(real_cases),
                "synthetic_cases": len(synth_cases),
            },
            "overall_metrics": overall_metrics,
            "by_origin": {
                "REAL": real_metrics,
                "SYNTHETIC": synth_metrics,
            },
            "annotator_agreement": agreement,
            "failure_analysis": failure_report,
        }

        if output_dir:
            out_p = Path(output_dir)
            out_p.mkdir(parents=True, exist_ok=True)

            json_path = out_p / "v1_eval_report.json"
            md_path = out_p / "v1_eval_report.md"

            with open(json_path, "w", encoding="utf-8") as f:
                json.dump(report, f, indent=2, ensure_ascii=False)

            md_content = generate_markdown_report(report)
            with open(md_path, "w", encoding="utf-8") as f:
                f.write(md_content)

            logger.info("Evaluation report written to %s and %s", json_path, md_path)

        return report
