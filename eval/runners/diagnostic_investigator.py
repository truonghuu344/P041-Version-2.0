"""Comprehensive diagnostic and audit tool for CV-JD Benchmark.

Investigates:
1. Production parity audit (Embeddings, BM25, Vector, RRF, Chunking)
2. Requirement extraction quality (Precision, Recall, Group, Type, Exp, HC)
3. Layer A Retrieval Metrics (Recall@K, MRR, NDCG against chunk annotations)
4. Layer B Requirement Matching Metrics (Precision, Recall, F1, Confusion Matrix)
5. Candidate divergence tracing (Structured vs Raw mode)
6. Bottleneck attribution analysis
"""

from __future__ import annotations

import json
import math
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from eval.datasets.loader import load_benchmark_dataset
from eval.runners.metrics import (
    calculate_classification_metrics,
    calculate_dcg,
    calculate_mae,
    calculate_ndcg,
    calculate_pairwise_inversions,
    calculate_pearson_r,
    calculate_spearman_rho,
)
from src.config import get_settings
from src.services.cv_jd_matching import (
    _fold,
    parse_job_description,
)
from src.services.cv_jd_pipeline import (
    ChunkingService,
    EmbeddingService,
    HybridFusionService,
    PipelineConfig,
    RetrievalService,
    run_cv_jd_pipeline,
)


from eval.runners.extraction_evaluator import evaluate_dataset_extraction


def run_retrieval_and_layer_b_audit(dataset, annotations_path: Path) -> dict[str, Any]:
    """Audit Layer A Retrieval and Layer B Matching against annotated ground truth."""
    annotations = {}
    if annotations_path.is_file():
        raw_ann = json.loads(annotations_path.read_text(encoding="utf-8"))
        annotations = raw_ann.get("requirement_level_truth", {})

    settings = get_settings()
    config = PipelineConfig(
        bm25_top_k=settings.cv_jd_bm25_top_k,
        semantic_top_k=settings.cv_jd_semantic_top_k,
        semantic_min_score=settings.cv_jd_semantic_min_score,
        rrf_k=settings.cv_jd_rrf_k,
        hybrid_top_k=settings.cv_jd_hybrid_top_k,
    )

    y_true = []
    y_pred = []
    mismatches = []
    recalls_at_5 = []
    recalls_at_10 = []
    precisions_at_5 = []
    mrrs = []
    retrieval_failures = []

    for job in dataset.jobs:
        job_annot = annotations.get(job.job_id, {})
        for cand in job.candidates:
            cand_annot = job_annot.get(cand.cv_id, {})
            if not cand_annot:
                continue

            res = run_cv_jd_pipeline(
                cv_text=cand.cv_text,
                parsed_cv=cand.cv_parsed,
                job_id=job.job_id,
                requirements=job.requirements,
                config=config,
            )
            eval_map = {r["requirement_id"]: r for r in res.get("evaluated_requirements", [])}

            _, _, chunks = ChunkingService.build(cand.cv_text, cand.cv_parsed)
            retriever = RetrievalService(chunks, config)

            for req in job.requirements:
                req_id = req.get("requirement_id")
                if req_id not in cand_annot:
                    continue

                item_annot = cand_annot[req_id]
                expected_st = item_annot.get("expected_status")
                if expected_st:
                    pred_item = eval_map.get(req_id, {})
                    pred_st = pred_item.get("status", "NOT_FOUND")
                    y_true.append(expected_st)
                    y_pred.append(pred_st)
                    if expected_st != pred_st:
                        mismatches.append({
                            "job_id": job.job_id,
                            "cv_id": cand.cv_id,
                            "req_id": req_id,
                            "req_text": req.get("text"),
                            "expected_status": expected_st,
                            "predicted_status": pred_st,
                            "score": pred_item.get("criterion_score", 0.0),
                        })

                # Retrieval evaluation
                relevant_chunks = item_annot.get("relevant_chunks", [])
                if relevant_chunks:
                    rel_set = set(relevant_chunks)
                    retrieved = retriever.retrieve(req)
                    ret_ids = [c["chunk_id"] for c in retrieved]

                    top_5 = set(ret_ids[:5])
                    top_10 = set(ret_ids[:10])

                    r5 = len(rel_set.intersection(top_5)) / len(rel_set)
                    r10 = len(rel_set.intersection(top_10)) / len(rel_set)
                    p5 = len(rel_set.intersection(top_5)) / 5.0

                    recalls_at_5.append(r5)
                    recalls_at_10.append(r10)
                    precisions_at_5.append(p5)

                    rank = next((idx for idx, cid in enumerate(ret_ids, 1) if cid in rel_set), 0)
                    mrrs.append(1.0 / rank if rank > 0 else 0.0)

                    if r5 == 0:
                        retrieval_failures.append({
                            "job_id": job.job_id,
                            "cv_id": cand.cv_id,
                            "req_id": req_id,
                            "requirement": req.get("text"),
                            "expected_chunks": list(rel_set),
                            "retrieved_chunks": ret_ids[:3],
                            "rank": rank,
                        })

    class_metrics = calculate_classification_metrics(y_true, y_pred) if y_true else {}
    return {
        "retrieval": {
            "total_annotated": len(recalls_at_5),
            "recall_at_5": round(sum(recalls_at_5) / max(1, len(recalls_at_5)), 4),
            "recall_at_10": round(sum(recalls_at_10) / max(1, len(recalls_at_10)), 4),
            "precision_at_5": round(sum(precisions_at_5) / max(1, len(precisions_at_5)), 4),
            "mrr": round(sum(mrrs) / max(1, len(mrrs)), 4),
            "retrieval_failures": retrieval_failures,
        },
        "matching": {
            "metrics": class_metrics,
            "mismatches": mismatches,
        },
    }


