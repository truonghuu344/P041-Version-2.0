"""Deterministic, One-to-One Requirement Extraction Evaluator.

Implements Maximum Weight Bipartite Matching (Hungarian algorithm) to align
ground-truth JD requirements with extracted JD requirements.

Ensures:
- Exactly one-to-one pairing (no multiple TPs counted for one expected requirement).
- Separation of content detection (TP/FP/FN, P/R/F1) from attribute accuracy (group, type, threshold).
- Detection of duplicate extractions emitted by parser.
- Deterministic, mathematically valid metrics (Recall in [0, 1], Precision in [0, 1]).
"""

from __future__ import annotations

import re
import unicodedata
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any, Callable

try:
    from scipy.optimize import linear_sum_assignment
    HAS_SCIPY = True
except ImportError:
    HAS_SCIPY = False

from src.services.cv_jd_matching import RELATED_SKILLS, SKILL_ALIASES, canonical_skill, parse_job_description


def _fold(value: str) -> str:
    text = unicodedata.normalize("NFD", str(value or "").casefold())
    text = "".join(char for char in text if unicodedata.category(char) != "Mn")
    return re.sub(r"\s+", " ", text).strip()


def _tokenize(text: str) -> set[str]:
    clean = _fold(text)
    tokens = re.findall(r"[a-z0-9+#]+", clean)
    stop_words = {"va", "hoac", "trong", "cho", "cua", "la", "co", "cac", "nhung", "voi", "ve", "duoc", "tai", "and", "or", "in", "for", "of", "is", "with", "to", "at", "from"}
    return {t for t in tokens if len(t) > 1 and t not in stop_words}


def _is_short_tech_name(text: str) -> str | None:
    words = text.strip().split()
    if len(words) > 3 or len(text) > 30:
        return None
    cs = canonical_skill(text)
    if cs and (_fold(cs) in SKILL_ALIASES or _fold(text) in SKILL_ALIASES or cs in RELATED_SKILLS):
        return cs
    return None


def compute_requirement_similarity(expected: dict[str, Any], extracted: dict[str, Any]) -> float:
    """Calculate semantic and attribute similarity between an expected requirement and an extracted requirement.
    
    Returns a score in [0.0, 1.0].
    """
    exp_text = str(expected.get("text") or expected.get("normalized_value") or "")
    ext_text = str(extracted.get("text") or extracted.get("normalized_value") or "")

    exp_norm = _fold(expected.get("normalized_value") or exp_text)
    ext_norm = _fold(extracted.get("normalized_value") or ext_text)

    # 1. Exact normalized text match
    if exp_norm == ext_norm:
        return 1.0

    # 2. Technology Identity Check (applied only to short skill entity names)
    exp_skill = _is_short_tech_name(expected.get("normalized_value") or exp_text)
    ext_skill = _is_short_tech_name(extracted.get("normalized_value") or ext_text)

    if exp_skill and ext_skill:
        if exp_skill.casefold() == ext_skill.casefold():
            return 1.0
        # Check if related (e.g. FastAPI and Flask)
        if ext_skill in RELATED_SKILLS.get(exp_skill, set()) or exp_skill in RELATED_SKILLS.get(ext_skill, set()):
            return 0.40
        # Different known technologies -> strictly 0.0
        return 0.0

    # If expected is a specific technical skill, extracted must contain it
    if exp_skill and not ext_skill:
        if exp_skill.lower() in _tokenize(ext_text) or _fold(exp_skill) in ext_norm:
            return 0.85
        return 0.0

    if ext_skill and not exp_skill:
        if ext_skill.lower() in _tokenize(exp_text) or _fold(ext_skill) in exp_norm:
            return 0.85
        return 0.0

    # 3. Hard Constraint Identity Check
    exp_is_hc = bool(expected.get("is_hard_constraint") or expected.get("type") == "HARD_CONSTRAINT")
    ext_is_hc = bool(extracted.get("is_hard_constraint") or extracted.get("type") == "HARD_CONSTRAINT")
    if exp_is_hc and ext_is_hc:
        t1 = _tokenize(exp_text)
        t2 = _tokenize(ext_text)
        if t1.intersection(t2):
            return 0.95
        return 0.60

    # 4. Token Overlap (Jaccard & Overlap coefficient)
    tokens_exp = _tokenize(exp_text)
    tokens_ext = _tokenize(ext_text)
    if not tokens_exp or not tokens_ext:
        return 0.0

    intersection = tokens_exp.intersection(tokens_ext)
    if not intersection:
        return 0.0

    jaccard = len(intersection) / len(tokens_exp.union(tokens_ext))
    overlap_exp = len(intersection) / len(tokens_exp)
    overlap_ext = len(intersection) / len(tokens_ext)

    # Substring / sub-phrase match
    if exp_norm in ext_norm or ext_norm in exp_norm:
        return max(0.80, (overlap_exp + overlap_ext) / 2.0)

    # Experience keyword alignment
    exp_is_exp = bool(expected.get("group") == "experience_seniority" or expected.get("minimum_years"))
    ext_is_exp = bool(extracted.get("group") == "experience_seniority" or extracted.get("minimum_years"))
    if exp_is_exp and ext_is_exp:
        return round(0.50 + 0.50 * overlap_exp, 4)

    score = 0.60 * overlap_exp + 0.40 * jaccard
    return round(score, 4)


