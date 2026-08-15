from __future__ import annotations

from src.services.cv_blocks import apply_cv_block_patches, public_cv_blocks


def _parsed_cv() -> dict:
    return {
        "summary": "Python backend developer",
        "skills": ["Python", "SQLite"],
        "experience": [
            {
                "company": "Example Co",
                "description": "Built internal APIs using Python",
                "bullets": ["Maintained SQLite databases"],
            }
        ],
    }


def test_public_blocks_have_stable_ids_and_exact_text():
    blocks = public_cv_blocks(_parsed_cv())

    assert blocks == [
        {"block_id": "summary-001", "section": "summary", "text": "Python backend developer"},
        {"block_id": "skills-001", "section": "skills", "text": "Python, SQLite"},
        {
            "block_id": "experience-001-description",
            "section": "experience",
            "text": "Built internal APIs using Python",
        },
        {
            "block_id": "experience-001-bullet-001",
            "section": "experience",
            "text": "Maintained SQLite databases",
        },
    ]


def test_apply_block_patches_preserves_source_and_structure():
    source = _parsed_cv()
    optimized, applied, invalid = apply_cv_block_patches(
        source,
        [
            {
                "block_id": "experience-001-description",
                "section": "experience",
                "original_text": "Built internal APIs using Python",
                "optimized_text": "Developed internal APIs using Python",
            }
        ],
    )

    assert applied == ["experience-001-description"]
    assert invalid == []
    assert source["experience"][0]["description"] == "Built internal APIs using Python"
    assert optimized["experience"][0]["description"] == "Developed internal APIs using Python"
    assert optimized["experience"][0]["company"] == "Example Co"
    assert optimized["experience"][0]["bullets"] == ["Maintained SQLite databases"]


def test_apply_block_patches_rejects_unknown_duplicate_and_inexact_patches():
    source = _parsed_cv()
    valid = {
        "block_id": "summary-001",
        "section": "summary",
        "original_text": "Python backend developer",
        "optimized_text": "Backend developer using Python",
    }
    optimized, applied, invalid = apply_cv_block_patches(
        source,
        [
            valid,
            valid,
            {
                "block_id": "new-section-001",
                "section": "new-section",
                "original_text": "Anything",
                "optimized_text": "Something",
            },
            {
                "block_id": "skills-001",
                "section": "experience",
                "original_text": "Python, SQLite",
                "optimized_text": "Python",
            },
        ],
    )

    assert applied == ["summary-001"]
    assert invalid == ["summary-001", "new-section-001", "skills-001"]
    assert optimized["summary"] == "Backend developer using Python"
    assert optimized["skills"] == ["Python", "SQLite"]
