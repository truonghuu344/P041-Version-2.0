"""Comprehensive unit and integration tests for Audited V1 CV-JD Evaluation Framework."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from eval.v1_eval.failure_analysis import (
    map_engine_classification_to_evidence_relation,
    map_engine_status_to_requirement_outcome,
)
from eval.v1_eval.metrics import (
    calculate_annotator_agreement,
    calculate_boolean_group_metrics,
    calculate_critical_gap_metrics,
    calculate_layered_retrieval_metrics,
    map_evidence_spans_to_chunks,
)
from eval.v1_eval.runner import V1BenchmarkRunner
from eval.v1_eval.schema import (
    ALLOWED_EXPECTED_PROFICIENCIES,
    ALLOWED_REQUIRED_LEVELS,
    BenchmarkCase,
    BenchmarkRequirement,
    DataOrigin,
    EvidenceRelation,
    EvidenceSpan,
    RequirementAnnotation,
    RequirementOutcome,
)
from eval.v1_eval.template_generator import (
    create_golden_sample_benchmark,
    create_real_benchmark_manifest,
    generate_unlabeled_benchmark_template,
)


def test_requirement_semantics_separation() -> None:
    """Test required_level (REQUIRED/PREFERRED) is separated from expected_proficiency (JUNIOR/SENIOR/etc)."""
    req = BenchmarkRequirement(
        requirement_id="REQ_PY",
        canonical_name="Python",
        required_level="REQUIRED",
        expected_proficiency="SENIOR",
        importance=4.5,
        hard_gate=True,
    )
    req.validate()
    assert req.required_level in ALLOWED_REQUIRED_LEVELS
    assert req.expected_proficiency in ALLOWED_EXPECTED_PROFICIENCIES
    assert req.mandatory is True

    # Check validation error for invalid level or proficiency
    with pytest.raises(ValueError, match="Invalid required_level"):
        BenchmarkRequirement(requirement_id="R1", canonical_name="Java", required_level="SENIOR").validate()

    with pytest.raises(ValueError, match="Invalid expected_proficiency"):
        BenchmarkRequirement(requirement_id="R2", canonical_name="Java", expected_proficiency="SUPER_SENIOR").validate()


def test_source_evidence_spans_mapping_to_chunks() -> None:
    """Test runtime dynamic mapping of human evidence spans (quotes) to chunks."""
    chunks = [
        {"chunk_id": "CHUNK_01", "text": "Senior Backend Developer với 5 năm kinh nghiệm Python và FastAPI.", "parent_title": "Experience"},
        {"chunk_id": "CHUNK_02", "text": "Triển khai hệ thống microservices trên hạ tầng Docker và AWS.", "parent_title": "Projects"},
        {"chunk_id": "CHUNK_03", "text": "Tốt nghiệp Cử nhân Khoa học Máy tính Đại học Bách Khoa.", "parent_title": "Education"},
    ]

    spans = [
        EvidenceSpan(section="experience", parent_title="Experience", quote="5 năm kinh nghiệm Python"),
        EvidenceSpan(section="projects", quote="triển khai hệ thống microservices"),
    ]

    matched_ids = map_evidence_spans_to_chunks(spans, chunks)
    assert "CHUNK_01" in matched_ids
    assert "CHUNK_02" in matched_ids
    assert "CHUNK_03" not in matched_ids


def test_overall_score_normalization_formula() -> None:
    """Test normalization from 1..5 scale to canonical 0..100 scale."""
    # Direct 0..100 score
    case1 = BenchmarkCase(case_id="c1", cv_id="cv1", jd_id="jd1", human_overall_score=88.5)
    assert case1.get_canonical_overall_score() == 88.5

    # 1..5 scale normalization formula: (r - 1.0) / 4.0 * 100.0
    case_min = BenchmarkCase(case_id="c2", cv_id="cv1", jd_id="jd1", human_overall_rating=1.0)
    assert case_min.get_canonical_overall_score() == 0.0

    case_mid = BenchmarkCase(case_id="c3", cv_id="cv1", jd_id="jd1", human_overall_rating=3.0)
    assert case_mid.get_canonical_overall_score() == 50.0

    case_max = BenchmarkCase(case_id="c4", cv_id="cv1", jd_id="jd1", human_overall_rating=5.0)
    assert case_max.get_canonical_overall_score() == 100.0


def test_multi_annotator_agreement_and_kappa() -> None:
    """Test raw agreement and Cohen's Kappa for multi-annotator datasets."""
    reqs = [
        BenchmarkRequirement(
            requirement_id="r1",
            canonical_name="Python",
            annotations=[
                RequirementAnnotation(annotator_id="A1", evidence_relation="DIRECT", requirement_outcome="SATISFIED"),
                RequirementAnnotation(annotator_id="A2", evidence_relation="DIRECT", requirement_outcome="SATISFIED"),
            ],
        ),
        BenchmarkRequirement(
            requirement_id="r2",
            canonical_name="Docker",
            annotations=[
                RequirementAnnotation(annotator_id="A1", evidence_relation="WEAK_EVIDENCE", requirement_outcome="PARTIAL"),
                RequirementAnnotation(annotator_id="A2", evidence_relation="DIRECT", requirement_outcome="SATISFIED"),
            ],
        ),
    ]

    agreement = calculate_annotator_agreement(reqs)
    assert agreement["multi_annotated_requirements"] == 2
    assert agreement["evidence_relation_raw_agreement"] == 0.5
    assert agreement["requirement_outcome_raw_agreement"] == 0.5


def test_boolean_group_metrics() -> None:
    """Test accuracy calculation for ANY_OF and ALL_OF boolean groups."""
    group_results = [
        {"group_id": "g1", "operator": "ANY_OF", "human_group_status": "SATISFIED", "engine_group_status": "SATISFIED"},
        {"group_id": "g2", "operator": "ANY_OF", "human_group_status": "SATISFIED", "engine_group_status": "UNSATISFIED"},
        {"group_id": "g3", "operator": "ALL_OF", "human_group_status": "PARTIAL", "engine_group_status": "PARTIAL"},
    ]
    res = calculate_boolean_group_metrics(group_results)
    assert res["total_groups"] == 3
    assert res["boolean_group_accuracy"] == pytest.approx(2 / 3, rel=1e-2)
    assert res["any_of_accuracy"] == 0.5
    assert res["all_of_accuracy"] == 1.0


