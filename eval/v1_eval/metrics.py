"""Metrics calculation module for audited CV-JD matching evaluation."""

from __future__ import annotations

import math
import unicodedata
import re
from collections import Counter, defaultdict
from typing import Any

from eval.v1_eval.schema import (
    EvidenceRelation,
    EvidenceSpan,
    RequirementOutcome,
)

EVIDENCE_RELATION_ORDER = [
    EvidenceRelation.DIRECT.value,
    EvidenceRelation.EQUIVALENT.value,
    EvidenceRelation.INFERRED.value,
    EvidenceRelation.ADJACENT.value,
    EvidenceRelation.WEAK_EVIDENCE.value,
    EvidenceRelation.NO_EVIDENCE.value,
]

REQUIREMENT_OUTCOME_ORDER = [
    RequirementOutcome.SATISFIED.value,
    RequirementOutcome.PARTIAL.value,
    RequirementOutcome.UNSATISFIED.value,
    RequirementOutcome.UNKNOWN.value,
]


def _fold(value: Any) -> str:
    text = str(value or "").casefold().replace("đ", "d").replace("Đ", "d")
    text = unicodedata.normalize("NFD", text)
    text = "".join(char for char in text if unicodedata.category(char) != "Mn")
    return re.sub(r"\s+", " ", text).strip()


def map_evidence_spans_to_chunks(
    expected_evidence: list[EvidenceSpan | dict[str, Any]],
    chunks: list[dict[str, Any]],
) -> set[str]:
    """Map human evidence spans (quotes/sections) directly to CV chunk IDs dynamically at runtime.

    This ensures benchmark ground truth remains immutable and valid even if chunking logic evolves.
    """
    matched_chunk_ids: set[str] = set()
    if not expected_evidence or not chunks:
        return matched_chunk_ids

    for span in expected_evidence:
        if isinstance(span, dict):
            quote = str(span.get("quote", "")).strip()
            parent = str(span.get("parent_title", "")).strip()
        else:
            quote = str(span.quote or "").strip()
            parent = str(span.parent_title or "").strip()

        if not quote:
            continue

        folded_quote = _fold(quote)
        quote_tokens = set(re.findall(r"\w{2,}", folded_quote))

        for chunk in chunks:
            chunk_id = chunk.get("chunk_id")
            if not chunk_id:
                continue

            chunk_text = str(chunk.get("text", ""))
            folded_chunk = _fold(chunk_text)
            chunk_parent = str(chunk.get("parent_title", ""))

            # 1. Substring containment
            if folded_quote in folded_chunk or folded_chunk in folded_quote:
                matched_chunk_ids.add(chunk_id)
                continue

            # 2. Token overlap for longer phrases (> 50% Jaccard)
            if quote_tokens:
                c_tokens = set(re.findall(r"\w{2,}", folded_chunk))
                if c_tokens:
                    overlap = len(quote_tokens.intersection(c_tokens)) / len(quote_tokens)
                    if overlap >= 0.60:
                        matched_chunk_ids.add(chunk_id)
                        continue

            # 3. Parent title match if quote is partial
            if parent and _fold(parent) in _fold(chunk_parent) and len(folded_quote) > 10:
                if any(t in folded_chunk for t in quote_tokens if len(t) >= 4):
                    matched_chunk_ids.add(chunk_id)

    return matched_chunk_ids


