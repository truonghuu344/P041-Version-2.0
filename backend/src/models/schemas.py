from datetime import datetime
from typing import Any, Literal

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


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    email: EmailStr
    otp: str = Field(..., pattern=r"^\d{6}$", description="Mã OTP gồm 6 chữ số")
    new_password: str = Field(..., min_length=8, max_length=72)


class GoogleAuthRequest(BaseModel):
    credential: str = Field(..., min_length=20, description="Google Identity Services ID token")
    role: Literal["student", "counselor", "enterprise"] = "student"


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
    is_published: bool = False
    created_at: datetime


class JobCatalogItem(BaseModel):
    source_id: str
    title: str
    company: str
    location: str
    job_level: str
    employment_type: str
    remote_type: str
    domain: str
    skills: list[str] = Field(default_factory=list)
    description: str
    source_url: str | None = None
    match_score: float | None = None
    matched_skills: list[str] = Field(default_factory=list)
    missing_skills: list[str] = Field(default_factory=list)
    retrieval_score: float | None = None


class JobCatalogResponse(BaseModel):
    jobs: list[JobCatalogItem]
    total: int
    returned: int
    matched_by_cv: bool = False
    retrieval_mode: str = "catalog"


class JobRAGStatus(BaseModel):
    enabled: bool
    available: bool
    collection: str
    points_count: int
    embedding_model: str
    detail: str


class JobRAGSyncResponse(BaseModel):
    indexed: int
    unchanged: int
    deleted: int
    total: int
    collection: str
    embedding_provider: str


# --- Gap Analysis Schemas ---
class GapAnalysisRequest(BaseModel):
    cv_id: str
    jd_id: str


class CVOptimizationSuggestion(BaseModel):
    block_id: str | None = None
    section: str | None = None
    original_text: str
    suggested_improvement: str
    action_verb: str | None = None
    reason: str
    jd_alignment: list[str] = Field(default_factory=list)
    evidence: list[str] = Field(default_factory=list)
    fact_check_status: str = "supported_rephrase"
    requires_confirmation: bool = False
    risk_flags: list[str] = Field(default_factory=list)


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


class RequirementEvidenceSource(BaseModel):
    section: str
    quote: str
    source_id: str
    evidence_id: str | None = None
    requirement_id: str | None = None
    chunk_id: str | None = None
    text: str | None = None
    source_page: int | None = None
    source_section: str | None = None
    semantic_score: float | None = None
    semantic_rank: int | None = None
    bm25_score: float | None = None
    bm25_rank: int | None = None
    fusion_score: float | None = None
    fusion_rank: int | None = None


class RequirementEvidenceItem(BaseModel):
    requirement_id: str
    requirement: str
    requirement_type: str
    importance: float
    status: Literal["matched", "partial", "missing", "unknown"]
    evidence_strength: str
    evidence: list[RequirementEvidenceSource] = []
    reason: str
    confidence: float
    score: float
    evaluation_status: Literal["SUPPORTED", "PARTIALLY_SUPPORTED", "NOT_FOUND", "CONFLICTING", "UNCERTAIN"] | None = (
        None
    )
    match_classification: (
        Literal["EXACT_MATCH", "NORMALIZED_MATCH", "SEMANTIC_MATCH", "PARTIAL_MATCH", "NOT_FOUND"] | None
    ) = None


class CriterionEvaluationOut(BaseModel):
    criterion_id: str
    raw_score: float
    weight: float
    weighted_score: float
    status: str
    reason: str
    requirement_ids: list[str] = []
    evidence_ids: list[str] = []


class GapAnalysisResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    cv_id: str
    jd_id: str
    cv_snapshot_id: str | None = None
    jd_snapshot_id: str | None = None
    pipeline_version: str = "1.0"
    match_score: float
    final_score: float = 0.0
    rating: str = "POOR"
    trace_id: str = ""
    match_id: str = ""
    candidate_id: str = ""
    document_id: str = ""
    status: str = "COMPLETED"
    mandatory_requirement_failed: bool = False
    criteria: list[CriterionEvaluationOut] = []
    requirements: dict[str, list[dict[str, Any]]] = {}
    evidence: list[dict[str, Any]] = []
    retrieval_results: list[dict[str, Any]] = []
    cv_chunks: list[dict[str, Any]] = []
    warnings: list[str] = []
    versions: dict[str, str] = {}
    processing_trace: list[dict[str, Any]] = []
    structured_cv: dict[str, Any] = {}
    structured_jd: dict[str, Any] = {}
    raw_match_score: float = 0.0
    match_level: str = "partial_match"
    confidence_score: float = 0.0
    confidence_level: str = "low"
    must_have_coverage: float = 0.0
    must_have_gate: dict[str, Any] = {}
    hard_skills_matching: list[str] = []
    hard_skills_partial: list[str] = []
    hard_skills_missing: list[str] = []
    soft_skills_gap: list[str] = []
    unknown_requirements: list[str] = []
    requirement_evidence: list[RequirementEvidenceItem] = []
    strengths: list[str] = []
    risks: list[str] = []
    suggestions: list[CVOptimizationSuggestion] = []
    executive_summary: str = ""
    priority_actions: list[GapPriorityAction] = []
    learning_recommendations: list[LearningRecommendation] = []
    certification_recommendations: list[CertificationRecommendation] = []
    project_recommendations: list[ProjectRecommendation] = []
    cv_section_recommendations: list[CVSectionRecommendation] = []
    score_breakdown: dict[str, float] = {}
    integrity_guardrail: str = "passed"
    created_at: datetime


class ResumeOptimizationRequest(BaseModel):
    language: Literal["vi", "en"] = "vi"
    optimization_mode: Literal["conservative", "balanced", "aggressive"] = "balanced"


class ResumeOptimizationChange(BaseModel):
    block_id: str
    section: str
    original: str
    optimized: str
    reason: str
    jd_alignment: list[str] = Field(default_factory=list)
    evidence: list[str] = Field(default_factory=list)
    requires_confirmation: bool = False
    risk_flags: list[str] = Field(default_factory=list)


class ResumeFactCheckClaim(BaseModel):
    claim: str
    status: Literal["supported", "supported_rephrase", "reasonable_inference", "unsupported"]
    evidence: str
    confidence: float = Field(ge=0.0, le=1.0)


class MissingSkillRecommendation(BaseModel):
    skill: str
    reason: str
    recommended_action: str


class ResumeOptimizationResponse(BaseModel):
    status: Literal["completed"] = "completed"
    target_job_title: str
    target_role: str
    summary: dict[str, Any]
    jd_analysis: dict[str, Any]
    resume_analysis: dict[str, Any]
    match_analysis: dict[str, float]
    requirements: list[dict[str, Any]] = Field(default_factory=list)
    strengths: list[str] = Field(default_factory=list)
    gaps: dict[str, list[str]]
    optimization_plan: dict[str, list[str]]
    optimized_resume: dict[str, Any]
    changes: list[ResumeOptimizationChange] = Field(default_factory=list)
    patches: list[dict[str, Any]] = Field(default_factory=list)
    duplicate_candidates: list[dict[str, Any]] = Field(default_factory=list)
    confirmation_questions: list[str] = Field(default_factory=list)
    validation: dict[str, bool]
    fact_check: dict[str, Any]
    missing_skills_recommendations: list[MissingSkillRecommendation] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    optimization_mode: Literal["conservative", "balanced", "aggressive"] = "balanced"
    provider: str = "deterministic_guarded"


class ManualCVCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=255)
    template_name: Literal["classic", "modern", "compact"] = "classic"
    personal_info: dict[str, str] = Field(default_factory=dict)
    summary: str = Field(default="", max_length=3000)
    education: list[dict[str, Any]] = Field(default_factory=list, max_length=20)
    experience: list[dict[str, Any]] = Field(default_factory=list, max_length=30)
    skills: list[str] = Field(default_factory=list, max_length=100)
    projects: list[dict[str, Any]] = Field(default_factory=list, max_length=30)


