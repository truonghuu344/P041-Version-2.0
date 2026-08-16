"""Evidence confidence calculation for Top Jobs recommendations.

Calculates the confidence level of the evidence underlying a recommendation.
Confidence is strictly an indicator of evidence coverage and extraction certainty;
it is decoupled from the fit score (e.g. high fit score with low evidence confidence
is a valid and expected state when requirements have sparse or uncertain evidence).

Levels (V1):
- high: >= 80% of scored requirements have verified evidence.
- medium: 50% - 79% of scored requirements have verified evidence.
- low: < 50% of scored requirements have verified evidence, or high uncertainty (UNCERTAIN status).
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from typing import Any, Literal

ConfidenceLevel = Literal["high", "medium", "low"]

HIGH_THRESHOLD = 0.80
MEDIUM_THRESHOLD = 0.50
MAX_UNCERTAIN_RATIO_FOR_NON_LOW = 0.30


@dataclass(frozen=True, slots=True)
class ConfidenceResult:
    """Calculated confidence score and level."""

    confidence_score: float
    confidence_level: ConfidenceLevel
    evidence_coverage: float
    verified_count: int
    uncertain_count: int
    total_requirements: int
    details: dict[str, Any] = field(default_factory=dict)


def _extract_requirements_data(match_input: Any) -> tuple[int, int, int]:
    """Extract (verified_count, uncertain_count, total_requirements) from match input."""
    # Direct counts tuple or mapping
    if isinstance(match_input, Mapping) and "verified_count" in match_input:
        return (
            int(match_input.get("verified_count", 0)),
            int(match_input.get("uncertain_count", 0)),
            int(match_input.get("total_requirements", 0)),
        )

    # From match object or result dict
    result_json = getattr(match_input, "result_json", None) or (
        match_input.get("result_json") if isinstance(match_input, Mapping) else None
    )

    if result_json is None and isinstance(match_input, Mapping):
        result_json = match_input

    if isinstance(result_json, Mapping):
        requirements_groups = result_json.get("requirements")
        if isinstance(requirements_groups, Mapping):
            matched = requirements_groups.get("matched", [])
            partial = requirements_groups.get("partial", [])
            missing = requirements_groups.get("missing", [])
            uncertain = requirements_groups.get("uncertain", [])

            verified_count = len(matched)
            uncertain_count = len(uncertain)
            total = len(matched) + len(partial) + len(missing) + len(uncertain)
            if total > 0:
                return verified_count, uncertain_count, total

        # Fallback to criteria list
        criteria = result_json.get("criteria", [])
        if isinstance(criteria, Sequence) and not isinstance(criteria, (str, bytes)) and criteria:
            verified = sum(1 for c in criteria if isinstance(c, Mapping) and c.get("status") == "SUPPORTED")
            uncertain = sum(1 for c in criteria if isinstance(c, Mapping) and c.get("status") == "UNCERTAIN")
            return verified, uncertain, len(criteria)

    return 0, 0, 0


def calculate_evidence_confidence(
    match_or_requirements: Any = None,
    *,
    verified_count: int | None = None,
    uncertain_count: int | None = None,
    total_requirements: int | None = None,
    high_threshold: float = HIGH_THRESHOLD,
    medium_threshold: float = MEDIUM_THRESHOLD,
    max_uncertain_ratio: float = MAX_UNCERTAIN_RATIO_FOR_NON_LOW,
) -> ConfidenceResult:
    """Calculate the evidence confidence score and level.

    Parameters
    ----------
    match_or_requirements:
        MatchResult, MatchRun, match result dict, or requirements container.
    verified_count:
        Explicit count of requirements supported with verified evidence.
    uncertain_count:
        Explicit count of requirements with UNCERTAIN status.
    total_requirements:
        Explicit total count of scored requirements.
    high_threshold:
        Coverage threshold for 'high' confidence (default 0.80).
    medium_threshold:
        Coverage threshold for 'medium' confidence (default 0.50).
    max_uncertain_ratio:
        Maximum allowed ratio of UNCERTAIN requirements before downgrading to 'low'.

    Returns
    -------
    ConfidenceResult
        Evidence confidence metrics and categorical level ('high', 'medium', 'low').
    """
    if verified_count is None or uncertain_count is None or total_requirements is None:
        extracted_v, extracted_u, extracted_t = _extract_requirements_data(match_or_requirements)
        v_count = verified_count if verified_count is not None else extracted_v
        u_count = uncertain_count if uncertain_count is not None else extracted_u
        t_count = total_requirements if total_requirements is not None else extracted_t
    else:
        v_count = verified_count
        u_count = uncertain_count
        t_count = total_requirements

    if t_count <= 0:
        return ConfidenceResult(
            confidence_score=0.0,
            confidence_level="low",
            evidence_coverage=0.0,
            verified_count=0,
            uncertain_count=0,
            total_requirements=0,
            details={"note": "No scored requirements found."},
        )

    coverage = round(v_count / t_count, 4)
    uncertain_ratio = round(u_count / t_count, 4)

    # Determine confidence level
    if uncertain_ratio >= max_uncertain_ratio or coverage < medium_threshold:
        level: ConfidenceLevel = "low"
    elif coverage >= high_threshold:
        level = "high"
    else:
        level = "medium"

    # Numerical score (0.0 to 1.0) penalized by uncertainty
    raw_score = max(0.0, min(1.0, coverage * (1.0 - uncertain_ratio * 0.5)))

    return ConfidenceResult(
        confidence_score=round(raw_score, 4),
        confidence_level=level,
        evidence_coverage=coverage,
        verified_count=v_count,
        uncertain_count=u_count,
        total_requirements=t_count,
        details={
            "coverage_ratio": coverage,
            "uncertain_ratio": uncertain_ratio,
            "thresholds": {"high": high_threshold, "medium": medium_threshold},
        },
    )
