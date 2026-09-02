import pytest
from sqlalchemy import select

from src.db.models import JobDescription
from src.services.deployed_data_sync import sync_deployed_job_catalog


@pytest.mark.asyncio
async def test_deployed_catalog_sync_upserts_changes():
    from tests.conftest import TestingSessionLocal

    catalog = ({"source_id": "JD-TEST-001", "title": "Backend Engineer", "company": "Example Co", "location": "HCM", "description": "Python and PostgreSQL", "skills": ["Python", "PostgreSQL"]},)
    first = await sync_deployed_job_catalog(TestingSessionLocal, lambda: catalog)
    second = await sync_deployed_job_catalog(TestingSessionLocal, lambda: catalog)
    third = await sync_deployed_job_catalog(TestingSessionLocal, lambda: ({**catalog[0], "title": "Senior Backend Engineer"},))

    assert first == {"created": 1, "updated": 0, "unchanged": 0}
    assert second == {"created": 0, "updated": 0, "unchanged": 1}
    assert third == {"created": 0, "updated": 1, "unchanged": 0}
    async with TestingSessionLocal() as session:
        records = (await session.scalars(select(JobDescription))).all()
    assert len(records) == 1
    assert records[0].title == "Senior Backend Engineer"
