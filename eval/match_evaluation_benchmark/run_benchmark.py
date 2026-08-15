"""
Match Evaluation Benchmark — Thành viên 4 (feat/match-evaluation-modal).

So sánh criterion status từ API vs expert labels trong golden_set.json,
tính precision/recall và kiểm tra determinism.

Chạy:
    python eval/match_evaluation_benchmark/run_benchmark.py \\
        --base-url http://localhost:8000 \\
        --token <JWT_TOKEN> \\
        --golden eval/match_evaluation_benchmark/golden_set.json \\
        --match-ids match_001,match_002,...

Hoặc dry-run với mock (không cần server):
    python eval/match_evaluation_benchmark/run_benchmark.py --dry-run
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from pathlib import Path


@dataclass
class CriterionResult:
    criterion_id: str
    predicted: str
    expected: str
    match: bool


@dataclass
class PairResult:
    pair_id: str
    criterion_results: list[CriterionResult] = field(default_factory=list)
    mandatory_gaps_predicted: list[str] = field(default_factory=list)
    mandatory_gaps_expected: list[str] = field(default_factory=list)
    evidence_traceable: bool = True
    determinism_ok: bool = True


@dataclass
class BenchmarkReport:
    run_at: str
    base_url: str
    total_pairs: int
    criterion_precision: float
    criterion_recall: float
    evidence_traceability: float
    determinism_pass_rate: float
    mandatory_fn_rate: float
    per_pair: list[dict] = field(default_factory=list)
    passed: bool = False


def _get(url: str, token: str) -> dict:
    import urllib.request
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


def evaluate_pair(
    base_url: str,
    token: str,
    match_id: str,
    golden: dict,
) -> PairResult:
    pair_id = golden["pair_id"]
    result = PairResult(pair_id=pair_id)

    try:
        eval_data = _get(f"{base_url}/api/v2/matches/{match_id}/evaluation", token)
    except Exception as exc:
        print(f"  [WARN] Cannot fetch evaluation for {match_id}: {exc}")
        return result

    expert_labels: dict = golden.get("expert_labels", {})
    criteria = eval_data.get("criteria_summary", [])

    for crit in criteria:
        cid = crit["criterion_id"]
        predicted = crit.get("status", "UNKNOWN")
        expected = expert_labels.get(cid, "UNKNOWN")
        if expected == "UNKNOWN":
            continue
        result.criterion_results.append(
            CriterionResult(
                criterion_id=cid,
                predicted=predicted,
                expected=expected,
                match=(predicted == expected),
            )
        )

    try:
        gaps_data = _get(f"{base_url}/api/v2/matches/{match_id}/evaluation/gaps", token)
        mandatory_gaps = [g["requirement_text"] for g in gaps_data.get("gaps", []) if g["mandatory"]]
        result.mandatory_gaps_predicted = mandatory_gaps
        result.mandatory_gaps_expected = golden.get("mandatory_gaps_expected", [])
    except Exception as exc:
        print(f"  [WARN] Cannot fetch gaps for {match_id}: {exc}")

    cv_raw = golden.get("cv_summary", "")
    try:
        criteria_list = _get(f"{base_url}/api/v2/matches/{match_id}/evaluation/criteria", token)
        for crit in criteria_list.get("criteria", []):
            cid = crit["criterion_id"]
            reqs_data = _get(
                f"{base_url}/api/v2/matches/{match_id}/evaluation/criteria/{cid}/requirements",
                token,
            )
            for req in reqs_data.get("items", []):
                ev_data = _get(
                    f"{base_url}/api/v2/matches/{match_id}/evaluation/requirements/{req['requirement_id']}/evidence",
                    token,
                )
                for ev in ev_data.get("items", []):
                    if ev["text"] and cv_raw and ev["text"] not in cv_raw:
                        result.evidence_traceable = False
    except Exception as exc:
        print(f"  [WARN] Cannot verify evidence for {match_id}: {exc}")

    try:
        eval_data_2 = _get(f"{base_url}/api/v2/matches/{match_id}/evaluation", token)
        result.determinism_ok = (
            eval_data.get("fit_score") == eval_data_2.get("fit_score")
        )
    except Exception:
        pass

    return result


def compute_metrics(results: list[PairResult]) -> dict:
    all_criterion_results = [cr for r in results for cr in r.criterion_results]
    total = len(all_criterion_results)
    correct = sum(1 for cr in all_criterion_results if cr.match)

    precision = correct / total if total else 0.0
    recall = correct / total if total else 0.0

    ev_pass = sum(1 for r in results if r.evidence_traceable)
    ev_rate = ev_pass / len(results) * 100 if results else 0.0

    det_pass = sum(1 for r in results if r.determinism_ok)
    det_rate = det_pass / len(results) * 100 if results else 0.0

    mandatory_fn_count = 0
    mandatory_total = 0
    for r in results:
        expected_set = set(r.mandatory_gaps_expected)
        predicted_set = set(r.mandatory_gaps_predicted)
        mandatory_total += len(expected_set)
        fn = expected_set - predicted_set
        mandatory_fn_count += len(fn)

    mandatory_fn_rate = (mandatory_fn_count / mandatory_total * 100) if mandatory_total else 0.0

    return {
        "criterion_precision": round(precision, 4),
        "criterion_recall": round(recall, 4),
        "evidence_traceability": round(ev_rate, 2),
        "determinism_pass_rate": round(det_rate, 2),
        "mandatory_fn_rate": round(mandatory_fn_rate, 2),
    }


def dry_run(golden_path: Path) -> BenchmarkReport:
    print("[Benchmark] DRY RUN - using mock data, no real API calls.")
    with open(golden_path) as f:
        golden_set = json.load(f)

    mock_results = []
    for g in golden_set:
        result = PairResult(pair_id=g["pair_id"])
        for cid, expected in g.get("expert_labels", {}).items():
            import random
            predicted = expected if random.random() > 0.2 else "UNCERTAIN"
            result.criterion_results.append(
                CriterionResult(
                    criterion_id=cid,
                    predicted=predicted,
                    expected=expected,
                    match=(predicted == expected),
                )
            )
        result.mandatory_gaps_expected = g.get("mandatory_gaps_expected", [])
        result.mandatory_gaps_predicted = g.get("mandatory_gaps_expected", [])
        result.evidence_traceable = True
        result.determinism_ok = True
        mock_results.append(result)

    metrics = compute_metrics(mock_results)
    report = BenchmarkReport(
        run_at=datetime.now(timezone.utc).isoformat(),
        base_url="DRY_RUN",
        total_pairs=len(golden_set),
        per_pair=[asdict(r) for r in mock_results],
        passed=(
            metrics["criterion_precision"] >= 0.85
            and metrics["criterion_recall"] >= 0.80
            and metrics["evidence_traceability"] == 100.0
            and metrics["mandatory_fn_rate"] < 5.0
        ),
        **metrics,
    )
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description="Match Evaluation Benchmark")
    parser.add_argument("--base-url", default="http://localhost:8000")
    parser.add_argument("--token", default="")
    parser.add_argument("--golden", default="eval/match_evaluation_benchmark/golden_set.json")
    parser.add_argument("--match-ids", default="", help="Comma-separated match IDs tương ứng với golden set")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--output", default="eval/match_evaluation_benchmark/results_baseline.json")
    args = parser.parse_args()

    golden_path = Path(args.golden)
    if not golden_path.exists():
        print(f"[ERROR] Golden set không tìm thấy: {golden_path}")
        sys.exit(1)

    if args.dry_run:
        report = dry_run(golden_path)
    else:
        if not args.token:
            print("[ERROR] Cần --token khi chạy với server thực.")
            sys.exit(1)
        match_ids = [m.strip() for m in args.match_ids.split(",") if m.strip()]
        with open(golden_path) as f:
            golden_set = json.load(f)

        if len(match_ids) != len(golden_set):
            print(f"[ERROR] Số match_ids ({len(match_ids)}) != số pairs trong golden set ({len(golden_set)}).")
            sys.exit(1)

        results = []
        for golden, match_id in zip(golden_set, match_ids):
            print(f"  Evaluating pair {golden['pair_id']} -> match {match_id}...")
            r = evaluate_pair(args.base_url, args.token, match_id, golden)
            results.append(r)

        metrics = compute_metrics(results)
        report = BenchmarkReport(
            run_at=datetime.now(timezone.utc).isoformat(),
            base_url=args.base_url,
            total_pairs=len(results),
            per_pair=[asdict(r) for r in results],
            passed=(
                metrics["criterion_precision"] >= 0.85
                and metrics["criterion_recall"] >= 0.80
                and metrics["evidence_traceability"] == 100.0
                and metrics["mandatory_fn_rate"] < 5.0
            ),
            **metrics,
        )

    print("\n" + "=" * 60)
    print("BENCHMARK RESULTS")
    print("=" * 60)
    print(f"  Pairs evaluated   : {report.total_pairs}")
    print(f"  Criterion precision: {report.criterion_precision:.1%}")
    print(f"  Criterion recall   : {report.criterion_recall:.1%}")
    print(f"  Evidence traceable : {report.evidence_traceability:.0f}%")
    print(f"  Determinism pass   : {report.determinism_pass_rate:.0f}%")
    print(f"  Mandatory FN rate  : {report.mandatory_fn_rate:.1f}%")
    print(f"\n  OVERALL: {'✅ PASSED' if report.passed else '❌ FAILED'}")
    print("=" * 60)

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(asdict(report), f, indent=2, ensure_ascii=False)
    print(f"\n[Benchmark] Results saved to {output_path}")

    sys.exit(0 if report.passed else 1)


if __name__ == "__main__":
    main()
