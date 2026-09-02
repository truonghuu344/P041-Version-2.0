"""Ranking, retrieval, and classification metrics for CV-JD evaluation."""

from __future__ import annotations

import math
from typing import Any


def calculate_dcg(relevances: list[float | int], k: int | None = None) -> float:
    """Discounted Cumulative Gain (graded 2^rel - 1 formulation)."""
    if not relevances:
        return 0.0
    limit = len(relevances) if k is None else min(k, len(relevances))
    dcg = 0.0
    for i in range(limit):
        rel = float(relevances[i])
        dcg += (math.pow(2.0, rel) - 1.0) / math.log2(i + 2.0)
    return dcg


def calculate_ndcg(relevances: list[float | int], k: int | None = None) -> float:
    """Normalized Discounted Cumulative Gain at rank K."""
    if not relevances:
        return 0.0
    actual_dcg = calculate_dcg(relevances, k)
    ideal_relevances = sorted(relevances, reverse=True)
    ideal_dcg = calculate_dcg(ideal_relevances, k)
    if ideal_dcg <= 0.0:
        return 0.0
    return min(1.0, max(0.0, actual_dcg / ideal_dcg))


def _rank_data(values: list[float]) -> list[float]:
    """Assign fractional ranks to elements (handling ties by average rank)."""
    n = len(values)
    indexed = sorted(enumerate(values), key=lambda x: x[1])
    ranks = [0.0] * n
    i = 0
    while i < n:
        j = i
        while j < n - 1 and math.isclose(indexed[j][1], indexed[j + 1][1], abs_tol=1e-9):
            j += 1
        # average rank for indices i..j (1-based)
        avg_rank = sum(range(i + 1, j + 2)) / (j - i + 1)
        for k in range(i, j + 1):
            ranks[indexed[k][0]] = avg_rank
        i = j + 1
    return ranks


def calculate_spearman_rho(x: list[float], y: list[float]) -> float:
    """Spearman rank correlation coefficient with tie-handling."""
    if len(x) != len(y) or len(x) < 2:
        return 0.0
    rx = _rank_data(x)
    ry = _rank_data(y)
    return calculate_pearson_r(rx, ry)


def calculate_pearson_r(x: list[float], y: list[float]) -> float:
    """Pearson correlation coefficient."""
    n = len(x)
    if n != len(y) or n < 2:
        return 0.0
    mean_x = sum(x) / n
    mean_y = sum(y) / n
    cov = sum((x[i] - mean_x) * (y[i] - mean_y) for i in range(n))
    var_x = sum((x[i] - mean_x) ** 2 for i in range(n))
    var_y = sum((y[i] - mean_y) ** 2 for i in range(n))
    if var_x <= 1e-12 or var_y <= 1e-12:
        return 0.0
    r = cov / (math.sqrt(var_x) * math.sqrt(var_y))
    return min(1.0, max(-1.0, r))


def calculate_mae(predictions: list[float], targets: list[float]) -> float:
    """Mean Absolute Error."""
    if not predictions or len(predictions) != len(targets):
        return 0.0
    return sum(abs(p - t) for p, t in zip(predictions, targets)) / len(predictions)


def calculate_pairwise_inversions(
    candidates_ranked: list[dict[str, Any]],
    score_key: str = "system_score",
    human_key: str = "human_relevance",
) -> dict[str, Any]:
    """Calculate pairwise inversions for candidates evaluated against one JD.
    
    A pair (A, B) is evaluated when human_relevance(A) != human_relevance(B).
    If Human(A) > Human(B) but System(A) < System(B), it is an inverted pair.
    """
    n = len(candidates_ranked)
    total_pairs = 0
    correct_pairs = 0
    inverted_pairs = 0
    tied_pairs = 0
    inversion_details = []

    for i in range(n):
        for j in range(i + 1, n):
            cand_a = candidates_ranked[i]
            cand_b = candidates_ranked[j]
            h_a = float(cand_a.get(human_key, 0))
            h_b = float(cand_b.get(human_key, 0))

            if math.isclose(h_a, h_b, abs_tol=1e-9):
                continue  # Skip pairs with equal human relevance

            total_pairs += 1
            # Normalize so A is the candidate with higher human relevance
            if h_a < h_b:
                cand_a, cand_b = cand_b, cand_a
                h_a, h_b = h_b, h_a

            s_a = float(cand_a.get(score_key, 0.0))
            s_b = float(cand_b.get(score_key, 0.0))

            if s_a > s_b:
                correct_pairs += 1
            elif s_a < s_b:
                inverted_pairs += 1
                inversion_details.append(
                    {
                        "expected_better": cand_a.get("cv_id"),
                        "expected_worse": cand_b.get("cv_id"),
                        "human_better": h_a,
                        "human_worse": h_b,
                        "system_better": s_a,
                        "system_worse": s_b,
                        "score_gap": round(s_b - s_a, 2),
                    }
                )
            else:
                tied_pairs += 1
                inversion_details.append(
                    {
                        "expected_better": cand_a.get("cv_id"),
                        "expected_worse": cand_b.get("cv_id"),
                        "human_better": h_a,
                        "human_worse": h_b,
                        "system_better": s_a,
                        "system_worse": s_b,
                        "score_gap": 0.0,
                        "note": "System scored both candidates equally despite human relevance difference.",
                    }
                )

    inversion_rate = round(inverted_pairs / total_pairs, 4) if total_pairs > 0 else 0.0
    return {
        "total_pairs": total_pairs,
        "correct_pairs": correct_pairs,
        "inverted_pairs": inverted_pairs,
        "tied_pairs": tied_pairs,
        "inversion_rate": inversion_rate,
        "inversion_details": inversion_details,
    }


