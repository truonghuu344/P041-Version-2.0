from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

VariantMode = Literal["HAS_CV", "NO_CV"]
VariantStatus = Literal["DRAFT", "DRAFT_BLOCKED", "VALIDATED", "PUBLISHED"]


class CVVariantCreate(BaseModel):
    mode: VariantMode
    jd_id: str
    cv_id: str | None = None
    match_id: str | None = None
    template_name: Literal["classic", "modern", "elegant", "compact", "creative"] = "classic"
    title: str = Field(default="CV tối ưu theo JD", min_length=2, max_length=255)
    content: dict[str, Any] | None = None
    candidate_evidence_confirmed: bool = False
    language: Literal["vi", "en"] = "vi"
    optimization_mode: Literal["conservative", "balanced", "aggressive"] = "balanced"

    @model_validator(mode="after")
    def validate_mode_contract(self):
        if self.mode == "HAS_CV" and not self.cv_id:
            raise ValueError("cv_id is required for HAS_CV mode")
        if self.mode == "NO_CV" and not self.content:
            raise ValueError("content is required for NO_CV mode")
        return self


class CVVariantUpdate(BaseModel):
    content: dict[str, Any]
    confirmed_claims: list[str] = Field(default_factory=list, max_length=100)
    change_summary: str = Field(default="Autosave nội dung CV", max_length=500)


class CVVariantSuggestionDecision(BaseModel):
    decision: Literal["accept", "reject", "edit"]
    final_text: str | None = Field(default=None, max_length=5000)


class CVVariantTemplateOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    name: str
    version: int
    schema_data: dict[str, Any] = Field(alias="schema", serialization_alias="schema")
    renderer_config: dict[str, Any]


class CVVariantClaimOut(BaseModel):
    id: str
    claim_key: str
    claim_text: str
    source_evidence_ids: list[str]
    source_spans: list[dict[str, Any]]
    validation_status: str
    validator_reason: str | None = None


class CVVariantRevisionOut(BaseModel):
    revision_no: int
    editor_type: str
    change_summary: str | None = None
    content: dict[str, Any]
    created_at: datetime


class CVVariantOut(BaseModel):
    id: str
    user_id: str
    source_cv_snapshot_id: str | None
    target_jd_snapshot_id: str
    match_id: str | None
    template: CVVariantTemplateOut
    mode: VariantMode
    title: str
    content: dict[str, Any]
    status: VariantStatus
    prompt_version: str
    pipeline_version: str
    validator_result: dict[str, Any] | None
    ai_metadata: dict[str, Any]
    rendered_checksum: str | None
    trace_id: str
    revision_no: int
    published_at: datetime | None
    retention_until: datetime | None
    created_at: datetime
    updated_at: datetime
    claims: list[CVVariantClaimOut] = Field(default_factory=list)
    revisions: list[CVVariantRevisionOut] = Field(default_factory=list)


class CVVariantListOut(BaseModel):
    items: list[CVVariantOut]
    total: int


class CVVariantValidationOut(BaseModel):
    variant_id: str
    status: VariantStatus
    passed: bool
    content_hash: str
    validators: list[dict[str, Any]]
    claims_total: int
    claims_supported: int
    claims_blocked: int
    ats_score: float = 0.0
    verification_status: str = "Insufficient evidence"
    render: dict[str, Any]
    trace_id: str


class CVVariantPublishOut(BaseModel):
    variant_id: str
    status: Literal["PUBLISHED"]
    checksum: str
    download_url: str
    published_at: datetime
    trace_id: str