def test_critical_gap_precision_recall_f1() -> None:
    """Test critical gap precision, recall, and F1 metrics."""
    items = [
        # True Positive critical gap
        {"mandatory": True, "human_is_critical_gap": True, "engine_outcome": "UNSATISFIED", "engine_evidence_relation": "NO_EVIDENCE"},
        # True Negative (not a critical gap)
        {"mandatory": True, "human_is_critical_gap": False, "engine_outcome": "SATISFIED", "engine_evidence_relation": "DIRECT"},
        # False Positive (engine flagged gap, but ground truth is satisfied)
        {"mandatory": True, "human_is_critical_gap": False, "engine_outcome": "UNSATISFIED", "engine_evidence_relation": "NO_EVIDENCE"},
        # False Negative (ground truth is critical gap, but engine missed it)
        {"mandatory": True, "human_is_critical_gap": True, "engine_outcome": "SATISFIED", "engine_evidence_relation": "DIRECT"},
    ]
    crit = calculate_critical_gap_metrics(items)
    # TP=1, FP=1, FN=1 -> Prec = 0.5, Rec = 0.5, F1 = 0.5
    assert crit["critical_gap_precision"] == 0.5
    assert crit["critical_gap_recall"] == 0.5
    assert crit["critical_gap_f1"] == 0.5


def test_evidence_relation_vs_requirement_outcome_separation() -> None:
    """Test that evidence relation (DIRECT/EQUIVALENT) is distinct from requirement outcome (SATISFIED/UNSATISFIED)."""
    # Example: 6 months Python on a 3+ year requirement -> DIRECT evidence, but UNSATISFIED outcome
    req = BenchmarkRequirement(
        requirement_id="REQ_PY_EXP",
        canonical_name="Python Experience",
        evidence_relation=EvidenceRelation.DIRECT.value,
        requirement_outcome=RequirementOutcome.UNSATISFIED.value,
        expected_evidence=[EvidenceSpan(quote="6 months Python developer")],
    )
    req.validate()
    assert req.evidence_relation == "DIRECT"
    assert req.requirement_outcome == "UNSATISFIED"

    mapped_rel = map_engine_classification_to_evidence_relation({"match_classification": "DIRECT", "evidence_strength": "STRONG"})
    mapped_out = map_engine_status_to_requirement_outcome({"status": "SUPPORTED", "match_score": 0.9})
    assert mapped_rel == "DIRECT"
    assert mapped_out == "SATISFIED"


def test_layered_retrieval_metrics() -> None:
    """Test separate measurement across BM25, Vector, RRF Hybrid, and Final layers."""
    layer_queries = {
        "bm25": [{"expected_chunk_ids": ["c1"], "retrieved_chunk_ids": ["c2", "c1"]}],
        "semantic": [{"expected_chunk_ids": ["c1"], "retrieved_chunk_ids": ["c1", "c2"]}],
        "hybrid": [{"expected_chunk_ids": ["c1"], "retrieved_chunk_ids": ["c1", "c2"]}],
        "final": [{"expected_chunk_ids": ["c1"], "retrieved_chunk_ids": ["c1"]}],
    }
    layers = calculate_layered_retrieval_metrics(layer_queries)
    assert layers["bm25"]["recall_at_1"] == 0.0
    assert layers["bm25"]["recall_at_3"] == 1.0
    assert layers["semantic"]["recall_at_1"] == 1.0
    assert layers["hybrid"]["recall_at_1"] == 1.0
    assert layers["final"]["recall_at_1"] == 1.0


def test_full_pipeline_runner_with_real_vs_synthetic_breakdown(tmp_path: Path) -> None:
    """Integration test: runner produces separate metrics for REAL and SYNTHETIC data origins."""
    cases = create_golden_sample_benchmark(tmp_path / "golden.json")
    runner = V1BenchmarkRunner(use_deterministic_embedding=True)
    report = runner.evaluate_dataset(cases, output_dir=tmp_path)

    assert "overall_metrics" in report
    assert "by_origin" in report
    assert "REAL" in report["by_origin"]
    assert "SYNTHETIC" in report["by_origin"]
    assert "failure_analysis" in report

    md_file = tmp_path / "v1_eval_report.md"
    assert md_file.exists()
    md_content = md_file.read_text(encoding="utf-8")
    assert "REAL Data" in md_content
    assert "SYNTHETIC Data" in md_content
    assert "Multi-Layer Retrieval Progression" in md_content


def test_generate_real_manifest_and_synthetic_template(tmp_path: Path) -> None:
    """Test generating unannotated synthetic template and empty real manifest."""
    real_p = tmp_path / "real_manifest.json"
    synth_p = tmp_path / "synth_template.json"

    real_cases = create_real_benchmark_manifest(real_p)
    synth_cases = generate_unlabeled_benchmark_template(output_path=synth_p)

    assert len(real_cases) >= 6
    assert len(synth_cases) >= 50

    # Ensure no fabricated human labels
    for c in real_cases:
        assert c.data_origin == DataOrigin.REAL.value
        assert c.human_overall_score is None
        for r in c.requirements:
            assert r.evidence_relation is None
            assert r.requirement_outcome is None
            assert r.expected_evidence == []

    for c in synth_cases:
        assert c.data_origin == DataOrigin.SYNTHETIC.value
        assert c.human_overall_score is None


def test_real_benchmark_builder_loading_and_sampling() -> None:
    """Test loading and validating the 560 real CVs and 91 real JDs from data/clean."""
    from eval.v1_eval.real_benchmark_builder import load_and_validate_source_data, select_benchmark_pairs

    cvs, jds, stats = load_and_validate_source_data()
    assert len(cvs) == 560
    assert len(jds) == 91
    assert stats["cv_stats"]["valid_count"] == 560
    assert stats["jd_stats"]["valid_count"] == 91

    pairs = select_benchmark_pairs(cvs, jds)
    assert len(pairs) == 80

    strata_counts = {}
    for p in pairs:
        s = p["sampling_stratum"]
        strata_counts[s] = strata_counts.get(s, 0) + 1

    assert strata_counts.get("STRONG_CANDIDATE") == 20
    assert strata_counts.get("MEDIUM_CANDIDATE") == 20
    assert strata_counts.get("WEAK_CANDIDATE") == 15
    assert strata_counts.get("NEGATIVE_CANDIDATE") == 15
    assert strata_counts.get("EDGE_CASE") == 10


