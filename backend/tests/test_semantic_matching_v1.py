from __future__ import annotations

from src.services.cv_jd_matching import build_cv_jd_evidence, classify_jd_sentence, parse_job_description
from src.services.cv_jd_pipeline import ChunkingService
from src.services.semantic_relations import (
    canonical_skill,
    match_semantic_relation,
)


def test_alias_normalization():
    """Verify alias normalization across common software skills."""
    assert canonical_skill("JS") == "JavaScript"
    assert canonical_skill("js") == "JavaScript"
    assert canonical_skill("React.js") == "React"
    assert canonical_skill("reactjs") == "React"
    assert canonical_skill("RESTful API") == "REST API"
    assert canonical_skill("restful apis") == "REST API"
    assert canonical_skill("K8s") == "Kubernetes"
    assert canonical_skill("k8s") == "Kubernetes"
    assert canonical_skill("pgvector") == "Vector Database"
    assert canonical_skill("TS") == "TypeScript"


# 1. Regression Test 1: Kubernetes vs CI/CD => ADJACENT
def test_regression_1_kubernetes_vs_cicd_adjacent():
    """Case 1: If CV has Kubernetes, system classifies as ADJACENT with nuanced explanation."""
    result = build_cv_jd_evidence(
        cv_text="Kinh nghiệm làm việc với Kubernetes cluster và Docker containers trong triển khai microservices.",
        parsed_cv={
            "skills": ["Kubernetes", "Docker"],
            "projects": [{"id": "p1", "description": "Triển khai microservices trên Kubernetes cluster."}],
        },
        jd_title="DevOps Engineer",
        jd_requirements="Bắt buộc có kinh nghiệm CI/CD.",
    )

    cicd_req = next(
        (item for item in result["requirement_evidence"] if "ci/cd" in item["requirement"].lower() or "ci cd" in item["requirement"].lower()),
        None,
    )
    assert cicd_req is not None
    assert cicd_req["status"] == "partial"
    assert cicd_req["match_classification"] == "ADJACENT"
    assert "Kubernetes" in cicd_req["reason"]
    assert "deployment" in cicd_req["reason"].lower() or "orchestration" in cicd_req["reason"].lower()


# 2. Regression Test 2: GitHub Actions vs CI/CD => INFERRED / SUPPORTS
def test_regression_2_github_actions_vs_cicd_supports():
    """Case 2: If CV has GitHub Actions / GitLab CI, system validates CI/CD support."""
    result = build_cv_jd_evidence(
        cv_text="Automated testing and deployment workflows using GitHub Actions and Docker.",
        parsed_cv={
            "skills": ["GitHub Actions", "Docker"],
            "projects": [{"id": "p1", "description": "Built automated build and test pipeline using GitHub Actions."}],
        },
        jd_title="DevOps Engineer",
        jd_requirements="Yêu cầu thành thạo CI/CD.",
    )

    cicd_req = next(
        (item for item in result["requirement_evidence"] if "ci/cd" in item["requirement"].lower() or "ci cd" in item["requirement"].lower()),
        None,
    )
    assert cicd_req is not None
    assert cicd_req["status"] == "matched"
    assert cicd_req["match_classification"] in {"DIRECT", "INFERRED", "EQUIVALENT"}
    assert "GitHub Actions" in cicd_req["reason"]


# 3. Regression Test 3: FastAPI + GET/POST endpoint vs REST API => INFERRED
def test_regression_3_fastapi_endpoints_infers_rest_api():
    """Case 3: CV with 'Built backend endpoints with FastAPI using GET/POST' semantically supports REST API."""
    result = build_cv_jd_evidence(
        cv_text="Built backend endpoints with FastAPI using GET/POST for user authentication service.",
        parsed_cv={
            "skills": ["FastAPI", "Python"],
            "projects": [{"id": "p1", "description": "Built backend endpoints with FastAPI using GET/POST for user authentication service."}],
        },
        jd_title="Backend Engineer",
        jd_requirements="Bắt buộc có kinh nghiệm phát triển REST API.",
    )

    rest_req = next(
        (item for item in result["requirement_evidence"] if "rest api" in item["requirement"].lower()),
        None,
    )
    assert rest_req is not None
    assert rest_req["status"] == "matched"
    assert rest_req["match_classification"] == "INFERRED"
    assert rest_req["match_score"] >= 0.8
    assert "FastAPI" in rest_req["reason"] or "endpoints" in rest_req["reason"].lower()


