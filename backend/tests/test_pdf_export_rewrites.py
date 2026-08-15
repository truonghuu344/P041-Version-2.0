from src.services.pdf_export import apply_accepted_rewrites


def test_apply_accepted_rewrites_replaces_export_copy_and_preserves_source():
    source = {
        "summary": "Backend developer",
        "experience": [{"description": "Built REST API using Python"}],
    }
    exported, unmatched = apply_accepted_rewrites(
        source,
        [("Built REST API using Python", "Developed REST API using Python")],
    )

    assert source["experience"][0]["description"] == "Built REST API using Python"
    assert exported["experience"][0]["description"] == "Developed REST API using Python"
    assert unmatched == []


def test_apply_accepted_rewrites_keeps_unmatched_text_for_legacy_export_section():
    exported, unmatched = apply_accepted_rewrites(
        {"summary": "Backend developer"},
        [("Original bullet not in parsed JSON", "Verified replacement")],
    )

    assert exported == {"summary": "Backend developer"}
    assert unmatched == ["Verified replacement"]
