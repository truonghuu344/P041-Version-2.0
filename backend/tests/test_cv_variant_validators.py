from src.services.cv_variant_service import extract_atomic_claims, is_meaningful_evidence, validate_claim_contract


def test_exact_candidate_fact_maps_to_snapshot_span():
    result = validate_claim_contract(
        claim="Built REST API using Python",
        source_text="Summary\nBuilt REST API using Python",
        snapshot_id="snapshot-1",
        jd_text="Python and Docker",
    )
    assert result["status"] == "SUPPORTED"
    assert result["evidence_ids"] == ["cv:snapshot-1:8:35"]


def test_rephrase_keeps_evidence_and_blocks_new_metric():
    safe = validate_claim_contract(
        claim="Developed REST API using Python",
        source_text="Built REST API using Python",
        evidence_text="Built REST API using Python",
    )
    unsafe = validate_claim_contract(
        claim="Developed REST API using Python and improved latency by 40%",
        source_text="Built REST API using Python",
        evidence_text="Built REST API using Python",
    )
    assert safe["status"] == "SUPPORTED_REPHRASE"
    assert unsafe["status"] == "BLOCKED_NUMERIC"


def test_rephrase_blocks_scope_inflation_and_jd_leakage():
    inflated = validate_claim_contract(
        claim="Led development of REST API using Python",
        source_text="Built REST API using Python",
        evidence_text="Built REST API using Python",
    )
    leaked = validate_claim_contract(
        claim="Built REST API using Python and Docker",
        source_text="Built REST API using Python",
        evidence_text="Built REST API using Python",
        jd_text="Docker is required",
    )
    assert inflated["status"] == "BLOCKED_CONTRADICTION"
    assert leaked["status"] == "BLOCKED_JD_LEAKAGE"


def test_controlled_user_confirmation_is_auditable_evidence():
    result = validate_claim_contract(
        claim="AWS Cloud Practitioner, June 2026",
        source_text="Python developer",
        confirmed=True,
    )
    assert result["status"] == "SUPPORTED_USER_CONFIRMED"
    assert result["evidence_ids"][0].startswith("user-confirmed:")


def test_personal_identifiers_are_not_evaluated_as_professional_claims():
    claims = extract_atomic_claims(
        {
            "personal_info": {"full_name": "Evidence Owner", "email": "owner@example.com"},
            "summary": "Backend developer using Python",
        }
    )
    assert claims == [("summary.0", "Backend developer using Python")]


def test_placeholder_text_is_not_candidate_evidence_or_a_verified_claim():
    assert not is_meaningful_evidence("fff\nff")
    result = validate_claim_contract(
        claim="Built a DevOps CI/CD pipeline using Docker",
        source_text="fff\nff",
        evidence_text="fff",
        jd_text="Docker, Kubernetes and CI/CD are required",
    )
    assert result["status"] == "INSUFFICIENT_EVIDENCE"
    assert result["evidence_ids"] == []