def calculate_retrieval_metrics(
    queries: list[dict[str, Any]],
) -> dict[str, float | int]:
    """Calculate retrieval metrics (Recall@1, 3, 5, MRR, nDCG@5) for a list of queries.

    Each query dict must contain:
    - "expected_chunk_ids": set[str] or list[str]
    - "retrieved_chunk_ids": list[str]
    """
    valid_queries = [q for q in queries if q.get("expected_chunk_ids")]
    if not valid_queries:
        return {
            "recall_at_1": 0.0,
            "recall_at_3": 0.0,
            "recall_at_5": 0.0,
            "mrr": 0.0,
            "ndcg_at_5": 0.0,
            "evaluated_queries": 0,
        }

    recalls_1: list[float] = []
    recalls_3: list[float] = []
    recalls_5: list[float] = []
    mrrs: list[float] = []
    ndcgs_5: list[float] = []

    for q in valid_queries:
        expected = set(q["expected_chunk_ids"])
        retrieved = list(q.get("retrieved_chunk_ids", []))

        # Recall@K
        r1 = set(retrieved[:1])
        r3 = set(retrieved[:3])
        r5 = set(retrieved[:5])

        recalls_1.append(len(expected.intersection(r1)) / len(expected))
        recalls_3.append(len(expected.intersection(r3)) / len(expected))
        recalls_5.append(len(expected.intersection(r5)) / len(expected))

        # MRR
        rr = 0.0
        for rank, chunk_id in enumerate(retrieved, start=1):
            if chunk_id in expected:
                rr = 1.0 / rank
                break
        mrrs.append(rr)

        # nDCG@5
        dcg = 0.0
        for rank, chunk_id in enumerate(retrieved[:5], start=1):
            rel = 1.0 if chunk_id in expected else 0.0
            if rel > 0:
                dcg += rel / math.log2(rank + 1)

        idcg = sum(1.0 / math.log2(r + 1) for r in range(1, min(5, len(expected)) + 1))
        ndcgs_5.append((dcg / idcg) if idcg > 0 else 0.0)

    return {
        "recall_at_1": round(sum(recalls_1) / len(recalls_1), 4),
        "recall_at_3": round(sum(recalls_3) / len(recalls_3), 4),
        "recall_at_5": round(sum(recalls_5) / len(recalls_5), 4),
        "mrr": round(sum(mrrs) / len(mrrs), 4),
        "ndcg_at_5": round(sum(ndcgs_5) / len(ndcgs_5), 4),
        "evaluated_queries": len(valid_queries),
    }


def calculate_layered_retrieval_metrics(
    layer_queries: dict[str, list[dict[str, Any]]],
) -> dict[str, dict[str, float | int]]:
    """Compute retrieval metrics separately across retrieval layers (BM25, Vector, RRF, Final)."""
    results: dict[str, dict[str, float | int]] = {}
    for layer_name, q_list in layer_queries.items():
        results[layer_name] = calculate_retrieval_metrics(q_list)
    return results


def calculate_classification_metrics(
    y_true: list[str],
    y_pred: list[str],
    labels: list[str] | None = None,
) -> dict[str, Any]:
    """Calculate multi-class Precision, Recall, F1, Confusion Matrix for any taxonomy."""
    labels = labels or EVIDENCE_RELATION_ORDER
    if len(y_true) != len(y_pred):
        raise ValueError("y_true and y_pred must have identical length.")

    if not y_true:
        return {
            "precision_macro": 0.0,
            "recall_macro": 0.0,
            "f1_macro": 0.0,
            "f1_weighted": 0.0,
            "accuracy": 0.0,
            "total_samples": 0,
            "per_class": {},
            "confusion_matrix": {lbl: {l2: 0 for l2 in labels} for lbl in labels},
        }

    cm: dict[str, dict[str, int]] = {lbl: {l2: 0 for l2 in labels} for lbl in labels}
    for t, p in zip(y_true, y_pred, strict=True):
        if t in cm and p in cm[t]:
            cm[t][p] += 1
        elif t in cm:
            cm[t][labels[-1]] += 1

    per_class: dict[str, dict[str, float | int]] = {}
    macro_precisions: list[float] = []
    macro_recalls: list[float] = []
    macro_f1s: list[float] = []
    weighted_f1_sum = 0.0
    total_support = 0

    for lbl in labels:
        tp = cm[lbl][lbl]
        fn = sum(cm[lbl][col] for col in labels if col != lbl)
        fp = sum(cm[row][lbl] for row in labels if row != lbl)
        support = tp + fn

        prec = (tp / (tp + fp)) if (tp + fp) > 0 else 0.0
        rec = (tp / (tp + fn)) if (tp + fn) > 0 else 0.0
        f1 = (2 * prec * rec / (prec + rec)) if (prec + rec) > 0 else 0.0

        per_class[lbl] = {
            "precision": round(prec, 4),
            "recall": round(rec, 4),
            "f1": round(f1, 4),
            "support": support,
            "true_positive": tp,
            "false_positive": fp,
            "false_negative": fn,
        }

        if support > 0:
            macro_precisions.append(prec)
            macro_recalls.append(rec)
            macro_f1s.append(f1)
            weighted_f1_sum += f1 * support
            total_support += support

    accuracy = sum(cm[lbl][lbl] for lbl in labels) / len(y_true)
    macro_prec = sum(macro_precisions) / len(macro_precisions) if macro_precisions else 0.0
    macro_rec = sum(macro_recalls) / len(macro_recalls) if macro_recalls else 0.0
    macro_f1 = sum(macro_f1s) / len(macro_f1s) if macro_f1s else 0.0
    weighted_f1 = (weighted_f1_sum / total_support) if total_support > 0 else 0.0

    return {
        "accuracy": round(accuracy, 4),
        "precision_macro": round(macro_prec, 4),
        "recall_macro": round(macro_rec, 4),
        "f1_macro": round(macro_f1, 4),
        "f1_weighted": round(weighted_f1, 4),
        "total_samples": len(y_true),
        "per_class": per_class,
        "confusion_matrix": cm,
    }


