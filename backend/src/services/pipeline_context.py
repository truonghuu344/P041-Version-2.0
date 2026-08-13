"""Versioned, reusable source context for the three career workflows."""

from __future__ import annotations

import hashlib
import json
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import CV, CVSnapshot, JDSnapshot, JobDescription

PIPELINE_VERSION = "2.0"


def _fingerprint(value: Any) -> str:
    encoded = json.dumps(value, ensure_ascii=False, sort_keys=True, default=str).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _pages(raw_text: str) -> list[dict[str, Any]]:
    """Preserve source pages when the parser left explicit page markers."""
    import re

    markers = list(re.finditer(r"(?m)^\[PAGE\s+(\d+)\]\s*$", raw_text))
    if not markers:
        return [{"page_number": 1, "text": raw_text}] if raw_text else []
    return [
        {
            "page_number": int(marker.group(1)),
            "text": raw_text[marker.end() : markers[index + 1].start() if index + 1 < len(markers) else len(raw_text)].strip(),
        }
        for index, marker in enumerate(markers)
    ]


async def get_or_create_cv_snapshot(db: AsyncSession, cv: CV) -> CVSnapshot:
    profile = dict(cv.parsed_json or {})
    source_hash = _fingerprint({"raw_text": cv.raw_text or "", "profile": profile})
    existing = await db.scalar(
        select(CVSnapshot)
        .where(CVSnapshot.cv_id == cv.id, CVSnapshot.source_hash == source_hash)
        .order_by(CVSnapshot.version_number.desc())
        .limit(1)
    )
    if existing:
        return existing
    version = int(await db.scalar(select(func.max(CVSnapshot.version_number)).where(CVSnapshot.cv_id == cv.id)) or 0) + 1
    snapshot = CVSnapshot(
        cv_id=cv.id,
        user_id=cv.user_id,
        version_number=version,
        source_hash=source_hash,
        raw_text=cv.raw_text or "",
        profile_json=profile,
        pages_json=_pages(cv.raw_text or ""),
        source_language=str(profile.get("language") or "vi"),
    )
    db.add(snapshot)
    await db.flush()
    return snapshot


async def get_or_create_jd_snapshot(db: AsyncSession, jd: JobDescription) -> JDSnapshot:
    normalized = dict(jd.normalized_json or {})
    requirements = normalized.get("requirements") or normalized
    source_hash = _fingerprint({"requirements_text": jd.requirements_text, "normalized": normalized})
    existing = await db.scalar(
        select(JDSnapshot)
        .where(JDSnapshot.jd_id == jd.id, JDSnapshot.source_hash == source_hash)
        .order_by(JDSnapshot.version_number.desc())
        .limit(1)
    )
    if existing:
        return existing
    version = int(await db.scalar(select(func.max(JDSnapshot.version_number)).where(JDSnapshot.jd_id == jd.id)) or 0) + 1
    snapshot = JDSnapshot(
        jd_id=jd.id,
        version_number=version,
        source_hash=source_hash,
        raw_text=jd.requirements_text or "",
        requirements_json={"requirements": requirements, "normalized": normalized},
        pages_json=_pages(jd.requirements_text or ""),
        source_language=str(normalized.get("language") or "vi"),
    )
    db.add(snapshot)
    await db.flush()
    return snapshot