def test_annotation_status_and_gold_export(tmp_path: Path) -> None:
    """Test annotation status calculation and safe gold dataset export."""
    from eval.v1_eval.annotation_workspace import export_gold_benchmark, get_annotation_status

    workspace_file = tmp_path / "mock_workspace.json"
    gold_file = tmp_path / "mock_gold.json"

    # 1. Workspace with 1 unreviewed case and 1 completed case
    mock_data = [
        {
            "case_id": "CASE_PENDING_01",
            "cv_id": "CV_01",
            "jd_id": "JD_01",
            "proposed_requirements": [
                {"requirement_id": "R1", "canonical_name": "Python", "review_status": "PENDING", "evidence_relation": None, "requirement_outcome": None}
            ],
            "boolean_groups": [{"group_id": "G1", "human_group_status": None}],
            "human_review_status": "PENDING",
            "human_overall_score": None,
            "adjudicated": False,
        },
        {
            "case_id": "CASE_COMPLETED_02",
            "cv_id": "CV_02",
            "jd_id": "JD_02",
            "proposed_requirements": [
                {
                    "requirement_id": "R2",
                    "canonical_name": "FastAPI",
                    "review_status": "APPROVED",
                    "evidence_relation": "DIRECT",
                    "requirement_outcome": "SATISFIED",
                    "required_level": "REQUIRED",
                    "expected_proficiency": "SENIOR",
                    "importance": 4.0,
                    "hard_gate": False,
                    "expected_evidence": [{"quote": "5 years FastAPI experience", "section": "experience"}],
                }
            ],
            "boolean_groups": [],
            "human_review_status": "COMPLETED",
            "human_overall_score": 95.0,
            "adjudicated": True,
        },
    ]

    workspace_file.write_text(json.dumps(mock_data, ensure_ascii=False), encoding="utf-8")

    status = get_annotation_status(workspace_file)
    assert status["selected_pairs"] == 2
    assert status["requirements_total"] == 2
    assert status["requirements_reviewed"] == 1
    assert status["requirements_pending"] == 1
    assert status["cases_ready_for_gold"] == 1

    gold_cases = export_gold_benchmark(workspace_file, gold_file)
    assert len(gold_cases) == 1
    assert gold_cases[0].case_id == "CASE_COMPLETED_02"
    assert gold_cases[0].data_origin == "REAL"
    assert gold_cases[0].human_overall_score == 95.0
    assert gold_cases[0].requirements[0].evidence_relation == "DIRECT"
    assert gold_cases[0].requirements[0].requirement_outcome == "SATISFIED"


