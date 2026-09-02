"""Public API contracts for evidence-based Top Jobs recommendations."""

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class JobRecommendationRequest(BaseModel):
    """Candidate-owned CV snapshot plus optional deterministic job filters."""

    model_config = ConfigDict(extra="forbid")

    cv_snapshot_id: str = Field(min_length=1, max_length=36)
    keyword: str | None = Field(default=None, max_length=120)
    role: str | None = Field(default=None, max_length=255)
    role_required: bool = False
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
    source_url: str | None = Field(default=None, max_length=2048)
    display_fit_score: float = Field(ge=0.0, le=100.0)
    raw_fit_score: float = Field(ge=0.0, le=100.0)
    fit_label: str = Field(min_length=1, max_length=40)
    evidence_confidence: str = Field(min_length=1, max_length=40)
    mandatory_requirement_failed: bool
    role_relevant: bool = False
    role_track: Literal["primary", "adjacent", "mismatch"] = "mismatch"
    role_reason: str = Field(default="", max_length=500)
    application_ready: bool = False
    retrieval_rank: int = Field(default=0, ge=0)
    role_affinity_score: float = Field(default=0.0, ge=0.0, le=100.0)
    ready_candidate_boost: float = Field(default=0.0, ge=0.0, le=1.0)
    # These values were added after the initial response contract.  Defaults
    # preserve compatibility for callers that only need the ranked result.
    required_skills_coverage: float = Field(default=0.0, ge=0.0, le=1.0)
    mandatory_requirements_matched: int = Field(default=0, ge=0)
    total_mandatory_requirements: int = Field(default=0, ge=0)
    score_breakdown: list[dict[str, Any]] = Field(default_factory=list)
    top_strengths: list[str] = Field(default_factory=list)
    top_gaps: list[str] = Field(default_factory=list)
    # Explanation is deliberately structured so the UI can show CV evidence,
    # mandatory gaps, and rubric reasoning without inventing fallback content.
    user_explanation: dict[str, Any] = Field(default_factory=dict)
    match_id: str = Field(min_length=1, max_length=64)
    # Real hiring metadata fields from backend catalog/DB
    seniority: str | None = Field(default=None, max_length=100)
    employment_type: str | None = Field(default=None, max_length=100)
    salary: str | None = Field(default=None, max_length=200)
    openings: int | None = Field(default=None, ge=1)
    deadline: str | None = Field(default=None, max_length=100)
    posted_at: str | None = Field(default=None, max_length=100)
    applicant_count: int | None = Field(default=None, ge=0)
    company_logo: str | None = Field(default=None, max_length=2048)
    source_name: str | None = Field(default=None, max_length=100)
    required_skills: list[str] = Field(default_factory=list)
    preferred_skills: list[str] = Field(default_factory=list)
    skills: list[str] = Field(default_factory=list)


class JobRecommendationRunResponse(BaseModel):
    """Response for a completed, running, or failed Top Jobs recommendation run."""

    model_config = ConfigDict(extra="forbid")

    run_id: str = Field(min_length=1, max_length=36)
    status: Literal["PENDING", "RUNNING", "COMPLETED", "FAILED"]
    items: list[JobRecommendationItem] = Field(default_factory=list)
    cache_hit: bool = False
    diagnostic: dict[str, Any] = Field(default_factory=dict)
