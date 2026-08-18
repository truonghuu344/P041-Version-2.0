"""Build the PII-free CV representation used for Top Jobs retrieval only."""

from __future__ import annotations

import re
from collections.abc import Iterable, Mapping
from typing import Any

_EMAIL_PATTERN = re.compile(r"\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b")
_PHONE_PATTERN = re.compile(r"(?<!\w)(?:\+?\d[\d .()-]{7,}\d)(?!\w)")
_ADDRESS_LABEL_PATTERN = re.compile(
    r"\b(?:address|dia\s*chi)\s*:\s*[^\n;|]+", re.IGNORECASE
)


def _safe_text(value: Any) -> str:
    """Redact incidental contact values; source selection already excludes PII fields."""
    text = re.sub(r"\s+", " ", str(value or "")).strip()
    text = _EMAIL_PATTERN.sub("", text)
    text = _PHONE_PATTERN.sub("", text)
    text = _ADDRESS_LABEL_PATTERN.sub("", text)
    return re.sub(r"\s+", " ", text).strip(" ,;|-")


def _strings(value: Any) -> list[str]:
    if isinstance(value, str):
        return [_safe_text(value)] if _safe_text(value) else []
    if isinstance(value, Iterable) and not isinstance(value, (bytes, Mapping)):
        return [text for item in value if (text := _safe_text(item))]
    return []


def _first(profile: Mapping[str, Any], *keys: str) -> str:
    for key in keys:
        value = _safe_text(profile.get(key))
        if value:
            return value
    return ""


def _record_text(records: Any, *, keys: tuple[str, ...], limit: int = 5) -> list[str]:
    if not isinstance(records, list):
        return []
    result: list[str] = []
    for record in records:
        if not isinstance(record, Mapping):
            continue
        parts = [_safe_text(record.get(key)) for key in keys]
        text = " — ".join(part for part in parts if part)
        if text:
            result.append(text)
        if len(result) == limit:
            break
    return result


def _profile_from_snapshot(cv_snapshot: Any) -> Mapping[str, Any]:
    """Accept a CVSnapshot ORM object or a profile mapping for unit-testable use."""
    if isinstance(cv_snapshot, Mapping):
        nested_profile = cv_snapshot.get("profile_json")
        return nested_profile if isinstance(nested_profile, Mapping) else cv_snapshot
    profile = getattr(cv_snapshot, "profile_json", None)
    return profile if isinstance(profile, Mapping) else {}


def build_cv_retrieval_text(cv_snapshot: Any) -> str:
    """Create a compact, PII-free semantic/lexical retrieval document.

    This intentionally never reads ``raw_text``. It selects only career fields
    from ``profile_json`` and should be the sole CV input to Top Jobs BM25/vector
    retrieval, keeping name, contact, address, gender, and photo out of ranking.
    """
    profile = _profile_from_snapshot(cv_snapshot)
    role = _first(profile, "target_role", "desired_role", "role", "headline", "title")
    skills = _strings(profile.get("skills") or profile.get("technical_skills"))[:30]
    domain = _first(profile, "domain", "industry", "specialization", "career_field")
    experience = _record_text(
        profile.get("experience"),
        keys=("role", "title", "duration", "years", "description", "highlights"),
    )
    projects = _record_text(
        profile.get("projects"),
        keys=("name", "title", "technologies", "tech_stack", "description"),
    )

    sections: list[tuple[str, list[str]]] = []
    if role:
        sections.append(("Role", [role]))
    if skills:
        sections.append(("Skills", [", ".join(dict.fromkeys(skills))]))
    if experience:
        sections.append(("Experience", experience))
    if projects:
        sections.append(("Projects", projects))
    if domain:
        sections.append(("Domain", [domain]))

    return "\n\n".join(f"{heading}:\n" + "\n".join(items) for heading, items in sections)
