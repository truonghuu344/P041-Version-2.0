"""CLI runner for CV-JD Benchmark and Multi-Layer Evaluation."""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT / "backend") not in sys.path:
    sys.path.insert(0, str(ROOT / "backend"))

from eval.datasets.loader import load_benchmark_dataset  # noqa: E402
from eval.runners.evaluator import BenchmarkEvaluator  # noqa: E402


def generate_markdown_report(report: dict[str, Any]) -> str:
    """Generate a clean GitHub-Flavored Markdown report from evaluation results."""
    meta = report["metadata"]
    cfg = report["configuration"]
    summary = report["summary_metrics"]
    layer_b = report["layer_metrics"]["layer_b_hard_constraints"]
    error_analysis = report["error_analysis"]
    jobs = report["per_job_results"]

    md = []
    md.append(f"# CV–JD Benchmark Evaluation Report: `{meta['scoring_version']}`\n")
    md.append(f"- **Split**: `{meta['split'].upper()}`")
    md.append(f"- **Dataset Version**: `{meta['dataset_version']}`")
    md.append(f"- **Timestamp (UTC)**: `{meta['timestamp_utc']}`")
    md.append(f"- **Total Job Descriptions**: `{meta['total_jobs']}`")
    md.append(f"- **Total Candidate Evaluations**: `{meta['total_evaluations']}`\n")

    md.append("## 1. Executive Summary & Ranking Metrics\n")
    md.append("| Metric | Value | Description |")
    md.append("| :--- | :--- | :--- |")
    md.append(f"| **NDCG@5** | `{summary['ndcg_at_5']:.4f}` | Graded relevance ranking quality in Top-5 |")
    md.append(f"| **NDCG@10** | `{summary['ndcg_at_10']:.4f}` | Graded relevance ranking quality in Top-10 |")
    md.append(f"| **Spearman Rank Correlation ($\\rho$)** | `{summary['spearman_rho']:.4f}` | Monotonic alignment between system & human rank |")
    md.append(f"| **Pearson Correlation ($r$)** | `{summary['pearson_r']:.4f}` | Linear correlation with normalized human scores |")
    md.append(f"| **Mean Absolute Error (MAE)** | `{summary['mae']:.2f}` | Score deviation from human rating (0-100 scale) |")
    md.append(f"| **Pairwise Inversion Rate** | `{summary['pairwise_inversion_rate'] * 100:.2f}%` | Inverted candidate pairs / total comparable pairs |")
    md.append(f"| **Pairwise Comparison Counts** | `{summary['correct_pairs']} Correct / {summary['inverted_pairs']} Inverted / {summary['tied_pairs']} Tied` | Total `{summary['total_pairs_compared']}` pairs evaluated |\n")

    md.append("## 2. Multi-Layer Evaluation Breakdown\n")
    md.append("### Layer A — Hybrid Retrieval (BM25 + Vector + RRF)")
    md.append("- Status: **OPERATIONAL** (Atomic requirement queries against CV chunks)\n")

    md.append("### Layer B — Eligibility & Hard Constraints Classification")
    md.append(f"- Accuracy: `{layer_b['accuracy'] * 100:.2f}%` | Macro-F1: `{layer_b['macro_f1']:.4f}`\n")
    md.append("| Class | Precision | Recall | F1-Score | Support |")
    md.append("| :--- | :--- | :--- | :--- | :--- |")
    for cls_name, cls_data in layer_b.get("per_class", {}).items():
        md.append(f"| **{cls_name}** | `{cls_data['precision']:.4f}` | `{cls_data['recall']:.4f}` | `{cls_data['f1']:.4f}` | `{cls_data['support']}` |")

    md.append("\n## 3. Pairwise Inversion & Error Analysis\n")
    md.append(f"Total Inversions Detected: **{error_analysis['total_inversions']}**\n")
    md.append("| Failure Layer | Inversion Count | Share |")
    md.append("| :--- | :--- | :--- |")
    total_inv = error_analysis["total_inversions"]
    for layer, count in error_analysis["inversions_by_layer"].items():
        share = (count / total_inv * 100) if total_inv > 0 else 0.0
        md.append(f"| `{layer}` | `{count}` | `{share:.1f}%` |")

    if error_analysis["detailed_inversion_diagnostics"]:
        md.append("\n### Detailed Inversion Diagnostics (Top Root Causes)")
        for idx, diag in enumerate(error_analysis["detailed_inversion_diagnostics"][:10], start=1):
            md.append(f"\n#### Case #{idx}: {diag['job_id']}")
            md.append(f"- **Human Ranking**: {diag['human_ranking']}")
            md.append(f"- **System Ranking**: {diag['system_ranking']}")
            md.append(f"- **Score Gap**: `{diag['score_difference']} pts`")
            md.append(f"- **Likely Failure Layer**: `{diag['likely_failure_layer']}`")
            md.append(f"- **Diagnostic Explanation**: {diag['diagnosis_reason']}")
            if diag["top_contributing_requirements"]:
                md.append("- **Largest Requirement Differentials**:")
                for r in diag["top_contributing_requirements"][:3]:
                    md.append(f"  - `{r['requirement_id']}` ({r['requirement_type']}): delta favoring worse = `+{r['delta_favoring_worse']:.1f} pts` (Req: {r['requirement_text']})")

    md.append("\n## 4. Per-Job Candidate Rankings\n")
    for job in jobs:
        md.append(f"### {job['job_id']}: {job['title']} (`{job['domain']}`, `{job['seniority']}`)")
        md.append(f"- NDCG@5: `{job['ndcg_at_5']:.4f}` | Spearman $\\rho$: `{job['spearman_rho']:.4f}` | Inversions: `{job['pairwise_inversions']['inverted_pairs']}/{job['pairwise_inversions']['total_pairs']}`")
        md.append("\n| System Rank | Human Rank | Delta | Candidate ID | Human Rel (0-4) | System Score | Eligibility | Tags |")
        md.append("| :---: | :---: | :---: | :--- | :---: | :---: | :---: | :--- |")
        for c in job["candidates"]:
            delta_str = f"+{c['rank_delta']}" if c["rank_delta"] > 0 else str(c["rank_delta"])
            tags_str = ", ".join(c.get("edge_case_tags", [])) or "standard"
            md.append(f"| {c['system_rank']} | {c['human_rank']} | `{delta_str}` | **{c['cv_id']}** | {c['human_relevance']} | **{c['system_score']:.1f}** | `{c['eligibility_actual']}` | {tags_str} |")
        md.append("")

    return "\n".join(md)


