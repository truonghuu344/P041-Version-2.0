from __future__ import annotations

import re
from collections.abc import Iterable, Sequence
from typing import Any

TECH_SKILLS: tuple[str, ...] = (
    ".NET",
    "AI",
    "AWS",
    "Azure",
    "C#",
    "C++",
    "CSS",
    "CI/CD",
    "Django",
    "Docker",
    "FastAPI",
    "Flask",
    "GCP",
    "Git",
    "Go",
    "Golang",
    "HTML",
    "Java",
    "JavaScript",
    "Jenkins",
    "Kubernetes",
    "LangChain",
    "LangGraph",
    "Linux",
    "Machine Learning",
    "Microservices",
    "MongoDB",
    "MySQL",
    "Node.js",
    "NoSQL",
    "OCR",
    "PostgreSQL",
    "Postman",
    "Python",
    "PyTorch",
    "QA",
    "React",
    "ReactJS",
    "REST API",
    "RESTful API",
    "Selenium",
    "Spring",
    "Spring Boot",
    "SQL",
    "SQL Server",
    "Tailwind",
    "TensorFlow",
    "TypeScript",
    "Vue",
    "VueJS",
)

SOFT_SKILLS: tuple[str, ...] = (
    "giao tiếp",
    "làm việc nhóm",
    "quản lý thời gian",
    "thuyết trình",
    "giải quyết vấn đề",
    "tư duy phản biện",
    "chủ động",
    "leadership",
    "communication",
    "teamwork",
    "problem solving",
    "time management",
)

_ROLE_TERMS: tuple[str, ...] = (
    "backend",
    "frontend",
    "fullstack",
    "full stack",
    "data",
    "devops",
    "cloud",
    "security",
    "qa",
    "tester",
    "mobile",
    "ai",
    "machine learning",
    "software",
)


