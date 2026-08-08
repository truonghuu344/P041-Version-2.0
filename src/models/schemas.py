from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, EmailStr, Field, ConfigDict


# --- Auth Schemas ---
class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6, description="Mật khẩu tối thiểu 6 ký tự")
    full_name: str = Field(..., min_length=2, description="Họ và tên người dùng")
    role: str = Field(default="student", description="student | counselor | enterprise | admin")


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    password: Optional[str] = None


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
    summary: Optional[str] = ""
    education: List[Dict[str, Any]] = []
    experience: List[Dict[str, Any]] = []
    skills: List[str] = []
    projects: List[Dict[str, Any]] = []


class CVOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    title: str
    file_path: Optional[str] = None
    raw_text: Optional[str] = None
    parsed_json: Optional[Dict[str, Any]] = None
    created_at: datetime


# --- Job Description Schemas ---
class JDCreate(BaseModel):
    title: str = Field(..., min_length=2, description="Tên vị trí công việc")
    company: Optional[str] = None
    location: Optional[str] = None
    requirements_text: str = Field(..., min_length=10, description="Mô tả chi tiết JD")


class JDOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    company: Optional[str] = None
    location: Optional[str] = None
    requirements_text: str
    normalized_json: Optional[Dict[str, Any]] = None
    is_system: bool
    created_at: datetime


# --- Gap Analysis Schemas ---
class GapAnalysisRequest(BaseModel):
    cv_id: str
    jd_id: str


class CVOptimizationSuggestion(BaseModel):
    original_text: str
    suggested_improvement: str
    action_verb: Optional[str] = None
    reason: str


class GapAnalysisResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    cv_id: str
    jd_id: str
    match_score: float
    hard_skills_matching: List[str] = []
    hard_skills_missing: List[str] = []
    soft_skills_gap: List[str] = []
    suggestions: List[CVOptimizationSuggestion] = []
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
    follow_up_question: Optional[str] = None
    is_last_question: bool = False


class AnswerSubmitRequest(BaseModel):
    user_answer: str = Field(..., min_length=2, description="Câu trả lời của sinh viên")


class InterviewReportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    session_id: str
    total_score: float
    star_scores: Dict[str, float]  # Situation, Task, Action, Result
    strengths: List[str] = []
    improvements: List[str] = []
    recommendations: List[str] = []
    created_at: datetime


# --- Legacy / Chat Schemas ---
class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=5000, description="Tin nhắn từ user")


class ChatResponse(BaseModel):
    response: str = Field(..., description="Phản hồi từ agent")
    analysis: str = Field(default="", description="Phân tích nội bộ")
