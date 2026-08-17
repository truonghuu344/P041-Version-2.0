from __future__ import annotations

from src.services.cv_jd_matching import build_cv_jd_evidence
from src.services.cv_jd_pipeline import EmbeddingService


def test_embedding_service_batch_and_cache():
    embedder = EmbeddingService(dimensions=128)
    texts = ["Python developer with FastAPI", "React frontend with TypeScript", "SQL database management"]

    vectors = embedder.embed_batch(texts)
    assert len(vectors) == 3
    assert all(isinstance(v, dict) for v in vectors)

    # Check cache hit
    vec0_again = embedder.embed("Python developer with FastAPI")
    assert vec0_again == vectors[0]


def test_cv_jd_evidence_run_with_optimized_pipeline():
    result = build_cv_jd_evidence(
        cv_text="Backend Engineer with 3 years experience in Python, FastAPI, and PostgreSQL.",
        parsed_cv={
            "skills": ["Python", "FastAPI", "PostgreSQL"],
            "experience": [{"description": "Developed high throughput APIs with FastAPI and PostgreSQL."}],
            "ats_quality": {"score": 90},
        },
        jd_title="Senior Python Backend Developer",
        jd_requirements="Requirements:\n- Strong knowledge of Python and FastAPI.\n- Experience with PostgreSQL.\n- Docker is a plus.",
    )

    assert "match_score" in result
    assert result["match_score"] > 50
    assert "Python" in result["hard_skills_matching"]
    assert "FastAPI" in result["hard_skills_matching"]
    assert "PostgreSQL" in result["hard_skills_matching"]
    assert len(result["requirement_evidence"]) > 0

