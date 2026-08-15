"""Deterministic metadata filtering used before Top Jobs retrieval.

Hard constraints remove a job only when the candidate explicitly requires one.
Role, seniority, and industry remain preference signals so semantic retrieval can
still surface related roles (for example Backend Developer and Platform Engineer).
"""

from __future__ import annotations

import re
import unicodedata
from collections.abc import Iterable, Mapping
from copy import deepcopy
from typing import Any

from src.schemas.job_recommendation import JobRecommendationRequest

_ROLE_FAMILIES = (
    {"backend", "platform", "api", "server", "microservice", "infrastructure"},
    {"frontend", "web", "ui", "react", "angular", "vue"},
    {"data", "analytics", "bi", "machine", "ml", "ai"},
    {"devops", "sre", "cloud", "infrastructure", "platform"},
)
_REMOTE_VALUES = {"remote", "fully remote", "work from home", "wfh"}
_UNKNOWN_VALUES = {"", "unknown", "chua xac dinh", "n/a", "na"}


def _normalise(value: Any) -> str:
    text = unicodedata.normalize("NFD", str(value or "").casefold())
    text = "".join(char for char in text if unicodedata.category(char) != "Mn")
    return re.sub(r"\s+", " ", text).strip()


def _tokens(value: Any) -> set[str]:
    return set(re.findall(r"[a-z0-9+#.]{2,}", _normalise(value)))


def _matches_requested_value(job_value: Any, requested: str) -> bool:
    job_text, requested_text = _normalise(job_value), _normalise(requested)
    if job_text in _UNKNOWN_VALUES or not requested_text:
        return False
    return requested_text in job_text or job_text in requested_text


def _is_remote(job: Mapping[str, Any]) -> bool:
    remote_type = _normalise(job.get("remote_type"))
    return remote_type in _REMOTE_VALUES or (
        "remote" in remote_type and "hybrid" not in remote_type
    )


def _role_affinity(role: str | None, job: Mapping[str, Any]) -> float:
    if not role:
        return 0.0
    requested_tokens = _tokens(role)
    job_tokens = _tokens(f"{job.get('title', '')} {job.get('domain', '')}")
    if not requested_tokens or not job_tokens:
        return 0.0
    lexical_overlap = len(requested_tokens & job_tokens) / len(requested_tokens)
    family_bonus = any(
        requested_tokens & family and job_tokens & family for family in _ROLE_FAMILIES
    )
    return min(1.0, lexical_overlap + (0.5 if family_bonus else 0.0))


def _preference_score(job: Mapping[str, Any], filters: JobRecommendationRequest) -> float:
    signals: list[float] = []
    if filters.role:
        signals.append(_role_affinity(filters.role, job))
    if filters.seniority:
        matches_seniority = _matches_requested_value(job.get("job_level"), filters.seniority)
        signals.append(1.0 if matches_seniority else 0.0)
    if filters.industry:
        matches_industry = _matches_requested_value(job.get("domain"), filters.industry)
        signals.append(1.0 if matches_industry else 0.0)
    return round(sum(signals) / len(signals) * 100.0, 2) if signals else 0.0


def apply_filters(
    jobs: Iterable[Mapping[str, Any]], filters: JobRecommendationRequest
) -> list[dict[str, Any]]:
    """Apply explicit hard constraints and annotate survivors with a soft score.

    The caller must invoke this over the catalog *before* BM25/vector candidate
    retrieval. ``metadata_preference_score`` is only a ranking signal; it never
    removes a job for role, seniority, or industry mismatch.
    """
    filtered_jobs: list[dict[str, Any]] = []
    for original_job in jobs:
        job = deepcopy(dict(original_job))
        if filters.location_required and not _matches_requested_value(
            job.get("location"), filters.location or ""
        ):
            continue
        if filters.remote_only and not _is_remote(job):
            continue
        if filters.work_mode and not _matches_requested_value(
            job.get("remote_type"), filters.work_mode
        ):
            continue
        if filters.job_type and not _matches_requested_value(
            job.get("employment_type"), filters.job_type
        ):
            continue
        job["metadata_preference_score"] = _preference_score(job, filters)
        filtered_jobs.append(job)
    return filtered_jobs