def trace_candidate_divergence(dataset) -> list[dict[str, Any]]:
    """Trace candidates with differences between Structured vs Raw parsed JD."""
    settings = get_settings()
    config = PipelineConfig()
    divergences = []

    for job in dataset.jobs:
        parsed_jd = parse_job_description(title=job.title, requirements_text=job.raw_jd_text)
        raw_reqs = parsed_jd.get("requirements", [])

        for cand in job.candidates:
            res_struct = run_cv_jd_pipeline(
                cv_text=cand.cv_text,
                parsed_cv=cand.cv_parsed,
                job_id=job.job_id,
                requirements=job.requirements,
                config=config,
            )
            res_raw = run_cv_jd_pipeline(
                cv_text=cand.cv_text,
                parsed_cv=cand.cv_parsed,
                job_id=job.job_id,
                requirements=raw_reqs,
                config=config,
            )

            score_struct = float(res_struct.get("final_score", 0.0))
            score_raw = float(res_raw.get("final_score", 0.0))
            delta = abs(score_struct - score_raw)

            if delta >= 8.0:
                divergences.append({
                    "job_id": job.job_id,
                    "cv_id": cand.cv_id,
                    "human_relevance": cand.human_relevance,
                    "score_structured": score_struct,
                    "score_raw": score_raw,
                    "delta": round(delta, 1),
                    "struct_req_count": len(job.requirements),
                    "raw_req_count": len(raw_reqs),
                })

    divergences.sort(key=lambda d: -d["delta"])
    return divergences


if __name__ == "__main__":
    dataset_file = ROOT / "eval" / "datasets" / "benchmark_dataset_v1.json"
    annot_file = ROOT / "eval" / "annotations" / "chunk_annotations.json"
    dataset = load_benchmark_dataset(dataset_file)

    print("================================================================================")
    print("[DIAGNOSTIC AUDIT] CV-JD Benchmark Comprehensive Investigation")
    print("================================================================================")

    # 1. Extraction Audit (One-to-One Bipartite Alignment)
    ext_report = evaluate_dataset_extraction(dataset)
    ext_s = ext_report["summary"]
    print("\n1. REQUIREMENT EXTRACTION AUDIT (One-to-One Hungarian Alignment):")
    print(f"  * Ground Truth Expected:  {ext_s['total_expected_requirements']}")
    print(f"  * Extracted Total:        {ext_s['total_extracted_requirements']}")
    print(f"  * True Positives (TP):    {ext_s['true_positives']}")
    print(f"  * False Positives (FP):   {ext_s['false_positives']}")
    print(f"  * False Negatives (FN):   {ext_s['false_negatives']}")
    print(f"  * Duplicate Extractions:  {ext_s['duplicate_extractions']} (across {ext_s['affected_duplicate_jobs_count']} JDs)")
    print(f"  * Precision:              {ext_s['precision'] * 100:.2f}%")
    print(f"  * Recall:                 {ext_s['recall'] * 100:.2f}% (Strictly <= 100%)")
    print(f"  * F1-Score:               {ext_s['f1']:.4f}")
    print(f"  * Group Accuracy:         {ext_s['group_accuracy'] * 100:.2f}%")
    print(f"  * Type Accuracy:          {ext_s['type_accuracy'] * 100:.2f}%")
    print(f"  * Experience Acc:         {ext_s['experience_accuracy'] * 100:.2f}%")

    # 2 & 3. Layer A Retrieval & Layer B Matching Audit
    layer_audit = run_retrieval_and_layer_b_audit(dataset, annot_file)
    ret_res = layer_audit["retrieval"]
    print("\n2. LAYER A RETRIEVAL AUDIT (against Annotated Ground Truth):")
    print(f"  * Total Annotated Req-Pairs: {ret_res['total_annotated']}")
    print(f"  * Recall@5:                  {ret_res['recall_at_5'] * 100:.1f}%")
    print(f"  * Recall@10:                 {ret_res['recall_at_10'] * 100:.1f}%")
    print(f"  * Precision@5:               {ret_res['precision_at_5'] * 100:.1f}%")
    print(f"  * MRR:                       {ret_res['mrr']:.4f}")

    match_res = layer_audit["matching"]
    print("\n3. LAYER B MATCHING AUDIT:")
    if "metrics" in match_res and match_res["metrics"]:
        m = match_res["metrics"]
        print(f"  * Accuracy: {m['accuracy'] * 100:.1f}% | Macro-F1: {m['macro_f1']:.4f}")
        for cls, d in m["per_class"].items():
            print(f"    - {cls:<12}: P={d['precision']:.2f}, R={d['recall']:.2f}, F1={d['f1']:.2f} (Support: {d['support']})")
        print(f"  * Confusion Matrix:")
        for row_cls, cols in m["confusion_matrix"].items():
            print(f"    {row_cls:<12} -> {cols}")

    # 4. Divergences
    divs = trace_candidate_divergence(dataset)
    print(f"\n4. STRUCTURED VS RAW DIVERGENCES (Found {len(divs)} cases with delta >= 8 pts):")
    for d in divs[:5]:
        print(f"  * {d['job_id']} / {d['cv_id']} (Human: {d['human_relevance']}): Struct={d['score_structured']} -> Raw={d['score_raw']} (Delta: {d['delta']} pts)")
