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
    {
        "backend", "platform", "api", "server", "microservice", "infrastructure",
        "fullstack", "node", "nodejs", "python", "java", "spring", "django", "fastapi",
    },
    {"frontend", "web", "ui", "react", "angular", "vue"},
    {"data", "analytics", "bi", "machine", "ml", "ai"},
    {"devops", "sre", "cloud", "infrastructure", "platform"},
)
_REMOTE_VALUES = {"remote", "fully remote", "work from home", "wfh"}
_UNKNOWN_VALUES = {"", "unknown", "chua xac dinh", "n/a", "na"}
_BACKEND_SIGNALS = {
    "node", "nodejs", "express", "nestjs", "api", "fastapi", "database",
    "mongodb", "postgresql", "postgres", "mysql", "sql", "server",
    "backend", "llm", "spring", "springboot", "django", "java", "golang",
    "microservices", "microservice", "rest",
}
_MISMATCH_SIGNALS = {"penetration", "tester", "testing", "qa", "security", "ocr", "computer vision", "training"}
_AI_TITLE_SIGNALS = {"ai", "ml", "machine", "data"}
_PURE_AI_SIGNALS = {
    "tensorflow", "pytorch", "computer vision", "ocr", "model training",
    "training model", "deep learning",
}


def _normalise(value: Any) -> str:
    text = unicodedata.normalize("NFD", str(value or "").casefold())
    text = "".join(char for char in text if unicodedata.category(char) != "Mn")
    text = text.replace("đ", "d").replace("-", " ")
    text = re.sub(r"\bfull\s+stack\b", "fullstack", text)
    text = re.sub(r"\bnode\.?\s*js\b", "nodejs", text)
    return re.sub(r"\s+", " ", text).strip()


def _tokens(value: Any) -> set[str]:
    return set(re.findall(r"[a-z0-9+#.]{2,}", _normalise(value)))


def _matches_requested_value(job_value: Any, requested: str) -> bool:
    job_text, requested_text = _normalise(job_value), _normalise(requested)
    if job_text in _UNKNOWN_VALUES or not requested_text:
        return False
    return requested_text in job_text or job_text in requested_text


def _matches_work_mode(job_value: Any, requested: str) -> bool:
    job_text, requested_text = _normalise(job_value), _normalise(requested)
    if not requested_text:
        return True
    if requested_text in {"remote", "remote only"}:
        return "remote" in job_text and "hybrid" not in job_text
    if requested_text == "hybrid":
        return "hybrid" in job_text
    if requested_text in {"onsite", "on site"}:
        return "on site" in job_text or "onsite" in job_text
    return requested_text in job_text


def _matches_keyword(job: Mapping[str, Any], keyword: str | None) -> bool:
    terms = _tokens(keyword)
    if not terms:
        return True
    haystack = _tokens(
        " ".join(
            [
                str(job.get("title") or ""),
                str(job.get("company") or ""),
                str(job.get("domain") or ""),
                str(job.get("location") or ""),
                str(job.get("description") or ""),
                *map(str, job.get("skills") or []),
            ]
        )
    )
    return terms.issubset(haystack)


def _is_remote(job: Mapping[str, Any]) -> bool:
    remote_type = _normalise(job.get("remote_type"))
    return remote_type in _REMOTE_VALUES or (
        "remote" in remote_type and "hybrid" not in remote_type
    )


def _role_affinity(role: str | None, job: Mapping[str, Any]) -> float:
    if not role:
        return 0.0
    requested_tokens = _tokens(role)
    # Role relevance is intentionally based on the advertised role/domain,
    # not an incidental skill. A Penetration Tester using Python is still not
    # a Backend Developer role.
    job_tokens = _tokens(f"{job.get('title', '')} {job.get('domain', '')}")
    if not requested_tokens or not job_tokens:
        return 0.0
    lexical_overlap = len(requested_tokens & job_tokens) / len(requested_tokens)
    family_bonus = any(
        requested_tokens & family and job_tokens & family for family in _ROLE_FAMILIES
    )
    return min(1.0, lexical_overlap + (0.5 if family_bonus else 0.0))


def _role_decision(role: str | None, job: Mapping[str, Any]) -> tuple[bool, str, str]:
    if not role:
        return True, "primary", "Không có role mục tiêu nên không loại theo role."
    text = _normalise(" ".join([str(job.get("title") or ""), str(job.get("description") or ""), *map(str, job.get("skills") or [])]))
    title = _normalise(job.get("title"))
    tokens = set(re.findall(r"[a-z0-9+#.]{2,}", text))
    title_tokens = set(re.findall(r"[a-z0-9+#.]{2,}", title))
    backend_signals = {signal for signal in _BACKEND_SIGNALS if signal in tokens}
    if any(signal in title for signal in ("penetration", "tester", "testing", "qa", "security")):
        return False, "mismatch", "JD thiên QA/Security/CV-ML thuần, không phải Backend."
    is_ai_title = bool(_AI_TITLE_SIGNALS & title_tokens) or any(
        signal in title for signal in ("computer vision", "ocr", "machine learning", "deep learning")
    )
    is_pure_ai = any(signal in text for signal in _PURE_AI_SIGNALS)
    if (is_ai_title or is_pure_ai) and not backend_signals:
        return False, "mismatch", "JD AI/ML thuần không có tín hiệu xây dựng backend."
    if is_ai_title and backend_signals:
        return True, "adjacent", "JD AI application có backend/API; phù hợp hướng phụ so với Backend/Fullstack."
    if backend_signals:
        return True, "primary", "Requirement/skills có tín hiệu Backend: " + ", ".join(sorted(backend_signals)) + "."
    if any(signal in text for signal in _MISMATCH_SIGNALS):
        return False, "mismatch", "JD thiên QA/Security/CV-ML thuần, không phải Backend."
    affinity = _role_affinity(role, job)
    if affinity >= 0.5:
        return True, "primary", "Title/domain thuộc nhóm Backend hoặc Fullstack liên quan."
    return False, "mismatch", "Không có tín hiệu Backend đủ rõ trong title, skills hoặc requirement."


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
        if not _matches_keyword(job, filters.keyword):
            continue
        if filters.role_required and _role_affinity(filters.role, job) <= 0:
            continue
        if filters.location_required and not _matches_requested_value(
            job.get("location"), filters.location or ""
        ):
            continue
        if filters.remote_only and not _is_remote(job):
            continue
        if filters.work_mode and not _matches_work_mode(
            job.get("remote_type"), filters.work_mode
        ):
            continue
        if filters.job_type and not _matches_requested_value(
            job.get("employment_type"), filters.job_type
        ):
            continue
        role_affinity = _role_affinity(filters.role, job)
        role_relevant, role_track, role_reason = _role_decision(filters.role, job)
        job["role_affinity_score"] = round(role_affinity * 100.0, 2)
        job["role_relevant"] = role_relevant
        job["role_track"] = role_track
        job["role_reason"] = role_reason
        job["metadata_preference_score"] = _preference_score(job, filters)
        filtered_jobs.append(job)
    return filtered_jobs
