"""Validated request and response contracts exposed by the backend API."""

from src.backend.models.analysis import (
    CertificationRecommendation,
    CVSectionRecommendation,
    GapAnalysisRequest,
    GapAnalysisResponse,
    LearningRecommendation,
    PriorityAction,
    ProjectRecommendation,
    ResumeSuggestion,
    SuggestionDecisionRequest,
)
from src.backend.models.auth import (
    AdminUserCreateRequest,
    AdminUserUpdateRequest,
    AuthResponse,
    GoogleAuthRequest,
    LoginRequest,
    RegisterRequest,
    UserResponse,
)
from src.backend.models.common import APIModel, MessageResponse, TimestampedResponse
from src.backend.models.counselor import (
    CounselorConsentRequest,
    CounselorFeedbackKind,
    CounselorFeedbackRequest,
    CounselorFeedbackResponse,
)
from src.backend.models.interview import (
    InterviewAnswerRequest,
    InterviewAnswerResponse,
    InterviewRatingRequest,
    InterviewReportResponse,
    InterviewSessionResponse,
    InterviewStartRequest,
    InterviewStartResponse,
    STARScores,
)
from src.backend.models.job_description import (
    CustomJobDescriptionRequest,
    JobDescriptionResponse,
)
from src.backend.models.resume import (
    CVBulkDeleteRequest,
    CVBulkDeleteResponse,
    CVEntry,
    CVPersonalInfo,
    ManualResumeCreateRequest,
    ResumeResponse,
)

__all__ = [
    "APIModel",
    "AdminUserCreateRequest",
    "AdminUserUpdateRequest",
    "AuthResponse",
    "CVBulkDeleteRequest",
    "CVBulkDeleteResponse",
    "CVEntry",
    "CVPersonalInfo",
    "CVSectionRecommendation",
    "CertificationRecommendation",
    "CounselorConsentRequest",
    "CounselorFeedbackKind",
    "CounselorFeedbackRequest",
    "CounselorFeedbackResponse",
    "CustomJobDescriptionRequest",
    "GapAnalysisRequest",
    "GapAnalysisResponse",
    "GoogleAuthRequest",
    "InterviewAnswerRequest",
    "InterviewAnswerResponse",
    "InterviewRatingRequest",
    "InterviewReportResponse",
    "InterviewSessionResponse",
    "InterviewStartRequest",
    "InterviewStartResponse",
    "JobDescriptionResponse",
    "LearningRecommendation",
    "LoginRequest",
    "ManualResumeCreateRequest",
    "MessageResponse",
    "PriorityAction",
    "ProjectRecommendation",
    "RegisterRequest",
    "ResumeResponse",
    "ResumeSuggestion",
    "STARScores",
    "SuggestionDecisionRequest",
    "TimestampedResponse",
    "UserResponse",
]
