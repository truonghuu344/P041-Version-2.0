"""Fit Score calculation for Top Jobs recommendations.

Calculates the candidate-job fit score using a deterministic 5-criterion rubric:
- 35% Required Skills (CRIT_REQUIRED_SKILL)
- 30% Relevant Experience (CRIT_EXPERIENCE)
- 10% Education (CRIT_EDUCATION)
- 10% Preferred Skills (CRIT_PREFERRED_SKILL)
- 15% Domain / Responsibilities (CRIT_DOMAIN)

When a job description lacks requirements for a specific criterion (e.g. no
Education requirements), that criterion is disabled and its weight is dynamically
redistributed across the remaining active criteria by normalizing active weights.
For example, without Education (10%), total active weight is 90%, and active
weights become 35/90, 30/90, 10/90, 15/90. Education is NOT mechanically penalized as 0.

If the Match Engine already computed criterion evaluations, those raw scores are
reused directly.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any

# Default 6-group rubric weights
DEFAULT_RUBRIC_WEIGHTS: dict[str, float] = {
    "CRIT_SKILLS": 35.0,
    "CRIT_RESPONSIBILITIES": 20.0,
    "CRIT_EXPERIENCE": 20.0,
    "CRIT_EDUCATION": 10.0,
    "CRIT_DOMAIN": 10.0,
    "CRIT_CERTIFICATIONS_OTHER": 5.0,
}

# Standard name aliases to support flexible input representations
CRITERION_ALIASES: dict[str, str] = {
    "skills": "CRIT_SKILLS",
    "skill": "CRIT_SKILLS",
    "required_skills": "CRIT_SKILLS",
    "required_skill": "CRIT_SKILLS",
    "must_have_skills": "CRIT_SKILLS",
    "preferred_skills": "CRIT_SKILLS",
    "preferred_skill": "CRIT_SKILLS",
    "nice_to_have_skills": "CRIT_SKILLS",
    "nice_to_have": "CRIT_SKILLS",
    "CRIT_SKILLS": "CRIT_SKILLS",
    "CRIT_REQUIRED_SKILL": "CRIT_SKILLS",
    "CRIT_PREFERRED_SKILL": "CRIT_SKILLS",
    "responsibilities_task_fit": "CRIT_RESPONSIBILITIES",
    "responsibilities": "CRIT_RESPONSIBILITIES",
    "experience_seniority": "CRIT_EXPERIENCE",
    "experience": "CRIT_EXPERIENCE",
    "relevant_experience": "CRIT_EXPERIENCE",
    "education": "CRIT_EDUCATION",
    "domain_industry": "CRIT_DOMAIN",
    "domain": "CRIT_DOMAIN",
    "domain_responsibilities": "CRIT_DOMAIN",
    "certifications_languages_other": "CRIT_CERTIFICATIONS_OTHER",
    "certifications": "CRIT_CERTIFICATIONS_OTHER",
    "certification": "CRIT_CERTIFICATIONS_OTHER",
    "languages": "CRIT_CERTIFICATIONS_OTHER",
    "other": "CRIT_CERTIFICATIONS_OTHER",
}


@dataclass(frozen=True, slots=True)
class CriterionBreakdown:
    """Breakdown for a single rubric criterion."""

    criterion_id: str
    raw_score: float
    base_weight: float
    normalized_weight: float
    weighted_score: float
    enabled: bool = True


@dataclass(frozen=True, slots=True)
class FitScoreResult:
    """Calculated fit score and detailed component breakdown."""

    raw_fit_score: float
    display_fit_score: float
    breakdown: list[CriterionBreakdown]
    active_weights: dict[str, float]


def _canonical_criterion_id(name: str) -> str:
    cleaned = str(name).strip()
    if cleaned in DEFAULT_RUBRIC_WEIGHTS:
        return cleaned
    normalized_key = cleaned.lower().replace("-", "_").replace(" ", "_")
    return CRITERION_ALIASES.get(normalized_key, cleaned)


def _extract_criterion_scores(
    criteria_input: Any,
) -> dict[str, float]:
    """Extract a mapping of canonical criterion_id -> raw_score from various input formats."""
    extracted: dict[str, float] = {}

    # Format 1: MatchResult object or dict containing 'criteria' or 'result_json'
    if hasattr(criteria_input, "result_json") and isinstance(criteria_input.result_json, Mapping):
        criteria_input = criteria_input.result_json.get("criteria", [])
    elif isinstance(criteria_input, Mapping) and "criteria" in criteria_input:
        criteria_input = criteria_input["criteria"]
    elif isinstance(criteria_input, Mapping) and "result_json" in criteria_input:
        res = criteria_input["result_json"]
        if isinstance(res, Mapping) and "criteria" in res:
            criteria_input = res["criteria"]

    # Format 2: Sequence of criterion dicts or objects (e.g. from pipeline/database)
    if isinstance(criteria_input, Sequence) and not isinstance(criteria_input, (str, bytes)):
        for item in criteria_input:
            if isinstance(item, Mapping):
                cid = item.get("criterion_id") or item.get("id") or item.get("name")
                raw = item.get("raw_score") if "raw_score" in item else item.get("score")
                if cid and raw is not None:
                    extracted[_canonical_criterion_id(str(cid))] = float(raw)
            elif hasattr(item, "criterion_id") and hasattr(item, "raw_score"):
                extracted[_canonical_criterion_id(str(item.criterion_id))] = float(item.raw_score)

    # Format 3: Direct mapping of criterion_id -> score
    elif isinstance(criteria_input, Mapping):
        for key, value in criteria_input.items():
            if value is not None:
                extracted[_canonical_criterion_id(str(key))] = float(value)

    return extracted


def calculate_fit_score(
    criteria_input: Any,
    *,
    custom_weights: Mapping[str, float] | None = None,
    decimal_places: int = 1,
) -> FitScoreResult:
    """Calculate the Fit Score.

    If the input is from the canonical Match Engine (containing requirement-derived criteria with weights),
    those dynamic weights and scores are preserved directly.
    Otherwise, falls back to rubric normalization for legacy raw score dictionaries.
    """
    # 1. Canonical Match Engine result or dict with precomputed dynamic criteria
    criteria_list = None
    direct_score = None
    if hasattr(criteria_input, "result_json") and isinstance(criteria_input.result_json, Mapping):
        criteria_list = criteria_input.result_json.get("criteria", [])
        direct_score = criteria_input.result_json.get("final_score") or criteria_input.result_json.get("match_score")
    elif isinstance(criteria_input, Mapping) and "result_json" in criteria_input and isinstance(criteria_input["result_json"], Mapping):
        res = criteria_input["result_json"]
        criteria_list = res.get("criteria", [])
        direct_score = res.get("final_score") or res.get("match_score")
    elif isinstance(criteria_input, Mapping) and "criteria" in criteria_input:
        criteria_list = criteria_input.get("criteria", [])
        direct_score = criteria_input.get("final_score") or criteria_input.get("match_score")
    elif isinstance(criteria_input, Sequence) and not isinstance(criteria_input, (str, bytes)):
        criteria_list = criteria_input

    if (
        criteria_list is not None
        and isinstance(criteria_list, Sequence)
        and len(criteria_list) > 0
        and all(isinstance(c, Mapping) and "weight" in c for c in criteria_list)
        and custom_weights is None
    ):
        breakdown: list[CriterionBreakdown] = []
        active_weights: dict[str, float] = {}
        total_raw = 0.0
        for c in criteria_list:
            cid = _canonical_criterion_id(str(c.get("criterion_id") or c.get("group") or c.get("id") or ""))
            w = float(c.get("weight") or 0.0)
            raw = float(c.get("raw_score") if "raw_score" in c else (c.get("score") or 0.0))
            weighted = float(c.get("weighted_score") if "weighted_score" in c else (raw * w / 100.0))
            total_raw += weighted
            active_weights[cid] = round(w, 4)
            breakdown.append(
                CriterionBreakdown(
                    criterion_id=cid,
                    raw_score=round(raw, decimal_places),
                    base_weight=round(w, decimal_places),
                    normalized_weight=round(w, 4),
                    weighted_score=round(weighted, decimal_places),
                    enabled=True,
                )
            )
        final_val = float(direct_score) if direct_score is not None else total_raw
        clamped = min(100.0, max(0.0, final_val))
        return FitScoreResult(
            raw_fit_score=round(clamped, 4),
            display_fit_score=round(clamped, decimal_places),
            breakdown=breakdown,
            active_weights=active_weights,
        )

    # 2. Legacy fallback for raw dictionary mapping
    raw_scores = _extract_criterion_scores(criteria_input)
    base_rubric = dict(custom_weights or DEFAULT_RUBRIC_WEIGHTS)

    # Determine which criteria are active (have requirements/scores)
    active_criteria = {
        cid: base_weight
        for cid, base_weight in base_rubric.items()
        if cid in raw_scores and base_weight > 0
    }

    total_active_weight = sum(active_criteria.values())

    if total_active_weight <= 0:
        # No active criteria provided
        return FitScoreResult(
            raw_fit_score=0.0,
            display_fit_score=0.0,
            breakdown=[],
            active_weights={},
        )

    breakdown: list[CriterionBreakdown] = []
    total_raw_fit_score = 0.0
    active_weights: dict[str, float] = {}

    for cid, base_weight in base_rubric.items():
        if cid not in active_criteria:
            continue

        raw = min(100.0, max(0.0, raw_scores[cid]))
        normalized_weight = (base_weight / total_active_weight) * 100.0
        active_weights[cid] = round(normalized_weight, 4)

        weighted_score = (raw / 100.0) * normalized_weight
        total_raw_fit_score += weighted_score

        breakdown.append(
            CriterionBreakdown(
                criterion_id=cid,
                raw_score=round(raw, decimal_places),
                base_weight=round(base_weight, decimal_places),
                normalized_weight=round(normalized_weight, 4),
                weighted_score=round(weighted_score, decimal_places),
                enabled=True,
            )
        )

    clamped_raw = min(100.0, max(0.0, total_raw_fit_score))
    display_score = round(clamped_raw, decimal_places)

    return FitScoreResult(
        raw_fit_score=round(clamped_raw, 4),
        display_fit_score=display_score,
        breakdown=breakdown,
        active_weights=active_weights,
    )
