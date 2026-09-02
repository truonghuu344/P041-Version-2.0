from __future__ import annotations

import re
import unicodedata
from typing import Any, Literal

MatchClassification = Literal["DIRECT", "EQUIVALENT", "INFERRED", "ADJACENT", "WEAK_EVIDENCE", "NO_EVIDENCE"]
EvidenceStrength = Literal["STRONG", "MEDIUM", "WEAK", "NONE"]
RelationType = Literal["EQUIVALENT", "SUPPORTS", "BROADER", "NARROWER", "ADJACENT"]

# 1. Normalized Skill Aliases (EQUIVALENT)
SKILL_ALIASES: dict[str, str] = {
    "amazon web services": "AWS",
    "aws": "AWS",
    "ci cd": "CI/CD",
    "ci/cd": "CI/CD",
    "cicd": "CI/CD",
    "ci-cd": "CI/CD",
    "golang": "Go",
    "go": "Go",
    "javascript": "JavaScript",
    "js": "JavaScript",
    "nodejs": "Node.js",
    "node.js": "Node.js",
    "node": "Node.js",
    "postgres": "PostgreSQL",
    "postgresql": "PostgreSQL",
    "psql": "PostgreSQL",
    "reactjs": "React",
    "react.js": "React",
    "react": "React",
    "react native": "React Native",
    "reactnative": "React Native",
    "restful api": "REST API",
    "restful apis": "REST API",
    "rest api": "REST API",
    "rest apis": "REST API",
    "rest-api": "REST API",
    "vuejs": "Vue",
    "vue.js": "Vue",
    "vue": "Vue",
    "vector database": "Vector Database",
    "vector databases": "Vector Database",
    "qdrant": "Vector Database",
    "pgvector": "Vector Database",
    "milvus": "Vector Database",
    "chromadb": "Vector Database",
    "chroma": "Vector Database",
    "pinecone": "Vector Database",
    "weaviate": "Vector Database",
    "restassured": "RestAssured",
    "rest-assured": "RestAssured",
    "postman": "Postman",
    "playwright": "Playwright",
    "selenium": "Selenium",
    "istqb": "ISTQB",
    "nlp": "NLP",
    "llm": "LLM",
    "rag": "RAG",
    "langchain": "LangChain",
    "langgraph": "LangGraph",
    "pytorch": "PyTorch",
    "tensorflow": "TensorFlow",
    "docker": "Docker",
    "kubernetes": "Kubernetes",
    "k8s": "Kubernetes",
    "terraform": "Terraform",
    "fastapi": "FastAPI",
    "python": "Python",
    "typescript": "TypeScript",
    "ts": "TypeScript",
    "redux": "Redux",
    "tailwind": "Tailwind",
    "tailwindcss": "Tailwind",
    "tailwind css": "Tailwind",
    "nextjs": "Next.js",
    "next.js": "Next.js",
    "graphql": "GraphQL",
    "kafka": "Kafka",
    "redis": "Redis",
    "mongodb": "MongoDB",
    "mysql": "MySQL",
    "sql server": "SQL Server",
    "mssql": "SQL Server",
    "elasticsearch": "Elasticsearch",
    "git": "Git",
    "github": "Git",
    "gitlab": "Git",
    "jenkins": "Jenkins",
    "github actions": "GitHub Actions",
    "gitlab ci": "GitLab CI",
    "argocd": "ArgoCD",
    "argo cd": "ArgoCD",
    "artificial intelligence": "AI",
    "ai": "AI",
    "ai/ml": "AI/ML",
    "ai-ml": "AI/ML",
    "computer vision": "Computer Vision",
    "thi giac may tinh": "Computer Vision",
    "problem solving": "Problem Solving",
    "problem-solving": "Problem Solving",
    "problem-solving skills": "Problem Solving",
    "giai quyet van de": "Problem Solving",
    "ky nang giai quyet van de": "Problem Solving",
    "logical thinking": "Logical Thinking",
    "tu duy logic": "Logical Thinking",
    "teamwork": "Teamwork",
    "team work": "Teamwork",
    "lam viec nhom": "Teamwork",
    "ky nang lam viec nhom": "Teamwork",
    "communication": "Communication",
    "communication skills": "Communication",
    "giao tiep": "Communication",
    "ky nang giao tiep": "Communication",
    "responsibility": "Responsibility",
    "tinh than trach nhiem": "Responsibility",
    "trach nhiem": "Responsibility",
    "leadership": "Leadership",
    "lanh dao": "Leadership",
    "ky nang lanh dao": "Leadership",
}

