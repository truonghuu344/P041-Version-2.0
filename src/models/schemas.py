from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field


# --- Auth Schemas ---
class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6, description="Mật khẩu tối thiểu 6 ký tự")
    full_name: str = Field(..., min_length=2, description="Họ và tên người dùng")
    role: str = Field(default="student", description="student | counselor | enterprise")


class UserUpdate(BaseModel):
    full_name: str | None = None
    email: str | None = None
    role: str | None = None
    password: str | None = None


class UserLogin(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    full_name: str
    role: str
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# --- CV Schemas ---
class CVParsedData(BaseModel):
    summary: str | None = ""
    education: list[dict[str, Any]] = []
    experience: list[dict[str, Any]] = []
    skills: list[str] = []
    projects: list[dict[str, Any]] = []


class CVOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    title: str
    file_path: str | None = None
    raw_text: str | None = None
    parsed_json: dict[str, Any] | None = None
    created_at: datetime


# --- Job Description Schemas ---
class JDCreate(BaseModel):
    title: str = Field(..., min_length=2, description="Tên vị trí công việc")
    company: str | None = None
    location: str | None = None
    requirements_text: str = Field(..., min_length=10, description="Mô tả chi tiết JD")


class JDOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    company: str | None = None
    location: str | None = None
    requirements_text: str
    normalized_json: dict[str, Any] | None = None
    is_system: bool
    created_at: datetime


# --- Gap Analysis Schemas ---
class GapAnalysisRequest(BaseModel):
    cv_id: str
    jd_id: str


class CVOptimizationSuggestion(BaseModel):
    original_text: str
    suggested_improvement: str
    action_verb: str | None = None
    reason: str


class GapPriorityAction(BaseModel):
    priority: int
    gap: str
    why_it_matters: str
    action: str


class LearningRecommendation(BaseModel):
    skill: str
    learning_goal: str
    topics: list[str] = []
    practice: str


class CertificationRecommendation(BaseModel):
    name: str
    provider: str
    related_skills: list[str] = []
    level: str
    reason: str
    verification_note: str


class ProjectRecommendation(BaseModel):
    title: str
    objective: str
    skills: list[str] = []
    deliverables: list[str] = []
    cv_bullet_template: str
    status: str = "recommended_not_completed"


class CVSectionRecommendation(BaseModel):
    section: str
    issue: str
    recommendation: str


class GapAnalysisResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    cv_id: str
    jd_id: str
    match_score: float
    hard_skills_matching: list[str] = []
    hard_skills_missing: list[str] = []
    soft_skills_gap: list[str] = []
    suggestions: list[CVOptimizationSuggestion] = []
    executive_summary: str = ""
    priority_actions: list[GapPriorityAction] = []
    learning_recommendations: list[LearningRecommendation] = []
    certification_recommendations: list[CertificationRecommendation] = []
    project_recommendations: list[ProjectRecommendation] = []
    cv_section_recommendations: list[CVSectionRecommendation] = []
    score_breakdown: dict[str, float] = {}
    created_at: datetime


# --- Mock Interview Schemas ---
class InterviewStartRequest(BaseModel):
    cv_id: str
    jd_id: str
    total_questions: int = Field(default=5, ge=3, le=10)


class InterviewQuestionOut(BaseModel):
    session_id: str
    question_index: int
    question_text: str
    follow_up_question: str | None = None
    is_last_question: bool = False


class AnswerSubmitRequest(BaseModel):
    user_answer: str = Field(..., min_length=2, description="Câu trả lời của sinh viên")


class InterviewReportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    session_id: str
    total_score: float
    star_scores: dict[str, float]  # Situation, Task, Action, Result
    strengths: list[str] = []
    improvements: list[str] = []
    recommendations: list[str] = []
    created_at: datetime


# --- Legacy / Chat Schemas ---
class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=5000, description="Tin nhắn từ user")


class ChatResponse(BaseModel):
    response: str = Field(..., description="Phản hồi từ agent")
    analysis: str = Field(default="", description="Phân tích nội bộ")