def test_gold_split_merge_remove_and_boolean_lifecycle(tmp_path: Path):
    """Validate proposal to gold transformations: REMOVE, SPLIT, MERGE, and BOOLEAN corrections."""
    from eval.v1_eval.annotation_workspace import export_jd_gold, generate_parser_baseline, get_jd_annotation_status

    jd_annotation_file = tmp_path / "test_jd_annotations.json"
    jd_gold_file = tmp_path / "test_jd_gold.json"
    baseline_file = tmp_path / "test_parser_baseline.json"

    # Mock JD with:
    # Proposal 1 (P_ING): Token error ("ing") -> Action: REMOVE
    # Proposal 2 (P_PY_FAST): Compound requirement -> Action: SPLIT into G_PY and G_FASTAPI
    # Proposal 3 (P_SPRING1) & Proposal 4 (P_SPRING2): Duplicates -> Action: MERGE into G_SPRING
    # Proposal 5-8: Overgrouped ANY_OF [REST API, Spring Boot, MySQL, PostgreSQL] -> Action: SPLIT_GROUP into standalone REST API, Spring Boot + ANY_OF [MySQL, PostgreSQL]
    mock_jd = [
        {
            "jd_id": "JD-001",
            "jd_title": "Backend Engineer",
            "company_name": "Tech Corp",
            "domain_category": "Backend",
            "job_level": "MIDDLE",
            "original_jd_text": "We need Python and FastAPI. Experience with MySQL/PostgreSQL. Benefits...",
            "review_status": "COMPLETED",
            "adjudicated": True,
            "proposed_requirements": [
                {"requirement_id": "P_ING", "canonical_name": "ing", "required_level": "REQUIRED", "hard_gate": False},
                {"requirement_id": "P_PY_FAST", "canonical_name": "Python and FastAPI", "required_level": "REQUIRED", "hard_gate": False},
                {"requirement_id": "P_SPRING1", "canonical_name": "Spring", "required_level": "REQUIRED", "hard_gate": False},
                {"requirement_id": "P_SPRING2", "canonical_name": "Spring Boot", "required_level": "REQUIRED", "hard_gate": False},
                {"requirement_id": "P_REST", "canonical_name": "REST API", "required_level": "REQUIRED", "hard_gate": False},
                {"requirement_id": "P_MYSQL", "canonical_name": "MySQL", "required_level": "REQUIRED", "hard_gate": False},
                {"requirement_id": "P_PG", "canonical_name": "PostgreSQL", "required_level": "REQUIRED", "hard_gate": False},
            ],
            "proposed_boolean_groups": [
                {
                    "group_id": "GRP_ANY_OVERGROUP",
                    "operator": "ANY_OF",
                    "min_required": 1,
                    "member_requirement_ids": ["P_REST", "P_SPRING1", "P_MYSQL", "P_PG"],
                }
            ],
            # Human corrections:
            "reviewed_requirements": [
                # Case A: P_ING removed (not in gold)
                # Case B: P_PY_FAST split into 2 gold reqs:
                {
                    "gold_requirement_id": "GOLD_JD001_REQ_001",
                    "canonical_name": "Python",
                    "source_proposal_ids": ["P_PY_FAST"],
                    "required_level": "REQUIRED",
                    "hard_gate": False,
                    "review_action": "SPLIT",
                    "error_type": "UNDER_SPLIT",
                },
                {
                    "gold_requirement_id": "GOLD_JD001_REQ_002",
                    "canonical_name": "FastAPI",
                    "source_proposal_ids": ["P_PY_FAST"],
                    "required_level": "REQUIRED",
                    "hard_gate": False,
                    "review_action": "SPLIT",
                    "error_type": "UNDER_SPLIT",
                },
                # Case C: P_SPRING1 and P_SPRING2 merged into 1 gold req:
                {
                    "gold_requirement_id": "GOLD_JD001_REQ_003",
                    "canonical_name": "Spring Boot",
                    "source_proposal_ids": ["P_SPRING1", "P_SPRING2"],
                    "required_level": "REQUIRED",
                    "hard_gate": False,
                    "review_action": "MERGE",
                    "error_type": "DUPLICATE_REQUIREMENT",
                },
                # Case D: REST API standalone
                {
                    "gold_requirement_id": "GOLD_JD001_REQ_004",
                    "canonical_name": "REST API",
                    "source_proposal_ids": ["P_REST"],
                    "required_level": "REQUIRED",
                    "hard_gate": False,
                    "review_action": "APPROVE",
                },
                # Case D: Database options
                {
                    "gold_requirement_id": "GOLD_JD001_REQ_005",
                    "canonical_name": "MySQL",
                    "source_proposal_ids": ["P_MYSQL"],
                    "required_level": "REQUIRED",
                    "hard_gate": False,
                    "review_action": "APPROVE",
                },
                {
                    "gold_requirement_id": "GOLD_JD001_REQ_006",
                    "canonical_name": "PostgreSQL",
                    "source_proposal_ids": ["P_PG"],
                    "required_level": "REQUIRED",
                    "hard_gate": False,
                    "review_action": "APPROVE",
                },
                # Track removed proposal error:
                {
                    "gold_requirement_id": "DISCARDED_P_ING",
                    "canonical_name": "ing",
                    "source_proposal_ids": ["P_ING"],
                    "review_action": "REMOVE",
                    "error_type": "TOKENIZATION_ERROR",
                },
            ],
            "reviewed_boolean_groups": [
                # Corrected boolean group (only DBs):
                {
                    "gold_group_id": "GOLD_JD001_GRP_001",
                    "operator": "ANY_OF",
                    "min_required": 1,
                    "member_gold_requirement_ids": ["GOLD_JD001_REQ_005", "GOLD_JD001_REQ_006"],
                    "source_proposal_group_ids": ["GRP_ANY_OVERGROUP"],
                    "review_action": "SPLIT_GROUP",
                }
            ],
        }
    ]

    jd_annotation_file.write_text(json.dumps(mock_jd, ensure_ascii=False), encoding="utf-8")

    # 1. Test status
    status = get_jd_annotation_status(jd_annotation_file)
    assert status["total_unique_jds"] == 1
    assert status["completed_jds"] == 1
    assert status["completion_pct"] == 100.0

    # 2. Test export
    exported = export_jd_gold(jd_annotation_file, jd_gold_file)
    assert len(exported) == 1
    assert len(exported[0]["gold_requirements"]) == 6
    assert len(exported[0]["gold_boolean_groups"]) == 1

    # 3. Test baseline calculation
    metrics = generate_parser_baseline(jd_gold_file, baseline_file)
    assert metrics["reviewed_jds_count"] == 1
    assert "requirement_extraction_precision" in metrics
    assert "parser_noise_rate" in metrics
    assert "duplicate_requirement_rate" in metrics

    # 4. Pair annotation verification:
    # A pair referencing this JD should only contain valid gold IDs:
    pair_entry = {
        "case_id": "CASE_JD-001_CV-01",
        "jd_id": "JD-001",
        "requirement_results": [
            {"gold_requirement_id": "GOLD_JD001_REQ_001", "evidence_relation": "DIRECT", "requirement_outcome": "SATISFIED"},
            {"gold_requirement_id": "GOLD_JD001_REQ_002", "evidence_relation": "DIRECT", "requirement_outcome": "SATISFIED"},
            {"gold_requirement_id": "GOLD_JD001_REQ_003", "evidence_relation": "NO_EVIDENCE", "requirement_outcome": "UNSATISFIED"},
            {"gold_requirement_id": "GOLD_JD001_REQ_004", "evidence_relation": "DIRECT", "requirement_outcome": "SATISFIED"},
            {"gold_requirement_id": "GOLD_JD001_REQ_005", "evidence_relation": "DIRECT", "requirement_outcome": "SATISFIED"},
            {"gold_requirement_id": "GOLD_JD001_REQ_006", "evidence_relation": "NO_EVIDENCE", "requirement_outcome": "UNSATISFIED"},
        ]
    }
    gold_ids = {r["gold_requirement_id"] for r in exported[0]["gold_requirements"] if r.get("review_action") != "REMOVE"}
    pair_gold_ids = {r["gold_requirement_id"] for r in pair_entry["requirement_results"]}
    assert pair_gold_ids.issubset(gold_ids)
    assert "P_ING" not in pair_gold_ids
    assert "P_PY_FAST" not in pair_gold_ids


def test_gold_id_immutability_and_monotonic_allocation():
    """Verify Gold IDs are allocated monotonically and never change under reorder, REMOVE, SPLIT, or MERGE."""
    from eval.v1_eval.annotation_workspace import allocate_next_gold_grp_id, allocate_next_gold_req_id

    existing_req_ids = ["GOLD_JD001_REQ_001", "GOLD_JD001_REQ_002"]

    # 1. Monotonic next allocation for SPLIT
    next_split_id = allocate_next_gold_req_id("JD-001", existing_req_ids)
    assert next_split_id == "GOLD_JD001_REQ_003"

    # 2. Removing an ID (e.g. REQ_001) does NOT cause subsequent allocation to reuse or renumber
    post_remove_ids = ["GOLD_JD001_REQ_002", "GOLD_JD001_REQ_003"]
    next_after_remove = allocate_next_gold_req_id("JD-001", post_remove_ids)
    assert next_after_remove == "GOLD_JD001_REQ_004"

    # 3. Reordering IDs does not affect next monotonic allocation
    reordered_ids = ["GOLD_JD001_REQ_003", "GOLD_JD001_REQ_001", "GOLD_JD001_REQ_004"]
    next_after_reorder = allocate_next_gold_req_id("JD-001", reordered_ids)
    assert next_after_reorder == "GOLD_JD001_REQ_005"

    # 4. Monotonic group allocation
    existing_grp_ids = ["GOLD_JD001_GRP_001"]
    next_grp_id = allocate_next_gold_grp_id("JD-001", existing_grp_ids)
    assert next_grp_id == "GOLD_JD001_GRP_002"