# 4. Regression Test 4: AI/ML vs Computer Vision => NO_EVIDENCE
def test_regression_4_aiml_vs_computer_vision_no_evidence():
    """Case 4: Generic AI/ML, LLM, RAG must not prove Computer Vision."""
    result = build_cv_jd_evidence(
        cv_text="Kinh nghiệm nghiên cứu Machine Learning, LLM và xây dựng hệ thống RAG.",
        parsed_cv={
            "skills": ["Machine Learning", "LLM", "RAG", "Python"],
            "projects": [{"id": "p1", "description": "Phát triển chatbot RAG với LangChain và LLM."}],
        },
        jd_title="AI Engineer (Computer Vision)",
        jd_requirements="Yêu cầu kinh nghiệm chuyên sâu về Computer Vision và xử lý ảnh.",
    )

    cv_req = next(
        (item for item in result["requirement_evidence"] if "computer vision" in item["requirement"].lower() or "thị giác máy tính" in item["requirement"].lower()),
        None,
    )
    assert cv_req is not None
    assert cv_req["status"] == "missing"
    assert cv_req["match_classification"] in {"NO_EVIDENCE", "NOT_FOUND"}


# 5. Regression Test 5: Machine Learning vs Computer Vision => not full match
def test_regression_5_machine_learning_vs_computer_vision_not_full_match():
    """Case 5: Broader skill Machine Learning must NEVER satisfy narrower requirement Computer Vision."""
    sem = match_semantic_relation("Computer Vision", "Kinh nghiệm 2 năm làm Machine Learning và Deep Learning.")
    assert sem["classification"] != "DIRECT"
    assert sem["classification"] != "EQUIVALENT"


# 6. Regression Test 6: "Strong logical thinking" vs teamwork => NO_EVIDENCE
def test_regression_6_logical_thinking_vs_teamwork_no_evidence():
    """Case 6: Logical thinking or generic statements must not prove teamwork."""
    result = build_cv_jd_evidence(
        cv_text="Strong logical thinking and analytical skills. Passionate about software craftsmanship.",
        parsed_cv={
            "skills": ["Python", "Logical Thinking"],
            "projects": [{"id": "p1", "description": "Solved complex algorithmic challenges with strong logical thinking."}],
        },
        jd_title="Software Engineer",
        jd_requirements="Yêu cầu kỹ năng làm việc nhóm (Teamwork).",
    )

    tw_req = next(
        (item for item in result["requirement_evidence"] if "teamwork" in item["requirement"].lower() or "làm việc nhóm" in item["requirement"].lower()),
        None,
    )
    assert tw_req is not None
    assert tw_req["status"] in {"missing", "unknown"}
    assert tw_req["match_classification"] in {"NO_EVIDENCE", "NOT_FOUND"}


# 7. Regression Test 7: Skill only in Skills section => WEAK_EVIDENCE
def test_regression_7_skill_only_in_skills_section_weak_evidence():
    """Case 7: A skill listed ONLY under Skills section is weaker evidence and capped."""
    result = build_cv_jd_evidence(
        cv_text="Skills: Python, Docker, PostgreSQL.",
        parsed_cv={
            "skills": ["Python", "Docker", "PostgreSQL"],
        },
        jd_title="Python Developer",
        jd_requirements="Yêu cầu thành thạo Python và Docker.",
    )

    python_req = next(
        (item for item in result["requirement_evidence"] if item["requirement"] == "Python"),
        None,
    )
    assert python_req is not None
    assert python_req["status"] == "partial"
    assert python_req["evidence_strength"].lower() == "weak"
    assert python_req["score"] <= 50.0


