import uuid
from typing import Any

from pydantic import EmailStr, Field, field_validator

from src.backend.models.common import APIModel, TimestampedResponse


class CVPersonalInfo(APIModel):
    full_name: str = Field(min_length=2, max_length=255)
    email: EmailStr
    phone: str | None = Field(default=None, max_length=32)


class CVEntry(APIModel):
    description: str = Field(min_length=1, max_length=5000)


class ManualResumeCreateRequest(APIModel):
    title: str = Field(min_length=1, max_length=255)
    template_name: str = Field(default="classic", min_length=1, max_length=100)
    personal_info: CVPersonalInfo
    summary: str | None = Field(default=None, max_length=5000)
    skills: list[str] = Field(default_factory=list, max_length=100)
    education: list[CVEntry] = Field(default_factory=list, max_length=50)
    experience: list[CVEntry] = Field(default_factory=list, max_length=100)
    projects: list[CVEntry] = Field(default_factory=list, max_length=100)

    @field_validator("skills")
    @classmethod
    def normalize_skills(cls, skills: list[str]) -> list[str]:
        normalized = list(dict.fromkeys(skill.strip() for skill in skills if skill.strip()))
        return normalized


class ResumeResponse(TimestampedResponse):
    id: uuid.UUID
    student_id: uuid.UUID
    title: str
    template_id: str | None
    raw_file_path: str | None
    parsed_content: dict[str, Any]
    accepted_suggestions: list[dict[str, Any]]
    missing_information: list[str]
    is_verified_real: bool


class CVBulkDeleteRequest(APIModel):
    cv_ids: list[uuid.UUID] = Field(min_length=1, max_length=100)

    @field_validator("cv_ids")
    @classmethod
    def remove_duplicate_ids(cls, cv_ids: list[uuid.UUID]) -> list[uuid.UUID]:
        return list(dict.fromkeys(cv_ids))


class CVBulkDeleteResponse(APIModel):
    deleted_ids: list[uuid.UUID]
    deleted_count: int = Field(ge=0)
