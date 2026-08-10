import uuid

from pydantic import AliasChoices, Field, model_validator

from src.backend.models.common import APIModel, TimestampedResponse


class GapAnalysisRequest(APIModel):
    cv_id: uuid.UUID
    jd_id: uuid.UUID


class PriorityAction(APIModel):
    priority: int = Field(ge=1)
    gap: str
    why_it_matters: str
    action: str


class LearningRecommendation(APIModel):
    skill: str
    learning_goal: str
    topics: list[str] = Field(default_factory=list)
    practice: str


class CertificationRecommendation(APIModel):
    name: str
    provider: str
    level: str
    reason: str
    related_skills: list[str] = Field(default_factory=list)
    verification_note: str


class ProjectRecommendation(APIModel):
    title: str
    objective: str
    skills: list[str] = Field(default_factory=list)
    deliverables: list[str] = Field(default_factory=list)
    cv_bullet_template: str


class CVSectionRecommendation(APIModel):
    section: str
    issue: str
    recommendation: str


class ResumeSuggestion(APIModel):
    original_text: str
    suggested_improvement: str
    reason: str


class GapAnalysisResponse(TimestampedResponse):
    id: uuid.UUID
    cv_id: uuid.UUID = Field(validation_alias=AliasChoices("cv_id", "resume_id"))
    jd_id: uuid.UUID = Field(validation_alias=AliasChoices("jd_id", "job_description_id"))
    match_score: float = Field(ge=0, le=100)
    ats_score: float = Field(ge=0, le=100)
    hard_skills_matching: list[str] = Field(default_factory=list)
    hard_skills_missing: list[str] = Field(default_factory=list)
    executive_summary: str
    priority_actions: list[PriorityAction] = Field(default_factory=list)
    learning_recommendations: list[LearningRecommendation] = Field(default_factory=list)
    certification_recommendations: list[CertificationRecommendation] = Field(default_factory=list)
    project_recommendations: list[ProjectRecommendation] = Field(default_factory=list)
    cv_section_recommendations: list[CVSectionRecommendation] = Field(default_factory=list)
    suggestions: list[ResumeSuggestion] = Field(default_factory=list)
    guardrail_flags: list[str] = Field(default_factory=list)


class SuggestionDecisionRequest(APIModel):
    suggestion_index: int = Field(ge=0)
    accepted: bool
    final_text: str | None = Field(default=None, max_length=10_000)

    @model_validator(mode="after")
    def require_final_text_for_acceptance(self) -> "SuggestionDecisionRequest":
        if self.accepted and not self.final_text:
            raise ValueError("final_text is required when accepting a suggestion")
        if not self.accepted:
            self.final_text = None
        return self