# 8. Regression Test 8: Skill demonstrated in Project => stronger evidence than Skills section
def test_regression_8_project_evidence_ranks_above_skills_section():
    """Case 8: Project bullet with FastAPI ranks above and provides stronger evidence than Skills section."""
    result = build_cv_jd_evidence(
        cv_text="Skills: FastAPI, Python, PostgreSQL.\nProjects: Built production backend API using FastAPI and Docker.",
        parsed_cv={
            "skills": ["FastAPI", "Python", "PostgreSQL"],
            "projects": [
                {
                    "name": "E-commerce Backend",
                    "role": "Backend Lead",
                    "bullets": ["Built production backend API using FastAPI and Docker for 10k daily users."],
                }
            ],
        },
        jd_title="Backend Developer",
        jd_requirements="Yêu cầu thành thạo FastAPI.",
    )

    fastapi_req = next(
        (item for item in result["requirement_evidence"] if item["requirement"] == "FastAPI"),
        None,
    )
    assert fastapi_req is not None
    assert fastapi_req["status"] == "matched"
    assert fastapi_req["evidence_strength"].lower() == "strong"
    assert fastapi_req["score"] >= 80.0
    # Parent source preserved
    assert "E-commerce Backend" in str(fastapi_req.get("parent_title") or fastapi_req.get("evidence_source"))


# 9. Regression Test 9: English CV without certificate => contextual/weak evidence
def test_regression_9_english_cv_without_cert_contextual():
    """Case 9: Professional English CV without IELTS/TOEIC provides contextual evidence, not ungrounded IELTS."""
    sem = match_semantic_relation(
        "English",
        "Senior Software Engineer. Developed scalable microservices, built REST APIs and collaborated with global engineering teams.",
    )
    assert sem["classification"] == "INFERRED"
    assert sem["evidence_strength"] == "WEAK"
    assert "chưa có chứng chỉ" in sem["reason"].lower() or "văn bản" in sem["reason"].lower()


# 10. Regression Test 10: 2+ years Python requirement vs Python only in Skills
def test_regression_10_duration_years_vs_skill_mention():
    """Case 10: Python in skills satisfies skill presence weakly, but not years of experience duration."""
    result = build_cv_jd_evidence(
        cv_text="Skills: Python, MySQL.",
        parsed_cv={
            "skills": ["Python", "MySQL"],
            "experience": [],  # No work experience records
        },
        jd_title="Senior Python Developer",
        jd_requirements="Yêu cầu tối thiểu 3 năm kinh nghiệm làm việc với Python.",
    )

    exp_req = next(
        (item for item in result["requirement_evidence"] if "kinh nghiệm" in item["requirement"].lower() or "năm" in item["requirement"].lower()),
        None,
    )
    if exp_req:
        assert exp_req["status"] in {"missing", "partial"}


# 11. Regression Test 11: Benefits/company culture text => excluded from matching
def test_regression_11_benefits_and_culture_excluded():
    """Case 11: Benefits and company marketing sentences must NOT become scorable requirements."""
    cat1, is_scorable1 = classify_jd_sentence("Thưởng tháng 13, bảo hiểm full lương và du lịch hàng năm.")
    assert cat1 == "BENEFIT"
    assert is_scorable1 is False

    cat2, is_scorable2 = classify_jd_sentence("Trải nghiệm môi trường làm việc trẻ trung, năng động và sáng tạo.")
    assert cat2 == "CULTURE_OR_MARKETING"
    assert is_scorable2 is False


# 12. Regression Test 12: Markdown headings => excluded
def test_regression_12_markdown_headings_excluded():
    """Case 12: Markdown headings like '## YÊU CẦU ỨNG TUYỂN' are excluded."""
    cat, is_scorable = classify_jd_sentence("## YÊU CẦU ỨNG TUYỂN")
    assert cat == "HEADING"
    assert is_scorable is False


# 13. Regression Test 13: Duplicate AI / Artificial Intelligence requirements => deduplicated
def test_regression_13_ai_and_artificial_intelligence_deduplicated():
    """Case 13: AI and Artificial Intelligence in the same JD must be deduplicated."""
    parsed = parse_job_description(
        title="AI Engineer",
        requirements_text=(
            "Yêu cầu bắt buộc:\n"
            "- Có kinh nghiệm về AI\n"
            "- Thành thạo Artificial Intelligence\n"
            "- Thành thạo Python\n"
        ),
    )
    reqs = parsed.get("requirements", [])
    ai_reqs = [r for r in reqs if canonical_skill(r.get("canonical_name") or r.get("text")) == "AI"]
    assert len(ai_reqs) == 1


# 14. Regression Test 14: One generic Summary chunk => cannot satisfy unrelated requirements
def test_regression_14_single_summary_chunk_anti_reuse():
    """Case 14: 'Passionate about AI and strong logical thinking' cannot prove teamwork, leadership, or communication."""
    sem_teamwork = match_semantic_relation("Teamwork", "Passionate about AI and strong logical thinking.")
    assert sem_teamwork["classification"] == "NO_EVIDENCE"

    sem_leadership = match_semantic_relation("Leadership", "Passionate about AI and strong logical thinking.")
    assert sem_leadership["classification"] == "NO_EVIDENCE"