# Soft skill specific behavioral keywords for anti-reuse validation
SOFT_SKILL_ACTION_KEYWORDS: dict[str, list[str]] = {
    "Teamwork": ["team", "teamwork", "collaborat", "phoi hop", "lam viec nhom", "cross-functional", "nhom", "dong nghiep", "pair programming", "scrum", "agile"],
    "Problem Solving": ["problem solving", "solve", "resolv", "troubleshoot", "debug", "giai quyet van de", "xu ly su co", "incident", "su co", "khac phuc", "fix bug"],
    "Logical Thinking": ["logical thinking", "analytical", "tu duy logic", "phan tich logic", "algorithm", "giai thuat", "toan hoc", "data structures", "cau truc du lieu"],
    "Communication": ["communication", "giao tiep", "present", "thuyet trinh", "stakeholder", "khach hang", "trao doi", "bao cao", "documentation", "viet tai lieu"],
    "Responsibility": ["responsibility", "chiu trach nhiem", "ownership", "accountab", "dam bao tien do", "tinh than trach nhiem", "cam ket"],
    "Leadership": ["lead", "leader", "leadership", "mentor", "quan ly nhom", "dan dat", "huong dan thanh vien", "chu tri"],
}

# Explicit Lightweight Semantic Skill Relations (Section 7)
SKILL_RELATIONS: list[dict[str, Any]] = [
    {"source": "GitHub Actions", "relation": "SUPPORTS", "target": "CI/CD"},
    {"source": "Jenkins", "relation": "SUPPORTS", "target": "CI/CD"},
    {"source": "GitLab CI", "relation": "SUPPORTS", "target": "CI/CD"},
    {"source": "CircleCI", "relation": "SUPPORTS", "target": "CI/CD"},
    {"source": "Travis CI", "relation": "SUPPORTS", "target": "CI/CD"},
    {"source": "Bitbucket Pipelines", "relation": "SUPPORTS", "target": "CI/CD"},
    {"source": "ArgoCD", "relation": "SUPPORTS", "target": "CI/CD"},
    {"source": "Kubernetes", "relation": "ADJACENT", "target": "CI/CD"},
    {"source": "Docker", "relation": "ADJACENT", "target": "CI/CD"},
    {"source": "Kubernetes", "relation": "SUPPORTS", "target": "Deployment"},
    {"source": "Kubernetes", "relation": "SUPPORTS", "target": "Container Orchestration"},
    {"source": "Docker", "relation": "SUPPORTS", "target": "Containerization"},
    {"source": "FastAPI", "relation": "ADJACENT", "target": "REST API"},
    {"source": "Express", "relation": "ADJACENT", "target": "REST API"},
    {"source": "NestJS", "relation": "ADJACENT", "target": "REST API"},
    {"source": "Flask", "relation": "ADJACENT", "target": "REST API"},
    {"source": "Django REST Framework", "relation": "SUPPORTS", "target": "REST API"},
    {"source": "Spring Boot", "relation": "ADJACENT", "target": "REST API"},
    {"source": "Machine Learning", "relation": "BROADER", "target": "Computer Vision"},
    {"source": "AI", "relation": "BROADER", "target": "Computer Vision"},
    {"source": "AI/ML", "relation": "BROADER", "target": "Computer Vision"},
    {"source": "Computer Vision", "relation": "NARROWER", "target": "Machine Learning"},
]