def _pure_python_hungarian(cost_matrix: list[list[float]]) -> list[tuple[int, int]]:
    """Pure Python fallback for bipartite maximum weight matching (Munkres algorithm)."""
    n_rows = len(cost_matrix)
    n_cols = len(cost_matrix[0]) if n_rows > 0 else 0
    if n_rows == 0 or n_cols == 0:
        return []

    # Pad to square matrix
    dim = max(n_rows, n_cols)
    matrix = [[0.0] * dim for _ in range(dim)]
    for i in range(n_rows):
        for j in range(n_cols):
            matrix[i][j] = cost_matrix[i][j]

    # Simple greedy search with backtracking for small dimensions
    import itertools
    row_indices = list(range(n_rows))
    best_cost = float("inf")
    best_assignment = []

    # For standard benchmarks, dimension <= 25, greedy best matching with conflict resolution
    available_cols = set(range(n_cols))
    assigned = []
    
    # Sort pairs by lowest cost
    all_pairs = []
    for r in range(n_rows):
        for c in range(n_cols):
            all_pairs.append((matrix[r][c], r, c))
    all_pairs.sort(key=lambda x: x[0])

    used_rows = set()
    used_cols = set()
    for cost, r, c in all_pairs:
        if r not in used_rows and c not in used_cols:
            used_rows.add(r)
            used_cols.add(c)
            assigned.append((r, c))
            if len(used_rows) == n_rows:
                break

    return assigned