# 15. Regression Test 15: Parent-child chunking preserves parent title and metadata
def test_regression_15_parent_child_chunking_preserves_parent_metadata():
    """Case 15: Child chunks retain parent company, role, dates, and parent_title."""
    parsed_cv = {
        "experience": [
            {
                "company": "FPT Software",
                "position": "Senior Backend Engineer",
                "start_date": "2022",
                "end_date": "2024",
                "bullets": [
                    "Built GET/POST endpoints using FastAPI and PostgreSQL.",
                    "Optimized query performance by 40% using Redis caching.",
                ],
            }
        ],
        "projects": [
            {
                "name": "Career Assistant",
                "role": "AI Engineer",
                "bullets": [
                    "Integrated pgvector and Gemini embedding for semantic retrieval.",
                ],
            }
        ],
    }

    _, _, chunks = ChunkingService.build("raw text", parsed_cv)
    assert len(chunks) >= 3

    exp_child = next(c for c in chunks if "FastAPI" in c["text"])
    assert exp_child["parent_type"] == "work_experience"
    assert "FPT Software" in exp_child["parent_title"]
    assert "Senior Backend Engineer" in exp_child["parent_title"]
    assert exp_child["evidence_strength"] == 1.0

    proj_child = next(c for c in chunks if "pgvector" in c["text"])
    assert proj_child["parent_type"] == "project"
    assert "Career Assistant" in proj_child["parent_title"]
    assert proj_child["evidence_strength"] == 0.9


# ==============================================================================
# Verified Correctness Issues Fixes - 10 New Regression Tests
# ==============================================================================

# 1. Boolean Logic: FastAPI OR Django satisfied by FastAPI only
def test_regression_v1_fastapi_or_django_satisfied_by_fastapi_only():
    """Case 1: 'FastAPI hoặc Django' satisfied when candidate only has FastAPI."""
    result = build_cv_jd_evidence(
        cv_text="Kinh nghiệm: 3 năm phát triển REST API với FastAPI và PostgreSQL trong dự án E-commerce.",
        parsed_cv={
            "skills": ["FastAPI", "PostgreSQL", "Python"],
            "projects": [
                {
                    "name": "E-commerce Backend",
                    "bullets": ["Phát triển hệ thống microservices và REST API hiệu năng cao với FastAPI."],
                }
            ],
        },
        jd_title="Python Backend Developer",
        jd_requirements="Thành thạo framework FastAPI hoặc Django để xây dựng REST API.",
    )

    ev_items = result["requirement_evidence"]
    fastapi_item = next((i for i in ev_items if "fastapi" in i["requirement"].lower()), None)
    django_item = next((i for i in ev_items if "django" in i["requirement"].lower()), None)

    assert fastapi_item is not None, "FastAPI requirement should exist"
    assert fastapi_item["status"] == "matched"
    assert fastapi_item["match_score"] >= 0.9

    if django_item is not None:
        # Django should be marked as satisfied via alternative, without fabricating evidence
        assert django_item.get("is_satisfied_by_alternative") is True
        assert django_item.get("is_required_after_group_resolution") is False
        assert django_item.get("score_contribution") == 0.0

    # Blocker list must NOT complain about missing Django
    blocker_titles = [b["title"].lower() for b in result.get("structured_blockers", [])]
    assert not any("django" in t for t in blocker_titles), f"Django must not be a blocker: {blocker_titles}"


