"""
Script tổng hợp và báo cáo kết quả LLM-as-Judge evaluation.

Cách dùng:
  # Báo cáo Gap Analysis eval
  python eval/scripts/report_eval.py \\
    --results eval/results/gap_eval_20260808.json \\
    --type gap_analysis

  # Báo cáo STAR calibration (kiểm tra correlation với golden scores)
  python eval/scripts/report_eval.py \\
    --results eval/results/star_calibration.json \\
    --type star_scoring \\
    --mode calibration \\
    --threshold 0.85

  # So sánh nhiều runs (ví dụ GPT-4o vs Claude)
  python eval/scripts/report_eval.py \\
    --results eval/results/gap_eval_gpt4o.json eval/results/gap_eval_claude.json \\
    --type gap_analysis \\
    --compare
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Any


# ─── Thresholds ───────────────────────────────────────────────────────────────

KPI_MEAN_SCORE = 8.5          # Target từ PRD: ≥ 8.5/10
KPI_INTEGRITY_MIN = 7.0       # Gate: bất kỳ case nào < 7 → BLOCK
KPI_STAR_CORRELATION = 0.85   # Pearson r so với golden scores


# ─── Loaders ──────────────────────────────────────────────────────────────────

def load_result_file(path: str) -> dict:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


# ─── Gap Analysis Report ──────────────────────────────────────────────────────

def report_gap_analysis(data: dict, threshold: float = KPI_MEAN_SCORE) -> dict:
    """Tổng hợp kết quả Gap Analysis eval."""
    results = data.get("results", [])
    if not results:
        print("⚠️  Không có kết quả nào trong file.")
        return {}

    all_scores = {
        "accuracy": [],
        "integrity": [],
        "relevance": [],
        "actionability": [],
        "mean_score": [],
    }

    integrity_failures = []
    range_failures = []

    for r in results:
        scores = r.get("scores", {})
        eval_id = r.get("eval_id", "?")

        for dim in all_scores:
            val = scores.get(dim)
            if val is not None:
                all_scores[dim].append(val)

        # Kiểm tra integrity gate
        integrity = scores.get("integrity", 10)
        if integrity < KPI_INTEGRITY_MIN:
            integrity_failures.append({
                "eval_id": eval_id,
                "integrity": integrity,
                "reasoning": scores.get("reasoning", ""),
            })

        # Kiểm tra có nằm trong expected range không
        expected = r.get("expected_score_range", {})
        mean = scores.get("mean_score", 0)
        if expected:
            lo = expected.get("min", 0)
            hi = expected.get("max", 10)
            if not (lo <= mean <= hi):
                range_failures.append({
                    "eval_id": eval_id,
                    "judge_score": mean,
                    "expected_range": f"[{lo}, {hi}]",
                })

    # Tính mean cho mỗi dimension
    summary = {}
    for dim, vals in all_scores.items():
        summary[dim] = round(sum(vals) / len(vals), 2) if vals else 0

    overall_mean = summary.get("mean_score", 0)
    kpi_pass = overall_mean >= threshold
    integrity_gate_pass = len(integrity_failures) == 0

    # ─── Print report ─────────────────────────────────────────────────────────
    print(f"\n{'='*65}")
    print(f"  GAP ANALYSIS EVALUATION REPORT")
    print(f"  Dataset: {data.get('dataset', '?')}")
    print(f"  Judge Model: {data.get('judge_model', '?')}")
    print(f"  Run: {data.get('run_timestamp', '?')}")
    print(f"  Total cases: {len(results)}")
    print(f"{'='*65}")

    print(f"\n  {'Dimension':<20} {'Mean Score':>12} {'Status':>10}")
    print(f"  {'-'*45}")

    dim_labels = {
        "accuracy": "Accuracy",
        "integrity": "Integrity ⚠️",
        "relevance": "Relevance",
        "actionability": "Actionability",
        "mean_score": "Overall Mean",
    }

    for dim, label in dim_labels.items():
        score = summary.get(dim, 0)
        if dim == "mean_score":
            print(f"  {'-'*45}")
            status = "✅ PASS" if kpi_pass else "❌ FAIL"
            print(f"  {label:<20} {score:>12.2f} {status:>10}")
        elif dim == "integrity":
            status = "✅ OK" if integrity_gate_pass else "🚨 GATE FAIL"
            print(f"  {label:<20} {score:>12.2f} {status:>10}")
        else:
            print(f"  {label:<20} {score:>12.2f}")

    print(f"\n  KPI Target: ≥ {threshold}/10")
    print(f"  Integrity Gate: no case < {KPI_INTEGRITY_MIN}/10")

    if integrity_failures:
        print(f"\n  🚨 INTEGRITY GATE FAILURES ({len(integrity_failures)} case(s)):")
        for f in integrity_failures:
            print(f"    - {f['eval_id']}: integrity={f['integrity']} — {f['reasoning'][:80]}")

    if range_failures:
        print(f"\n  ⚠️  OUT-OF-RANGE SCORES ({len(range_failures)} case(s)):")
        for f in range_failures:
            print(f"    - {f['eval_id']}: judge={f['judge_score']}, expected={f['expected_range']}")

    verdict = "✅ ALL GATES PASSED" if (kpi_pass and integrity_gate_pass) else "❌ GATES FAILED"
    print(f"\n  Final Verdict: {verdict}")
    print(f"{'='*65}\n")

    return {
        "summary": summary,
        "kpi_pass": kpi_pass,
        "integrity_gate_pass": integrity_gate_pass,
        "integrity_failures": integrity_failures,
        "range_failures": range_failures,
        "verdict": verdict,
    }


# ─── STAR Scoring Calibration Report ─────────────────────────────────────────

def compute_pearson_r(x: list[float], y: list[float]) -> float:
    """Tính Pearson correlation coefficient."""
    n = len(x)
    if n < 2:
        return 0.0
    mean_x = sum(x) / n
    mean_y = sum(y) / n
    cov = sum((xi - mean_x) * (yi - mean_y) for xi, yi in zip(x, y))
    std_x = (sum((xi - mean_x) ** 2 for xi in x) / n) ** 0.5
    std_y = (sum((yi - mean_y) ** 2 for yi in y) / n) ** 0.5
    if std_x == 0 or std_y == 0:
        return 0.0
    return cov / (n * std_x * std_y)


def report_star_calibration(data: dict, threshold: float = KPI_STAR_CORRELATION) -> dict:
    """Báo cáo calibration: so sánh judge scores với golden scores."""
    results = data.get("results", [])
    if not results:
        print("⚠️  Không có kết quả nào.")
        return {}

    judge_totals = []
    golden_totals = []
    per_dim = {"situation": [], "task": [], "action": [], "result": []}
    per_dim_golden = {"situation": [], "task": [], "action": [], "result": []}

    case_details = []

    for r in results:
        j_scores = r.get("judge_scores", {})
        g_scores = r.get("golden_scores", {})
        expected = r.get("expected_range", {})
        eval_id = r.get("eval_id", "?")

        j_total = j_scores.get("total_score", 0)
        g_total = g_scores.get("total", 0)

        judge_totals.append(j_total)
        golden_totals.append(g_total)

        for dim in per_dim:
            j_val = j_scores.get(dim, 0)
            g_val = g_scores.get(dim, 0)
            per_dim[dim].append(j_val)
            per_dim_golden[dim].append(g_val)

        # Kiểm tra range
        in_range = True
        if expected:
            lo = expected.get("min", 0)
            hi = expected.get("max", 100)
            in_range = lo <= j_total <= hi

        case_details.append({
            "eval_id": eval_id,
            "judge_total": j_total,
            "golden_total": g_total,
            "delta": round(j_total - g_total, 1),
            "in_range": in_range,
        })

    # Tính correlation
    r_total = compute_pearson_r(judge_totals, golden_totals)
    r_per_dim = {
        dim: compute_pearson_r(per_dim[dim], per_dim_golden[dim])
        for dim in per_dim
    }

    calibration_pass = r_total >= threshold
    out_of_range = [c for c in case_details if not c["in_range"]]

    # ─── Print report ─────────────────────────────────────────────────────────
    print(f"\n{'='*65}")
    print(f"  STAR SCORING CALIBRATION REPORT")
    print(f"  Dataset: {data.get('dataset', '?')}")
    print(f"  Judge Model: {data.get('judge_model', '?')}")
    print(f"  Run: {data.get('run_timestamp', '?')}")
    print(f"  Total cases: {len(results)}")
    print(f"{'='*65}")

    print(f"\n  {'Metric':<30} {'Pearson r':>12} {'Status':>10}")
    print(f"  {'-'*55}")
    print(f"  {'Overall Total Score':<30} {r_total:>12.3f} {'✅ PASS' if calibration_pass else '❌ FAIL':>10}")
    for dim in ("situation", "task", "action", "result"):
        r_d = r_per_dim[dim]
        print(f"    {dim.capitalize():<28} {r_d:>12.3f}")

    print(f"\n  Calibration Threshold: r ≥ {threshold}")

    print(f"\n  {'Eval ID':<12} {'Judge':>8} {'Golden':>8} {'Delta':>8} {'Range':>8}")
    print(f"  {'-'*50}")
    for c in case_details:
        range_status = "✅" if c["in_range"] else "⚠️ OOR"
        delta_str = f"+{c['delta']}" if c['delta'] >= 0 else str(c['delta'])
        print(f"  {c['eval_id']:<12} {c['judge_total']:>8.1f} {c['golden_total']:>8.1f} {delta_str:>8} {range_status:>8}")

    if out_of_range:
        print(f"\n  ⚠️  OUT-OF-RANGE: {len(out_of_range)} case(s) ngoài expected range")
        print(f"  → Cần review prompt hoặc adjust thresholds")

    verdict = "✅ CALIBRATION PASSED" if calibration_pass else "❌ CALIBRATION FAILED — Tune judge prompt"
    print(f"\n  Final Verdict: {verdict}")
    print(f"{'='*65}\n")

    return {
        "pearson_r_total": r_total,
        "pearson_r_per_dim": r_per_dim,
        "calibration_pass": calibration_pass,
        "out_of_range_cases": out_of_range,
        "case_details": case_details,
    }


# ─── Comparison Report (Multiple Runs) ───────────────────────────────────────

def report_comparison(result_files: list[str], eval_type: str) -> None:
    """So sánh nhiều eval runs (VD: GPT-4o vs Claude)."""
    print(f"\n{'='*65}")
    print(f"  COMPARISON REPORT — {eval_type.upper()}")
    print(f"{'='*65}")
    print(f"\n  {'Run File':<35} {'Mean Score':>12} {'Integrity':>10} {'KPI':>8}")
    print(f"  {'-'*68}")

    for path in result_files:
        try:
            data = load_result_file(path)
            results = data.get("results", [])
            model = data.get("judge_model", "unknown")

            means = [r.get("scores", {}).get("mean_score", 0) for r in results]
            integrities = [r.get("scores", {}).get("integrity", 0) for r in results]

            mean_score = sum(means) / len(means) if means else 0
            min_integrity = min(integrities) if integrities else 0
            kpi = "✅" if mean_score >= KPI_MEAN_SCORE else "❌"

            label = f"{Path(path).stem} ({model})"
            print(f"  {label:<35} {mean_score:>12.2f} {min_integrity:>10.2f} {kpi:>8}")
        except Exception as e:
            print(f"  {path:<35} ERROR: {e}")

    print(f"\n  KPI Target: ≥ {KPI_MEAN_SCORE}/10  |  Integrity Gate: ≥ {KPI_INTEGRITY_MIN}/10")
    print(f"{'='*65}\n")


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Report LLM-as-Judge evaluation results")
    parser.add_argument(
        "--results",
        nargs="+",
        required=True,
        help="Path(s) to result JSON file(s)",
    )
    parser.add_argument(
        "--type",
        choices=["gap_analysis", "star_scoring"],
        required=True,
        help="Evaluation type",
    )
    parser.add_argument(
        "--mode",
        choices=["report", "calibration"],
        default="report",
        help="Report mode: report (default) or calibration",
    )
    parser.add_argument(
        "--threshold",
        type=float,
        default=None,
        help="Override default KPI threshold",
    )
    parser.add_argument(
        "--compare",
        action="store_true",
        help="Compare multiple result files side-by-side",
    )

    args = parser.parse_args()

    # Validate files exist
    for path in args.results:
        if not Path(path).exists():
            print(f"ERROR: File không tìm thấy: {path}")
            sys.exit(1)

    # Compare mode
    if args.compare and len(args.results) > 1:
        report_comparison(args.results, args.type)
        return

    # Single file report
    data = load_result_file(args.results[0])

    if args.type == "gap_analysis":
        threshold = args.threshold or KPI_MEAN_SCORE
        result = report_gap_analysis(data, threshold=threshold)
        # Exit code: 1 nếu fail (để CI có thể catch)
        if not (result.get("kpi_pass") and result.get("integrity_gate_pass")):
            sys.exit(1)

    elif args.type == "star_scoring":
        if args.mode == "calibration":
            threshold = args.threshold or KPI_STAR_CORRELATION
            result = report_star_calibration(data, threshold=threshold)
            if not result.get("calibration_pass"):
                sys.exit(1)
        else:
            # Standard STAR report (non-calibration)
            report_gap_analysis(data)  # Reuse gap report for now


if __name__ == "__main__":
    main()
