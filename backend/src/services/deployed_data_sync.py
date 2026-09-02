"""Synchronize versioned, repository-owned catalog data into the application DB."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from src.db.database import AsyncSessionLocal
from src.db.models import JobDescription
from src.services.cv_jd_matching import parse_job_description
from src.services.job_catalog import load_enterprise_job_catalog


def _catalog_jd_values(item: dict[str, Any]) -> dict[str, Any]:
    source_id = str(item["source_id"]).strip()
    skills = [str(skill).strip() for skill in item.get("skills") or [] if str(skill).strip()]
    requirements_text = str(item.get("description") or "").strip() or f"Required skills: {', '.join(skills)}"
    metadata = {
        "source": "data/jds", "source_id": source_id, "skills": skills,
        "job_level": item.get("job_level"), "employment_type": item.get("employment_type"),
        "remote_type": item.get("remote_type"), "source_url": item.get("source_url"),
        "company": item.get("company"), "location": item.get("location"), "domain": item.get("domain"),
    }
    normalized = parse_job_description(
        title=str(item.get("title") or "Untitled position").strip(),
        requirements_text=requirements_text,
        metadata=metadata,
    )
    normalized.update({key: value for key, value in metadata.items() if value is not None})
    return {
        "title": str(item.get("title") or "Untitled position").strip(),
        "company": str(item.get("company") or "Unknown company").strip(),
        "location": str(item.get("location") or "Unknown location").strip(),
        "requirements_text": requirements_text, "normalized_json": normalized,
        "is_system": True, "is_published": True,
    }


async def sync_deployed_job_catalog(
    session_factory: async_sessionmaker[AsyncSession] = AsyncSessionLocal,
    catalog_loader: Callable[[], tuple[dict[str, Any], ...]] = load_enterprise_job_catalog,
) -> dict[str, int]:
    """Upsert ``data/jds`` records without modifying user-created records.

    Entries absent from the current deployment are retained, since deletion could
    invalidate analyses and snapshots referring to them.
    """
    catalog = catalog_loader()
    if not catalog:
        return {"created": 0, "updated": 0, "unchanged": 0}

    async with session_factory() as session:
        system_jds = (await session.scalars(select(JobDescription).where(JobDescription.is_system.is_(True)))).all()
        existing_by_source = {
            str((jd.normalized_json or {}).get("source_id") or "").casefold(): jd
            for jd in system_jds
            if (jd.normalized_json or {}).get("source") == "data/jds"
        }
        result = {"created": 0, "updated": 0, "unchanged": 0}
        for item in catalog:
            values = _catalog_jd_values(item)
            existing = existing_by_source.get(str(item["source_id"]).casefold())
            if existing is None:
                session.add(JobDescription(**values))
                result["created"] += 1
            elif all(getattr(existing, key) == value for key, value in values.items()):
                result["unchanged"] += 1
            else:
                for key, value in values.items():
                    setattr(existing, key, value)
                result["updated"] += 1
        await session.commit()
        return result