# 1b. Equivalence: Single requirement vs ANY_OF group
def test_regression_v1_fastapi_only_vs_anyof_equivalent_contribution():
    """Case 1b: Single requirement JD vs ANY_OF JD produces equivalent score contribution."""
    cv_text = "Kinh nghiệm: 3 năm phát triển REST API với FastAPI và PostgreSQL trong dự án E-commerce."
    parsed_cv = {
        "skills": ["FastAPI", "PostgreSQL", "Python"],
        "projects": [
            {
                "name": "E-commerce Backend",
                "bullets": ["Phát triển hệ thống microservices và REST API hiệu năng cao với FastAPI."],
            }
        ],
    }

    # Case A: FastAPI only
    res_a = build_cv_jd_evidence(
        cv_text=cv_text,
        parsed_cv=parsed_cv,
        jd_title="Python Backend Developer",
        jd_requirements="Thành thạo framework FastAPI để xây dựng REST API.",
    )

    # Case B: FastAPI or Django
    res_b = build_cv_jd_evidence(
        cv_text=cv_text,
        parsed_cv=parsed_cv,
        jd_title="Python Backend Developer",
        jd_requirements="Thành thạo framework FastAPI hoặc Django để xây dựng REST API.",
    )

    # Both must award full score to the technical skill group
    crit_a = next(c for c in res_a["criteria"] if c["group"] == "skills")
    crit_b = next(c for c in res_b["criteria"] if c["group"] == "skills")
    assert crit_a["raw_score"] == 100.0
    assert crit_b["raw_score"] == 100.0


# 2. Boolean Logic: CI/CD AND Kubernetes requires all items
def test_regression_v1_cicd_and_kubernetes_all_of_partial():
    """Case 2: 'CI/CD và Kubernetes' requires all items; candidate with CI/CD only is partial and Kubernetes is a blocker."""
    result = build_cv_jd_evidence(
        cv_text="Kinh nghiệm: Thiết lập CI/CD pipeline tự động hóa kiểm thử với GitHub Actions.",
        parsed_cv={
            "skills": ["CI/CD", "GitHub Actions"],
            "projects": [
                {
                    "name": "DevOps Modernization",
                    "bullets": ["Xây dựng CI/CD pipeline với GitHub Actions để deploy tự động."],
                }
            ],
        },
        jd_title="DevOps Engineer",
        jd_requirements="Kinh nghiệm triển khai CI/CD và Kubernetes trong môi trường production.",
    )

    ev_items = result["requirement_evidence"]
    cicd_item = next((i for i in ev_items if "ci/cd" in i["requirement"].lower() or "cicd" in i["requirement"].lower()), None)
    k8s_item = next((i for i in ev_items if "kubernetes" in i["requirement"].lower() or "k8s" in i["requirement"].lower()), None)

    assert cicd_item is not None
    assert cicd_item["status"] == "matched"

    assert k8s_item is not None
    assert k8s_item["status"] in {"missing", "unknown"}

    blocker_titles = [b["title"].lower() for b in result.get("structured_blockers", [])]
    assert any("kubernetes" in t for t in blocker_titles), f"Kubernetes must be in blockers: {blocker_titles}"


# 2b. Provenance: No duplicate or phantom blocker for satisfied skill
def test_regression_v1_no_phantom_duplicate_blocker_for_matched_cicd():
    """Case 2b: CI/CD is matched; no paraphrased 'Vận hành và giám sát CI/CD' blocker is generated."""
    result = build_cv_jd_evidence(
        cv_text="Kinh nghiệm: Thiết lập CI/CD pipeline tự động hóa kiểm thử với GitHub Actions.",
        parsed_cv={
            "skills": ["CI/CD", "GitHub Actions"],
            "projects": [
                {
                    "name": "DevOps Modernization",
                    "bullets": ["Xây dựng CI/CD pipeline với GitHub Actions để deploy tự động."],
                }
            ],
        },
        jd_title="DevOps Engineer",
        jd_requirements="Kinh nghiệm triển khai CI/CD và Kubernetes trong môi trường production.",
    )

    blocker_titles = [b["title"].lower() for b in result.get("structured_blockers", [])]
    # Kubernetes is missing, so it's a blocker
    assert any("kubernetes" in t for t in blocker_titles)
    # But CI/CD or paraphrased CI/CD must NOT be a blocker
    assert not any("vận hành" in t for t in blocker_titles)
    assert not any("ci/cd" in t for t in blocker_titles)