class CVOptimizationDecisionRequest(BaseModel):
    suggestion_index: int = Field(..., ge=0, le=100)
    accepted: bool
    final_text: str | None = Field(default=None, max_length=5000)


class CVOptimizationDecisionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    analysis_id: str
    suggestion_index: int
    accepted: bool
    final_text: str | None = None
    updated_at: datetime


class CVBulkDeleteRequest(BaseModel):
    cv_ids: list[str] = Field(..., min_length=1, max_length=100)


class CVBulkDeleteResponse(BaseModel):
    deleted_ids: list[str]
    deleted_count: int


# --- Mock Interview Schemas ---
class InterviewStartRequest(BaseModel):
    cv_id: str
    jd_id: str
    total_questions: int = Field(default=5, ge=3, le=10)
    match_id: str | None = None
    language: Literal["vi", "en", "bilingual"] = "vi"
    mode: Literal["text", "voice"] = "text"


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


class AssistantChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., min_length=1, max_length=4000)


class AssistantOperationRequest(BaseModel):
    action_type: Literal["run_gap_analysis", "start_interview"]
    cv_id: str = Field(..., min_length=1, max_length=36)
    jd_id: str = Field(..., min_length=1, max_length=36)
    confirmed: bool = False
    total_questions: int = Field(default=5, ge=3, le=10)


class AssistantChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    history: list[AssistantChatMessage] = Field(default_factory=list, max_length=12)
    current_page: str = Field(default="dashboard", max_length=50)
    timezone: str | None = Field(default=None, max_length=64)
    conversation_id: str | None = Field(default=None, max_length=36)
    operation: AssistantOperationRequest | None = None


class AssistantResourceOption(BaseModel):
    id: str
    label: str
    meta: str = ""


class AssistantSource(BaseModel):
    source_type: Literal["cv", "jd", "analysis", "system"]
    source_id: str
    title: str
    quote: str = ""
    updated_at: datetime | None = None
    provenance: Literal["user_data", "verified_analysis", "system_data", "recommendation"]


class AssistantAction(BaseModel):
    label: str
    page: str | None = None
    action_type: Literal["navigate", "run_gap_analysis", "start_interview", "evidence"] = "navigate"
    requires_confirmation: bool = False
    payload: dict[str, Any] = Field(default_factory=dict)
    options: dict[str, list[AssistantResourceOption]] = Field(default_factory=dict)
    sources: list[AssistantSource] = Field(default_factory=list)


class AssistantChatResponse(BaseModel):
    response: str
    provider: str = "google_gemini"
    model: str
    llm_succeeded: bool
    suggested_actions: list[AssistantAction] = Field(default_factory=list)
    conversation_id: str
    user_message_id: str
    assistant_message_id: str


class AssistantStatusResponse(BaseModel):
    agent_name: str
    provider: str
    model: str
    configured: bool
    weather_configured: bool = False


class ConversationMessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    role: Literal["user", "assistant"]
    content: str
    provider: str | None = None
    model: str | None = None
    llm_succeeded: bool | None = None
    suggested_actions: list[AssistantAction] = Field(default_factory=list)
    created_at: datetime


class InterviewSessionSummaryOut(BaseModel):
    id: str
    cv_id: str
    jd_id: str
    cv_snapshot_id: str | None = None
    jd_snapshot_id: str | None = None
    match_id: str | None = None
    language: str = "vi"
    mode: str = "text"
    status: str
    total_questions: int
    current_question_index: int
    created_at: datetime
    completed_at: datetime | None = None
    total_score: float | None = None