def calculate_evidence_relation_special_rates(
    items: list[dict[str, Any]],
    clf_metrics: dict[str, Any],
) -> dict[str, float | int]:
    """Calculate specific diagnostic rates for evidence relation:

    - NO_EVIDENCE false-positive rate
    - evidence false-negative rate
    - INFERRED F1
    - ADJACENT F1
    """
    evidence_labels = {
        EvidenceRelation.DIRECT.value,
        EvidenceRelation.EQUIVALENT.value,
        EvidenceRelation.INFERRED.value,
        EvidenceRelation.ADJACENT.value,
        EvidenceRelation.WEAK_EVIDENCE.value,
    }

    no_evidence_total = 0
    false_positives = 0
    evidence_total = 0
    false_negatives = 0

    for it in items:
        h_rel = it.get("human_evidence_relation") or it.get("human_label")
        e_rel = it.get("engine_evidence_relation") or it.get("engine_label")

        if h_rel == EvidenceRelation.NO_EVIDENCE.value:
            no_evidence_total += 1
            if e_rel in evidence_labels:
                false_positives += 1

        if h_rel in evidence_labels:
            evidence_total += 1
            if e_rel == EvidenceRelation.NO_EVIDENCE.value:
                false_negatives += 1

    fp_rate = (false_positives / no_evidence_total) if no_evidence_total > 0 else 0.0
    fn_rate = (false_negatives / evidence_total) if evidence_total > 0 else 0.0

    per_class = clf_metrics.get("per_class", {})
    inferred_f1 = per_class.get(EvidenceRelation.INFERRED.value, {}).get("f1", 0.0)
    adjacent_f1 = per_class.get(EvidenceRelation.ADJACENT.value, {}).get("f1", 0.0)

    return {
        "no_evidence_false_positive_rate": round(fp_rate, 4),
        "no_evidence_false_positives": false_positives,
        "no_evidence_total": no_evidence_total,
        "evidence_false_negative_rate": round(fn_rate, 4),
        "evidence_false_negatives": false_negatives,
        "evidence_total": evidence_total,
        "inferred_f1": round(inferred_f1, 4),
        "adjacent_f1": round(adjacent_f1, 4),
    }


def calculate_critical_gap_metrics(
    items: list[dict[str, Any]],
) -> dict[str, float | int]:
    """Calculate Precision, Recall, and F1 for Critical Gap detection (missing hard gates / mandatory requirements)."""
    tp = 0  # Ground truth is critical gap, engine identified as critical gap
    fp = 0  # Engine claimed critical gap, ground truth is not
    fn = 0  # Ground truth is critical gap, engine missed it
    tn = 0

    for it in items:
        # Determine if ground truth is a critical gap:
        # 1. Explicit flag human_is_critical_gap
        # 2. Or hard_gate/mandatory == True and human outcome is UNSATISFIED / NO_EVIDENCE
        h_crit = it.get("human_is_critical_gap")
        if h_crit is None:
            is_mand = it.get("mandatory", False) or it.get("hard_gate", False)
            h_out = it.get("human_requirement_outcome") or it.get("human_outcome")
            h_rel = it.get("human_evidence_relation") or it.get("human_label")
            h_crit = is_mand and (h_out == RequirementOutcome.UNSATISFIED.value or h_rel == EvidenceRelation.NO_EVIDENCE.value)

        # Engine critical gap:
        e_out = it.get("engine_requirement_outcome") or it.get("engine_outcome")
        e_rel = it.get("engine_evidence_relation") or it.get("engine_label")
        is_mand = it.get("mandatory", False) or it.get("hard_gate", False)
        e_crit = is_mand and (e_out == RequirementOutcome.UNSATISFIED.value or e_rel == EvidenceRelation.NO_EVIDENCE.value or it.get("is_blocker", False))

        if h_crit and e_crit:
            tp += 1
        elif not h_crit and e_crit:
            fp += 1
        elif h_crit and not e_crit:
            fn += 1
        else:
            tn += 1

    prec = (tp / (tp + fp)) if (tp + fp) > 0 else 0.0
    rec = (tp / (tp + fn)) if (tp + fn) > 0 else 0.0
    f1 = (2 * prec * rec / (prec + rec)) if (prec + rec) > 0 else 0.0

    return {
        "critical_gap_precision": round(prec, 4),
        "critical_gap_recall": round(rec, 4),
        "critical_gap_f1": round(f1, 4),
        "true_positives": tp,
        "false_positives": fp,
        "false_negatives": fn,
        "total_critical_gaps": tp + fn,
    }