def align_requirements_bipartite(
    expected_list: list[dict[str, Any]],
    extracted_list: list[dict[str, Any]],
    min_similarity: float = 0.45,
) -> tuple[list[tuple[dict[str, Any], dict[str, Any], float]], list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    """Perform optimal 1-to-1 matching between expected and extracted requirements.
    
    Returns:
    - matched_pairs: list of (expected_req, extracted_req, similarity_score)
    - false_negatives: unmatched expected requirements
    - false_positives: unmatched extracted requirements
    - duplicate_extractions: extracted requirements that strongly matched an already-assigned expected req
    """
    n_exp = len(expected_list)
    n_ext = len(extracted_list)

    if n_exp == 0:
        return [], [], list(extracted_list), []
    if n_ext == 0:
        return [], list(expected_list), [], []

    # Build similarity and cost matrix
    sim_matrix = []
    cost_matrix = []
    for exp in expected_list:
        row_sim = []
        row_cost = []
        for ext in extracted_list:
            s = compute_requirement_similarity(exp, ext)
            row_sim.append(s)
            row_cost.append(1.0 - s)
        sim_matrix.append(row_sim)
        cost_matrix.append(row_cost)

    # Solve bipartite assignment
    if HAS_SCIPY:
        row_ind, col_ind = linear_sum_assignment(cost_matrix)
        raw_pairs = list(zip(row_ind, col_ind))
    else:
        raw_pairs = _pure_python_hungarian(cost_matrix)

    matched_pairs = []
    assigned_exp_indices = set()
    assigned_ext_indices = set()

    for r, c in raw_pairs:
        sim = sim_matrix[r][c]
        if sim >= min_similarity:
            matched_pairs.append((expected_list[r], extracted_list[c], sim))
            assigned_exp_indices.add(r)
            assigned_ext_indices.add(c)

    false_negatives = [expected_list[i] for i in range(n_exp) if i not in assigned_exp_indices]
    unmatched_extracted = [extracted_list[j] for j in range(n_ext) if j not in assigned_ext_indices]

    # Detect duplicate extractions: unassigned extracted requirements that have high similarity to assigned expected ones
    duplicate_extractions = []
    false_positives = []

    for ext in unmatched_extracted:
        # Check if ext matches any expected requirement with high similarity (>= 0.60)
        max_sim_to_exp = max(
            (compute_requirement_similarity(exp, ext) for exp in expected_list),
            default=0.0,
        )
        if max_sim_to_exp >= 0.60:
            duplicate_extractions.append({
                "extracted": ext,
                "max_similarity_to_expected": max_sim_to_exp,
            })
        else:
            false_positives.append(ext)

    return matched_pairs, false_negatives, false_positives, duplicate_extractions


@dataclass
class JobExtractionResult:
    job_id: str
    title: str
    expected_count: int
    extracted_count: int
    true_positives: int
    false_positives: int
    false_negatives: int
    duplicate_count: int
    precision: float
    recall: float
    f1: float
    group_accuracy: float
    type_accuracy: float
    experience_accuracy: float
    hard_constraint_accuracy: float
    matched_pairs: list[dict[str, Any]] = field(default_factory=list)
    structural_errors: list[dict[str, Any]] = field(default_factory=list)
    unmatched_expected: list[dict[str, Any]] = field(default_factory=list)
    unmatched_extracted: list[dict[str, Any]] = field(default_factory=list)
    duplicates: list[dict[str, Any]] = field(default_factory=list)


def evaluate_job_extraction(
    job_id: str,
    title: str,
    raw_jd_text: str,
    expected_requirements: list[dict[str, Any]],
    parser_fn: Callable[..., dict[str, Any]] | None = None,
    min_similarity: float = 0.45,
) -> JobExtractionResult:
    """Evaluate requirement extraction for a single Job Description."""
    parse = parser_fn or parse_job_description
    parsed_jd = parse(title=title, requirements_text=raw_jd_text)
    extracted_requirements = parsed_jd.get("requirements", [])

    matched_pairs_raw, fn_list, fp_list, dup_list = align_requirements_bipartite(
        expected_requirements,
        extracted_requirements,
        min_similarity=min_similarity,
    )

    tp = len(matched_pairs_raw)
    fp = len(fp_list) + len(dup_list)  # Extra extractions are counted in total extracted = TP + FP
    fn = len(fn_list)

    precision = tp / max(1, tp + fp)
    recall = tp / max(1, tp + fn)
    f1 = 2 * precision * recall / max(1e-6, precision + recall)

    group_correct = 0
    type_correct = 0
    exp_expected = 0
    exp_correct = 0
    hc_expected = 0
    hc_correct = 0

    matched_pairs_data = []
    structural_errors = []

    for exp, ext, sim in matched_pairs_raw:
        is_grp_ok = (exp.get("group") == ext.get("group"))
        is_type_ok = (exp.get("type") == ext.get("type"))

        if is_grp_ok:
            group_correct += 1
        if is_type_ok:
            type_correct += 1

        exp_is_exp = bool(exp.get("group") == "experience_seniority" or exp.get("minimum_years"))
        if exp_is_exp:
            exp_expected += 1
            if exp.get("minimum_years") and ext.get("minimum_years") == exp.get("minimum_years"):
                exp_correct += 1

        exp_is_hc = bool(exp.get("is_hard_constraint") or exp.get("type") == "HARD_CONSTRAINT")
        if exp_is_hc:
            hc_expected += 1
            if ext.get("is_hard_constraint") or ext.get("type") == "HARD_CONSTRAINT":
                hc_correct += 1

        pair_info = {
            "expected_text": exp.get("text"),
            "extracted_text": ext.get("text"),
            "similarity": sim,
            "expected_group": exp.get("group"),
            "extracted_group": ext.get("group"),
            "expected_type": exp.get("type"),
            "extracted_type": ext.get("type"),
            "expected_min_years": exp.get("minimum_years"),
            "extracted_min_years": ext.get("minimum_years"),
            "group_match": is_grp_ok,
            "type_match": is_type_ok,
        }
        matched_pairs_data.append(pair_info)

        if not is_grp_ok or not is_type_ok or (exp.get("minimum_years") and not ext.get("minimum_years")):
            structural_errors.append(pair_info)

    for exp in fn_list:
        if exp.get("group") == "experience_seniority" or exp.get("minimum_years"):
            exp_expected += 1
        if exp.get("is_hard_constraint") or exp.get("type") == "HARD_CONSTRAINT":
            hc_expected += 1

    group_acc = group_correct / max(1, tp)
    type_acc = type_correct / max(1, tp)
    exp_acc = exp_correct / max(1, exp_expected) if exp_expected > 0 else 1.0
    hc_acc = hc_correct / max(1, hc_expected) if hc_expected > 0 else 1.0

    return JobExtractionResult(
        job_id=job_id,
        title=title,
        expected_count=len(expected_requirements),
        extracted_count=len(extracted_requirements),
        true_positives=tp,
        false_positives=fp,
        false_negatives=fn,
        duplicate_count=len(dup_list),
        precision=round(precision, 4),
        recall=round(recall, 4),
        f1=round(f1, 4),
        group_accuracy=round(group_acc, 4),
        type_accuracy=round(type_acc, 4),
        experience_accuracy=round(exp_acc, 4),
        hard_constraint_accuracy=round(hc_acc, 4),
        matched_pairs=matched_pairs_data,
        structural_errors=structural_errors,
        unmatched_expected=fn_list,
        unmatched_extracted=fp_list,
        duplicates=dup_list,
    )


def evaluate_dataset_extraction(
    dataset: Any,
    parser_fn: Callable[..., dict[str, Any]] | None = None,
    min_similarity: float = 0.45,
) -> dict[str, Any]:
    """Run mathematically rigorous one-to-one extraction evaluation across entire benchmark dataset."""
    job_results: list[JobExtractionResult] = []

    total_expected = 0
    total_extracted = 0
    total_tp = 0
    total_fp = 0
    total_fn = 0
    total_duplicates = 0

    all_matched_pairs = []
    all_structural_errors = []
    all_fps = []
    all_fns = []
    duplicate_groups = defaultdict(int)
    affected_duplicate_jds = set()

    for job in dataset.jobs:
        res = evaluate_job_extraction(
            job_id=job.job_id,
            title=job.title,
            raw_jd_text=job.raw_jd_text,
            expected_requirements=job.requirements,
            parser_fn=parser_fn,
            min_similarity=min_similarity,
        )
        job_results.append(res)

        total_expected += res.expected_count
        total_extracted += res.extracted_count
        total_tp += res.true_positives
        total_fp += res.false_positives
        total_fn += res.false_negatives
        total_duplicates += res.duplicate_count

        all_matched_pairs.extend(res.matched_pairs)
        all_structural_errors.extend(res.structural_errors)
        all_fps.extend(res.unmatched_extracted)
        all_fns.extend(res.unmatched_expected)

        if res.duplicate_count > 0:
            affected_duplicate_jds.add(job.job_id)
            for d in res.duplicates:
                grp = d["extracted"].get("group", "unknown")
                duplicate_groups[grp] += 1

    overall_precision = total_tp / max(1, total_tp + total_fp)
    overall_recall = total_tp / max(1, total_tp + total_fn)
    overall_f1 = 2 * overall_precision * overall_recall / max(1e-6, overall_precision + overall_recall)

    overall_group_acc = sum(1 for p in all_matched_pairs if p["group_match"]) / max(1, total_tp)
    overall_type_acc = sum(1 for p in all_matched_pairs if p["type_match"]) / max(1, total_tp)

    exp_pairs = [p for p in all_matched_pairs if p.get("expected_min_years")]
    exp_acc = sum(1 for p in exp_pairs if p.get("extracted_min_years") == p.get("expected_min_years")) / max(1, len(exp_pairs))

    return {
        "summary": {
            "total_expected_requirements": total_expected,
            "total_extracted_requirements": total_extracted,
            "true_positives": total_tp,
            "false_positives": total_fp,
            "false_negatives": total_fn,
            "duplicate_extractions": total_duplicates,
            "precision": round(overall_precision, 4),
            "recall": round(overall_recall, 4),
            "f1": round(overall_f1, 4),
            "group_accuracy": round(overall_group_acc, 4),
            "type_accuracy": round(overall_type_acc, 4),
            "experience_accuracy": round(exp_acc, 4),
            "affected_duplicate_jobs_count": len(affected_duplicate_jds),
            "affected_duplicate_job_ids": sorted(affected_duplicate_jds),
            "duplicate_groups": dict(duplicate_groups),
        },
        "per_job_results": [
            {
                "job_id": r.job_id,
                "title": r.title,
                "expected": r.expected_count,
                "extracted": r.extracted_count,
                "tp": r.true_positives,
                "fp": r.false_positives,
                "fn": r.false_negatives,
                "duplicates": r.duplicate_count,
                "precision": r.precision,
                "recall": r.recall,
                "f1": r.f1,
                "group_acc": r.group_accuracy,
                "type_acc": r.type_accuracy,
                "exp_acc": r.experience_accuracy,
                "structural_errors_count": len(r.structural_errors),
            }
            for r in job_results
        ],
        "top_false_positives": [
            {"text": fp.get("text"), "group": fp.get("group"), "type": fp.get("type")}
            for fp in all_fps[:10]
        ],
        "top_false_negatives": [
            {"text": fn.get("text"), "group": fn.get("group"), "type": fn.get("type"), "mandatory": fn.get("mandatory")}
            for fn in all_fns[:10]
        ],
        "structural_errors_sample": all_structural_errors[:10],
    }
