import uuid
from datetime import datetime

from pydantic import AliasChoices, Field

from src.backend.db.models import InterviewStatus
from src.backend.models.common import APIModel


class InterviewStartRequest(APIModel):
    cv_id: uuid.UUID
    jd_id: uuid.UUID
    total_questions: int = Field(default=5, ge=5, le=7)


class InterviewStartResponse(APIModel):
    session_id: uuid.UUID
    question_text: str
    question_index: int = Field(default=0, ge=0)
    total_questions: int = Field(ge=5, le=7)
    status: InterviewStatus = InterviewStatus.IN_PROGRESS


class InterviewAnswerRequest(APIModel):
    user_answer: str = Field(min_length=1, max_length=10_000)


class InterviewAnswerResponse(APIModel):
    question_text: str
    question_index: int = Field(ge=0)
    is_last_question: bool = False
    follow_up_question: str | None = None


class InterviewRatingRequest(APIModel):
    rating: int = Field(ge=1, le=5)
    comment: str | None = Field(default=None, max_length=2000)


class STARScores(APIModel):
    situation: float = Field(ge=0, le=100)
    task: float = Field(ge=0, le=100)
    action: float = Field(ge=0, le=100)
    result: float = Field(ge=0, le=100)


class InterviewReportResponse(APIModel):
    id: uuid.UUID
    session_id: uuid.UUID
    total_score: float = Field(
        ge=0,
        le=100,
        validation_alias=AliasChoices("total_score", "overall_score"),
    )
    star_scores: STARScores
    strengths: list[str] = Field(default_factory=list)
    improvements: list[str] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)
    counselor_notes: str | None = None
    disclaimer_text: str | None = None
    created_at: datetime


class InterviewSessionResponse(APIModel):
    id: uuid.UUID
    student_id: uuid.UUID
    cv_id: uuid.UUID = Field(validation_alias=AliasChoices("cv_id", "resume_id"))
    jd_id: uuid.UUID = Field(validation_alias=AliasChoices("jd_id", "job_description_id"))
    total_questions: int
    current_step: int
    status: InterviewStatus
    overall_score: float | None
    csat_score: int | None
    created_at: datetime