def calculate_binary_ranking_metrics(
    relevances: list[float | int],
    binary_threshold: float = 3.0,
    k: int = 5,
) -> dict[str, float]:
    """Calculate binary ranking metrics (P@K, R@K, MRR, MAP) given a relevance threshold."""
    binary_rels = [1 if r >= binary_threshold else 0 for r in relevances]
    total_relevant = sum(binary_rels)
    limit = min(k, len(binary_rels))

    # Precision@K
    p_at_k = sum(binary_rels[:limit]) / limit if limit > 0 else 0.0

    # Recall@K
    r_at_k = sum(binary_rels[:limit]) / total_relevant if total_relevant > 0 else 1.0

    # MRR (Reciprocal rank of first relevant item)
    mrr = 0.0
    for idx, val in enumerate(binary_rels):
        if val == 1:
            mrr = 1.0 / (idx + 1)
            break

    # Average Precision (AP)
    ap = 0.0
    hits = 0
    for idx, val in enumerate(binary_rels):
        if val == 1:
            hits += 1
            ap += hits / (idx + 1)
    map_score = ap / total_relevant if total_relevant > 0 else 0.0

    return {
        f"precision_at_{k}": round(p_at_k, 4),
        f"recall_at_{k}": round(r_at_k, 4),
        "mrr": round(mrr, 4),
        "map": round(map_score, 4),
    }


def calculate_classification_metrics(
    y_true: list[str],
    y_pred: list[str],
    labels: list[str] | None = None,
) -> dict[str, Any]:
    """Compute accuracy, per-class precision/recall/f1, macro-f1, and confusion matrix."""
    if not y_true or len(y_true) != len(y_pred):
        return {
            "accuracy": 0.0,
            "macro_f1": 0.0,
            "confusion_matrix": {},
            "per_class": {},
        }

    all_labels = sorted(list(set(y_true) | set(y_pred))) if labels is None else labels
    confusion: dict[str, dict[str, int]] = {l: {pl: 0 for pl in all_labels} for l in all_labels}

    for t, p in zip(y_true, y_pred):
        if t in confusion and p in confusion[t]:
            confusion[t][p] += 1

    total = len(y_true)
    correct = sum(1 for t, p in zip(y_true, y_pred) if t == p)
    accuracy = round(correct / total, 4) if total > 0 else 0.0

    per_class = {}
    f1_list = []
    for l in all_labels:
        tp = confusion[l][l]
        fp = sum(confusion[other][l] for other in all_labels if other != l)
        fn = sum(confusion[l][other] for other in all_labels if other != l)

        prec = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        rec = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = (2 * prec * rec) / (prec + rec) if (prec + rec) > 0 else 0.0

        per_class[l] = {
            "precision": round(prec, 4),
            "recall": round(rec, 4),
            "f1": round(f1, 4),
            "support": sum(confusion[l].values()),
        }
        if sum(confusion[l].values()) > 0:
            f1_list.append(f1)

    macro_f1 = round(sum(f1_list) / len(f1_list), 4) if f1_list else 0.0

    return {
        "accuracy": accuracy,
        "macro_f1": macro_f1,
        "confusion_matrix": confusion,
        "per_class": per_class,
    }
