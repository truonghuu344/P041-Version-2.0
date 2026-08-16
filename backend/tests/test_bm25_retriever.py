from src.services.job_recommendations.bm25_retriever import BM25Retriever, retrieve_bm25

JOBS = [
    {
        "jd_snapshot_id": "jd-python",
        "retrieval_text": "Backend Engineer Python FastAPI PostgreSQL REST API",
    },
    {
        "jd_snapshot_id": "jd-design",
        "retrieval_text": "Product Designer Figma UX research prototyping",
    },
    {
        "jd_snapshot_id": "jd-java",
        "retrieval_text": "Backend Engineer Java Spring Boot PostgreSQL",
    },
]


def test_bm25_returns_ranked_candidates_without_a_fit_score():
    ranked = retrieve_bm25("Role: Backend Engineer\nSkills: Python, FastAPI, PostgreSQL", JOBS, k=2)

    assert [item.jd_snapshot_id for item in ranked] == ["jd-python", "jd-java"]
    assert [item.rank for item in ranked] == [1, 2]
    assert all(item.score >= 0 for item in ranked)
    assert not hasattr(ranked[0], "raw_fit_score")
    assert not hasattr(ranked[0], "display_fit_score")


def test_bm25_requires_a_nonempty_retrieval_query_and_valid_k():
    assert retrieve_bm25("", JOBS) == []

    try:
        BM25Retriever().retrieve("Python", JOBS, k=0)
    except ValueError as error:
        assert "k" in str(error)
    else:
        raise AssertionError("Invalid candidate count must be rejected.")