# 2. Implements / Supports Relation (INFERRED -> tool directly proves mastery of target requirement)
IMPLEMENTS_RELATIONS: dict[str, dict[str, Any]] = {
    "CI/CD": {
        "implementers": ["GitHub Actions", "Jenkins", "GitLab CI", "ArgoCD", "CircleCI", "Travis CI", "Bitbucket Pipelines"],
        "reason": "CV có {tool}, là công cụ triển khai trực tiếp cho {target}.",
    },
    "REST API": {
        "implementers": ["FastAPI", "Express", "NestJS", "Flask", "Django REST Framework", "Spring Boot"],
        "context_clues": ["endpoint", "endpoints", "get", "post", "put", "delete", "json", "router", "route", "controller", "api", "crud"],
        "reason": "CV thể hiện kinh nghiệm xây dựng REST API qua việc phát triển API endpoints với {tool}.",
    },
    "Version Control": {
        "implementers": ["Git", "GitHub", "GitLab", "Bitbucket"],
        "reason": "CV sử dụng {tool} phục vụ quản lý phiên bản mã nguồn ({target}).",
    },
    "Containerization": {
        "implementers": ["Docker"],
        "reason": "CV sử dụng {tool} phục vụ đóng gói và container hóa ứng dụng ({target}).",
    },
    "Container Orchestration": {
        "implementers": ["Kubernetes", "Docker Swarm", "OpenShift"],
        "reason": "CV sử dụng {tool} để điều phối và quản lý container ({target}).",
    },
    "Deployment": {
        "implementers": ["Kubernetes", "Docker", "Terraform", "Ansible", "Helm", "AWS", "GCP", "Azure"],
        "reason": "CV có kinh nghiệm triển khai ({target}) sử dụng {tool}.",
    },
}

# 3. Adjacent / Related Relations (ADJACENT -> relevant evidence, but NOT sufficient to confirm)
ADJACENT_RELATIONS: dict[str, dict[str, Any]] = {
    "CI/CD": {
        "adjacent_skills": {
            "Kubernetes": "deployment/container orchestration",
            "Docker": "containerization",
            "Terraform": "Infrastructure as Code (IaC)",
            "Ansible": "configuration management",
            "Helm": "Kubernetes packaging/deployment",
        },
        "reason_template": (
            "CV có {skill}, cho thấy kinh nghiệm liên quan đến {domain_context}, "
            "nhưng chưa đủ bằng chứng để xác nhận kinh nghiệm xây dựng hoặc sử dụng CI/CD pipeline như GitHub Actions, Jenkins hoặc GitLab CI."
        ),
    },
    "Kubernetes": {
        "adjacent_skills": {
            "Docker": "containerization",
            "Docker Compose": "multi-container development",
        },
        "reason_template": (
            "CV có {skill}, cho thấy kinh nghiệm với containerization, nhưng chưa có bằng chứng về việc vận hành hay cấu hình {target} (K8s cluster/manifests)."
        ),
    },
    "Docker": {
        "adjacent_skills": {
            "Kubernetes": "container orchestration",
        },
        "reason_template": (
            "CV có {skill}, nhưng chưa thể hiện rõ việc viết Dockerfile hoặc quản lý container {target}."
        ),
    },
    "PostgreSQL": {
        "adjacent_skills": {
            "MySQL": "RDBMS/SQL",
            "SQL Server": "RDBMS/SQL",
            "Oracle": "RDBMS/SQL",
            "SQLite": "SQL database",
        },
        "reason_template": (
            "CV có kinh nghiệm với {skill} ({domain_context}), nhưng chưa có bằng chứng làm việc trực tiếp với {target}."
        ),
    },
    "MySQL": {
        "adjacent_skills": {
            "PostgreSQL": "RDBMS/SQL",
            "SQL Server": "RDBMS/SQL",
            "Oracle": "RDBMS/SQL",
        },
        "reason_template": (
            "CV có kinh nghiệm với {skill} ({domain_context}), nhưng chưa có bằng chứng làm việc trực tiếp với {target}."
        ),
    },
    "React": {
        "adjacent_skills": {
            "Vue": "frontend framework",
            "Angular": "frontend framework",
            "Next.js": "React framework",
        },
        "reason_template": (
            "CV có kinh nghiệm với {skill} ({domain_context}), nhưng chưa tìm thấy minh chứng cụ thể cho {target}."
        ),
    },
    "Vue": {
        "adjacent_skills": {
            "React": "frontend framework",
            "Angular": "frontend framework",
            "Nuxt.js": "Vue framework",
        },
        "reason_template": (
            "CV có kinh nghiệm với {skill} ({domain_context}), nhưng chưa tìm thấy minh chứng cụ thể cho {target}."
        ),
    },
    "Vector Database": {
        "adjacent_skills": {
            "pgvector": "PostgreSQL vector extension",
            "Redis": "in-memory cache/vector",
            "Elasticsearch": "search engine",
        },
        "reason_template": (
            "CV có kinh nghiệm với {skill} ({domain_context}), hỗ trợ lưu trữ vector/semantic search nhưng chưa đủ bằng chứng về hệ thống {target} chuyên dụng độc lập."
        ),
    },
    "PyTorch": {
        "adjacent_skills": {
            "TensorFlow": "deep learning framework",
            "Keras": "deep learning library",
            "Scikit-learn": "machine learning library",
        },
        "reason_template": (
            "CV có kinh nghiệm với {skill} ({domain_context}), nhưng chưa có minh chứng trực tiếp cho {target}."
        ),
    },
    "TensorFlow": {
        "adjacent_skills": {
            "PyTorch": "deep learning framework",
            "Scikit-learn": "machine learning library",
        },
        "reason_template": (
            "CV có kinh nghiệm với {skill} ({domain_context}), nhưng chưa có minh chứng trực tiếp cho {target}."
        ),
    },
}


