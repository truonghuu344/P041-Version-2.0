"""CLI entrypoint for running Audited V1 CV-JD Matching Benchmark Evaluation."""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT / "backend") not in sys.path:
    sys.path.insert(0, str(ROOT / "backend"))
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="backslashreplace")
        sys.stderr.reconfigure(encoding="utf-8", errors="backslashreplace")
    except Exception:
        pass

from eval.v1_eval import (
    V1BenchmarkRunner,
    create_golden_sample_benchmark,
    create_real_benchmark_manifest,
    export_gold_benchmark,
    generate_real_v1_benchmark,
    generate_unlabeled_benchmark_template,
    get_annotation_status,
    load_benchmark_cases,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("eval_runner")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Audited V1 Evaluation Framework for CV-JD Matching Engine",
    )
    parser.add_argument(
        "--dataset",
        type=str,
        default=None,
        help="Path to benchmark JSON file (e.g. eval/v1_golden_sample.json, eval/datasets/real_benchmark_v1_gold.json)",
    )
    parser.add_argument(
        "--build-real-benchmark",
        action="store_true",
        help="Build canonical source datasets, select 80 real CV-JD pairs, and create annotation workspace from existing real data",
    )
    parser.add_argument(
        "--annotation-status",
        action="store_true",
        help="Display human annotation and review progress status for a dataset",
    )
    parser.add_argument(
        "--export-gold",
        action="store_true",
        help="Export reviewed and adjudicated cases from annotation workspace into gold dataset",
    )
    parser.add_argument(
        "--gold-output",
        type=str,
        default="eval/datasets/real_benchmark_v1_gold.json",
        help="Output path for exported gold benchmark dataset",
    )
    parser.add_argument(
        "--generate-template",
        action="store_true",
        help="Generate the 51-case synthetic template (eval/benchmark_template_50_pairs.json)",
    )
    parser.add_argument(
        "--generate-real-manifest",
        action="store_true",
        help="Generate the empty REAL benchmark manifest (eval/real_benchmark_manifest.json)",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default="eval/results",
        help="Directory to save JSON and Markdown reports",
    )
    parser.add_argument(
        "--use-gemini",
        action="store_true",
        help="Use real Gemini embeddings instead of deterministic hashing",
    )

    args = parser.parse_args()

    # 1. Build Real Benchmark Workspace
    if args.build_real_benchmark:
        print("🔨 Building REAL V1 CV-JD Benchmark Datasets from existing project data...")
        summary = generate_real_v1_benchmark()

        cv_st = summary["cv_stats"]
        jd_st = summary["jd_stats"]

        print("\n" + "=" * 78)
        print("📊 REAL V1 BENCHMARK DATASET SUMMARY")
        print("=" * 78)
        print(f"• Real CVs Loaded / Valid:     {cv_st['total_loaded']} / {cv_st['valid_count']} (Excluded: {cv_st['excluded_count']})")
        print(f"• CV Categories:               {cv_st['categories']}")
        print(f"• CV Language Distribution:    {cv_st['languages']}")
        print(f"• Real JDs Loaded / Valid:     {jd_st['total_loaded']} / {jd_st['valid_count']} (Excluded: {jd_st['excluded_count']})")
        print(f"• JD Domain Categories:        {jd_st['domains']}")
        print(f"• JD Language Distribution:    {jd_st['languages']}")
        print(f"\n🎯 Selected Benchmark Pairs:   {summary['selected_pair_count']}")
        print(f"• Strata Distribution:         {summary['strata_distribution']}")
        print(f"• JD Domain Distribution:      {summary['domain_distribution']}")
        print(f"• CV Category Distribution:    {summary['cv_category_distribution']}")
        print(f"• Potential Test Leakage:      {summary['leakage_count']} cases flagged")
        print("\n📂 Files Created:")
        for f in summary["files_created"]:
            print(f"   {f}")
        print("=" * 78)
        return

    # 2. Annotation Status
    if args.annotation_status:
        target_dataset = args.dataset or str(ROOT / "eval" / "datasets" / "real_benchmark_v1_annotation.json")
        status = get_annotation_status(target_dataset)

        print("\n" + "=" * 78)
        print("📝 HUMAN ANNOTATION & REVIEW STATUS")
        print("=" * 78)
        print(f"• Target Workspace:            {status['dataset_path']}")
        print(f"• Total Selected Pairs:        {status['selected_pairs']}")
        print(f"• Total Requirements:          {status['requirements_total']}")
        print(f"• Requirements Reviewed:       {status['requirements_reviewed']} ({status['requirements_completion_pct']}%)")
        print(f"• Requirements Pending:        {status['requirements_pending']}")
        print(f"• Boolean Groups Total:        {status['boolean_groups_total']} (Reviewed: {status['boolean_groups_reviewed']} / Pending: {status['boolean_groups_pending']})")
        print(f"• Cases Fully Annotated:       {status['cases_fully_annotated']} / {status['selected_pairs']}")
        print(f"• Cases Adjudicated:           {status['cases_adjudicated']}")
        print(f"• Cases Ready for Gold Eval:   {status['cases_ready_for_gold']}")
        print("=" * 78)
        return

    # 3. Export Gold Dataset
    if args.export_gold:
        target_dataset = args.dataset or str(ROOT / "eval" / "datasets" / "real_benchmark_v1_annotation.json")
        out_gold = Path(args.gold_output)
        if not out_gold.is_absolute():
            out_gold = ROOT / out_gold

        print(f"📦 Exporting reviewed & adjudicated gold cases from {target_dataset} to {out_gold}...")
        gold_cases = export_gold_benchmark(target_dataset, out_gold)
        print(f"✅ Successfully exported {len(gold_cases)} gold benchmark cases ready for quality measurement.")
        return

    # 4. Handle synthetic template generation
    if args.generate_template:
        template_out = ROOT / "eval" / "benchmark_template_50_pairs.json"
        cases = generate_unlabeled_benchmark_template(output_path=template_out)
        print(f"✅ Generated SYNTHETIC benchmark template with {len(cases)} CV-JD pairs at:")
        print(f"   {template_out}")
        print("   (Tagged as data_origin: SYNTHETIC; all human labels are null ready for manual ground truth labeling)")
        return

    # 5. Handle REAL manifest generation
    if args.generate_real_manifest:
        real_manifest_out = ROOT / "eval" / "real_benchmark_manifest.json"
        cases = create_real_benchmark_manifest(output_path=real_manifest_out)
        print(f"✅ Generated REAL benchmark manifest with {len(cases)} target domain cases at:")
        print(f"   {real_manifest_out}")
        print("   (Tagged as data_origin: REAL; all human labels are null ready for human expert annotation)")
        return

    # 6. Evaluation Execution
    dataset_path = args.dataset
    if not dataset_path:
        sample_path = ROOT / "eval" / "v1_golden_sample.json"
        create_golden_sample_benchmark(sample_path)
        dataset_path = str(sample_path)

    p = Path(dataset_path)
    if not p.is_absolute():
        p = ROOT / p

    if not p.exists():
        logger.error("Dataset path %s does not exist.", p)
        sys.exit(1)

    print(f"🔍 Loading benchmark cases from: {p}")
    cases = load_benchmark_cases(p)
    real_count = sum(1 for c in cases if c.data_origin == "REAL")
    synth_count = sum(1 for c in cases if c.data_origin == "SYNTHETIC")
    print(f"📊 Loaded {len(cases)} cases ({real_count} REAL, {synth_count} SYNTHETIC).")

    out_dir = Path(args.output_dir)
    if not out_dir.is_absolute():
        out_dir = ROOT / out_dir
    out_dir.mkdir(parents=True, exist_ok=True)

    runner = V1BenchmarkRunner(use_deterministic_embedding=not args.use_gemini)
    print("🚀 Executing matching pipeline and evaluating against ground truth...")
    report = runner.evaluate_dataset(cases, output_dir=out_dir)

    print("\n" + "=" * 78)
    print("🎉 AUDITED BENCHMARK EVALUATION COMPLETE")
    print("=" * 78)
    overall = report["overall_metrics"]
    by_orig = report["by_origin"]
    fa = report["failure_analysis"]

    ret_layers = overall.get("retrieval_layers", {})
    hybrid_ret = ret_layers.get("hybrid", {})
    rel_clf = overall.get("evidence_relation", {})
    rel_diag = overall.get("evidence_relation_diagnostics", {})
    out_clf = overall.get("requirement_outcome", {})
    crit = overall.get("critical_gap", {})
    bg = overall.get("boolean_groups", {})
    corr = overall.get("rating_correlation", {})

    print(f"• Total Cases Evaluated:       {len(cases)} ({real_count} REAL / {synth_count} SYNTHETIC)")
    print(f"• RRF Retrieval Recall@1/@3/@5:{hybrid_ret.get('recall_at_1', 0):.4f} / {hybrid_ret.get('recall_at_3', 0):.4f} / {hybrid_ret.get('recall_at_5', 0):.4f}")
    print(f"• RRF Retrieval MRR / nDCG@5:  {hybrid_ret.get('mrr', 0):.4f} / {hybrid_ret.get('ndcg_at_5', 0):.4f}")
    print(f"• Evidence Relation Macro F1:  {rel_clf.get('f1_macro', 0):.4f} (Weighted: {rel_clf.get('f1_weighted', 0):.4f})")
    print(f"• NO_EVIDENCE FP / FN Rate:    {rel_diag.get('no_evidence_false_positive_rate', 0) * 100:.2f}% / {rel_diag.get('evidence_false_negative_rate', 0) * 100:.2f}%")
    print(f"• INFERRED F1 / ADJACENT F1:   {rel_diag.get('inferred_f1', 0):.4f} / {rel_diag.get('adjacent_f1', 0):.4f}")
    print(f"• Requirement Outcome Macro F1:{out_clf.get('f1_macro', 0):.4f} (Accuracy: {out_clf.get('accuracy', 0) * 100:.2f}%)")
    print(f"• Critical Gap Precision/Rec/F1:{crit.get('critical_gap_precision', 0):.4f} / {crit.get('critical_gap_recall', 0):.4f} / {crit.get('critical_gap_f1', 0):.4f}")
    print(f"• Boolean Group Accuracy:      {bg.get('boolean_group_accuracy', 0) * 100:.2f}% (ANY_OF: {bg.get('any_of_accuracy', 0) * 100:.2f}%)")
    print(f"• Score Spearman Rho / MAE:    {corr.get('spearman_rho', 0):.4f} / {corr.get('mae', 0):.2f} pts (on 0..100 canonical scale)")
    print(f"• Total Prediction Mismatches: {fa.get('total_mismatches', 0)} ({fa.get('mismatch_rate', 0) * 100:.1f}%)")
    print("\n📂 Reports Generated:")
    print(f"   JSON:     {out_dir / 'v1_eval_report.json'}")
    print(f"   Markdown: {out_dir / 'v1_eval_report.md'}")
    print("=" * 78)


if __name__ == "__main__":
    main()