class InterviewFeedbackCreate(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    comment: str | None = Field(default=None, max_length=1000)


class InterviewFeedbackOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    session_id: str
    rating: int
    comment: str | None = None
    created_at: datetime


# --- Counselor / Human-in-the-loop Schemas ---
class CounselorConsentCreate(BaseModel):
    counselor_email: EmailStr


class CounselorAssignmentOut(BaseModel):
    id: str
    counselor_id: str
    counselor_name: str
    counselor_email: str
    student_id: str
    student_name: str
    student_email: str
    status: str
    consented_at: datetime
    revoked_at: datetime | None = None


class CounselorFeedbackCreate(BaseModel):
    content: str = Field(..., min_length=3, max_length=4000)
    kind: Literal["comment", "task", "star_note"] = "comment"
    interview_report_id: str | None = None


class CounselorFeedbackOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    student_id: str
    counselor_id: str
    interview_report_id: str | None = None
    kind: str
    content: str
    created_at: datetime


class CounselorStudentOverview(BaseModel):
    student: UserOut
    cv_count: int
    analysis_count: int
    interview_count: int
    completed_interview_count: int
    average_star_score: float
    first_interview_score: float | None = None
    latest_interview_score: float | None = None
    interview_score_delta: float | None = None
    average_csat: float | None = None
    recent_feedback: list[CounselorFeedbackOut] = Field(default_factory=list)
    cvs: list[CVOut] = Field(default_factory=list)
    analyses: list[GapAnalysisResponse] = Field(default_factory=list)
    interviews: list[InterviewSessionSummaryOut] = Field(default_factory=list)


# --- Enterprise Schemas ---
class JobApplicationCreate(BaseModel):
    jd_id: str
    cv_id: str
    analysis_id: str | None = None


class JobApplicationDecision(BaseModel):
    status: Literal["submitted", "shortlisted", "interview", "rejected"]


class JobApplicationOut(BaseModel):
    id: str
    jd_id: str
    jd_title: str
    student_id: str
    candidate_name: str
    candidate_email: str
    cv_id: str
    analysis_id: str | None = None
    match_score: float
    status: str
    shared_at: datetime
    decided_at: datetime | None = None


# --- Operational metrics ---
class ProductMetricsOut(BaseModel):
    active_users: int
    total_users: int
    adoption_rate: float
    adoption_target: float = 60.0
    adoption_target_met: bool = False
    average_csat: float | None = None
    csat_target: float = 4.0
    csat_target_met: bool | None = None
    completed_interviews: int
    average_interview_score: float | None = None
    latency_by_event_ms: dict[str, float] = Field(default_factory=dict)


class ConversationSummaryOut(BaseModel):
    id: str
    title: str
    message_count: int
    last_message_preview: str
    created_at: datetime
    updated_at: datetime


class ConversationDetailOut(BaseModel):
    id: str
    title: str
    messages: list[ConversationMessageOut]
    created_at: datetime
    updated_at: datetime


class AdminAILogOut(BaseModel):
    id: str
    user_id: str
    user_email: str
    user_full_name: str
    conversation_id: str | None = None
    prompt: str
    response: str
    provider: str
    model: str
    llm_succeeded: bool
    error_code: str | None = None
    current_page: str | None = None
    latency_ms: int
    tools_used: list[str] = Field(default_factory=list)
    created_at: datetime


class AdminAILogListOut(BaseModel):
    items: list[AdminAILogOut]
    total: int
    limit: int
    offset: int


class AdminAILogStatsOut(BaseModel):
    total_requests: int
    successful_requests: int
    failed_requests: int
    unique_users: int


# --- Compatibility & Workflow Request Schemas ---
class CVAnalyzeRequest(BaseModel):
    cv_id: str = Field(..., min_length=1, description="ID của CV đã upload")
    jd_text: str = Field(..., min_length=1, description="Nội dung Job Description")


class SuggestionDecisionRequest(BaseModel):
    final_text: str | None = None


class InterviewAnswerRequest(BaseModel):
    answer: str | None = None
    user_answer: str | None = None

    def get_text(self) -> str:
        if self.answer is not None:
            return self.answer
        if self.user_answer is not None:
            return self.user_answer
        return ""