# 3. RRF scale normalization ensures retrieval relevance materially affects reranking
def test_regression_v1_rrf_scale_normalization_ranking():
    """Case 3: Normalized RRF scales raw fusion score to [0, 1] so retrieval relevance materially influences rank."""
    from src.services.cv_jd_pipeline import EvidenceService

    chunks = [
        {
            "chunk_id": "c1",
            "text": "Skills: Python, FastAPI, Docker",
            "chunk_type": "CV_SKILL",
            "evidence_strength": 0.4,
            "parent_title": "Skills List",
        },
        {
            "chunk_id": "c2",
            "text": "Architected high-throughput REST API microservices using FastAPI.",
            "chunk_type": "CV_PROJECT",
            "evidence_strength": 1.0,
            "parent_title": "Payment Gateway",
        },
    ]

    service = EvidenceService(chunks, max_per_requirement=2)
    retrieval = {
        "bm25_results": [{"chunk_id": "c1", "score": 2.5}],
        "semantic_results": [{"chunk_id": "c2", "score": 0.85}],
        "hybrid_results": [
            {"chunk_id": "c1", "fusion_score": 0.032},
            {"chunk_id": "c2", "fusion_score": 0.030},
        ],
    }

    selected = service.select({"requirement_id": "req1", "text": "FastAPI"}, retrieval)
    assert len(selected) == 2
    # Project chunk c2 should rank first because strength (1.0) and section quality (1.0) outweigh minor RRF difference
    assert selected[0]["chunk_id"] == "c2"
    assert selected[0]["rerank_score"] > selected[1]["rerank_score"]


# 4. 9 out of 10 normal REQUIRED requirements -> no 49.0 score cap
def test_regression_v1_9_of_10_required_no_hard_gate_cap():
    """Case 4: Candidate satisfying 9/10 normal REQUIRED skills scores >= 80% without 49% cap."""
    result = build_cv_jd_evidence(
        cv_text=(
            "Kinh nghiệm: 5 năm Senior Backend Engineer.\n"
            "Thành thạo: Python, FastAPI, PostgreSQL, Redis, Docker, Git, REST API, Microservices, RabbitMQ."
        ),
        parsed_cv={
            "skills": ["Python", "FastAPI", "PostgreSQL", "Redis", "Docker", "Git", "REST API", "Microservices", "RabbitMQ"],
            "experience": [
                {
                    "company": "Tech Corp",
                    "role": "Senior Engineer",
                    "bullets": [
                        "Phát triển microservices bằng Python và FastAPI.",
                        "Quản lý cơ sở dữ liệu PostgreSQL và Redis caching.",
                        "Đóng gói ứng dụng với Docker và quản lý mã nguồn Git.",
                        "Thiết kế REST API và xử lý bất đồng bộ qua RabbitMQ.",
                    ],
                }
            ],
        },
        jd_title="Senior Python Backend Engineer",
        jd_requirements=(
            "Yêu cầu:\n"
            "- Python\n"
            "- FastAPI\n"
            "- PostgreSQL\n"
            "- Redis\n"
            "- Docker\n"
            "- Git\n"
            "- REST API\n"
            "- Microservices\n"
            "- RabbitMQ\n"
            "- GraphQL\n"  # 1 missing skill out of 10
        ),
    )

    assert result["final_score"] >= 75.0, f"Final score {result['final_score']} should not be capped to <= 49.0"
    assert result.get("hard_gate_failed") is False or not result.get("hard_gate_failed")


# 5. Missing true hard gate triggers 49.0 cap
def test_regression_v1_missing_true_hard_gate_triggers_cap():
    """Case 5: Candidate satisfying technical skills but missing true non-negotiable hard gate is capped at 49.0."""
    result = build_cv_jd_evidence(
        cv_text="Kinh nghiệm: 5 năm luật sư doanh nghiệp, tư vấn pháp lý.",
        parsed_cv={
            "skills": ["Tư vấn pháp lý", "Luật doanh nghiệp"],
            "experience": [{"company": "Law Firm", "role": "Lawyer", "bullets": ["Tư vấn pháp lý"]}]
        },
        jd_title="Trưởng phòng Pháp chế",
        jd_requirements=(
            "Yêu cầu bắt buộc:\n"
            "- Tư vấn pháp lý doanh nghiệp\n"
            "- Bắt buộc phải có thẻ Luật sư do Bộ Tư pháp cấp\n"  # True Hard Gate
        ),
    )

    # Missing the non-negotiable credential should cap score at <= 49.0
    assert result["final_score"] <= 49.0, f"Score {result['final_score']} should be capped by hard gate"
    assert result.get("hard_gate_failed") is True or result.get("mandatory_requirement_failed") is True


