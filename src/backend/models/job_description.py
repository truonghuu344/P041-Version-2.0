import uuid

from pydantic import Field

from src.backend.db.models import JobDescriptionSource
from src.backend.models.common import APIModel, TimestampedResponse


class CustomJobDescriptionRequest(APIModel):
    title: str = Field(min_length=2, max_length=255)
    company: str | None = Field(default=None, max_length=255)
    location: str | None = Field(default=None, max_length=255)
    requirements_text: str = Field(min_length=20, max_length=100_000)


class JobDescriptionResponse(TimestampedResponse):
    id: uuid.UUID
    enterprise_id: uuid.UUID | None
    title: str
    description_text: str
    required_skills: list[str]
    source_type: JobDescriptionSource
    vector_id: str | None
