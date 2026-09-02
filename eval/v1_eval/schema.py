"""Benchmark schema and data models for Audited V1 CV-JD Evaluation Framework."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from enum import Enum
from typing import Any


class RequiredLevel(str, Enum):
    """Priority level of requirement (mandatory vs optional)."""
    REQUIRED = "REQUIRED"
    PREFERRED = "PREFERRED"


class ExpectedProficiency(str, Enum):
    """Expected seniority or competency level."""
    JUNIOR = "JUNIOR"
    MIDDLE = "MIDDLE"
    SENIOR = "SENIOR"
    EXPERT = "EXPERT"
    UNSPECIFIED = "UNSPECIFIED"


class EvidenceRelation(str, Enum):
    """Allowed relations between CV evidence and JD requirement."""
    DIRECT = "DIRECT"
    EQUIVALENT = "EQUIVALENT"
    INFERRED = "INFERRED"
    ADJACENT = "ADJACENT"
    WEAK_EVIDENCE = "WEAK_EVIDENCE"
    NO_EVIDENCE = "NO_EVIDENCE"


class RequirementOutcome(str, Enum):
    """Outcome of requirement satisfaction check."""
    SATISFIED = "SATISFIED"
    PARTIAL = "PARTIAL"
    UNSATISFIED = "UNSATISFIED"
    UNKNOWN = "UNKNOWN"


class DataOrigin(str, Enum):
    """Data origin tag."""
    REAL = "REAL"
    SYNTHETIC = "SYNTHETIC"


class BooleanOperator(str, Enum):
    """Boolean group operator."""
    ANY_OF = "ANY_OF"
    ALL_OF = "ALL_OF"


class BooleanGroupStatus(str, Enum):
    """Human or engine group evaluation status."""
    SATISFIED = "SATISFIED"
    PARTIAL = "PARTIAL"
    UNSATISFIED = "UNSATISFIED"


class FailureCategory(str, Enum):
    """Root-cause failure categorization."""
    PARSING_ERROR = "PARSING_ERROR"
    RETRIEVAL_MISS = "RETRIEVAL_MISS"
    RERANKING_ERROR = "RERANKING_ERROR"
    SEMANTIC_VALIDATION_ERROR = "SEMANTIC_VALIDATION_ERROR"
    BOOLEAN_GROUP_ERROR = "BOOLEAN_GROUP_ERROR"
    SCORING_ERROR = "SCORING_ERROR"
    EXPLANATION_ERROR = "EXPLANATION_ERROR"


class HumanReviewAction(str, Enum):
    """Actions allowed for human review of JD requirements."""
    APPROVE = "APPROVE"
    EDIT = "EDIT"
    REMOVE = "REMOVE"
    SPLIT = "SPLIT"
    MERGE = "MERGE"
    ADD = "ADD"


class HumanBooleanAction(str, Enum):
    """Actions allowed for human review of Boolean groups."""
    APPROVE = "APPROVE"
    REMOVE = "REMOVE"
    CHANGE_OPERATOR = "CHANGE_OPERATOR"
    SPLIT_GROUP = "SPLIT_GROUP"
    MERGE_GROUPS = "MERGE_GROUPS"


class ParserErrorType(str, Enum):
    """Taxonomy of parser failures discovered during JD structure extraction."""
    HEADING_LEAK = "HEADING_LEAK"
    BENEFIT_LEAK = "BENEFIT_LEAK"
    APPLICATION_INSTRUCTION_LEAK = "APPLICATION_INSTRUCTION_LEAK"
    TOKENIZATION_ERROR = "TOKENIZATION_ERROR"
    DUPLICATE_REQUIREMENT = "DUPLICATE_REQUIREMENT"
    OVER_SPLIT = "OVER_SPLIT"
    UNDER_SPLIT = "UNDER_SPLIT"
    BOOLEAN_OVERGROUP = "BOOLEAN_OVERGROUP"
    BOOLEAN_WRONG_OPERATOR = "BOOLEAN_WRONG_OPERATOR"
    HARD_GATE_OVERCLASSIFICATION = "HARD_GATE_OVERCLASSIFICATION"
    WRONG_REQUIRED_LEVEL = "WRONG_REQUIRED_LEVEL"
    MISSING_EXTRACTION = "MISSING_EXTRACTION"
    OTHER = "OTHER"


# Legacy alias for backward compatibility:
HumanLabel = EvidenceRelation
ALLOWED_HUMAN_LABELS = {label.value for label in EvidenceRelation}
ALLOWED_EVIDENCE_RELATIONS = {rel.value for rel in EvidenceRelation}
ALLOWED_REQUIREMENT_OUTCOMES = {out.value for out in RequirementOutcome}
ALLOWED_REQUIRED_LEVELS = {lvl.value for lvl in RequiredLevel}
ALLOWED_EXPECTED_PROFICIENCIES = {prof.value for prof in ExpectedProficiency}
ALLOWED_DATA_ORIGINS = {orig.value for orig in DataOrigin}
ALLOWED_FAILURE_CATEGORIES = {cat.value for cat in FailureCategory}
ALLOWED_HUMAN_REVIEW_ACTIONS = {act.value for act in HumanReviewAction}
ALLOWED_HUMAN_BOOLEAN_ACTIONS = {act.value for act in HumanBooleanAction}
ALLOWED_PARSER_ERROR_TYPES = {err.value for err in ParserErrorType}


@dataclass
class EvidenceSpan:
    """Human-labeled ground truth evidence span directly from source CV text."""
    section: str = ""
    parent_title: str = ""
    quote: str = ""
    start_offset: int | None = None
    end_offset: int | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> EvidenceSpan:
        return cls(
            section=str(data.get("section", "")),
            parent_title=str(data.get("parent_title", "")),
            quote=str(data.get("quote", "")),
            start_offset=data.get("start_offset"),
            end_offset=data.get("end_offset"),
        )


@dataclass
class RequirementAnnotation:
    """An independent human annotation for a single requirement."""
    annotator_id: str
    annotation_timestamp: str = ""
    annotation_version: str = "1.0"
    evidence_relation: str | None = None  # One of EvidenceRelation
    requirement_outcome: str | None = None  # One of RequirementOutcome
    expected_evidence: list[EvidenceSpan] = field(default_factory=list)
    human_is_critical_gap: bool | None = None
    notes: str = ""

    def validate(self) -> None:
        if self.evidence_relation is not None and self.evidence_relation not in ALLOWED_EVIDENCE_RELATIONS:
            raise ValueError(f"Invalid evidence_relation '{self.evidence_relation}'. Allowed: {sorted(ALLOWED_EVIDENCE_RELATIONS)}")
        if self.requirement_outcome is not None and self.requirement_outcome not in ALLOWED_REQUIREMENT_OUTCOMES:
            raise ValueError(f"Invalid requirement_outcome '{self.requirement_outcome}'. Allowed: {sorted(ALLOWED_REQUIREMENT_OUTCOMES)}")

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["expected_evidence"] = [e.to_dict() for e in self.expected_evidence]
        return d

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> RequirementAnnotation:
        spans = []
        for s in data.get("expected_evidence", []):
            if isinstance(s, EvidenceSpan):
                spans.append(s)
            elif isinstance(s, dict):
                spans.append(EvidenceSpan.from_dict(s))
            elif isinstance(s, str):
                spans.append(EvidenceSpan(quote=s))
        return cls(
            annotator_id=str(data.get("annotator_id", "")),
            annotation_timestamp=str(data.get("annotation_timestamp", "")),
            annotation_version=str(data.get("annotation_version", "1.0")),
            evidence_relation=data.get("evidence_relation"),
            requirement_outcome=data.get("requirement_outcome"),
            expected_evidence=spans,
            human_is_critical_gap=data.get("human_is_critical_gap"),
            notes=str(data.get("notes", "")),
        )


@dataclass
class BooleanGroupGroundTruth:
    """Human ground truth for a logical requirement group (ANY_OF / ALL_OF)."""
    group_id: str
    operator: str = "ANY_OF"  # ANY_OF | ALL_OF
    min_required: int = 1
    member_requirement_ids: list[str] = field(default_factory=list)
    human_group_status: str | None = None  # SATISFIED | PARTIAL | UNSATISFIED
    expected_satisfied_by: list[str] = field(default_factory=list)
    notes: str = ""

    def validate(self) -> None:
        if self.operator not in {"ANY_OF", "ALL_OF"}:
            raise ValueError(f"Invalid group operator '{self.operator}'. Must be ANY_OF or ALL_OF.")
        if self.human_group_status is not None and self.human_group_status not in {"SATISFIED", "PARTIAL", "UNSATISFIED"}:
            raise ValueError(f"Invalid human_group_status '{self.human_group_status}'. Must be SATISFIED, PARTIAL, or UNSATISFIED.")

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> BooleanGroupGroundTruth:
        return cls(
            group_id=str(data.get("group_id", "")),
            operator=str(data.get("operator", "ANY_OF")),
            min_required=int(data.get("min_required", 1)),
            member_requirement_ids=list(data.get("member_requirement_ids", [])),
            human_group_status=data.get("human_group_status"),
            expected_satisfied_by=list(data.get("expected_satisfied_by", [])),
            notes=str(data.get("notes", "")),
        )


class StructuralAlignmentOutcome(str, Enum):
    """Structural alignment outcomes between production parser proposals and human Gold requirements."""
    EXACT_MATCH = "EXACT_MATCH"
    EDITED_MATCH = "EDITED_MATCH"
    UNDER_SPLIT = "UNDER_SPLIT"
    OVER_SPLIT = "OVER_SPLIT"
    DUPLICATE_REQUIREMENT = "DUPLICATE_REQUIREMENT"
    FALSE_EXTRACTION = "FALSE_EXTRACTION"
    MISSING_EXTRACTION = "MISSING_EXTRACTION"


@dataclass
class ProposalProvenance:
    """Provenance tracking connecting gold requirements to past parser baseline runs."""
    parser_version: str = "1.0.0"
    proposal_ids: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class ParserVersionSnapshot:
    """Reproducible snapshot of parser configuration and version metadata for benchmark baseline runs."""
    parser_version: str = "1.0.0"
    git_commit: str | None = None
    git_dirty: bool = False
    evaluation_timestamp: str = ""
    parser_configuration: dict[str, Any] = field(default_factory=dict)
    parser_config_hash: str | None = None
    matching_schema_version: str = "1.0.0"
    benchmark_gold_version: str = "v1.0"

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class GoldRequirement:
    """Human-reviewed ground truth for a single JD requirement with stable gold ID."""
    gold_requirement_id: str
    canonical_name: str
    source_sentence: str = ""
    source_start_offset: int | None = None
    source_end_offset: int | None = None
    required_level: str = "REQUIRED"  # REQUIRED | PREFERRED
    expected_proficiency: str = "UNSPECIFIED"
    importance: float = 1.0
    hard_gate: bool = False
    group_id: str | None = None
    proposal_provenance: dict[str, Any] = field(default_factory=lambda: {"parser_version": "1.0.0", "proposal_ids": []})
    source_proposal_ids: list[str] = field(default_factory=list)
    review_action: str = "APPROVE"  # APPROVE | EDIT | SPLIT | MERGE | REMOVE
    active: bool = True
    error_type: str | None = None  # One of ParserErrorType
    notes: str = ""

    def __post_init__(self) -> None:
        if self.review_action == "REMOVE":
            self.active = False
        if not self.source_proposal_ids and self.proposal_provenance and "proposal_ids" in self.proposal_provenance:
            self.source_proposal_ids = list(self.proposal_provenance["proposal_ids"])
        elif self.source_proposal_ids and not self.proposal_provenance.get("proposal_ids"):
            self.proposal_provenance = {
                "parser_version": self.proposal_provenance.get("parser_version", "1.0.0"),
                "proposal_ids": list(self.source_proposal_ids),
            }

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> GoldRequirement:
        prov = data.get("proposal_provenance") or {}
        if not prov and data.get("source_proposal_ids"):
            prov = {"parser_version": "1.0.0", "proposal_ids": list(data.get("source_proposal_ids", []))}
        rev_act = str(data.get("review_action", "APPROVE"))
        is_active = data.get("active", rev_act != "REMOVE")
        return cls(
            gold_requirement_id=str(data.get("gold_requirement_id", "")),
            canonical_name=str(data.get("canonical_name", "")),
            source_sentence=str(data.get("source_sentence", "")),
            source_start_offset=data.get("source_start_offset"),
            source_end_offset=data.get("source_end_offset"),
            required_level=str(data.get("required_level", "REQUIRED")),
            expected_proficiency=str(data.get("expected_proficiency", "UNSPECIFIED")),
            importance=float(data.get("importance", 1.0)),
            hard_gate=bool(data.get("hard_gate", False)),
            group_id=data.get("group_id"),
            proposal_provenance=prov,
            source_proposal_ids=list(data.get("source_proposal_ids") or prov.get("proposal_ids") or []),
            review_action=rev_act,
            active=bool(is_active),
            error_type=data.get("error_type"),
            notes=str(data.get("notes", "")),
        )


@dataclass
class GoldBooleanGroup:
    """Human-reviewed ground truth for a logical requirement group with stable gold group ID."""
    gold_group_id: str
    operator: str = "ANY_OF"  # ANY_OF | ALL_OF
    min_required: int = 1
    member_gold_requirement_ids: list[str] = field(default_factory=list)
    source_proposal_group_ids: list[str] = field(default_factory=list)
    review_action: str = "APPROVE"  # APPROVE | CHANGE_OPERATOR | SPLIT_GROUP | MERGE_GROUPS | REMOVE
    active: bool = True
    notes: str = ""

    def __post_init__(self) -> None:
        if self.review_action == "REMOVE":
            self.active = False

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> GoldBooleanGroup:
        rev_act = str(data.get("review_action", "APPROVE"))
        is_active = data.get("active", rev_act != "REMOVE")
        return cls(
            gold_group_id=str(data.get("gold_group_id", "")),
            operator=str(data.get("operator", "ANY_OF")),
            min_required=int(data.get("min_required", 1)),
            member_gold_requirement_ids=list(data.get("member_gold_requirement_ids", [])),
            source_proposal_group_ids=list(data.get("source_proposal_group_ids", [])),
            review_action=rev_act,
            active=bool(is_active),
            notes=str(data.get("notes", "")),
        )


@dataclass
class BenchmarkRequirement:
    """Ground truth expectation for a single JD requirement."""
    requirement_id: str
    canonical_name: str
    required_level: str = "REQUIRED"  # REQUIRED | PREFERRED
    expected_proficiency: str = "UNSPECIFIED"  # JUNIOR | MIDDLE | SENIOR | EXPERT | UNSPECIFIED
    importance: float = 1.0
    text: str = ""
    group: str = "skills"
    hard_gate: bool = False
    human_is_critical_gap: bool | None = None
    group_id: str | None = None
    group_operator: str | None = None

    # Primary / Adjudicated human labels:
    evidence_relation: str | None = None  # One of EvidenceRelation
    requirement_outcome: str | None = None  # One of RequirementOutcome
    expected_evidence: list[EvidenceSpan] = field(default_factory=list)
    expected_evidence_chunk_ids: list[str] = field(default_factory=list)  # Derived/runtime cache only

    # Multi-annotator support:
    annotations: list[RequirementAnnotation] = field(default_factory=list)
    adjudicated: bool = False
    notes: str = ""

    @property
    def human_label(self) -> str | None:
        """Backward-compatible alias for evidence_relation."""
        return self.evidence_relation

    @property
    def mandatory(self) -> bool:
        """Helper property for backward compatibility with pipeline."""
        return self.required_level == RequiredLevel.REQUIRED.value or self.hard_gate

    def validate(self) -> None:
        if self.required_level not in ALLOWED_REQUIRED_LEVELS:
            # Map legacy REQUIRED/PREFERRED if passed
            if self.required_level.upper() in ALLOWED_REQUIRED_LEVELS:
                self.required_level = self.required_level.upper()
            else:
                raise ValueError(f"Invalid required_level '{self.required_level}'. Allowed: {sorted(ALLOWED_REQUIRED_LEVELS)}")

        if self.expected_proficiency not in ALLOWED_EXPECTED_PROFICIENCIES:
            if self.expected_proficiency.upper() in ALLOWED_EXPECTED_PROFICIENCIES:
                self.expected_proficiency = self.expected_proficiency.upper()
            else:
                raise ValueError(f"Invalid expected_proficiency '{self.expected_proficiency}'. Allowed: {sorted(ALLOWED_EXPECTED_PROFICIENCIES)}")

        if self.evidence_relation is not None and self.evidence_relation not in ALLOWED_EVIDENCE_RELATIONS:
            raise ValueError(f"Invalid evidence_relation '{self.evidence_relation}'. Allowed: {sorted(ALLOWED_EVIDENCE_RELATIONS)}")

        if self.requirement_outcome is not None and self.requirement_outcome not in ALLOWED_REQUIREMENT_OUTCOMES:
            raise ValueError(f"Invalid requirement_outcome '{self.requirement_outcome}'. Allowed: {sorted(ALLOWED_REQUIREMENT_OUTCOMES)}")

        for ann in self.annotations:
            ann.validate()

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["expected_evidence"] = [e.to_dict() if hasattr(e, "to_dict") else e for e in self.expected_evidence]
        d["annotations"] = [a.to_dict() if hasattr(a, "to_dict") else a for a in self.annotations]
        # Keep human_label alias in serialized output for backward compatibility
        d["human_label"] = self.evidence_relation
        return d

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> BenchmarkRequirement:
        # Migration from legacy fields:
        # 1. required_level vs expected_proficiency
        req_level = data.get("required_level", "REQUIRED")
        exp_prof = data.get("expected_proficiency", "UNSPECIFIED")
        if req_level in {"junior", "middle", "senior", "expert"}:
            exp_prof = req_level.upper()
            req_level = "REQUIRED"
        elif req_level in {"REQUIRED", "PREFERRED"}:
            req_level = req_level.upper()
        else:
            legacy_type = str(data.get("type", "REQUIRED")).upper()
            req_level = "REQUIRED" if legacy_type in {"REQUIRED", "MANDATORY"} else "PREFERRED"

        # 2. human_label vs evidence_relation
        ev_rel = data.get("evidence_relation") or data.get("human_label")

        # 3. expected_evidence spans
        spans: list[EvidenceSpan] = []
        for s in data.get("expected_evidence", []):
            if isinstance(s, EvidenceSpan):
                spans.append(s)
            elif isinstance(s, dict):
                spans.append(EvidenceSpan.from_dict(s))
            elif isinstance(s, str):
                spans.append(EvidenceSpan(quote=s))

        # 4. Annotations list
        anns = []
        for a in data.get("annotations", []):
            if isinstance(a, RequirementAnnotation):
                anns.append(a)
            elif isinstance(a, dict):
                anns.append(RequirementAnnotation.from_dict(a))

        return cls(
            requirement_id=str(data.get("requirement_id", "")),
            canonical_name=str(data.get("canonical_name", data.get("name", data.get("text", "")))),
            required_level=str(req_level),
            expected_proficiency=str(exp_prof),
            importance=float(data.get("importance", 1.0)),
            text=str(data.get("text", "")),
            group=str(data.get("group", "skills")),
            hard_gate=bool(data.get("hard_gate", False)),
            human_is_critical_gap=data.get("human_is_critical_gap"),
            group_id=data.get("group_id"),
            group_operator=data.get("group_operator"),
            evidence_relation=ev_rel,
            requirement_outcome=data.get("requirement_outcome"),
            expected_evidence=spans,
            expected_evidence_chunk_ids=list(data.get("expected_evidence_chunk_ids", [])),
            annotations=anns,
            adjudicated=bool(data.get("adjudicated", False)),
            notes=str(data.get("notes", "")),
        )


@dataclass
class BenchmarkCase:
    """A benchmark case consisting of a CV and JD pair with requirement-level ground truth."""
    case_id: str
    cv_id: str
    jd_id: str
    data_origin: str = "SYNTHETIC"  # REAL | SYNTHETIC
    source_dataset: str = ""
    requirements: list[BenchmarkRequirement] = field(default_factory=list)
    boolean_groups: list[BooleanGroupGroundTruth] = field(default_factory=list)
    human_overall_score: float | None = None  # Canonical 0..100 scale
    cv_text: str = ""
    cv_parsed: dict[str, Any] = field(default_factory=dict)
    jd_title: str = ""
    jd_requirements: str = ""
    jd_parsed: dict[str, Any] | None = None
    domain: str = ""
    seniority: str = ""
    notes: str = ""

    # Legacy support
    human_overall_rating: float | int | None = None

    def get_canonical_overall_score(self) -> float | None:
        """Return canonical 0..100 overall score, normalizing from legacy 1..5 if necessary."""
        if self.human_overall_score is not None:
            return float(self.human_overall_score)
        if self.human_overall_rating is not None:
            r = float(self.human_overall_rating)
            if r <= 5.0:
                # Standard linear normalization from 1..5 scale to 0..100:
                # 1.0 -> 0.0, 3.0 -> 50.0, 5.0 -> 100.0 (or r * 20.0 for 0..5)
                # If rating >= 1.0, map (r - 1.0) / 4.0 * 100.0; else r * 20.0
                if r >= 1.0:
                    return round((r - 1.0) / 4.0 * 100.0, 2)
                return round(r * 20.0, 2)
            return round(r, 2)
        return None

    def validate(self) -> None:
        if not self.case_id:
            raise ValueError("Benchmark case must have a non-empty case_id.")
        if not self.cv_id or not self.jd_id:
            raise ValueError(f"Case '{self.case_id}' must specify cv_id and jd_id.")
        if self.data_origin not in ALLOWED_DATA_ORIGINS:
            raise ValueError(f"Invalid data_origin '{self.data_origin}'. Allowed: {sorted(ALLOWED_DATA_ORIGINS)}")

        for req in self.requirements:
            req.validate()
        for bg in self.boolean_groups:
            bg.validate()

        score = self.get_canonical_overall_score()
        if score is not None and not (0.0 <= score <= 100.0):
            raise ValueError(f"Case '{self.case_id}' has out-of-range overall score {score}. Must be in 0..100.")

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["requirements"] = [r.to_dict() for r in self.requirements]
        d["boolean_groups"] = [bg.to_dict() for bg in self.boolean_groups]
        d["human_overall_score"] = self.get_canonical_overall_score()
        return d

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> BenchmarkCase:
        req_objs = []
        for r in data.get("requirements", []):
            if isinstance(r, BenchmarkRequirement):
                req_objs.append(r)
            else:
                req_objs.append(BenchmarkRequirement.from_dict(r))

        bg_objs = []
        for bg in data.get("boolean_groups", []):
            if isinstance(bg, BooleanGroupGroundTruth):
                bg_objs.append(bg)
            else:
                bg_objs.append(BooleanGroupGroundTruth.from_dict(bg))

        raw_score = data.get("human_overall_score")
        raw_rating = data.get("human_overall_rating")

        return cls(
            case_id=str(data.get("case_id", "")),
            cv_id=str(data.get("cv_id", "")),
            jd_id=str(data.get("jd_id", "")),
            data_origin=str(data.get("data_origin", "SYNTHETIC")).upper(),
            source_dataset=str(data.get("source_dataset", "")),
            requirements=req_objs,
            boolean_groups=bg_objs,
            human_overall_score=float(raw_score) if raw_score is not None else None,
            human_overall_rating=float(raw_rating) if raw_rating is not None else None,
            cv_text=str(data.get("cv_text", "")),
            cv_parsed=dict(data.get("cv_parsed", {})),
            jd_title=str(data.get("jd_title", "")),
            jd_requirements=str(data.get("jd_requirements", "")),
            jd_parsed=data.get("jd_parsed"),
            domain=str(data.get("domain", "")),
            seniority=str(data.get("seniority", "")),
            notes=str(data.get("notes", "")),
        )


@dataclass
class FailureItem:
    """Detailed record of a single prediction failure."""
    case_id: str
    requirement_id: str
    human_evidence: list[dict[str, Any]]
    retrieved_evidence: list[str]
    human_evidence_relation: str
    engine_evidence_relation: str
    human_outcome: str
    engine_outcome: str
    boolean_group: str | None
    scores: dict[str, Any]
    failure_category: str
    reason: str = ""

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)