def _fold(value: str) -> str:
    text = str(value or "").casefold().replace("đ", "d").replace("Đ", "d")
    text = unicodedata.normalize("NFD", text)
    text = "".join(char for char in text if unicodedata.category(char) != "Mn")
    return re.sub(r"\s+", " ", text).strip()


def canonical_skill(value: str) -> str:
    folded = _fold(value)
    if folded in SKILL_ALIASES:
        return SKILL_ALIASES[folded]
    for alias, canonical in SKILL_ALIASES.items():
        if folded == _fold(alias):
            return canonical
    return str(value or "").strip()


def match_semantic_relation(
    target_requirement: str,
    cv_text: str,
    evidence_chunks: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Evaluate relationship between a target requirement and CV content.

    Returns structured analysis:
    - classification: DIRECT | EQUIVALENT | INFERRED | ADJACENT | NO_EVIDENCE
    - evidence_strength: STRONG | MEDIUM | WEAK | NONE
    - reason: Explanatory text in Vietnamese avoiding false negative/positive claims
    - matched_skill: The skill that provided the evidence
    - score_factor: Float 0.0 to 1.0
    """
    evidence_chunks = evidence_chunks or []
    canon_target = canonical_skill(target_requirement)
    folded_target = _fold(canon_target)
    folded_cv_text = _fold(cv_text)

    # Check sections where evidence appears
    project_exp_chunks = [
        c for c in evidence_chunks
        if (
            c.get("chunk_type") in {"CV_PROJECT", "CV_EXPERIENCE"}
            or (
                c.get("chunk_type") == "CV_SUMMARY"
                and not re.search(r"^(?:skills|kỹ năng|technical skills)\s*[:：]", str(c.get("text") or "").strip(), re.IGNORECASE)
                and c.get("source_section") not in {"skills", "skill"}
            )
        )
        and c.get("source_section") not in {"skills", "skill"}
    ]
    has_project_keywords = any(
        kw in folded_cv_text
        for kw in (
            "phat trien", "xay dung", "trien khai", "thiet ke", "lap trinh", "su dung",
            "developed", "built", "implemented", "designed", "architected", "deployed",
            "configured", "integrated", "managed", "created", "lead", "du an", "project"
        )
    )
    if not evidence_chunks and has_project_keywords:
        project_exp_chunks = [{"text": cv_text, "chunk_type": "CV_PROJECT"}]

    # Helper to check if a term appears in project/experience
    def appears_in_projects(term: str) -> bool:
        folded_term = _fold(term)
        pattern = rf"(?<!\w){re.escape(folded_term)}(?!\w)"
        return any(bool(re.search(pattern, _fold(str(c.get("text") or "")))) for c in project_exp_chunks)

    def appears_in_cv(term: str) -> bool:
        folded_term = _fold(term)
        pattern = rf"(?<!\w){re.escape(folded_term)}(?!\w)"
        return bool(re.search(pattern, folded_cv_text))

    # 0. SPECIAL HANDLING: Language requirement (e.g. English)
    if canon_target in {"English", "Tiếng Anh"} or folded_target in {"english", "tieng anh"}:
        cert_matches = [
            kw for kw in ("ielts", "toeic", "toefl", "cefr", "cambridge", "b2", "c1", "c2")
            if re.search(rf"(?<!\w){re.escape(kw)}(?!\w)", folded_cv_text)
        ]
        if cert_matches or appears_in_projects("English") or appears_in_projects("Tiếng Anh"):
            return {
                "classification": "DIRECT",
                "evidence_strength": "STRONG",
                "matched_skill": "English",
                "score_factor": 1.0,
                "reason": "CV có chứng chỉ hoặc kinh nghiệm làm việc thực tế bằng tiếng Anh.",
            }
        english_markers = ("experience", "project", "projects", "education", "skills", "summary", "developed", "built", "implemented", "responsible", "engineer", "developer")
        english_hit_count = sum(1 for m in english_markers if re.search(rf"(?<!\w){re.escape(m)}(?!\w)", folded_cv_text))
        if english_hit_count >= 3:
            return {
                "classification": "INFERRED",
                "evidence_strength": "WEAK",
                "matched_skill": "English CV Context",
                "score_factor": 0.70,
                "reason": "CV được trình bày bằng tiếng Anh, thể hiện khả năng sử dụng tiếng Anh trong văn bản công việc, nhưng chưa có chứng chỉ (IELTS/TOEIC) hoặc mức độ thành thạo cụ thể.",
            }

    # 0b. SPECIAL HANDLING: Computer Vision discipline (AI general mention != Computer Vision)
    if canon_target == "Computer Vision" or "computer vision" in folded_target or "thi giac may tinh" in folded_target:
        cv_specific_terms = ("computer vision", "thi giac may tinh", "opencv", "yolo", "cnn", "image processing", "xu ly anh", "segmentation", "object detection", "nhan dien hinh anh")
        has_cv_specific = any(re.search(rf"(?<!\w){re.escape(_fold(t))}(?!\w)", folded_cv_text) for t in cv_specific_terms)
        if not has_cv_specific:
            return {
                "classification": "NO_EVIDENCE",
                "evidence_strength": "NONE",
                "matched_skill": None,
                "score_factor": 0.0,
                "reason": "Chưa tìm thấy dự án, kinh nghiệm hoặc kỹ năng thể hiện Computer Vision (kỹ năng AI chung không đủ để xác nhận Computer Vision).",
            }

    # 0c. SPECIAL HANDLING: Soft Skill Anti-Reuse & Action Verification
    if canon_target in SOFT_SKILL_ACTION_KEYWORDS:
        action_keywords = SOFT_SKILL_ACTION_KEYWORDS[canon_target]
        has_action = any(
            any(kw in _fold(str(c.get("text") or "")) for kw in action_keywords)
            for c in project_exp_chunks
        )
        has_cv_mention = any(kw in folded_cv_text for kw in action_keywords)
        if has_action:
            return {
                "classification": "DIRECT",
                "evidence_strength": "STRONG",
                "matched_skill": canon_target,
                "score_factor": 1.0,
                "reason": f"CV thể hiện kinh nghiệm thực tế về {canon_target} trong dự án/quá trình làm việc.",
            }
        elif has_cv_mention:
            return {
                "classification": "DIRECT",
                "evidence_strength": "WEAK",
                "matched_skill": canon_target,
                "score_factor": 0.5,
                "reason": f"CV có tự đề cập {canon_target} nhưng chưa có nhiều minh chứng cụ thể trong dự án.",
            }
        else:
            return {
                "classification": "NO_EVIDENCE",
                "evidence_strength": "NONE",
                "matched_skill": None,
                "score_factor": 0.0,
                "reason": f"Chưa tìm thấy bằng chứng về {canon_target} trong CV.",
            }

    # 1. DIRECT MATCH: Exact canonical name exists in CV projects/experience
    if appears_in_projects(canon_target):
        return {
            "classification": "DIRECT",
            "evidence_strength": "STRONG",
            "matched_skill": canon_target,
            "score_factor": 1.0,
            "reason": f"CV thể hiện kinh nghiệm thực tế với {canon_target} trong dự án/kinh nghiệm làm việc.",
        }

    # 2. EQUIVALENT MATCH: Alias of target requirement exists in CV projects/experience
    target_aliases = [alias for alias, canon in SKILL_ALIASES.items() if canon == canon_target]
    for alias in target_aliases:
        if appears_in_projects(alias):
            return {
                "classification": "EQUIVALENT",
                "evidence_strength": "STRONG",
                "matched_skill": alias,
                "score_factor": 1.0,
                "reason": f"CV thể hiện kinh nghiệm thực tế với {alias} (tương đương {canon_target}).",
            }

    # 3. INFERRED MATCH: Implementation tool or strong context clues found in project/experience
    if canon_target in IMPLEMENTS_RELATIONS:
        impl_info = IMPLEMENTS_RELATIONS[canon_target]
        for tool in impl_info.get("implementers", []):
            if appears_in_projects(tool) or appears_in_cv(tool):
                context_clues = impl_info.get("context_clues", [])
                has_context = not context_clues or any(clue in folded_cv_text for clue in context_clues)
                if has_context:
                    template = impl_info.get("reason", "CV thể hiện kinh nghiệm {target} qua công cụ {tool}.")
                    reason = template.format(tool=tool, target=canon_target)
                    return {
                        "classification": "INFERRED",
                        "evidence_strength": "STRONG" if appears_in_projects(tool) else "MEDIUM",
                        "matched_skill": tool,
                        "score_factor": 0.95 if appears_in_projects(tool) else 0.8,
                        "reason": reason,
                    }

    # Special inference: FastAPI / Express / Flask + HTTP endpoint clues -> REST API
    if canon_target == "REST API" or "rest api" in folded_target:
        for framework in ["FastAPI", "Express", "NestJS", "Flask", "Django REST Framework", "Spring Boot"]:
            if appears_in_projects(framework) or appears_in_cv(framework):
                if any(k in folded_cv_text for k in ("endpoint", "endpoints", "get", "post", "put", "delete", "api", "router", "route", "backend")):
                    return {
                        "classification": "INFERRED",
                        "evidence_strength": "STRONG" if appears_in_projects(framework) else "MEDIUM",
                        "matched_skill": framework,
                        "score_factor": 0.95,
                        "reason": f"CV có kinh nghiệm phát triển backend endpoints với {framework}, chứng minh năng lực xây dựng REST API.",
                    }

    # 4. SKILLS SECTION ONLY (Direct or Equivalent): Weak evidence
    if appears_in_cv(canon_target):
        return {
            "classification": "DIRECT",
            "evidence_strength": "WEAK",
            "matched_skill": canon_target,
            "score_factor": 0.5,
            "reason": f"CV có đề cập {canon_target} trong mục Kỹ năng, nhưng chưa có bằng chứng về việc đã sử dụng {canon_target} trong dự án hoặc kinh nghiệm thực tế.",
        }
    for alias in target_aliases:
        if appears_in_cv(alias):
            return {
                "classification": "EQUIVALENT",
                "evidence_strength": "WEAK",
                "matched_skill": alias,
                "score_factor": 0.5,
                "reason": f"CV có đề cập {alias} (tương đương {canon_target}) trong mục Kỹ năng, nhưng chưa có bằng chứng thực tế trong dự án hoặc kinh nghiệm làm việc.",
            }

    # 5. ADJACENT MATCH: Related/adjacent skill exists in CV
    if canon_target in ADJACENT_RELATIONS:
        adj_info = ADJACENT_RELATIONS[canon_target]
        for adj_skill, domain_context in adj_info.get("adjacent_skills", {}).items():
            if appears_in_cv(adj_skill) or appears_in_projects(adj_skill):
                reason_tpl = adj_info.get("reason_template", "CV có {skill} liên quan đến {domain_context}, nhưng chưa đủ bằng chứng cho {target}.")
                reason = reason_tpl.format(skill=adj_skill, domain_context=domain_context, target=canon_target)
                return {
                    "classification": "ADJACENT",
                    "evidence_strength": "WEAK",
                    "matched_skill": adj_skill,
                    "score_factor": 0.45,
                    "reason": reason,
                }

    # 6. UNSEEN SEMANTIC FALLBACK (e.g. OpenTelemetry/Jaeger -> Observability)
    fallback_res = _heuristic_unseen_relation(canon_target, cv_text)
    if fallback_res.get("classification") != "NO_EVIDENCE":
        return fallback_res

    # 7. NO EVIDENCE: Nothing found
    return {
        "classification": "NO_EVIDENCE",
        "evidence_strength": "NONE",
        "matched_skill": None,
        "score_factor": 0.0,
        "reason": f"Chưa tìm thấy bằng chứng về {canon_target} trong CV.",
    }


_SEMANTIC_FALLBACK_CACHE: dict[tuple[str, str, str], dict[str, Any]] = {}


def _heuristic_unseen_relation(target: str, text: str) -> dict[str, Any]:
    """Domain concept semantic evaluator for relations not explicitly in static dictionary."""
    folded_t = _fold(target)
    folded_c = _fold(text)

    # Observability / Monitoring inference from modern tracing/metrics stacks
    if any(k in folded_t for k in ("observability", "giam sat he thong", "monitoring and observability", "tracing")):
        tracing_tools = ["opentelemetry", "jaeger", "zipkin", "prometheus", "grafana", "datadog", "distributed tracing", "apm", "new relic"]
        matched_tools = [tool for tool in tracing_tools if re.search(rf"\b{re.escape(tool)}\b", folded_c)]
        if matched_tools:
            tool_str = ", ".join(matched_tools[:2])
            return {
                "classification": "INFERRED",
                "relation": "supports",
                "evidence_strength": "STRONG",
                "matched_skill": matched_tools[0],
                "score_factor": 0.90,
                "confidence": 0.90,
                "reason": f"CV thể hiện kinh nghiệm triển khai {tool_str}, cung cấp bằng chứng thực tế hỗ trợ yêu cầu {target}.",
            }

    # Asynchronous Message Queue / Event-Driven Architecture
    if any(k in folded_t for k in ("event-driven", "event driven", "message queue", "message broker", "kien truc su kien", "event architecture")):
        mq_tools = ["rabbitmq", "kafka", "apache kafka", "celery", "activemq", "sqs", "pubsub", "pub/sub"]
        matched_tools = [tool for tool in mq_tools if re.search(rf"\b{re.escape(tool)}\b", folded_c)]
        if matched_tools:
            return {
                "classification": "INFERRED",
                "relation": "supports",
                "evidence_strength": "STRONG",
                "matched_skill": matched_tools[0],
                "score_factor": 0.90,
                "confidence": 0.90,
                "reason": f"CV có kinh nghiệm làm việc với {matched_tools[0]}, chứng minh năng lực về {target}.",
            }

    return {
        "classification": "NO_EVIDENCE",
        "evidence_strength": "NONE",
        "matched_skill": None,
        "score_factor": 0.0,
        "confidence": 0.0,
        "reason": f"Chưa tìm thấy bằng chứng về {target} trong CV.",
    }


def evaluate_semantic_fallback_batch(
    pairs: list[dict[str, Any]],
    api_key: str | None = None,
    model_name: str = "gemini-2.5-flash",
) -> list[dict[str, Any]]:
    """Evaluates unresolved semantic pairs in a single batch Gemini call or domain heuristic fallback."""
    import hashlib
    import json

    results: list[dict[str, Any] | None] = [None] * len(pairs)
    unresolved_indices: list[int] = []

    for idx, pair in enumerate(pairs):
        req = pair["requirement"]
        text = pair.get("candidate_text") or pair.get("text") or ""
        text_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]
        cache_key = (_fold(req), text_hash, model_name)
        if cache_key in _SEMANTIC_FALLBACK_CACHE:
            results[idx] = _SEMANTIC_FALLBACK_CACHE[cache_key]
        else:
            unresolved_indices.append(idx)

    if not unresolved_indices:
        return [r for r in results if r is not None]

    # Try calling Gemini if API key is present
    if api_key:
        try:
            from google import genai
            from google.genai import types
            from pydantic import BaseModel, Field

            class SemanticFallbackItem(BaseModel):
                pair_id: int
                classification: str = Field(description="DIRECT, EQUIVALENT, INFERRED, ADJACENT, WEAK_EVIDENCE, or NO_EVIDENCE")
                relation: str = Field(description="equivalent, supports, broader, narrower, adjacent, or none")
                confidence: float = Field(description="Confidence between 0.0 and 1.0")
                reason: str = Field(description="Concise Vietnamese explanation of evidence evaluation")

            class SemanticFallbackResponse(BaseModel):
                evaluations: list[SemanticFallbackItem]

            client = genai.Client(api_key=api_key)
            prompt_items = []
            for i in unresolved_indices:
                pair = pairs[i]
                prompt_items.append({
                    "pair_id": i,
                    "requirement": pair["requirement"],
                    "candidate_evidence": pair.get("candidate_text") or pair.get("text") or "",
                    "parent_context": pair.get("parent_context", ""),
                })

            prompt = (
                "You are an expert HR and Engineering Skill Match Validator.\n"
                "Evaluate whether the candidate evidence text semantically proves or supports the given job requirement.\n"
                "Strict Rules:\n"
                "- Do NOT invent experience.\n"
                "- Broader skills (e.g. AI/ML) NEVER prove narrower skills (e.g. Computer Vision) -> return NO_EVIDENCE.\n"
                "- Specific implementation tools (e.g. OpenTelemetry/Jaeger for Observability) -> return INFERRED with relation 'supports'.\n"
                "- Return structured evaluations for each pair_id.\n\n"
                f"Pairs to evaluate: {json.dumps(prompt_items, ensure_ascii=False)}"
            )

            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=SemanticFallbackResponse,
                    temperature=0.0,
                ),
            )
            parsed_resp = json.loads(response.text)
            for item in parsed_resp.get("evaluations", []):
                p_idx = item.get("pair_id")
                if p_idx is not None and p_idx in unresolved_indices:
                    cls_name = str(item.get("classification", "NO_EVIDENCE")).upper()
                    res_obj = {
                        "classification": cls_name,
                        "relation": str(item.get("relation", "none")).lower(),
                        "confidence": float(item.get("confidence", 0.85)),
                        "reason": str(item.get("reason", "")),
                        "matched_skill": pairs[p_idx]["requirement"],
                        "score_factor": (
                            1.0 if cls_name in {"DIRECT", "EQUIVALENT"}
                            else 0.90 if cls_name == "INFERRED"
                            else 0.45 if cls_name == "ADJACENT"
                            else 0.0
                        ),
                        "evidence_strength": (
                            "STRONG" if cls_name in {"DIRECT", "EQUIVALENT", "INFERRED"}
                            else "WEAK" if cls_name == "ADJACENT"
                            else "NONE"
                        ),
                    }
                    req = pairs[p_idx]["requirement"]
                    c_text = pairs[p_idx].get("candidate_text") or pairs[p_idx].get("text") or ""
                    text_hash = hashlib.sha256(c_text.encode("utf-8")).hexdigest()[:16]
                    _SEMANTIC_FALLBACK_CACHE[(_fold(req), text_hash, model_name)] = res_obj
                    results[p_idx] = res_obj
        except Exception as exc:
            import logging
            logging.getLogger(__name__).warning("Gemini semantic fallback batch error: %s; using heuristic fallback", exc)

    # For any remaining unresolved indices (or when offline):
    for i in unresolved_indices:
        if results[i] is None:
            pair = pairs[i]
            req = pair["requirement"]
            cand_text = pair.get("candidate_text") or pair.get("text") or ""
            res_obj = _heuristic_unseen_relation(req, cand_text)
            text_hash = hashlib.sha256(cand_text.encode("utf-8")).hexdigest()[:16]
            _SEMANTIC_FALLBACK_CACHE[(_fold(req), text_hash, model_name)] = res_obj
            results[i] = res_obj

    return [r for r in results if r is not None]

