"""Public API contracts for evidence-based Top Jobs recommendations."""

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class JobRecommendationRequest(BaseModel):
    """Candidate-owned CV snapshot plus optional deterministic job filters."""

    model_config = ConfigDict(extra="forbid")

    cv_snapshot_id: str = Field(min_length=1, max_length=36)
    role: str | None = Field(default=None, max_length=255)
    location: str | None = Field(default=None, max_length=255)
    location_required: bool = False
    work_mode: str | None = Field(default=None, max_length=40)
    remote_only: bool = False
    job_type: str | None = Field(default=None, max_length=40)
    seniority: str | None = Field(default=None, max_length=40)
    industry: str | None = Field(default=None, max_length=100)


class JobRecommendationItem(BaseModel):
    """One ranked result; evidence is retrieved through match_id, not copied here."""

    model_config = ConfigDict(extra="forbid")

    rank: int = Field(ge=1)
    job_id: str = Field(min_length=1, max_length=64)
    title: str = Field(min_length=1, max_length=500)
    company: str | None = Field(default=None, max_length=255)
    location: str | None = Field(default=None, max_length=255)
    work_mode: str | None = Field(default=None, max_length=40)
    display_fit_score: float = Field(ge=0.0, le=100.0)
    raw_fit_score: float = Field(ge=0.0, le=100.0)
    fit_label: str = Field(min_length=1, max_length=40)
    evidence_confidence: str = Field(min_length=1, max_length=40)
    mandatory_requirement_failed: bool
    required_skills_coverage: float = Field(ge=0.0, le=1.0)
    mandatory_requirements_matched: int = Field(ge=0)
    total_mandatory_requirements: int = Field(ge=0)
    score_breakdown: list[dict[str, Any]] = Field(default_factory=list)
    top_strengths: list[str] = Field(default_factory=list)
    top_gaps: list[str] = Field(default_factory=list)
    match_id: str = Field(min_length=1, max_length=64)


class JobRecommendationRunResponse(BaseModel):
    """Response for a completed, running, or failed Top Jobs recommendation run."""

    model_config = ConfigDict(extra="forbid")

    run_id: str = Field(min_length=1, max_length=36)
    status: Literal["PENDING", "RUNNING", "COMPLETED", "FAILED"]
    items: list[JobRecommendationItem] = Field(default_factory=list)
