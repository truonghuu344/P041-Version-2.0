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

# Default 5-pillar rubric weights
DEFAULT_RUBRIC_WEIGHTS: dict[str, float] = {
    "CRIT_REQUIRED_SKILL": 35.0,
    "CRIT_EXPERIENCE": 30.0,
    "CRIT_EDUCATION": 10.0,
    "CRIT_PREFERRED_SKILL": 10.0,
    "CRIT_DOMAIN": 15.0,
}

# Standard name aliases to support flexible input representations
CRITERION_ALIASES: dict[str, str] = {
    "required_skills": "CRIT_REQUIRED_SKILL",
    "required_skill": "CRIT_REQUIRED_SKILL",
    "skills": "CRIT_REQUIRED_SKILL",
    "experience": "CRIT_EXPERIENCE",
    "relevant_experience": "CRIT_EXPERIENCE",
    "education": "CRIT_EDUCATION",
    "preferred_skills": "CRIT_PREFERRED_SKILL",
    "preferred_skill": "CRIT_PREFERRED_SKILL",
    "nice_to_have": "CRIT_PREFERRED_SKILL",
    "domain": "CRIT_DOMAIN",
    "domain_responsibilities": "CRIT_DOMAIN",
    "responsibilities": "CRIT_DOMAIN",
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
    """Calculate the rubric-weighted Fit Score with dynamic active-weight normalization.

    Parameters
    ----------
    criteria_input:
        Criteria evaluation records, Match Engine result, or mapping of
        criterion_id -> raw_score (0.0 - 100.0). Only present/active criteria
        are considered.
    custom_weights:
        Optional custom base weights for criteria. Defaults to the standard 5-pillar rubric.
    decimal_places:
        Number of decimal places for score rounding (default 1).

    Returns
    -------
    FitScoreResult
        Contains raw_fit_score, display_fit_score, and per-criterion breakdown.
    """
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