def test_semantic_alignment_and_error_taxonomy():
    """Verify Gold <-> Proposal semantic alignment independently of requirement/group IDs."""
    from eval.v1_eval.metrics import align_proposals_to_gold, calculate_parser_metrics

    # Test cases:
    # 1. UNDER_SPLIT: Proposal has "Python and FastAPI", Gold has separate Python and FastAPI
    # 2. DUPLICATE: Proposals have "Spring" and "Spring Boot", Gold has only "Spring Boot"
    # 3. FALSE_EXTRACTION: Proposal has "Performance bonus", Gold has no match
    # 4. MISSING_EXTRACTION: Gold has "Valid Driver License", Proposal has no match
    # 5. EXACT_MATCH: Proposal has "Docker", Gold has "Docker"
    proposals = [
        {"requirement_id": "P1", "canonical_name": "Python and FastAPI", "source_sentence": "Must know Python and FastAPI."},
        {"requirement_id": "P2", "canonical_name": "Spring", "source_sentence": "Java, Spring Boot ecosystem."},
        {"requirement_id": "P3", "canonical_name": "Spring Boot", "source_sentence": "Java, Spring Boot ecosystem."},
        {"requirement_id": "P4", "canonical_name": "Performance bonus", "source_sentence": "Annual performance bonus."},
        {"requirement_id": "P5", "canonical_name": "Docker", "source_sentence": "Experience with Docker containers."},
    ]

    gold_reqs = [
        {"gold_requirement_id": "G1", "canonical_name": "Python", "source_sentence": "Must know Python and FastAPI.", "review_action": "SPLIT"},
        {"gold_requirement_id": "G2", "canonical_name": "FastAPI", "source_sentence": "Must know Python and FastAPI.", "review_action": "SPLIT"},
        {"gold_requirement_id": "G3", "canonical_name": "Spring Boot", "source_sentence": "Java, Spring Boot ecosystem.", "review_action": "MERGE"},
        {"gold_requirement_id": "G4", "canonical_name": "Docker", "source_sentence": "Experience with Docker containers.", "review_action": "APPROVE"},
        {"gold_requirement_id": "G5", "canonical_name": "Valid Driver License", "source_sentence": "Must possess a valid driver license.", "review_action": "APPROVE"},
    ]

    alignment = align_proposals_to_gold(proposals, gold_reqs)
    outcomes = alignment["structural_outcomes"]
    counts = alignment["taxonomy_counts"]

    assert outcomes["P1"] == "UNDER_SPLIT"
    assert outcomes["P2"] == "DUPLICATE_REQUIREMENT"
    assert outcomes["P3"] == "DUPLICATE_REQUIREMENT"
    assert outcomes["P4"] == "FALSE_EXTRACTION"
    assert outcomes["P5"] == "EXACT_MATCH"
    assert counts["MISSING_EXTRACTION"] == 1  # G5 was not extracted

    # Test Boolean semantic concept matching without relying on group IDs:
    jd_eval = [
        {
            "jd_id": "JD-001",
            "review_status": "COMPLETED",
            "adjudicated": True,
            "proposed_requirements": proposals,
            "proposed_boolean_groups": [
                # Parser created overgrouped ANY_OF [P1, P5]
                {"group_id": "P_GRP_1", "operator": "ANY_OF", "member_requirement_ids": ["P1", "P5"]}
            ],
            "gold_requirements": gold_reqs,
            "gold_boolean_groups": [
                # Gold expects ANY_OF [G1, G2] (Python, FastAPI)
                {"gold_group_id": "G_GRP_1", "operator": "ANY_OF", "member_gold_requirement_ids": ["G1", "G2"]}
            ],
        }
    ]

    metrics = calculate_parser_metrics(jd_eval)
    assert metrics["reviewed_jds_count"] == 1
    assert "error_taxonomy_counts" in metrics
    assert metrics["parser_noise_rate"] > 0
    assert metrics["duplicate_requirement_rate"] > 0


@pytest.mark.skipif(
    not Path("eval/datasets/real_jd_requirement_annotations_v1.json").exists()
    or not Path("eval/datasets/real_pair_annotations_v1.json").exists(),
    reason="Annotation datasets not found"
)
def test_actual_annotation_workspaces_contain_zero_prefilled_labels():
    """Audit actual JSON workspace files to guarantee zero fabricated human labels before human labeling starts."""
    jd_annot_path = Path("eval/datasets/real_jd_requirement_annotations_v1.json")
    pair_annot_path = Path("eval/datasets/real_pair_annotations_v1.json")

    assert jd_annot_path.exists(), f"Missing {jd_annot_path}"
    assert pair_annot_path.exists(), f"Missing {pair_annot_path}"

    with open(jd_annot_path, encoding="utf-8") as f:
        jd_annotations = json.load(f)

    with open(pair_annot_path, encoding="utf-8") as f:
        pair_annotations = json.load(f)

    assert len(jd_annotations) == 29
    assert len(pair_annotations) == 80

    # Verify JD-level workspace: 27 JDs are pending, JD-001 and JD-002 have valid annotations
    j1 = next(j for j in jd_annotations if j["jd_id"] == "JD-001")
    assert "GOLD_JD001_REQ_014" in j1.get("tombstoned_requirement_ids", [])
    assert any(r.get("gold_requirement_id") == "GOLD_JD001_REQ_014" and r.get("active") is False for r in j1.get("reviewed_requirements", []))

    j2 = next(j for j in jd_annotations if j["jd_id"] == "JD-002")
    assert "GOLD_JD002_REQ_014" in j2.get("tombstoned_requirement_ids", [])
    assert len([r for r in j2.get("reviewed_requirements", []) if r.get("active", True) and r.get("review_action") != "REMOVE"]) == 15

    for jd in jd_annotations:
        if jd["jd_id"] not in {"JD-001", "JD-002"}:
            assert jd.get("review_status") == "PENDING"
            assert jd.get("adjudicated") is False
            assert len(jd.get("reviewed_requirements", [])) == 0
            assert len(jd.get("reviewed_boolean_groups", [])) == 0

    # Verify Pair-level workspace is completely clean of prefilled human labels:
    for pair in pair_annotations:
        assert pair.get("human_review_status") == "PENDING"
        assert pair.get("human_overall_score") is None
        assert pair.get("adjudicated") is False
        for res in pair.get("requirement_results", []):
            assert res.get("evidence_relation") is None, f"Found prefilled evidence_relation in {pair['case_id']}"
            assert res.get("requirement_outcome") is None, f"Found prefilled requirement_outcome in {pair['case_id']}"
            assert res.get("expected_evidence") == [], f"Found prefilled expected_evidence in {pair['case_id']}"
            assert res.get("human_is_critical_gap") is None
            assert res.get("adjudicated") is False


