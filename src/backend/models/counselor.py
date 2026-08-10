import uuid
from datetime import datetime
from enum import StrEnum

from pydantic import EmailStr, Field

from src.backend.models.common import APIModel


class CounselorFeedbackKind(StrEnum):
    COMMENT = "comment"
    ASSIGNMENT = "assignment"


class CounselorConsentRequest(APIModel):
    counselor_email: EmailStr


class CounselorFeedbackRequest(APIModel):
    content: str = Field(min_length=1, max_length=10_000)
    kind: CounselorFeedbackKind = CounselorFeedbackKind.COMMENT


class CounselorFeedbackResponse(APIModel):
    id: uuid.UUID
    counselor_id: uuid.UUID
    student_id: uuid.UUID
    session_id: uuid.UUID | None
    report_id: uuid.UUID | None
    content: str
    kind: CounselorFeedbackKind
    created_at: datetime
