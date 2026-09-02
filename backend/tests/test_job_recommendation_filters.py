from src.schemas.job_recommendation import JobRecommendationRequest
from src.services.job_recommendation_filters import apply_filters

JOBS = [
    {
        "source_id": "remote-platform",
        "title": "Platform Engineer",
        "location": "Ho Chi Minh City",
        "remote_type": "Remote",
        "employment_type": "Full-time",
        "job_level": "Middle",
        "domain": "Technology",
    },
    {
        "source_id": "hybrid-backend",
        "title": "Backend Developer",
        "location": "Ha Noi",
        "remote_type": "Hybrid",
        "employment_type": "Part-time",
        "job_level": "Junior",
        "domain": "Technology",
    },
]


def test_hard_filters_are_applied_before_retrieval_candidates():
    filters = JobRecommendationRequest(
        cv_snapshot_id="snapshot-1",
        location="Ho Chi Minh City",
        location_required=True,
        remote_only=True,
        job_type="Full-time",
    )

    jobs = apply_filters(JOBS, filters)

    assert [job["source_id"] for job in jobs] == ["remote-platform"]


def test_role_seniority_and_industry_are_soft_preferences_not_exclusions():
    filters = JobRecommendationRequest(
        cv_snapshot_id="snapshot-1",
        role="Backend Developer",
        seniority="Senior",
        industry="Finance",
    )

    jobs = apply_filters(JOBS, filters)

    assert {job["source_id"] for job in jobs} == {"remote-platform", "hybrid-backend"}
    platform = next(job for job in jobs if job["source_id"] == "remote-platform")
    assert platform["metadata_preference_score"] > 0


def test_explicit_student_filters_limit_role_keyword_location_and_work_mode():
    jobs = apply_filters(
        [
            {
                "source_id": "fullstack-hanoi",
                "title": "Full Stack Node.js Engineer",
                "company": "Example",
                "location": "Hà Nội",
                "remote_type": "On-site",
                "skills": ["Node.js", "React"],
            },
            {
                "source_id": "remote-data",
                "title": "Data Engineer",
                "company": "Example",
                "location": "TP. Hồ Chí Minh",
                "remote_type": "Remote",
                "skills": ["Python"],
            },
        ],
        JobRecommendationRequest(
            cv_snapshot_id="snapshot-1",
            keyword="nodejs",
            role="Fullstack",
            role_required=True,
            location="Ha Noi",
            location_required=True,
            work_mode="onsite",
        ),
    )

    assert [job["source_id"] for job in jobs] == ["fullstack-hanoi"]


def test_backend_role_affinity_prefers_fullstack_over_penetration_testing():
    jobs = apply_filters(
        [
            {"source_id": "fullstack", "title": "Fullstack Engineer", "skills": ["NodeJS", "React"]},
            {"source_id": "security", "title": "Penetration Tester - Intern", "skills": ["Python"]},
        ],
        JobRecommendationRequest(cv_snapshot_id="snapshot-1", role="Backend Developer"),
    )

    by_id = {job["source_id"]: job for job in jobs}
    assert by_id["fullstack"]["role_relevant"] is True
    assert by_id["security"]["role_relevant"] is False
    assert by_id["fullstack"]["role_affinity_score"] > by_id["security"]["role_affinity_score"]


def test_at_01_backend_primary_nodejs_and_spring_boot():
    """AT-01: JD Node.js Backend, Spring Boot Backend -> primary, role_relevant=true."""
    jobs = apply_filters(
        [
            {"source_id": "node-backend", "title": "Node.js Backend Developer", "skills": ["Node.js", "Express", "PostgreSQL"]},
            {"source_id": "spring-backend", "title": "Spring Boot Backend Engineer", "skills": ["Java", "Spring Boot", "MySQL"]},
        ],
        JobRecommendationRequest(cv_snapshot_id="snapshot-1", role="Backend Developer"),
    )
    by_id = {job["source_id"]: job for job in jobs}
    assert by_id["node-backend"]["role_track"] == "primary"
    assert by_id["node-backend"]["role_relevant"] is True
    assert by_id["spring-backend"]["role_track"] == "primary"
    assert by_id["spring-backend"]["role_relevant"] is True


def test_at_02_fullstack_primary_with_node_api_database():
    """AT-02: JD Fullstack có Node.js/API/database -> primary, role_relevant=true."""
    jobs = apply_filters(
        [
            {"source_id": "fullstack-node", "title": "Fullstack Developer", "skills": ["Node.js", "React", "REST API", "MongoDB"]},
        ],
        JobRecommendationRequest(cv_snapshot_id="snapshot-1", role="Backend Developer"),
    )
    job = jobs[0]
    assert job["role_track"] == "primary"
    assert job["role_relevant"] is True


def test_at_03_ai_application_adjacent():
    """AT-03: JD AI Engineer có LLM/API/database/backend -> adjacent, role_relevant=true."""
    jobs = apply_filters(
        [
            {"source_id": "ai-app-eng", "title": "AI Engineer", "skills": ["LLM", "FastAPI", "PostgreSQL", "Backend"]},
        ],
        JobRecommendationRequest(cv_snapshot_id="snapshot-1", role="Backend Developer"),
    )
    job = jobs[0]
    assert job["role_track"] == "adjacent"
    assert job["role_relevant"] is True
    assert "adjacent" in job["role_reason"] or "phù hợp hướng phụ" in job["role_reason"]


def test_at_04_pure_ai_ml_mismatch():
    """AT-04: JD AI/ML thuần: training model, TensorFlow, computer vision, OCR -> mismatch, role_relevant=false."""
    jobs = apply_filters(
        [
            {"source_id": "pure-ml", "title": "AI / ML Engineer", "skills": ["TensorFlow", "Model Training", "Computer Vision", "OCR"]},
            {"source_id": "cv-engineer", "title": "Computer Vision Engineer", "skills": ["PyTorch", "Deep Learning", "OCR"]},
        ],
        JobRecommendationRequest(cv_snapshot_id="snapshot-1", role="Backend Developer"),
    )
    by_id = {job["source_id"]: job for job in jobs}
    assert by_id["pure-ml"]["role_track"] == "mismatch"
    assert by_id["pure-ml"]["role_relevant"] is False
    assert by_id["cv-engineer"]["role_track"] == "mismatch"
    assert by_id["cv-engineer"]["role_relevant"] is False