def calculate_boolean_group_metrics(
    group_results: list[dict[str, Any]],
) -> dict[str, float | int]:
    """Calculate accuracy for Boolean Requirement Groups (ANY_OF, ALL_OF)."""
    if not group_results:
        return {
            "boolean_group_accuracy": 0.0,
            "any_of_accuracy": 0.0,
            "all_of_accuracy": 0.0,
            "total_groups": 0,
            "any_of_total": 0,
            "all_of_total": 0,
        }

    total = len(group_results)
    correct_total = 0

    any_of_total = 0
    any_of_correct = 0

    all_of_total = 0
    all_of_correct = 0

    for g in group_results:
        op = str(g.get("operator", "ANY_OF")).upper()
        h_st = str(g.get("human_group_status", "")).upper()
        e_st = str(g.get("engine_group_status", "")).upper()

        is_match = (h_st == e_st)
        if is_match:
            correct_total += 1

        if op == "ANY_OF":
            any_of_total += 1
            if is_match:
                any_of_correct += 1
        elif op == "ALL_OF":
            all_of_total += 1
            if is_match:
                all_of_correct += 1

    bg_acc = (correct_total / total) if total > 0 else 0.0
    any_acc = (any_of_correct / any_of_total) if any_of_total > 0 else 0.0
    all_acc = (all_of_correct / all_of_total) if all_of_total > 0 else 0.0

    return {
        "boolean_group_accuracy": round(bg_acc, 4),
        "any_of_accuracy": round(any_acc, 4),
        "all_of_accuracy": round(all_acc, 4),
        "total_groups": total,
        "any_of_total": any_of_total,
        "all_of_total": all_of_total,
    }


def calculate_annotator_agreement(
    requirements: list[Any],
) -> dict[str, Any]:
    """Calculate raw inter-annotator agreement and Cohen's Kappa for multi-annotator datasets."""
    pairs_relation: list[tuple[str, str]] = []
    pairs_outcome: list[tuple[str, str]] = []

    total_annotated_reqs = 0
    multi_annotated_reqs = 0

    for req in requirements:
        if hasattr(req, "annotations"):
            anns = req.annotations
        elif isinstance(req, dict):
            anns = req.get("annotations", [])
        else:
            anns = getattr(req, "annotations", [])

        if not anns:
            continue
        total_annotated_reqs += 1
        if len(anns) >= 2:
            multi_annotated_reqs += 1
            a1 = anns[0]
            a2 = anns[1]

            r1 = a1.evidence_relation if hasattr(a1, "evidence_relation") else a1.get("evidence_relation")
            r2 = a2.evidence_relation if hasattr(a2, "evidence_relation") else a2.get("evidence_relation")
            if r1 and r2:
                pairs_relation.append((r1, r2))

            o1 = a1.requirement_outcome if hasattr(a1, "requirement_outcome") else a1.get("requirement_outcome")
            o2 = a2.requirement_outcome if hasattr(a2, "requirement_outcome") else a2.get("requirement_outcome")
            if o1 and o2:
                pairs_outcome.append((o1, o2))

    def _cohen_kappa(pairs: list[tuple[str, str]], labels: list[str]) -> tuple[float, float]:
        if not pairs:
            return 0.0, 0.0
        n = len(pairs)
        agree_count = sum(1 for p in pairs if p[0] == p[1])
        po = agree_count / n

        # Expected agreement pe
        c1 = defaultdict(int)
        c2 = defaultdict(int)
        for p in pairs:
            c1[p[0]] += 1
            c2[p[1]] += 1

        pe = sum((c1[lbl] / n) * (c2[lbl] / n) for lbl in labels)
        kappa = (po - pe) / (1.0 - pe) if (1.0 - pe) > 0 else 1.0
        return round(po, 4), round(kappa, 4)

    rel_raw, rel_kappa = _cohen_kappa(pairs_relation, EVIDENCE_RELATION_ORDER)
    out_raw, out_kappa = _cohen_kappa(pairs_outcome, REQUIREMENT_OUTCOME_ORDER)

    return {
        "multi_annotated_requirements": multi_annotated_reqs,
        "total_annotated_requirements": total_annotated_reqs,
        "evidence_relation_raw_agreement": rel_raw,
        "evidence_relation_cohen_kappa": rel_kappa,
        "requirement_outcome_raw_agreement": out_raw,
        "requirement_outcome_cohen_kappa": out_kappa,
    }