def test_persistent_monotonic_allocator_and_non_reuse():
    """Verify persistent monotonic allocation guarantees non-reuse even after removing highest ID."""
    from eval.v1_eval.annotation_workspace import (
        allocate_next_gold_grp_id,
        allocate_next_gold_req_id,
        remove_gold_requirement,
    )

    jd_data = {
        "jd_id": "JD-001",
        "next_gold_requirement_index": 1,
        "next_gold_group_index": 1,
        "reviewed_requirements": [],
        "reviewed_boolean_groups": [],
        "tombstoned_requirement_ids": [],
        "tombstoned_group_ids": [],
    }

    # 1. Allocate 001, 002, 003
    id1 = allocate_next_gold_req_id(jd_data)
    jd_data["reviewed_requirements"].append({"gold_requirement_id": id1})
    id2 = allocate_next_gold_req_id(jd_data)
    jd_data["reviewed_requirements"].append({"gold_requirement_id": id2})
    id3 = allocate_next_gold_req_id(jd_data)
    jd_data["reviewed_requirements"].append({"gold_requirement_id": id3})

    assert id1 == "GOLD_JD001_REQ_001"
    assert id2 == "GOLD_JD001_REQ_002"
    assert id3 == "GOLD_JD001_REQ_003"
    assert jd_data["next_gold_requirement_index"] == 4

    # 2. Remove highest ID (003)
    remove_gold_requirement(jd_data, "GOLD_JD001_REQ_003")
    # Record is preserved with active=False for provenance
    assert len(jd_data["reviewed_requirements"]) == 3
    r3 = next(r for r in jd_data["reviewed_requirements"] if r.get("gold_requirement_id") == "GOLD_JD001_REQ_003")
    assert r3["active"] is False
    assert r3["review_action"] == "REMOVE"
    assert "GOLD_JD001_REQ_003" in jd_data["tombstoned_requirement_ids"]

    # 3. Next allocation MUST be 004 (never 003!)
    id4 = allocate_next_gold_req_id(jd_data)
    assert id4 == "GOLD_JD001_REQ_004"
    assert jd_data["next_gold_requirement_index"] == 5

    # 4. Group allocator test: create 001, 002 -> remove 002 -> next MUST be 003
    g1 = allocate_next_gold_grp_id(jd_data)
    jd_data["reviewed_boolean_groups"].append({"gold_group_id": g1})
    g2 = allocate_next_gold_grp_id(jd_data)
    jd_data["reviewed_boolean_groups"].append({"gold_group_id": g2})
    assert g1 == "GOLD_JD001_GRP_001"
    assert g2 == "GOLD_JD001_GRP_002"

    jd_data["reviewed_boolean_groups"].pop()
    jd_data["tombstoned_group_ids"].append(g2)

    g3 = allocate_next_gold_grp_id(jd_data)
    assert g3 == "GOLD_JD001_GRP_003"


def test_git_metadata_resolution_and_dirty_flag():
    """Verify Git commit SHA and dirty working tree status resolution."""
    from eval.v1_eval.annotation_workspace import compute_parser_config_hash, resolve_git_metadata

    git_sha, git_dirty = resolve_git_metadata()
    if git_sha is not None:
        assert len(git_sha) == 40
    assert isinstance(git_dirty, bool)

    config = {"model": "heuristic+regex", "pipeline_version": "v1.0"}
    h1 = compute_parser_config_hash(config)
    h2 = compute_parser_config_hash(config)
    assert h1 == h2
    assert len(h1) == 16


def test_atomic_save_backup_and_validation(tmp_path: Path):
    """Verify atomic saving, backup creation, duplicate ID rejection, and dangling member rejection."""
    import pytest
    from eval.v1_eval.annotation_workspace import (
        generate_parser_baseline,
        save_jd_annotations_atomically,
        validate_jd_ground_truth,
    )

    workspace_file = tmp_path / "test_workspace.json"

    # Valid JD data
    jd_data = [
        {
            "jd_id": "JD-001",
            "next_gold_requirement_index": 3,
            "next_gold_group_index": 2,
            "reviewed_requirements": [
                {"gold_requirement_id": "GOLD_JD001_REQ_001", "canonical_name": "Python", "review_action": "APPROVE"},
                {"gold_requirement_id": "GOLD_JD001_REQ_002", "canonical_name": "FastAPI", "review_action": "APPROVE"},
            ],
            "reviewed_boolean_groups": [
                {
                    "gold_group_id": "GOLD_JD001_GRP_001",
                    "operator": "ANY_OF",
                    "member_gold_requirement_ids": ["GOLD_JD001_REQ_001", "GOLD_JD001_REQ_002"],
                }
            ],
            "tombstoned_requirement_ids": [],
            "tombstoned_group_ids": [],
        }
    ]

    # 1. Save valid data atomically
    save_jd_annotations_atomically(jd_data, workspace_file, create_backup=True)
    assert workspace_file.exists()

    # 2. Save again and verify backup creation
    save_jd_annotations_atomically(jd_data, workspace_file, create_backup=True)
    backups = list(tmp_path.glob("test_workspace.bak.*"))
    assert len(backups) >= 1

    # 3. Duplicate Gold ID rejection
    duplicate_jd = {
        "jd_id": "JD-001",
        "reviewed_requirements": [
            {"gold_requirement_id": "GOLD_JD001_REQ_001", "review_action": "APPROVE", "active": True},
            {"gold_requirement_id": "GOLD_JD001_REQ_001", "review_action": "APPROVE", "active": True},
        ],
        "reviewed_boolean_groups": [],
    }
    errs = validate_jd_ground_truth(duplicate_jd)
    assert any("Duplicate active gold_requirement_id" in e for e in errs)

    with pytest.raises(ValueError, match="Validation failed"):
        save_jd_annotations_atomically([duplicate_jd], workspace_file, create_backup=False)

    # 4. Dangling Boolean member rejection
    dangling_jd = {
        "jd_id": "JD-001",
        "reviewed_requirements": [
            {"gold_requirement_id": "GOLD_JD001_REQ_001", "review_action": "APPROVE"}
        ],
        "reviewed_boolean_groups": [
            {
                "gold_group_id": "GOLD_JD001_GRP_001",
                "member_gold_requirement_ids": ["GOLD_JD001_REQ_001", "NONEXISTENT_REQ_999"],
            }
        ],
        "tombstoned_requirement_ids": [],
    }
    dangling_errs = validate_jd_ground_truth(dangling_jd)
    assert any("references nonexistent gold requirement" in e for e in dangling_errs)

    # 5. Incomplete Gold cannot generate baseline
    empty_gold_file = tmp_path / "empty_gold.json"
    empty_gold_file.write_text("[]", encoding="utf-8")
    with pytest.raises(ValueError, match="Cannot generate parser baseline from empty"):
        generate_parser_baseline(empty_gold_file, tmp_path / "out.json")


