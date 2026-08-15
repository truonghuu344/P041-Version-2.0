"""Pydantic v2 schemas cho Match Evaluation API — Thành viên 4."""

from __future__ import annotations
from typing import Literal
from pydantic import BaseModel, Field


class EvidenceDetail(BaseModel):
    evidence_id: str
    requirement_id: str
    chunk_id: str
    text: str
    source_page: int | None = None
    source_section: str | None = None
    span_start: int | None = None
    span_end: int | None = None
    fusion_score: float | None = None
    semantic_score: float | None = None
    bm25_score: float | None = None


class EvidenceListData(BaseModel):
    requirement_id: str
    items: list[EvidenceDetail]
    total: int


class RequirementDetail(BaseModel):
    requirement_id: str
    criterion_id: str
    text: str
    mandatory: bool
    priority: str
    status: str
    criterion_score: float | None = None
    evidence_ids: list[str] = Field(default_factory=list)


class RequirementListData(BaseModel):
    criterion_id: str
    items: list[RequirementDetail]
    total: int
    page: int
    page_size: int


class MandatoryGate(BaseModel):
    failed: bool
    failed_requirements: list[str] = Field(default_factory=list)


class CriterionSummary(BaseModel):
    criterion_id: str
    label: str
    weight: float
    raw_score: float
    weighted_score: float
    status: str
    requirements_total: int
    requirements_met: int
    requirements_partial: int
    top_gap_text: str | None = None
    reason: str | None = None


class MatchEvaluationData(BaseModel):
    match_id: str
    status: str
    fit_score: float | None = None
    confidence: Literal["high", "medium", "low", "very_low"] | None = None
    mandatory_gate: MandatoryGate
    criteria_summary: list[CriterionSummary]
    versions: dict = Field(default_factory=dict)
    trace_id: str | None = None
    created_at: str | None = None


class GapAction(BaseModel):
    requirement_id: str
    requirement_text: str
    criterion_id: str
    criterion_label: str | None = None
    status: str
    mandatory: bool
    priority: str
    score_impact: float
    evidence_count: int
    action_type: str
    action_text: str
    weight: float


class GapListData(BaseModel):
    match_id: str
    gaps: list[GapAction]
    total: int
    mandatory_failed_count: int


class CriteriaListData(BaseModel):
    match_id: str
    criteria: list[CriterionSummary]