def calculate_rating_correlation(
    pairs: list[tuple[float, float]],
) -> dict[str, float]:
    """Calculate correlation, MAE, and RMSE between engine score (0..100) and human canonical score (0..100)."""
    if len(pairs) < 2:
        return {
            "pearson_r": 0.0,
            "spearman_rho": 0.0,
            "mae": 0.0,
            "rmse": 0.0,
            "samples": len(pairs),
        }

    sys_scores = [p[0] for p in pairs]
    hum_scores = [p[1] for p in pairs]
    n = len(pairs)

    mean_sys = sum(sys_scores) / n
    mean_hum = sum(hum_scores) / n

    cov = sum((s - mean_sys) * (h - mean_hum) for s, h in zip(sys_scores, hum_scores, strict=True))
    var_sys = sum((s - mean_sys) ** 2 for s in sys_scores)
    var_hum = sum((h - mean_hum) ** 2 for h in hum_scores)

    pearson_r = (cov / (math.sqrt(var_sys) * math.sqrt(var_hum))) if var_sys > 0 and var_hum > 0 else 0.0

    def _rank(arr: list[float]) -> list[float]:
        sorted_indices = sorted(range(len(arr)), key=lambda i: arr[i])
        ranks = [0.0] * len(arr)
        i = 0
        while i < len(arr):
            j = i
            while j + 1 < len(arr) and arr[sorted_indices[j + 1]] == arr[sorted_indices[i]]:
                j += 1
            avg_rank = 1.0 + (i + j) / 2.0
            for k in range(i, j + 1):
                ranks[sorted_indices[k]] = avg_rank
            i = j + 1
        return ranks

    sys_ranks = _rank(sys_scores)
    hum_ranks = _rank(hum_scores)

    cov_r = sum((sr - (n + 1) / 2.0) * (hr - (n + 1) / 2.0) for sr, hr in zip(sys_ranks, hum_ranks, strict=True))
    var_sr = sum((sr - (n + 1) / 2.0) ** 2 for sr in sys_ranks)
    var_hr = sum((hr - (n + 1) / 2.0) ** 2 for hr in hum_ranks)
    spearman_rho = (cov_r / (math.sqrt(var_sr) * math.sqrt(var_hr))) if var_sr > 0 and var_hr > 0 else 0.0

    mae = sum(abs(s - h) for s, h in zip(sys_scores, hum_scores, strict=True)) / n
    rmse = math.sqrt(sum((s - h) ** 2 for s, h in zip(sys_scores, hum_scores, strict=True)) / n)

    return {
        "pearson_r": round(pearson_r, 4),
        "spearman_rho": round(spearman_rho, 4),
        "mae": round(mae, 2),
        "rmse": round(rmse, 2),
        "samples": n,
    }


def _canonical_tokens(name: str) -> set[str]:
    """Helper to tokenize and fold requirement concepts."""
    return set(re.findall(r"\w{2,}", _fold(name)))


def _semantic_req_similarity(p_name: str, p_sent: str, g_name: str, g_sent: str) -> float:
    """Calculate semantic similarity between a proposal and a gold requirement without relying on IDs."""
    fn_p = _fold(p_name)
    fn_g = _fold(g_name)
    if fn_p == fn_g and fn_p:
        return 1.0

    tok_p = _canonical_tokens(p_name)
    tok_g = _canonical_tokens(g_name)
    if tok_p and tok_g:
        jaccard = len(tok_p.intersection(tok_g)) / len(tok_p.union(tok_g))
        if jaccard >= 0.60:
            return 0.85 + 0.15 * jaccard

    # Check sentence containment
    fs_p = _fold(p_sent)
    fs_g = _fold(g_sent)
    if (fn_g in fs_p or fn_p in fs_g) and (fn_p in fn_g or fn_g in fn_p):
        return 0.80

    return 0.0


