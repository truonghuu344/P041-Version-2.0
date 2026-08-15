"""Mandatory eligibility gate for Top Jobs recommendations.

If a candidate does not meet the minimum mandatory requirement coverage threshold
(default 50%), the mandatory gate fails:
- ``failed`` is set to ``True`` with reason ``"MUST_HAVE_COVERAGE_BELOW_THRESHOLD"``.
- The user-facing ``display_score`` is capped at 49.0 (preventing ineligible candidates
  from seeing an artificially high fit score), while the true ``raw_score`` is preserved.
- The gate decision payload is serialized as JSON for persistence in ``mandatory_gate_json``.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any

DEFAULT_MUST_HAVE_THRESHOLD = 0.50
DEFAULT_SCORE_CAP = 49.0
REASON_MUST_HAVE_BELOW_THRESHOLD = "MUST_HAVE_COVERAGE_BELOW_THRESHOLD"


@dataclass(frozen=True, slots=True)
class GateResult:
    """Outcome of the mandatory requirement gate evaluation."""

    raw_score: float
    display_score: float
    failed: bool
    reason: str | None = None
    gate_json: dict[str, Any] = field(default_factory=dict)


def _extract_match_data(match_input: Any) -> tuple[float, float, list[str]]:
    """Extract raw fit score, must_have coverage, and failed requirement IDs from match input."""
    raw_score = 0.0
    coverage = 1.0
    failed_ids: list[str] = []

    # 1. Extract raw_score / fit_score
    if hasattr(match_input, "final_score"):
        raw_score = float(match_input.final_score)
    elif hasattr(match_input, "raw_fit_score"):
        raw_score = float(match_input.raw_fit_score)
    elif hasattr(match_input, "fit_score"):
        raw_score = float(match_input.fit_score)
    elif isinstance(match_input, Mapping):
        raw_score = float(
            match_input.get("raw_fit_score")
            or match_input.get("final_score")
            or match_input.get("fit_score")
            or match_input.get("match_score")
            or 0.0
        )
    elif isinstance(match_input, (int, float)):
        raw_score = float(match_input)

    # 2. Extract coverage if available directly
    if hasattr(match_input, "must_have_coverage") and match_input.must_have_coverage is not None:
        coverage = float(match_input.must_have_coverage)
    elif isinstance(match_input, Mapping) and "must_have_coverage" in match_input:
        coverage = float(match_input["must_have_coverage"])

    # 3. Extract from result_json / requirements if present
    result_json = getattr(match_input, "result_json", None) or (
        match_input.get("result_json") if isinstance(match_input, Mapping) else None
    )

    if isinstance(result_json, Mapping):
        if "must_have_coverage" in result_json:
            coverage = float(result_json["must_have_coverage"])

        requirements_group = result_json.get("requirements")
        if isinstance(requirements_group, Mapping):
            # Inspect missing/partial/matched groups from pipeline output
            missing = requirements_group.get("missing", [])
            for item in missing:
                if isinstance(item, Mapping) and item.get("mandatory"):
                    req_id = str(item.get("requirement_id") or item.get("id") or "")
                    if req_id and req_id not in failed_ids:
                        failed_ids.append(req_id)

    return raw_score, coverage, failed_ids


def apply_mandatory_gate(
    match_or_score: Any,
    *,
    must_have_coverage: float | None = None,
    failed_requirement_ids: list[str] | None = None,
    threshold: float = DEFAULT_MUST_HAVE_THRESHOLD,
    score_cap: float = DEFAULT_SCORE_CAP,
    decimal_places: int = 1,
) -> GateResult:
    """Evaluate whether candidate meets mandatory requirement coverage.

    Parameters
    ----------
    match_or_score:
        MatchResult, MatchRun, result dict, or numerical raw score.
    must_have_coverage:
        Explicit coverage ratio (0.0 to 1.0). If omitted, extracted from match.
    failed_requirement_ids:
        Explicit list of unmet mandatory requirement IDs. If omitted, extracted from match.
    threshold:
        Coverage threshold required to pass (default 0.50).
    score_cap:
        Upper bound for display_score when gate fails (default 49.0).
    decimal_places:
        Rounding precision for display score.

    Returns
    -------
    GateResult
        Gate evaluation result with display score and persistence payload.
    """
    extracted_score, extracted_coverage, extracted_failed_ids = _extract_match_data(match_or_score)

    raw_score = extracted_score
    coverage = must_have_coverage if must_have_coverage is not None else extracted_coverage
    failed_ids = (
        failed_requirement_ids if failed_requirement_ids is not None else extracted_failed_ids
    )

    coverage = max(0.0, min(1.0, float(coverage)))

    if coverage < threshold:
        display_score = round(min(raw_score, score_cap), decimal_places)
        failed = True
        reason = REASON_MUST_HAVE_BELOW_THRESHOLD
    else:
        display_score = round(raw_score, decimal_places)
        failed = False
        reason = None

    gate_payload = {
        "threshold": round(threshold, 2),
        "coverage": round(coverage, 2),
        "reason": reason,
        "failed_requirement_ids": failed_ids,
    }

    return GateResult(
        raw_score=round(raw_score, decimal_places),
        display_score=display_score,
        failed=failed,
        reason=reason,
        gate_json=gate_payload,
    )