def _unique(values: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        key = value.casefold()
        if key not in seen:
            seen.add(key)
            result.append(value)
    return result


def extract_known_terms(text: str, vocabulary: Sequence[str]) -> list[str]:
    """Trích từ khóa theo biên ký tự, không dùng substring mơ hồ như C trong CV."""
    if not text:
        return []
    found: list[str] = []
    for term in sorted(vocabulary, key=len, reverse=True):
        pattern = rf"(?<!\w){re.escape(term)}(?!\w)"
        if re.search(pattern, text, flags=re.IGNORECASE):
            found.append(term)
    return _unique(found)


def collect_cv_skills(cv_text: str, parsed: dict[str, Any]) -> list[str]:
    declared = [str(item).strip() for item in parsed.get("skills", []) if str(item).strip()]
    detected = extract_known_terms(cv_text, TECH_SKILLS)
    return _unique([*declared, *detected])


def build_gap_evidence(
    cv_text: str,
    parsed: dict[str, Any],
    jd_title: str,
    jd_requirements: str,
) -> dict[str, Any]:
    cv_skills = collect_cv_skills(cv_text, parsed)
    jd_skills = extract_known_terms(jd_requirements, TECH_SKILLS)
    cv_lookup = {skill.casefold(): skill for skill in cv_skills}
    matched = [cv_lookup[skill.casefold()] for skill in jd_skills if skill.casefold() in cv_lookup]
    missing = [skill for skill in jd_skills if skill.casefold() not in cv_lookup]

    jd_soft = extract_known_terms(jd_requirements, SOFT_SKILLS)
    cv_soft = extract_known_terms(cv_text, SOFT_SKILLS)
    cv_soft_lookup = {skill.casefold() for skill in cv_soft}
    soft_gap = [skill for skill in jd_soft if skill.casefold() not in cv_soft_lookup]

    cv_lower = f"{cv_text} {parsed.get('summary', '')}".casefold()
    title_lower = jd_title.casefold()
    role_terms = [term for term in _ROLE_TERMS if term in title_lower]
    domain_score = 100.0 if role_terms and any(term in cv_lower for term in role_terms) else 50.0

    hard_score = (len(matched) / len(jd_skills) * 100.0) if jd_skills else 70.0
    nice_score = (len(jd_soft) - len(soft_gap)) / len(jd_soft) * 100.0 if jd_soft else 70.0
    parsed_experience = parsed.get("experience", [])
    parsed_projects = parsed.get("projects", [])
    experience_score = 85.0 if parsed_experience else 65.0 if parsed_projects else 35.0
    match_score = round(
        hard_score * 0.50 + nice_score * 0.20 + domain_score * 0.20 + experience_score * 0.10,
        2,
    )

    return {
        "cv_skills": cv_skills,
        "jd_skills": jd_skills,
        "hard_skills_matching": matched,
        "hard_skills_missing": missing,
        "soft_skills_gap": soft_gap,
        "score_breakdown": {
            "hard_skills": round(hard_score, 2),
            "nice_to_have": nice_score,
            "domain_fit": domain_score,
            "experience_fit": experience_score,
        },
        "match_score": max(0.0, min(100.0, match_score)),
    }


def cv_evidence_sentences(cv_text: str) -> list[str]:
    parts = re.split(r"[\r\n]+|(?<=[.!?])\s+", cv_text or "")
    return [re.sub(r"\s+", " ", part).strip(" -•\t") for part in parts if len(part.strip()) >= 20]


def deterministic_cv_suggestions(cv_text: str, matched_skills: Sequence[str]) -> list[dict[str, Any]]:
    """Gợi ý chỉ diễn đạt lại bằng bằng chứng đã có; không tự thêm thành tích hay kỹ năng."""
    sentences = cv_evidence_sentences(cv_text)
    suggestions: list[dict[str, Any]] = []
    action_verbs = ("Phát triển", "Triển khai", "Xây dựng", "Tối ưu", "Phân tích")
    for sentence in sentences[:3]:
        evidence_skills = [skill for skill in matched_skills if skill.casefold() in sentence.casefold()]
        verb = next((item for item in action_verbs if item.casefold() in sentence.casefold()), "Thực hiện")
        skill_suffix = f" bằng {', '.join(evidence_skills)}" if evidence_skills else ""
        suggestion = f"{verb} {sentence[0].lower() + sentence[1:]}{skill_suffix}".strip()
        suggestions.append(
            {
                "original_text": sentence,
                "suggested_improvement": suggestion,
                "action_verb": verb,
                "reason": "Diễn đạt lại bằng động từ hành động; chỉ sử dụng nội dung đã có trong CV.",
            }
        )
    return suggestions


_LEARNING_TOPICS: dict[str, list[str]] = {
    "docker": ["Image và container", "Dockerfile multi-stage", "Docker Compose", "Bảo mật và tối ưu image"],
    "postgresql": ["Thiết kế schema", "Index và EXPLAIN", "Transaction", "Tích hợp ORM và migration"],
    "kubernetes": ["Pod và Deployment", "Service và Ingress", "ConfigMap/Secret", "Quan sát và autoscaling"],
    "aws": ["IAM", "EC2 và networking", "S3", "Triển khai và giám sát ứng dụng"],
    "azure": ["Identity", "Compute", "Storage", "Monitoring"],
    "gcp": ["IAM", "Compute", "Cloud Storage", "Cloud Run"],
    "machine learning": ["Tiền xử lý dữ liệu", "Đánh giá mô hình", "Feature engineering", "MLOps cơ bản"],
    "react": ["Component và hooks", "State management", "Testing", "Hiệu năng frontend"],
    "typescript": ["Type system", "Generics", "Narrowing", "Tích hợp dự án web"],
    "fastapi": ["Dependency injection", "Validation", "Authentication", "Async và testing"],
}

_CERTIFICATE_CATALOG: tuple[dict[str, Any], ...] = (
    {
        "skills": ("AWS",),
        "name": "AWS Certified Cloud Practitioner",
        "provider": "Amazon Web Services",
        "level": "Nền tảng",
    },
    {
        "skills": ("AWS",),
        "name": "AWS Certified Solutions Architect – Associate",
        "provider": "Amazon Web Services",
        "level": "Associate",
    },
    {
        "skills": ("Azure",),
        "name": "Microsoft Certified: Azure Fundamentals (AZ-900)",
        "provider": "Microsoft",
        "level": "Nền tảng",
    },
    {
        "skills": ("GCP",),
        "name": "Cloud Digital Leader",
        "provider": "Google Cloud",
        "level": "Nền tảng",
    },
    {
        "skills": ("Kubernetes", "Docker"),
        "name": "Kubernetes and Cloud Native Associate (KCNA)",
        "provider": "Linux Foundation / CNCF",
        "level": "Nền tảng",
    },
    {
        "skills": ("Kubernetes",),
        "name": "Certified Kubernetes Application Developer (CKAD)",
        "provider": "Linux Foundation / CNCF",
        "level": "Thực hành",
    },
    {
        "skills": ("Python",),
        "name": "PCEP – Certified Entry-Level Python Programmer",
        "provider": "Python Institute",
        "level": "Nền tảng",
    },
)


def deterministic_gap_career_plan(evidence: dict[str, Any], jd_title: str) -> dict[str, Any]:
    """Sinh lộ trình hữu ích khi chưa có LLM; mọi mục đều là khuyến nghị tương lai."""
    missing = list(evidence.get("hard_skills_missing", []))
    soft_gap = list(evidence.get("soft_skills_gap", []))
    matched = list(evidence.get("hard_skills_matching", []))
    priority_actions: list[dict[str, Any]] = []
    for index, skill in enumerate(missing[:5], start=1):
        priority_actions.append(
            {
                "priority": index,
                "gap": skill,
                "why_it_matters": f"{skill} xuất hiện trong JD nhưng chưa có bằng chứng trong CV.",
                "action": f"Học nền tảng, thực hành trong một dự án và chỉ bổ sung {skill} vào CV sau khi hoàn thành.",
            }
        )
    for skill in soft_gap[:2]:
        priority_actions.append(
            {
                "priority": len(priority_actions) + 1,
                "gap": skill,
                "why_it_matters": "JD yêu cầu kỹ năng mềm này nhưng CV chưa đưa ra ví dụ cụ thể.",
                "action": "Bổ sung một tình huống STAR có vai trò, hành động và kết quả thực tế.",
            }
        )

    learning_recommendations = []
    for skill in missing[:5]:
        topics = _LEARNING_TOPICS.get(
            skill.casefold(),
            [f"Nền tảng {skill}", "Thực hành có hướng dẫn", "Testing", "Ứng dụng vào dự án portfolio"],
        )
        learning_recommendations.append(
            {
                "skill": skill,
                "learning_goal": f"Có thể dùng {skill} để giải quyết một yêu cầu thực tế trong JD.",
                "topics": topics,
                "practice": f"Tạo một deliverable có thể chạy/demo và ghi lại quyết định kỹ thuật liên quan đến {skill}.",
            }
        )

    certificates = []
    missing_lookup = {skill.casefold() for skill in missing}
    jd_lookup = {skill.casefold() for skill in evidence.get("jd_skills", [])}
    for item in _CERTIFICATE_CATALOG:
        related = [skill for skill in item["skills"] if skill.casefold() in missing_lookup | jd_lookup]
        if related:
            certificates.append(
                {
                    "name": item["name"],
                    "provider": item["provider"],
                    "related_skills": related,
                    "level": item["level"],
                    "reason": f"Củng cố tín hiệu năng lực cho {', '.join(related)} trong JD.",
                    "verification_note": "Kiểm tra điều kiện, lệ phí và phiên bản chứng chỉ trên trang chính thức trước khi đăng ký.",
                }
            )
        if len(certificates) == 3:
            break

    project_skills = missing[:3] or matched[:3]
    projects = []
    if project_skills:
        stack = ", ".join(project_skills)
        projects.append(
            {
                "title": f"Production-ready {jd_title} Portfolio Project",
                "objective": f"Chứng minh khả năng áp dụng {stack} vào một sản phẩm chạy được.",
                "skills": project_skills,
                "deliverables": [
                    "Mã nguồn có README và hướng dẫn chạy",
                    "Test cho luồng chính",
                    "Bản demo hoặc môi trường triển khai",
                    "Sơ đồ kiến trúc và quyết định kỹ thuật",
                ],
                "cv_bullet_template": (
                    f"Sau khi hoàn thành: Xây dựng [sản phẩm cụ thể] bằng {stack}; "
                    "đo lường [chỉ số thực tế] và ghi rõ vai trò cá nhân."
                ),
                "status": "recommended_not_completed",
            }
        )

    section_recommendations = [
        {
            "section": "Skills",
            "issue": "Thiếu từ khóa có bằng chứng so với JD." if missing else "Các kỹ năng chính đã bao phủ JD.",
            "recommendation": (
                "Chỉ thêm kỹ năng còn thiếu sau khi có dự án, bài tập hoặc chứng chỉ xác thực."
                if missing
                else "Sắp xếp kỹ năng phù hợp JD lên đầu và liên kết chúng với dự án."
            ),
        },
        {
            "section": "Projects / Experience",
            "issue": "Bullet cần thể hiện rõ hành động, phạm vi và kết quả.",
            "recommendation": "Dùng cấu trúc: động từ hành động + việc đã làm + công nghệ + kết quả đo được thực tế.",
        },
    ]
    summary = (
        f"CV đáp ứng {len(matched)}/{len(evidence.get('jd_skills', []))} kỹ năng kỹ thuật nhận diện được trong JD. "
        f"Ưu tiên tiếp theo: {', '.join(missing[:3])}."
        if missing
        else "CV đã bao phủ các kỹ năng kỹ thuật nhận diện được; hãy tăng bằng chứng bằng kết quả và dự án thực tế."
    )
    return {
        "executive_summary": summary,
        "priority_actions": priority_actions,
        "learning_recommendations": learning_recommendations,
        "certification_recommendations": certificates,
        "project_recommendations": projects,
        "cv_section_recommendations": section_recommendations,
    }


def clamp_star_scores(scores: dict[str, Any]) -> dict[str, float]:
    result: dict[str, float] = {}
    for key in ("situation", "task", "action", "result"):
        try:
            value = float(scores.get(key, 0.0))
        except (TypeError, ValueError):
            value = 0.0
        result[key] = round(max(0.0, min(100.0, value)), 2)
    return result