def align_proposals_to_gold(
    proposed_reqs: list[dict[str, Any]],
    gold_reqs: list[dict[str, Any]],
) -> dict[str, Any]:
    """Align production proposals to gold requirements based on semantic content and sentence overlap."""
    active_gold_reqs = [g for g in gold_reqs if g.get("review_action") != "REMOVE"]
    removed_gold_reqs = [g for g in gold_reqs if g.get("review_action") == "REMOVE"]

    prop_to_gold: dict[str, list[dict[str, Any]]] = defaultdict(list)
    gold_to_prop: dict[str, list[dict[str, Any]]] = defaultdict(list)

    # 1. First pass: Check provenance hint if available, else semantic matching
    for p in proposed_reqs:
        pid = str(p.get("requirement_id") or p.get("id") or "")
        p_name = str(p.get("canonical_name") or p.get("text") or "")
        p_sent = str(p.get("source_sentence") or p.get("text") or "")

        for g in active_gold_reqs:
            gid = str(g.get("gold_requirement_id") or "")
            g_name = str(g.get("canonical_name") or "")
            g_sent = str(g.get("source_sentence") or "")
            prov_ids = list(g.get("source_proposal_ids") or g.get("proposal_provenance", {}).get("proposal_ids", []))

            # Match criteria: provenance ID match OR semantic match
            is_match = False
            if pid and pid in prov_ids:
                is_match = True
            else:
                sim = _semantic_req_similarity(p_name, p_sent, g_name, g_sent)
                if sim >= 0.75:
                    is_match = True

            if is_match:
                prop_to_gold[pid or p_name].append(g)
                gold_to_prop[gid].append(p)

    # 2. Classify alignments
    structural_outcomes: dict[str, str] = {}
    taxonomy_counts: Counter[str] = Counter()

    for p in proposed_reqs:
        pid = str(p.get("requirement_id") or p.get("id") or "")
        pkey = pid or str(p.get("canonical_name", ""))
        matched_golds = prop_to_gold.get(pkey, [])

        if not matched_golds:
            # Check if recorded as an explicit REMOVE in gold review
            is_explicit_remove = any(
                pid in (g.get("source_proposal_ids") or g.get("proposal_provenance", {}).get("proposal_ids", []))
                for g in removed_gold_reqs
            )
            err_type = "FALSE_EXTRACTION"
            for g in removed_gold_reqs:
                if pid in (g.get("source_proposal_ids") or g.get("proposal_provenance", {}).get("proposal_ids", [])):
                    err_type = g.get("error_type") or "FALSE_EXTRACTION"
                    break
            structural_outcomes[pkey] = "FALSE_EXTRACTION"
            taxonomy_counts[err_type] += 1
        elif len(matched_golds) > 1:
            structural_outcomes[pkey] = "UNDER_SPLIT"
            taxonomy_counts["UNDER_SPLIT"] += 1
        else:
            g = matched_golds[0]
            gid = str(g.get("gold_requirement_id", ""))
            matched_props = gold_to_prop.get(gid, [])
            if len(matched_props) > 1:
                structural_outcomes[pkey] = "DUPLICATE_REQUIREMENT"
                taxonomy_counts["DUPLICATE_REQUIREMENT"] += 1
            else:
                if _fold(p.get("canonical_name", "")) == _fold(g.get("canonical_name", "")):
                    structural_outcomes[pkey] = "EXACT_MATCH"
                else:
                    structural_outcomes[pkey] = "EDITED_MATCH"

    # Identify missing extractions
    for g in active_gold_reqs:
        gid = str(g.get("gold_requirement_id", ""))
        if not gold_to_prop.get(gid):
            taxonomy_counts["MISSING_EXTRACTION"] += 1

    return {
        "prop_to_gold": prop_to_gold,
        "gold_to_prop": gold_to_prop,
        "structural_outcomes": structural_outcomes,
        "taxonomy_counts": dict(taxonomy_counts),
    }


