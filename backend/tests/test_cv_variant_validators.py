from src.services.cv_variant_service import validate_claim_contract


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
