from __future__ import annotations

import json
from pathlib import Path

from src.services.cv_variant_service import validate_claim_contract
from src.services.pdf_export import build_cv_pdf

CORPUS = Path(__file__).parents[2] / "eval" / "cv_variants" / "claims.jsonl"


def _cases():
    return [json.loads(line) for line in CORPUS.read_text(encoding="utf-8").splitlines() if line.strip()]


def test_100_claim_publish_guard_benchmark():
    cases = _cases()
    assert len(cases) == 100
    assert {category: sum(item["category"] == category for item in cases) for category in {"supported", "unsupported", "conflicting", "numeric"}} == {
        "supported": 50,
        "unsupported": 25,
        "conflicting": 15,
        "numeric": 10,
    }
    outcomes = []
    for case in cases:
        result = validate_claim_contract(
            claim=case["claim"],
            source_text=case["source"],
            evidence_text=case.get("evidence"),
            jd_text="Kubernetes is required",
        )
        passed = result["status"].startswith("SUPPORTED")
        outcomes.append((case, passed, result))
        assert passed is (case["expected"] == "pass"), (case, result)

    publishable = [item for item in outcomes if item[1]]
    unsupported_publish_rate = sum(item[0]["expected"] == "block" for item in publishable) / max(1, len(publishable))
    evidence_coverage = sum(bool(item[2]["evidence_ids"]) for item in publishable) / max(1, len(publishable))
    assert unsupported_publish_rate == 0
    assert evidence_coverage == 1


def test_render_success_rate_is_at_least_95_percent():
    cases = _cases()
    successes = 0
    templates = ("classic", "modern", "compact")
    for index, case in enumerate(cases):
        try:
            pdf = build_cv_pdf(
                title=f"Evaluation {case['id']}",
                parsed={
                    "personal_info": {"full_name": "Evaluation Candidate"},
                    "summary": case["claim"],
                    "skills": ["Python"],
                    "experience": [],
                    "projects": [],
                    "education": [],
                },
                accepted_suggestions=[],
                template_name=templates[index % len(templates)],
            )
            page_count = pdf.count(b"/Type /Page")
            successes += bool(pdf.startswith(b"%PDF") and 1 <= page_count <= 2)
        except Exception:
            pass
    assert successes / len(cases) >= 0.95