def main() -> None:
    parser = argparse.ArgumentParser(description="Run reproducible CV-JD benchmark evaluation.")
    parser.add_argument(
        "--dataset",
        type=str,
        default=str(ROOT / "eval" / "datasets" / "benchmark_dataset_v1.json"),
        help="Path to benchmark dataset JSON file.",
    )
    parser.add_argument(
        "--annotations",
        type=str,
        default=str(ROOT / "eval" / "annotations" / "chunk_annotations.json"),
        help="Path to ground truth annotations JSON file.",
    )
    parser.add_argument(
        "--split",
        type=str,
        choices=["dev", "holdout", "all"],
        default="holdout",
        help="Dataset split to evaluate on ('dev', 'holdout', or 'all').",
    )
    parser.add_argument(
        "--scoring-version",
        type=str,
        default="scoring_v1",
        help="Identifier for the scoring system baseline version.",
    )
    parser.add_argument(
        "--tuning",
        action="store_true",
        default=False,
        help="Tuning mode: automatically restricts evaluation to the 'dev' split to preserve holdout integrity.",
    )
    parser.add_argument(
        "--input-mode",
        type=str,
        choices=["structured", "raw"],
        default="structured",
        help="Input evaluation mode: 'structured' (canonical requirement objects) or 'raw' (end-to-end parsed from raw text).",
    )
    parser.add_argument(
        "--save-report",
        action="store_true",
        default=True,
        help="Save machine-readable JSON and human-readable Markdown reports to output dir.",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default=str(ROOT / "eval" / "reports"),
        help="Directory where evaluation reports will be saved.",
    )

    args = parser.parse_args()

    split_to_run = "dev" if args.tuning else args.split

    print("================================================================================")
    print(f"[RUNNER] CV-JD Benchmark Evaluation: [{args.scoring_version}] | Split: [{split_to_run.upper()}] | Mode: [{args.input_mode.upper()}]")
    if args.tuning:
        print("[TUNING MODE]: Evaluation locked strictly to DEV split. Holdout remains untouched.")
    elif split_to_run == "holdout":
        print("[HOLDOUT DISCIPLINE]: Evaluating on locked Holdout set. Do not use for iterative heuristic tuning!")
    print("[ZERO-LEAKAGE AUDIT]: Human labels and ground truth annotations are isolated from matching engine.")
    print("================================================================================")

    dataset = load_benchmark_dataset(args.dataset)
    evaluator = BenchmarkEvaluator(
        scoring_version=args.scoring_version,
        annotations_path=args.annotations,
    )

    report = evaluator.evaluate_dataset(dataset, split=split_to_run, input_mode=args.input_mode)
    summary = report["summary_metrics"]

    print("\nOVERALL RANKING & EVALUATION RESULTS:")
    print("--------------------------------------------------------------------------------")
    print(f"* Dataset Size:              {report['metadata']['total_jobs']} JDs, {report['metadata']['total_evaluations']} Candidate Evaluations")
    print(f"* NDCG@5:                    {summary['ndcg_at_5']:.4f}")
    print(f"* NDCG@10:                   {summary['ndcg_at_10']:.4f}")
    print(f"* Spearman Correlation (rho): {summary['spearman_rho']:.4f}")
    print(f"* Pearson Correlation (r):   {summary['pearson_r']:.4f}")
    print(f"* Mean Absolute Error (MAE): {summary['mae']:.2f} pts")
    print(f"* Pairwise Inversion Rate:   {summary['pairwise_inversion_rate'] * 100:.2f}% ({summary['inverted_pairs']}/{summary['total_pairs_compared']} pairs)")
    print("--------------------------------------------------------------------------------")

    # Hard constraint classification metrics
    layer_b = report["layer_metrics"]["layer_b_hard_constraints"]
    print(f"* Hard Constraint Accuracy:  {layer_b['accuracy'] * 100:.2f}% (Macro-F1: {layer_b['macro_f1']:.4f})")

    # Inversions by failure layer
    err_layers = report["error_analysis"]["inversions_by_layer"]
    print("\nINVERSIONS BY FAILURE LAYER:")
    for layer, count in err_layers.items():
        if count > 0:
            print(f"  - {layer:<30}: {count} pairs")

    if args.save_report:
        out_dir = Path(args.output_dir)
        out_dir.mkdir(parents=True, exist_ok=True)
        ts_slug = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        json_path = out_dir / f"{args.scoring_version}_{split_to_run}_{ts_slug}.json"
        md_path = out_dir / f"{args.scoring_version}_{split_to_run}_{ts_slug}.md"

        json_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
        md_content = generate_markdown_report(report)
        md_path.write_text(md_content, encoding="utf-8")

        print(f"\nReports saved successfully:")
        print(f"  * JSON: {json_path}")
        print(f"  * Markdown: {md_path}")
    print("================================================================================\n")


if __name__ == "__main__":
    main()