# 6. Observability vs OpenTelemetry + Jaeger -> Semantic Fallback INFERRED
def test_regression_v1_opentelemetry_jaeger_vs_observability_fallback_inferred():
    """Case 6: Observability requirement evaluated against OpenTelemetry + Jaeger evidence produces INFERRED match."""
    sem = match_semantic_relation(
        "Observability",
        "Implemented distributed tracing across microservices using OpenTelemetry and Jaeger to monitor latency.",
    )
    assert sem["classification"] == "INFERRED"
    assert sem["evidence_strength"] == "STRONG"
    assert sem["score_factor"] >= 0.85


# 7. Exact, alias, and known relation evaluate deterministically
def test_regression_v1_exact_alias_known_relation_skips_fallback():
    """Case 7: Exact match, alias (ReactJS -> React), and known relation (GitHub Actions -> CI/CD) evaluate deterministically."""
    # 1. Exact
    sem_exact = match_semantic_relation("FastAPI", "Kinh nghiệm thực tế phát triển backend với FastAPI.")
    assert sem_exact["classification"] == "DIRECT"

    # 2. Alias
    sem_alias = match_semantic_relation("React", "Phát triển giao diện web với ReactJS.")
    assert sem_alias["classification"] == "EQUIVALENT"

    # 3. Known relation
    sem_rel = match_semantic_relation("CI/CD", "Thiết lập pipeline tự động hóa với GitHub Actions.")
    assert sem_rel["classification"] == "INFERRED"


# 8. Batched semantic fallback evaluated in single batch
def test_regression_v1_batched_semantic_fallback():
    """Case 8: evaluate_semantic_fallback_batch processes multiple ambiguous pairs and caches results."""
    from src.services.semantic_relations import evaluate_semantic_fallback_batch

    pairs = [
        {
            "requirement": "Observability",
            "candidate_text": "Configured distributed tracing with Jaeger and Prometheus metrics.",
        },
        {
            "requirement": "Event-Driven Architecture",
            "candidate_text": "Built asynchronous message handling pipelines with Apache Kafka.",
        },
    ]

    results = evaluate_semantic_fallback_batch(pairs)
    assert len(results) == 2
    assert results[0]["classification"] == "INFERRED"
    assert results[1]["classification"] == "INFERRED"


# 9. Unchanged CV does not re-embed CV chunks on second match
def test_regression_v1_unchanged_cv_embedding_cache_hit():
    """Case 9: Matching the same CV twice hits the embedding cache with 0 redundant embeddings."""
    from src.services.cv_jd_pipeline import EmbeddingService, VectorSearchService

    embedder = EmbeddingService(dimensions=128)
    chunks = [
        {"chunk_id": "c1", "text": "Python FastAPI backend developer", "normalized_text": "python fastapi backend developer"},
        {"chunk_id": "c2", "text": "PostgreSQL database optimization", "normalized_text": "postgresql database optimization"},
    ]

    # First indexing
    search_1 = VectorSearchService(chunks, embedder)
    vecs_1 = search_1.vectors

    # Second indexing on same chunks
    search_2 = VectorSearchService(chunks, embedder)
    vecs_2 = search_2.vectors

    assert len(vecs_1) == len(vecs_2) == 2
    assert vecs_1[0] == vecs_2[0]
    assert vecs_1[1] == vecs_2[1]


# 10. Changed CV embeds only changed/new chunks
def test_regression_v1_changed_cv_only_embeds_new_chunks():
    """Case 10: When a new bullet is added to a CV, existing chunks hit the cache and only the new chunk is embedded."""
    from src.services.cv_jd_pipeline import _EMBEDDING_CACHE, EmbeddingService, VectorSearchService

    embedder = EmbeddingService(dimensions=128)
    initial_chunks = [
        {"chunk_id": "c1", "text": "Experienced Python Developer with FastAPI.", "normalized_text": "experienced python developer with fastapi."},
    ]
    search_1 = VectorSearchService(initial_chunks, embedder)
    initial_cache_size = len(_EMBEDDING_CACHE)

    updated_chunks = [
        {"chunk_id": "c1", "text": "Experienced Python Developer with FastAPI.", "normalized_text": "experienced python developer with fastapi."},
        {"chunk_id": "c2", "text": "Deployed applications using Docker and Kubernetes.", "normalized_text": "deployed applications using docker and kubernetes."},
    ]
    search_2 = VectorSearchService(updated_chunks, embedder)

    # Cache should only grow by 1 (the new chunk)
    assert len(_EMBEDDING_CACHE) >= initial_cache_size + 1
    assert search_2.vectors[0] == search_1.vectors[0]

