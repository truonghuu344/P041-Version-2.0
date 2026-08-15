"""
Unit tests cho gap_priority_service.py
Thành viên 4 — feat/match-evaluation-modal

Chạy: pytest backend/tests/unit/test_gap_priority_service.py -v
"""

import pytest

from src.services.gap_priority_service import (
    ActionType,
    GapItem,
    compute_gap_priority,
)


def _req(
    req_id: str,
    status: str,
    mandatory: bool = False,
    priority: str = "medium",
    criterion_id: str = "required_skills",
    score: float = 0.0,
    evidence_ids: list | None = None,
) -> dict:
    return {
        "requirement_id": req_id,
        "text": f"Requirement {req_id}",
        "mandatory": mandatory,
        "priority": priority,
        "status": status,
        "criterion_id": criterion_id,
        "criterion_score": score,
        "payload_json": {"evidence_ids": evidence_ids or []},
    }


def _crit(criterion_id: str, weight: float = 0.35) -> dict:
    return {
        "criterion_id": criterion_id,
        "weight": weight,
        "raw_score": 0.0,
        "reason": criterion_id,
    }


class TestComputeGapPriority:

    def test_empty_requirements_returns_empty(self):
        result = compute_gap_priority([], [])
        assert result == []

    def test_supported_requirement_excluded(self):
        reqs = [_req("r1", "SUPPORTED")]
        result = compute_gap_priority(reqs, [_crit("required_skills")])
        assert len(result) == 0

    def test_not_found_included(self):
        reqs = [_req("r1", "NOT_FOUND")]
        result = compute_gap_priority(reqs, [_crit("required_skills")])
        assert len(result) == 1
        assert result[0].requirement_id == "r1"

    def test_mandatory_first(self):
        reqs = [
            _req("r1", "NOT_FOUND", mandatory=False, priority="high"),
            _req("r2", "NOT_FOUND", mandatory=True, priority="low"),
            _req("r3", "NOT_FOUND", mandatory=False, priority="high"),
        ]
        result = compute_gap_priority(reqs, [_crit("required_skills")])
        assert result[0].requirement_id == "r2"
        assert result[0].mandatory is True

    def test_multiple_mandatory_kept_together(self):
        reqs = [
            _req("r1", "NOT_FOUND", mandatory=False, priority="high"),
            _req("r2", "NOT_FOUND", mandatory=True, priority="low"),
            _req("r3", "MISSING", mandatory=True, priority="low"),
            _req("r4", "NOT_FOUND", mandatory=False, priority="high"),
        ]
        result = compute_gap_priority(reqs, [_crit("required_skills")])
        mandatory_ids = [g.requirement_id for g in result if g.mandatory]
        non_mandatory_ids = [g.requirement_id for g in result if not g.mandatory]
        assert set(mandatory_ids) == {"r2", "r3"}
        assert set(non_mandatory_ids) == {"r1", "r4"}
        first_non_mandatory_idx = next(i for i, g in enumerate(result) if not g.mandatory)
        for g in result[:first_non_mandatory_idx]:
            assert g.mandatory is True

    def test_score_impact_sort_within_non_mandatory(self):
        reqs = [
            _req("r1", "NOT_FOUND", criterion_id="education"),
            _req("r2", "NOT_FOUND", criterion_id="required_skills"),
        ]
        criteria = [
            _crit("required_skills", 0.35),
            _crit("education", 0.10),
        ]
        result = compute_gap_priority(reqs, criteria)
        assert result[0].requirement_id == "r2"

    def test_action_type_mandatory_missing(self):
        reqs = [_req("r1", "NOT_FOUND", mandatory=True)]
        result = compute_gap_priority(reqs, [_crit("required_skills")])
        assert result[0].action_type == ActionType.MANDATORY_MISSING

    def test_action_type_evidence_weak(self):
        reqs = [_req("r1", "PARTIALLY_SUPPORTED", mandatory=False)]
        result = compute_gap_priority(reqs, [_crit("required_skills")])
        assert result[0].action_type == ActionType.EVIDENCE_WEAK

    def test_action_type_uncertain(self):
        reqs = [_req("r1", "UNCERTAIN", mandatory=False)]
        result = compute_gap_priority(reqs, [_crit("required_skills")])
        assert result[0].action_type == ActionType.UNCERTAIN

    def test_action_text_does_not_contain_cv_data(self):
        cv_specific_data = ["Python developer tại FPT", "3 năm kinh nghiệm", "MBA"]
        reqs = [_req("r1", "NOT_FOUND")]
        result = compute_gap_priority(reqs, [_crit("required_skills")])
        action_text = result[0].action_text
        for data_point in cv_specific_data:
            assert data_point not in action_text

    def test_action_text_no_llm_artifacts(self):
        reqs = [
            _req("r1", "NOT_FOUND"),
            _req("r2", "PARTIALLY_SUPPORTED"),
            _req("r3", "UNCERTAIN"),
        ]
        result = compute_gap_priority(reqs, [_crit("required_skills")])
        for gap in result:
            assert gap.action_text
            assert "{" not in gap.action_text
            assert "}" not in gap.action_text

    def test_deterministic_same_input_same_output(self):
        reqs = [
            _req("r1", "NOT_FOUND", mandatory=True),
            _req("r2", "PARTIALLY_SUPPORTED", mandatory=False, priority="high"),
            _req("r3", "NOT_FOUND", mandatory=False, priority="low"),
        ]
        criteria = [_crit("required_skills")]
        result_a = compute_gap_priority(reqs, criteria)
        result_b = compute_gap_priority(reqs, criteria)
        assert [g.requirement_id for g in result_a] == [g.requirement_id for g in result_b]

    def test_evidence_count_set_correctly(self):
        reqs = [_req("r1", "PARTIALLY_SUPPORTED", evidence_ids=["e1", "e2", "e3"])]
        result = compute_gap_priority(reqs, [_crit("required_skills")])
        assert result[0].evidence_count == 3

    def test_stable_sort_by_requirement_id(self):
        reqs = [
            _req("r_b", "NOT_FOUND", priority="medium", criterion_id="required_skills"),
            _req("r_a", "NOT_FOUND", priority="medium", criterion_id="required_skills"),
        ]
        result = compute_gap_priority(reqs, [_crit("required_skills")])
        ids = [g.requirement_id for g in result]
        assert ids == sorted(ids)

    def test_uncertain_status_gets_uncertain_action(self):
        reqs = [_req("r1", "UNCERTAIN")]
        result = compute_gap_priority(reqs, [_crit("required_skills")])
        assert result[0].action_type == ActionType.UNCERTAIN
        assert result[0].score_impact == 0.35

    def test_score_impact_calculation(self):
        reqs = [
            _req("r1", "NOT_FOUND", criterion_id="required_skills"),
            _req("r2", "MISSING", criterion_id="required_skills"),
        ]
        result = compute_gap_priority(reqs, [_crit("required_skills", 0.35)])
        for gap in result:
            assert abs(gap.score_impact - 0.175) < 0.001

    def test_returns_gap_item_dataclass(self):
        reqs = [_req("r1", "NOT_FOUND")]
        result = compute_gap_priority(reqs, [_crit("required_skills")])
        assert isinstance(result[0], GapItem)