def calculate_parser_metrics(
    reviewed_jds: list[dict[str, Any]],
    parser_snapshot: ParserVersionSnapshot | dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Calculate comprehensive JD parsing quality metrics against frozen gold ground truth."""
    valid_jds = [
        j for j in reviewed_jds
        if j.get("review_status") not in {None, "PENDING"} or j.get("adjudicated") or len(j.get("reviewed_requirements", []) or j.get("gold_requirements", [])) > 0
    ]

    if not valid_jds:
        return {
            "reviewed_jds_count": 0,
            "status": "NO_REVIEWED_JDS",
            "requirement_extraction_precision": 0.0,
            "requirement_extraction_recall": 0.0,
            "requirement_extraction_f1": 0.0,
            "required_preferred_accuracy": 0.0,
            "hard_gate_precision": 0.0,
            "hard_gate_recall": 0.0,
            "hard_gate_f1": 0.0,
            "boolean_group_precision": 0.0,
            "boolean_group_recall": 0.0,
            "boolean_group_f1": 0.0,
            "operator_accuracy": 0.0,
            "any_of_accuracy": 0.0,
            "all_of_accuracy": 0.0,
            "singleton_group_error_rate": 0.0,
            "boolean_overgroup_rate": 0.0,
            "parser_noise_rate": 0.0,
            "duplicate_requirement_rate": 0.0,
            "error_taxonomy_counts": {},
            "parser_version_snapshot": parser_snapshot.to_dict() if hasattr(parser_snapshot, "to_dict") else (parser_snapshot or {}),
        }

    total_proposed_reqs = 0
    total_gold_reqs = 0
    tp_reqs = 0
    fp_reqs = 0
    fn_reqs = 0

    req_level_matches = 0
    req_level_totals = 0

    hg_tp = 0
    hg_fp = 0
    hg_fn = 0

    all_taxonomy_counts: Counter[str] = Counter()

    total_proposed_groups = 0
    total_singleton_groups = 0
    total_gold_groups = 0
    bg_tp = 0
    bg_fp = 0
    bg_fn = 0
    op_correct = 0
    op_total = 0
    any_correct = 0
    any_total = 0
    all_correct = 0
    all_total = 0
    overgroup_count = 0

    for jd in valid_jds:
        proposed = jd.get("proposed_requirements", [])
        gold = [r for r in (jd.get("gold_requirements") or jd.get("reviewed_requirements", [])) if r.get("review_action") != "REMOVE"]
        total_proposed_reqs += len(proposed)
        total_gold_reqs += len(gold)

        alignment = align_proposals_to_gold(proposed, jd.get("gold_requirements") or jd.get("reviewed_requirements", []))
        all_taxonomy_counts.update(alignment["taxonomy_counts"])

        prop_to_gold = alignment["prop_to_gold"]
        gold_to_prop = alignment["gold_to_prop"]

        # Requirements TP / FP / FN
        for p in proposed:
            pid = str(p.get("requirement_id") or p.get("id") or "")
            pkey = pid or str(p.get("canonical_name", ""))
            matched = prop_to_gold.get(pkey, [])
            if matched:
                tp_reqs += 1
                g = matched[0]
                p_lvl = str(p.get("required_level", "")).upper()
                r_lvl = str(g.get("required_level", "")).upper()
                if p_lvl and r_lvl:
                    req_level_totals += 1
                    if p_lvl == r_lvl:
                        req_level_matches += 1

                p_hg = bool(p.get("hard_gate", False))
                r_hg = bool(g.get("hard_gate", False))
                if p_hg and r_hg:
                    hg_tp += 1
                elif p_hg and not r_hg:
                    hg_fp += 1
                elif not p_hg and r_hg:
                    hg_fn += 1
            else:
                fp_reqs += 1

        for g in gold:
            gid = str(g.get("gold_requirement_id", ""))
            if not gold_to_prop.get(gid):
                fn_reqs += 1

        # Boolean Groups Alignment: Semantic Concept matching independently of group IDs
        p_groups = jd.get("proposed_boolean_groups", [])
        g_groups = jd.get("gold_boolean_groups") or jd.get("reviewed_boolean_groups", [])

        # Track singletons in production proposals
        singletons = [pg for pg in p_groups if len(pg.get("member_requirement_ids", [])) == 1]
        total_singleton_groups += len(singletons)

        multi_p_groups = [pg for pg in p_groups if len(pg.get("member_requirement_ids", [])) > 1]
        multi_g_groups = [gg for gg in g_groups if len(gg.get("member_gold_requirement_ids", [])) > 1]

        total_proposed_groups += len(p_groups)
        total_gold_groups += len(multi_g_groups)

        # Map each proposed group members to gold requirement concepts
        def _group_gold_concepts(group: dict[str, Any], is_gold: bool) -> frozenset[str]:
            if is_gold:
                return frozenset(_fold(m) for m in group.get("member_gold_requirement_ids", []))
            # For proposal group: map member proposal IDs to corresponding gold requirement concepts
            members = group.get("member_requirement_ids", [])
            concepts = set()
            for m in members:
                matched_g = prop_to_gold.get(m, [])
                if matched_g:
                    for g in matched_g:
                        concepts.add(_fold(g.get("gold_requirement_id", "")))
                else:
                    concepts.add(f"unmatched_{_fold(m)}")
            return frozenset(concepts)

        gold_group_map = {_group_gold_concepts(gg, True): gg for gg in multi_g_groups}

        for pg in multi_p_groups:
            p_concepts = _group_gold_concepts(pg, False)
            p_op = str(pg.get("operator", "")).upper()
            if p_op == "ANY_OF":
                any_total += 1
            elif p_op == "ALL_OF":
                all_total += 1

            if p_concepts in gold_group_map:
                bg_tp += 1
                matched_gg = gold_group_map[p_concepts]
                g_op = str(matched_gg.get("operator", "")).upper()
                op_total += 1
                if p_op == g_op:
                    op_correct += 1
                    if p_op == "ANY_OF":
                        any_correct += 1
                    elif p_op == "ALL_OF":
                        all_correct += 1
            else:
                bg_fp += 1
                overgroup_count += 1

        for gg in multi_g_groups:
            g_concepts = _group_gold_concepts(gg, True)
            if not any(_group_gold_concepts(pg, False) == g_concepts for pg in multi_p_groups):
                bg_fn += 1

    precision = tp_reqs / max(1, tp_reqs + fp_reqs)
    recall = tp_reqs / max(1, tp_reqs + fn_reqs)
    f1 = (2 * precision * recall) / max(1e-6, precision + recall)

    req_acc = req_level_matches / max(1, req_level_totals)

    hg_prec = hg_tp / max(1, hg_tp + hg_fp)
    hg_rec = hg_tp / max(1, hg_tp + hg_fn)
    hg_f1 = (2 * hg_prec * hg_rec) / max(1e-6, hg_prec + hg_rec)

    bg_prec = bg_tp / max(1, bg_tp + bg_fp)
    bg_rec = bg_tp / max(1, bg_tp + bg_fn)
    bg_f1 = (2 * bg_prec * bg_rec) / max(1e-6, bg_prec + bg_rec)

    op_acc = op_correct / max(1, op_total)
    any_acc = any_correct / max(1, any_total)
    all_acc = all_correct / max(1, all_total)

    singleton_rate = total_singleton_groups / max(1, total_proposed_groups)
    overgroup_rate = overgroup_count / max(1, len(multi_p_groups) if 'multi_p_groups' in locals() else 1)
    noise_rate = all_taxonomy_counts.get("FALSE_EXTRACTION", 0) / max(1, total_proposed_reqs)
    dup_rate = all_taxonomy_counts.get("DUPLICATE_REQUIREMENT", 0) / max(1, total_proposed_reqs)

    snapshot_dict = parser_snapshot.to_dict() if hasattr(parser_snapshot, "to_dict") else (parser_snapshot or {
        "parser_version": "1.0.0",
        "git_commit": "HEAD",
        "evaluation_timestamp": "",
        "jd_parser_configuration": {"model": "heuristic+regex", "pipeline_version": "v1.0"},
        "matching_schema_version": "1.0.0",
        "benchmark_gold_version": "v1.0",
    })

    return {
        "parser_version_snapshot": snapshot_dict,
        "reviewed_jds_count": len(valid_jds),
        "total_proposed_requirements": total_proposed_reqs,
        "total_gold_requirements": total_gold_reqs,
        "requirement_extraction_precision": round(precision, 4),
        "requirement_extraction_recall": round(recall, 4),
        "requirement_extraction_f1": round(f1, 4),
        "required_preferred_accuracy": round(req_acc, 4),
        "hard_gate_precision": round(hg_prec, 4),
        "hard_gate_recall": round(hg_rec, 4),
        "hard_gate_f1": round(hg_f1, 4),
        "boolean_group_precision": round(bg_prec, 4),
        "boolean_group_recall": round(bg_rec, 4),
        "boolean_group_f1": round(bg_f1, 4),
        "operator_accuracy": round(op_acc, 4),
        "any_of_accuracy": round(any_acc, 4),
        "all_of_accuracy": round(all_acc, 4),
        "singleton_group_error_rate": round(singleton_rate, 4),
        "boolean_overgroup_rate": round(overgroup_rate, 4),
        "parser_noise_rate": round(noise_rate, 4),
        "duplicate_requirement_rate": round(dup_rate, 4),
        "error_taxonomy_counts": dict(all_taxonomy_counts),
    }


