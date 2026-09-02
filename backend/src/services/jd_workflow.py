"""Shared JD normalization and provenance helpers.

The upload endpoint, Enterprise publisher and Counselor opportunity flow all
use this module so parser output and creator metadata are consistent.
"""

from typing import Any

from src.db.models import User
from src.services.cv_jd_matching import parse_job_description


def normalize_jd_for_creator(
    *,
    title: str,
    requirements_text: str,
    metadata: dict[str, Any] | None,
    creator: User,
    creation_source: str,
) -> dict[str, Any]:
    """Parse a JD with the existing parser and attach immutable provenance."""
    merged_metadata = dict(metadata or {})
    normalized = parse_job_description(
        title=title,
        requirements_text=requirements_text,
        metadata=merged_metadata,
    )
    normalized.update(merged_metadata)
    normalized["creation_source"] = creation_source
    normalized["creator_role"] = creator.role
    normalized["creator_user_id"] = creator.id
    return normalized


def attach_jd_provenance(
    normalized: dict[str, Any] | None,
    *,
    creator: User,
    creation_source: str,
) -> dict[str, Any]:
    """Add the same provenance to async/OCR parser output without reparsing."""
    result = dict(normalized or {})
    result["creation_source"] = creation_source
    result["creator_role"] = creator.role
    result["creator_user_id"] = creator.id
    return result