def test_remove_tombstone_state_consistency_and_provenance(tmp_path: Path):
    """Verify REMOVE/tombstone consistency, active filtering in exports, and pair workspace refresh."""
    from eval.v1_eval.annotation_workspace import (
        allocate_next_gold_req_id,
        export_jd_gold,
        refresh_pair_workspace_from_jd_gold,
        save_jd_annotations_atomically,
        validate_jd_ground_truth,
    )

    jd_file = tmp_path / "jd_annotations.json"
    gold_file = tmp_path / "jd_gold.json"
    pairs_file = tmp_path / "pair_annotations.json"

    # Mock JD-001 with active items and 1 removed item (e.g. REQ_014 = "ing")
    jd_001 = {
        "jd_id": "JD-001",
        "review_status": "COMPLETED",
        "adjudicated": True,
        "next_gold_requirement_index": 16,
        "next_gold_group_index": 4,
        "tombstoned_requirement_ids": ["GOLD_JD001_REQ_014"],
        "tombstoned_group_ids": [],
        "proposed_requirements": [
            {"requirement_id": "P1", "canonical_name": "Data Structure"},
            {"requirement_id": "P2", "canonical_name": "Python"},
            {"requirement_id": "P14", "canonical_name": "ing"},
        ],
        "reviewed_requirements": [
            {"gold_requirement_id": "GOLD_JD001_REQ_001", "canonical_name": "Data Structure", "review_action": "APPROVE", "active": True},
            {"gold_requirement_id": "GOLD_JD001_REQ_006", "canonical_name": "Python", "review_action": "APPROVE", "active": True},
            {"gold_requirement_id": "GOLD_JD001_REQ_014", "canonical_name": "ing", "review_action": "REMOVE", "active": False, "error_type": "TOKENIZATION_ERROR"},
        ],
        "reviewed_boolean_groups": [
            {
                "gold_group_id": "GOLD_JD001_GRP_001",
                "operator": "ANY_OF",
                "min_required": 1,
                "member_gold_requirement_ids": ["GOLD_JD001_REQ_001", "GOLD_JD001_REQ_006"],
                "review_action": "APPROVE",
                "active": True,
            }
        ],
    }

    # 1. Validation check
    errs = validate_jd_ground_truth(jd_001)
    assert errs == []

    # 2. Save repeatedly - tombstones must not duplicate
    save_jd_annotations_atomically([jd_001], jd_file, create_backup=False)
    save_jd_annotations_atomically([jd_001], jd_file, create_backup=False)
    assert jd_001["tombstoned_requirement_ids"] == ["GOLD_JD001_REQ_014"]

    # 3. Next allocation for current JD-001 state remains REQ_016
    next_id = allocate_next_gold_req_id(jd_001)
    assert next_id == "GOLD_JD001_REQ_016"
    assert jd_001["next_gold_requirement_index"] == 17

    # 4. Export JD Gold - removed requirement must be excluded
    exported = export_jd_gold(jd_file, gold_file)
    assert len(exported) == 1
    exported_req_ids = [r["gold_requirement_id"] for r in exported[0]["gold_requirements"]]
    assert "GOLD_JD001_REQ_014" not in exported_req_ids
    assert exported_req_ids == ["GOLD_JD001_REQ_001", "GOLD_JD001_REQ_006"]

    # 5. Pair workspace refresh - removed requirement must not appear
    mock_pairs = [
        {
            "case_id": "CASE_JD-001_CV-01",
            "cv_id": "CV-01",
            "jd_id": "JD-001",
            "requirement_results": [],
        }
    ]
    pairs_file.write_text(json.dumps(mock_pairs, ensure_ascii=False), encoding="utf-8")
    refreshed_pairs = refresh_pair_workspace_from_jd_gold(gold_file, pairs_file)
    pair_req_ids = [r["gold_requirement_id"] for r in refreshed_pairs[0]["requirement_results"]]
    assert "GOLD_JD001_REQ_014" not in pair_req_ids
    assert pair_req_ids == ["GOLD_JD001_REQ_001", "GOLD_JD001_REQ_006"]

    # 6. Boolean group referencing removed requirement fails validation
    invalid_group_jd = {
        "jd_id": "JD-001",
        "tombstoned_requirement_ids": ["GOLD_JD001_REQ_014"],
        "tombstoned_group_ids": [],
        "reviewed_requirements": [
            {"gold_requirement_id": "GOLD_JD001_REQ_001", "review_action": "APPROVE", "active": True},
            {"gold_requirement_id": "GOLD_JD001_REQ_014", "review_action": "REMOVE", "active": False},
        ],
        "reviewed_boolean_groups": [
            {
                "gold_group_id": "GOLD_JD001_GRP_001",
                "operator": "ANY_OF",
                "member_gold_requirement_ids": ["GOLD_JD001_REQ_001", "GOLD_JD001_REQ_014"],
                "active": True,
            }
        ],
    }
    grp_errs = validate_jd_ground_truth(invalid_group_jd)
    assert any("references removed/tombstoned requirement" in e for e in grp_errs)


def test_cli_review_wizard_core_operations(tmp_path: Path):
    """Verify interactive CLI review wizard actions: APPROVE, EDIT, REMOVE, MERGE, SPLIT, ADD, resume and save."""
    from eval.review_jd import (
        cli_add_req,
        cli_approve_req,
        cli_edit_req,
        cli_merge_reqs,
        cli_remove_req,
        cli_split_req,
        init_jd_reviewed_structures,
    )
    from eval.v1_eval.annotation_workspace import (
        allocate_next_gold_req_id,
        remove_gold_group,
        save_jd_annotations_atomically,
        validate_jd_ground_truth,
    )

    test_file = tmp_path / "test_cli_jd.json"

    # Start with unreviewed JD
    jd_raw = {
        "jd_id": "JD-002",
        "jd_title": "Software Developer - Intern",
        "company_name": "Tech Corp",
        "domain_category": "Backend",
        "job_level": "INTERN",
        "original_jd_text": "Need Python and FastAPI. Familiar with MySQL or PostgreSQL. Performance bonus.",
        "review_status": "PENDING",
        "proposed_requirements": [
            {"requirement_id": "P1", "canonical_name": "Python and FastAPI", "source_sentence": "Need Python and FastAPI.", "required_level": "REQUIRED"},
            {"requirement_id": "P2", "canonical_name": "MySQL", "source_sentence": "Familiar with MySQL or PostgreSQL.", "required_level": "REQUIRED"},
            {"requirement_id": "P3", "canonical_name": "PostgreSQL", "source_sentence": "Familiar with MySQL or PostgreSQL.", "required_level": "REQUIRED"},
            {"requirement_id": "P4", "canonical_name": "Performance bonus", "source_sentence": "Performance bonus.", "required_level": "PREFERRED"},
        ],
        "proposed_boolean_groups": [
            {
                "group_id": "GRP_01",
                "operator": "ANY_OF",
                "min_required": 1,
                "member_requirement_ids": ["P2", "P3"],
            }
        ],
    }

    # 1. Initialize structures
    init_jd_reviewed_structures(jd_raw)
    assert len(jd_raw["reviewed_requirements"]) == 4
    assert len(jd_raw["reviewed_boolean_groups"]) == 1
    assert jd_raw["next_gold_requirement_index"] == 5

    # 2. APPROVE P2
    r_mysql = next(r for r in jd_raw["reviewed_requirements"] if "P2" in r["source_proposal_ids"])
    cli_approve_req(r_mysql)
    assert r_mysql["review_action"] == "APPROVE"
    assert r_mysql["active"] is True

    # 3. EDIT P3
    r_pg = next(r for r in jd_raw["reviewed_requirements"] if "P3" in r["source_proposal_ids"])
    cli_edit_req(r_pg, canonical_name="PostgreSQL DB", importance=4.5, notes="High priority DB")
    assert r_pg["canonical_name"] == "PostgreSQL DB"
    assert r_pg["importance"] == 4.5
    assert r_pg["review_action"] == "EDIT"

    # 4. REMOVE P4 (Benefit leak)
    r_bonus = next(r for r in jd_raw["reviewed_requirements"] if "P4" in r["source_proposal_ids"])
    cli_remove_req(jd_raw, r_bonus["gold_requirement_id"], error_type="BENEFIT_LEAK", notes="Company perk")
    assert r_bonus["active"] is False
    assert r_bonus["review_action"] == "REMOVE"
    assert r_bonus["error_type"] == "BENEFIT_LEAK"
    assert r_bonus["gold_requirement_id"] in jd_raw["tombstoned_requirement_ids"]

    # 5. SPLIT P1 ("Python and FastAPI" -> "Python", "FastAPI")
    r_py_fast = next(r for r in jd_raw["reviewed_requirements"] if "P1" in r["source_proposal_ids"])
    split_child_ids = cli_split_req(jd_raw, r_py_fast["gold_requirement_id"], ["Python", "FastAPI"])
    assert len(split_child_ids) == 2
    assert split_child_ids == ["GOLD_JD002_REQ_005", "GOLD_JD002_REQ_006"]
    assert r_py_fast["active"] is False
    assert r_py_fast["gold_requirement_id"] in jd_raw["tombstoned_requirement_ids"]
    assert jd_raw["next_gold_requirement_index"] == 7

    # 6. ADD missing requirement ("Docker")
    add_id = cli_add_req(jd_raw, canonical_name="Docker", source_sentence="Experience with Docker.", required_level="PREFERRED", hard_gate=False)
    assert add_id == "GOLD_JD002_REQ_007"
    assert jd_raw["next_gold_requirement_index"] == 8
    added_r = next(r for r in jd_raw["reviewed_requirements"] if r["gold_requirement_id"] == add_id)
    assert added_r["review_action"] == "ADD"
    assert added_r["error_type"] == "MISSING_EXTRACTION"
    assert added_r["active"] is True

    # 7. MERGE (split children into a framework bundle for test)
    merge_id = cli_merge_reqs(
        jd_raw,
        source_gold_ids=["GOLD_JD002_REQ_005", "GOLD_JD002_REQ_006"],
        merged_name="Python Backend Stack",
        required_level="REQUIRED",
    )
    assert merge_id == "GOLD_JD002_REQ_008"
    assert jd_raw["next_gold_requirement_index"] == 9
    assert "GOLD_JD002_REQ_005" in jd_raw["tombstoned_requirement_ids"]
    assert "GOLD_JD002_REQ_006" in jd_raw["tombstoned_requirement_ids"]
    merged_r = next(r for r in jd_raw["reviewed_requirements"] if r["gold_requirement_id"] == merge_id)
    assert merged_r["source_proposal_ids"] == ["P1"]
    assert merged_r["active"] is True

    # 8. Boolean Group REMOVAL
    grp = jd_raw["reviewed_boolean_groups"][0]
    remove_gold_group(jd_raw, grp["gold_group_id"])
    assert grp["active"] is False
    assert grp["review_action"] == "REMOVE"
    assert grp["gold_group_id"] in jd_raw["tombstoned_group_ids"]

    # 9. Atomic save & Resume verification
    errs = validate_jd_ground_truth(jd_raw)
    assert errs == []

    save_jd_annotations_atomically([jd_raw], test_file, create_backup=False)

    # Reload from disk (Resume test)
    reloaded = json.loads(test_file.read_text(encoding="utf-8"))[0]
    assert reloaded["next_gold_requirement_index"] == 9
    assert len(reloaded["tombstoned_requirement_ids"]) == 4  # REQ_004, REQ_001, REQ_005, REQ_006
    assert len(reloaded["tombstoned_group_ids"]) == 1

    # Next allocation continues correctly
    next_alloc = allocate_next_gold_req_id(reloaded)
    assert next_alloc == "GOLD_JD002_REQ_009"






