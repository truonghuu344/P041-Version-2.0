from __future__ import annotations

import hashlib
import re
import unicodedata
from collections.abc import Iterable
from typing import Any, Literal

from src.agents.tools.career_tools import SOFT_SKILLS, TECH_SKILLS, extract_known_terms

PIPELINE_VERSION = "1.0"

RequirementStatus = Literal["matched", "partial", "missing", "unknown"]

SKILL_ALIASES: dict[str, str] = {
    "amazon web services": "AWS",
    "aws": "AWS",
    "ci cd": "CI/CD",
    "ci/cd": "CI/CD",
    "golang": "Go",
    "go": "Go",
    "javascript": "JavaScript",
    "js": "JavaScript",
    "nodejs": "Node.js",
    "node.js": "Node.js",
    "postgres": "PostgreSQL",
    "postgresql": "PostgreSQL",
    "reactjs": "React",
    "react.js": "React",
    "react": "React",
    "restful api": "REST API",
    "rest api": "REST API",
    "vuejs": "Vue",
    "vue.js": "Vue",
    "vue": "Vue",
}

RELATED_SKILLS: dict[str, set[str]] = {
    "PostgreSQL": {"SQL", "MySQL", "SQL Server"},
    "MySQL": {"SQL", "PostgreSQL", "SQL Server"},
    "SQL Server": {"SQL", "PostgreSQL", "MySQL"},
    "MongoDB": {"NoSQL"},
    "AWS": {"Azure", "GCP"},
    "Azure": {"AWS", "GCP"},
    "GCP": {"AWS", "Azure"},
    "FastAPI": {"Flask", "Django", "REST API"},
    "Django": {"Flask", "FastAPI", "Python"},
    "Flask": {"Django", "FastAPI", "Python"},
    "React": {"Vue", "JavaScript", "TypeScript"},
    "Vue": {"React", "JavaScript", "TypeScript"},
    "Docker": {"Kubernetes", "CI/CD"},
    "Kubernetes": {"Docker"},
    "PyTorch": {"TensorFlow", "Machine Learning"},
    "TensorFlow": {"PyTorch", "Machine Learning"},
}

ROLE_SKILLS: dict[str, set[str]] = {
    "backend": {
        "Python",
        "Java",
        "C#",
        "Go",
        "FastAPI",
        "Django",
        "Flask",
        "Spring Boot",
        "Node.js",
        "REST API",
        "SQL",
        "PostgreSQL",
        "MySQL",
    },
    "frontend": {"JavaScript", "TypeScript", "React", "Vue", "HTML", "CSS", "Tailwind"},
    "fullstack": {"JavaScript", "TypeScript", "React", "Vue", "Node.js", "REST API", "SQL"},
    "data": {"Python", "SQL", "Machine Learning", "PyTorch", "TensorFlow"},
    "devops": {"Docker", "Kubernetes", "Linux", "CI/CD", "Jenkins", "AWS", "Azure", "GCP"},
    "cloud": {"AWS", "Azure", "GCP", "Docker", "Kubernetes", "Linux"},
    "qa": {"QA", "Selenium", "Postman"},
    "ai": {"AI", "Machine Learning", "Python", "PyTorch", "TensorFlow", "LangChain", "LangGraph"},
}

NICE_MARKERS = (
    "ưu tiên",
    "lợi thế",
    "điểm cộng",
    "khuyến khích",
    "preferred",
    "nice to have",
    "a plus",
    "plus",
    "bonus",
)
MUST_MARKERS = (
    "bắt buộc",
    "yêu cầu",
    "cần có",
    "thành thạo",
    "must",
    "required",
    "requirement",
    "proficient",
    "strong knowledge",
)
EXCLUSION_MARKERS = ("bắt buộc", "must have", "must-have", "mandatory", "required")
RESPONSIBILITY_MARKERS = (
    "phát triển",
    "xây dựng",
    "thiết kế",
    "triển khai",
    "duy trì",
    "vận hành",
    "phân tích",
    "kiểm thử",
    "develop",
    "build",
    "design",
    "implement",
    "maintain",
    "operate",
    "analyze",
    "test",
)


def _fold(value: str) -> str:
    text = unicodedata.normalize("NFD", str(value or "").casefold())
    text = "".join(char for char in text if unicodedata.category(char) != "Mn")
    return re.sub(r"\s+", " ", text).strip()


def _unique(values: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    output: list[str] = []
    for value in values:
        key = _fold(value)
        if value and key not in seen:
            seen.add(key)
            output.append(value)
    return output


def canonical_skill(value: str) -> str:
    folded = _fold(value).replace("-", " ")
    if folded in SKILL_ALIASES:
        return SKILL_ALIASES[folded]
    for skill in TECH_SKILLS:
        if _fold(skill) == folded:
            return SKILL_ALIASES.get(folded, skill)
    return re.sub(r"\s+", " ", value).strip()


def _sentences(text: str) -> list[str]:
    # Nối các dòng bị ngắt giữa câu: Thay newline bằng khoảng trắng nếu
    # dòng trước không kết thúc bằng dấu câu và dòng sau không bắt đầu bằng bullet/số.
    healed = re.sub(r"(?<![.!?;:])[\r\n]+(?![ \t]*[•*\-–—\d.)])", " ", text or "")
    parts = re.split(r"[\r\n]+|(?<=[.!?;])\s+", healed)
    return _unique(re.sub(r"^[\s•*\-–—\d.)]+", "", part).strip() for part in parts if part.strip())


def _sentence_for_term(text: str, term: str) -> str:
    aliases = [alias for alias, canonical in SKILL_ALIASES.items() if canonical == term]
    aliases.append(term)
    for sentence in _sentences(text):
        folded = _fold(sentence)
        if any(re.search(rf"(?<!\w){re.escape(_fold(alias))}(?!\w)", folded) for alias in aliases):
            return sentence[:1000]
    return ""


def _extract_canonical_skills(text: str) -> list[str]:
    detected = [canonical_skill(skill) for skill in extract_known_terms(text, TECH_SKILLS)]
    folded = _fold(text)
    for alias, canonical in SKILL_ALIASES.items():
        if re.search(rf"(?<!\w){re.escape(alias)}(?!\w)", folded):
            detected.append(canonical)
    return _unique(detected)


def _requirement_kind(sentence: str) -> Literal["must", "nice"]:
    folded = _fold(sentence)
    if any(_fold(marker) in folded for marker in NICE_MARKERS):
        return "nice"
    return "must"


def _seniority(title_and_text: str) -> str | None:
    folded = _fold(title_and_text)
    for token, value in (
        ("intern", "intern"),
        ("thuc tap", "intern"),
        ("fresher", "fresher"),
        ("junior", "junior"),
        ("middle", "middle"),
        ("mid level", "middle"),
        ("senior", "senior"),
        ("lead", "lead"),
        ("manager", "manager"),
    ):
        if re.search(rf"(?<!\w){re.escape(token)}(?!\w)", folded):
            return value
    return None


def normalize_job_title(title: str) -> str:
    normalized = _fold(title)
    normalized = re.sub(r"\b(intern|internship|fresher|junior|middle|mid(?: level)?|senior|lead|manager)\b", "", normalized)
    aliases = (
        (r"\b(back[- ]?end|backend)\s+(developer|engineer)\b", "backend engineer"),
        (r"\b(front[- ]?end|frontend)\s+(developer|engineer)\b", "frontend engineer"),
        (r"\bfull[- ]?stack\s+(developer|engineer)\b", "fullstack engineer"),
        (r"\bsoftware developer\b", "software engineer"),
        (r"\bdevops developer\b", "devops engineer"),
    )
    for pattern, canonical in aliases:
        normalized = re.sub(pattern, canonical, normalized)
    return re.sub(r"\s+", " ", normalized).strip()


def _minimum_years(text: str) -> float | None:
    folded = _fold(text)
    patterns = (
        r"(?:toi thieu|minimum|at least)\s*(\d+(?:[.,]\d+)?)\+?\s*(?:nam|years?)",
        r"(\d+(?:[.,]\d+)?)\+?\s*(?:nam|years?)\s*(?:kinh nghiem|experience)",
    )
    values: list[float] = []
    for pattern in patterns:
        values.extend(float(value.replace(",", ".")) for value in re.findall(pattern, folded))
    return max(values) if values else None


def parse_job_description(
    *,
    title: str,
    requirements_text: str,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Parse a JD into versioned, evidence-backed requirements without inventing fields."""
    metadata = metadata or {}
    sentences = _sentences(requirements_text)
    must: dict[str, dict[str, Any]] = {}
    nice: dict[str, dict[str, Any]] = {}
    ambiguous_requirements: list[str] = []

    for skill in _extract_canonical_skills(requirements_text):
        aliases = [alias for alias, canonical in SKILL_ALIASES.items() if canonical == skill] + [skill]
        matching_sentences = [
            sentence
            for sentence in sentences
            if any(
                re.search(rf"(?<!\w){re.escape(_fold(alias))}(?!\w)", _fold(sentence))
                for alias in aliases
            )
        ]
        quote = next(
            (sentence for sentence in matching_sentences if _requirement_kind(sentence) == "must"),
            matching_sentences[0] if matching_sentences else requirements_text[:1000],
        )
        if {_requirement_kind(sentence) for sentence in matching_sentences} == {"must", "nice"}:
            ambiguous_requirements.append(f"{skill} xuất hiện ở cả required và preferred; ưu tiên required.")
        requirement = {
            "id": f"skill-{re.sub(r'[^a-z0-9]+', '-', _fold(skill)).strip('-')}",
            "name": skill,
            "importance": 5,
            "required_level": "unknown",
            "evidence_quote": quote,
            "is_exclusion": any(_fold(marker) in _fold(quote) for marker in EXCLUSION_MARKERS),
        }
        if _requirement_kind(quote) == "nice":
            requirement["importance"] = 2
            nice[skill] = requirement
        else:
            must[skill] = requirement

    # Curated catalog metadata is useful when a shortened description omits its skill list.
    for raw_skill in metadata.get("skills") or []:
        skill = canonical_skill(str(raw_skill))
        if skill and skill not in must and skill not in nice:
            must[skill] = {
                "id": f"skill-{re.sub(r'[^a-z0-9]+', '-', _fold(skill)).strip('-')}",
                "name": skill,
                "importance": 4,
                "required_level": "unknown",
                "evidence_quote": str(raw_skill),
                "is_exclusion": False,
            }

    responsibilities = []
    for index, sentence in enumerate(sentences):
        folded = _fold(sentence)
        if any(_fold(marker) in folded for marker in MUST_MARKERS + NICE_MARKERS):
            continue
        if any(_fold(marker) in folded for marker in RESPONSIBILITY_MARKERS) and len(sentence) >= 15:
            responsibilities.append({"id": f"responsibility-{index + 1}", "text": sentence[:1000], "importance": 3})
        if len(responsibilities) == 8:
            break

    soft_requirements = []
    for index, skill in enumerate(extract_known_terms(requirements_text, SOFT_SKILLS), start=1):
        quote = _sentence_for_term(requirements_text, skill) or skill
        soft_requirements.append(
            {
                "id": f"soft-{index}",
                "name": skill,
                "importance": 2,
                "evidence_quote": quote,
            }
        )

    education_requirements = []
    for sentence in sentences:
        folded = _fold(sentence)
        if any(term in folded for term in ("bachelor", "degree", "dai hoc", "cao dang", "cu nhan")):
            education_requirements.append(
                {"id": f"education-{len(education_requirements) + 1}", "text": sentence, "importance": 2}
            )

    certification_requirements = []
    for sentence in sentences:
        folded = _fold(sentence)
        if any(term in folded for term in ("certificate", "certification", "chung chi")):
            certification_requirements.append(
                {"id": f"certification-{len(certification_requirements) + 1}", "text": sentence, "importance": 2}
            )

    language_requirements = []
    language_terms = {
        "English": ("english", "tieng anh", "ielts", "toeic"),
        "Vietnamese": ("vietnamese", "tieng viet"),
        "Japanese": ("japanese", "tieng nhat", "jlpt"),
        "Korean": ("korean", "tieng han", "topik"),
        "Chinese": ("chinese", "tieng trung", "hsk"),
    }
    for sentence in sentences:
        folded = _fold(sentence)
        for language, terms in language_terms.items():
            if not any(term in folded for term in terms):
                continue
            level_match = re.search(r"\b(a1|a2|b1|b2|c1|c2|ielts\s*\d(?:[.,]\d)?)\b", folded)
            language_requirements.append(
                {
                    "id": f"language-{len(language_requirements) + 1}",
                    "text": sentence,
                    "language": language,
                    "normalized_language": {
                        "English": "en",
                        "Vietnamese": "vi",
                        "Japanese": "ja",
                        "Korean": "ko",
                        "Chinese": "zh",
                    }[language],
                    "minimum_level": level_match.group(1).upper() if level_match else None,
                    "importance": 3,
                }
            )
            break

    inferred_domain = metadata.get("domain")
    if not inferred_domain:
        for terms, domain in (
            (("fintech", "banking", "payment", "ngan hang", "thanh toan"), "fintech"),
            (("ecommerce", "e-commerce", "thuong mai dien tu"), "ecommerce"),
            (("healthcare", "health tech", "y te"), "healthcare"),
            (("education", "edtech", "giao duc"), "education"),
            (("retail", "ban le"), "retail"),
        ):
            if any(term in _fold(requirements_text) for term in terms):
                inferred_domain = domain
                break

    folded_all = _fold(requirements_text)
    remote_type = metadata.get("remote_type") or (
        "hybrid"
        if "hybrid" in folded_all
        else "remote"
        if any(term in folded_all for term in ("remote", "tu xa"))
        else "onsite"
        if any(term in folded_all for term in ("onsite", "on-site", "tai van phong"))
        else "unspecified"
    )
    employment_type = metadata.get("employment_type") or (
        "internship"
        if any(term in folded_all for term in ("intern", "internship", "thuc tap"))
        else "part_time"
        if any(term in folded_all for term in ("part time", "part-time", "ban thoi gian"))
        else "contract"
        if any(term in folded_all for term in ("contract", "hop dong"))
        else "full_time"
        if any(term in folded_all for term in ("full time", "full-time", "toan thoi gian"))
        else "unspecified"
    )

    explicit_classification = any(_fold(marker) in _fold(requirements_text) for marker in MUST_MARKERS + NICE_MARKERS)
    recognized_count = len(must) + len(nice) + len(responsibilities)
    parse_score = min(
        100.0,
        35.0
        + min(35.0, recognized_count * 5.0)
        + (15.0 if explicit_classification else 0.0)
        + (15.0 if title.strip() else 0.0),
    )
    parsed = {
        "schema_version": PIPELINE_VERSION,
        "title": title.strip(),
        "company": metadata.get("company"),
        "job_level": metadata.get("job_level") or _seniority(f"{title}\n{requirements_text}"),
        "domain": inferred_domain,
        "must_have_skills": list(must.values()),
        "nice_to_have_skills": list(nice.values()),
        "responsibilities": responsibilities,
        "min_years_experience": _minimum_years(requirements_text),
        "education_requirements": education_requirements[:5],
        "certification_requirements": certification_requirements[:5],
        "language_requirements": language_requirements,
        "soft_skill_requirements": soft_requirements,
        "work_constraints": {
            "location": metadata.get("location"),
            "remote_type": remote_type,
            "employment_type": employment_type,
        },
        "parse_quality": {
            "score": round(parse_score, 1),
            "explicit_requirement_classification": explicit_classification,
            "ambiguous_requirements": ambiguous_requirements
            + ([] if explicit_classification else ["JD không phân biệt rõ must-have và nice-to-have."]),
        },
    }
    parsed["job"] = {
        "job_id": str(metadata.get("job_id") or ""),
        "title_original": title.strip(),
        "title_normalized": normalize_job_title(title),
        "seniority": parsed["job_level"],
        "summary": sentences[0] if sentences else "",
        "location": parsed["work_constraints"]["location"],
        "work_mode": parsed["work_constraints"]["remote_type"],
        "employment_type": parsed["work_constraints"]["employment_type"],
    }
    parsed["requirements"] = _build_atomic_requirements(parsed, requirements_text)
    return parsed


def _degree_level(text: str) -> str:
    folded = _fold(text)
    for terms, level in (
        (("doctorate", "phd", "tien si"), "doctorate"),
        (("master", "thac si"), "master"),
        (("bachelor", "cu nhan", "dai hoc"), "bachelor"),
        (("associate", "cao dang"), "associate"),
        (("high school", "trung hoc"), "high_school"),
    ):
        if any(term in folded for term in terms):
            return level
    return "unknown"


def _build_atomic_requirements(parsed: dict[str, Any], raw_text: str) -> list[dict[str, Any]]:
    """Convert normalized JD fields into independently retrievable requirements."""
    requirements: list[dict[str, Any]] = []

    def source_page(text: str) -> int:
        offset = raw_text.find(text)
        if offset < 0:
            return 1
        markers = list(re.finditer(r"(?m)^\[PAGE\s+(\d+)\]\s*$", raw_text[:offset]))
        return int(markers[-1].group(1)) if markers else 1

    def add(
        requirement_type: str,
        text: str,
        *,
        mandatory: bool,
        priority: str,
        normalized_value: str | None = None,
        original_value: str | None = None,
        confidence: float = 0.9,
        **extra: Any,
    ) -> None:
        clean = re.sub(r"\s+", " ", str(text or "")).strip()
        if not clean:
            return
        dedupe_key = (_fold(requirement_type), _fold(normalized_value or clean))
        for existing in requirements:
            existing_key = (
                _fold(existing["requirement_type"]),
                _fold(existing.get("normalized_value") or existing["text"]),
            )
            if existing_key == dedupe_key:
                return
        requirements.append(
            {
                "requirement_id": (
                    f"JD_REQ_{len(requirements) + 1:03d}_"
                    f"{hashlib.sha256(f'{requirement_type}|{clean}|{raw_text}'.encode()).hexdigest()[:8].upper()}"
                ),
                "requirement_type": requirement_type,
                "text": clean,
                "mandatory": mandatory,
                "priority": priority,
                "normalized_value": normalized_value,
                "original_value": original_value or normalized_value or clean,
                "source_text": clean,
                "source_page": source_page(clean),
                "confidence": confidence,
                "uncertain": confidence < 0.5,
                **extra,
            }
        )

    for item in parsed["must_have_skills"]:
        name = str(item["name"])
        add(
            "JD_REQUIRED_SKILL",
            name,
            mandatory=True,
            priority="critical" if item.get("is_exclusion") else "high",
            normalized_value=name,
            original_value=name,
            skill_original=name,
            skill_normalized=canonical_skill(name),
            related_values=sorted(RELATED_SKILLS.get(name, set())),
        )
    required_names = {_fold(item["name"]) for item in parsed["must_have_skills"]}
    for item in parsed["nice_to_have_skills"]:
        name = str(item["name"])
        if _fold(name) in required_names:
            continue
        add(
            "JD_PREFERRED_SKILL",
            name,
            mandatory=False,
            priority="low",
            normalized_value=name,
            original_value=name,
            skill_original=name,
            skill_normalized=canonical_skill(name),
            related_values=sorted(RELATED_SKILLS.get(name, set())),
        )
    for item in parsed["responsibilities"]:
        add("JD_RESPONSIBILITY", item["text"], mandatory=False, priority="medium")
    if parsed.get("min_years_experience") is not None:
        years = float(parsed["min_years_experience"])
        quote = next(
            (sentence for sentence in _sentences(raw_text) if _minimum_years(sentence) is not None),
            f"Tối thiểu {years:g} năm kinh nghiệm phù hợp.",
        )
        add(
            "JD_EXPERIENCE",
            quote,
            mandatory=True,
            priority="high",
            minimum_years=years,
            role=parsed.get("title"),
            seniority=parsed.get("job_level"),
            skill=None,
            domain=parsed.get("domain"),
            preferred_years=None,
        )
    for item in parsed["education_requirements"]:
        text = str(item["text"])
        add(
            "JD_EDUCATION",
            text,
            mandatory=any(marker in _fold(text) for marker in map(_fold, EXCLUSION_MARKERS)),
            priority="medium",
            minimum_degree=_degree_level(text),
            preferred_degree=None,
            major="computer science"
            if any(term in _fold(text) for term in ("computer science", "cong nghe thong tin"))
            else None,
        )
    for item in parsed["certification_requirements"]:
        text = str(item["text"])
        mandatory = any(marker in _fold(text) for marker in map(_fold, EXCLUSION_MARKERS))
        add(
            "JD_CERTIFICATION",
            text,
            mandatory=mandatory,
            priority="high" if mandatory else "low",
            normalized_name=_fold(text),
            certification_name=text,
        )
    for item in parsed["language_requirements"]:
        text = str(item["text"])
        mandatory = any(marker in _fold(text) for marker in map(_fold, EXCLUSION_MARKERS))
        add(
            "JD_LANGUAGE",
            text,
            mandatory=mandatory,
            priority="high" if mandatory else "medium",
            normalized_value=str(item["normalized_language"]),
            language=item["language"],
            normalized_language=item["normalized_language"],
            minimum_level=item.get("minimum_level"),
        )
    for item in parsed["soft_skill_requirements"]:
        text = str(item.get("evidence_quote") or item["name"])
        preferred = _requirement_kind(text) == "nice"
        add(
            "JD_PREFERRED_QUALIFICATION" if preferred else "JD_REQUIRED_QUALIFICATION",
            text,
            mandatory=not preferred,
            priority="low" if preferred else "medium",
            normalized_value=str(item["name"]),
        )
    domain = parsed.get("domain")
    if domain:
        add(
            "JD_DOMAIN",
            str(domain),
            mandatory=False,
            priority="medium",
            normalized_value=str(domain),
            domain=domain,
            minimum_years=None,
        )
    constraints = parsed.get("work_constraints") or {}
    for key, requirement_type in (
        ("location", "JD_LOCATION"),
        ("remote_type", "JD_WORK_MODE"),
        ("employment_type", "JD_EMPLOYMENT_TYPE"),
    ):
        if constraints.get(key):
            add(
                requirement_type,
                str(constraints[key]),
                mandatory=False,
                priority="low",
                normalized_value=str(constraints[key]),
            )
    claimed_sources = {_fold(item.get("source_text")) for item in requirements}
    for sentence in _sentences(raw_text):
        if len(sentence) < 10 or _fold(sentence) in claimed_sources or sentence.startswith("[PAGE "):
            continue
        add(
            "JD_OTHER_REQUIREMENT",
            sentence,
            mandatory=False,
            priority="low",
            confidence=0.7,
        )
    return requirements


def _skill_values(parsed_cv: dict[str, Any]) -> list[str]:
    values: list[str] = []
    for key in ("skills", "hard_skills"):
        for item in parsed_cv.get(key) or []:
            if isinstance(item, dict):
                value = item.get("canonical_name") or item.get("name") or item.get("original_text")
            else:
                value = item
            if value:
                values.append(canonical_skill(str(value)))
    return _unique(values)


def _original_skill_values(parsed_cv: dict[str, Any], cv_text: str) -> list[str]:
    values: list[str] = []
    for key in ("skills", "hard_skills", "soft_skills"):
        for item in parsed_cv.get(key) or []:
            if isinstance(item, dict):
                value = item.get("original_name") or item.get("original_text") or item.get("name")
            else:
                value = item
            if value:
                values.append(str(value))
    folded_cv = _fold(cv_text)
    for skill in _extract_canonical_skills(cv_text):
        aliases = [alias for alias, canonical in SKILL_ALIASES.items() if canonical == skill]
        original = next(
            (
                alias
                for alias in sorted(aliases, key=len, reverse=True)
                if re.search(rf"(?<!\w){re.escape(alias)}(?!\w)", folded_cv)
            ),
            skill,
        )
        values.append(original)
    return _unique(values)


def _attach_source_pages(parsed_cv: dict[str, Any], cv_text: str) -> dict[str, Any]:
    parsed = dict(parsed_cv)
    page_parts = re.split(r"\[PAGE\s+(\d+)\]", cv_text, flags=re.IGNORECASE)
    pages = [(int(page_parts[index]), page_parts[index + 1]) for index in range(1, len(page_parts) - 1, 2)]
    if not pages:
        return parsed
    for section in ("experience", "projects", "education", "certifications", "languages"):
        records = []
        for raw_record in parsed_cv.get(section) or []:
            if not isinstance(raw_record, dict) or raw_record.get("source_page"):
                records.append(raw_record)
                continue
            record = dict(raw_record)
            quote = str(record.get("evidence_quote") or record.get("description") or "").strip()
            if quote:
                compact_quote = _fold(quote)[:160]
                record["source_page"] = next(
                    (page_number for page_number, page_text in pages if compact_quote in _fold(page_text)),
                    None,
                )
            records.append(record)
        if records:
            parsed[section] = records
    return parsed


def _record_text(record: Any) -> str:
    if not isinstance(record, dict):
        return str(record or "")
    return " ".join(
        str(value)
        for key, value in record.items()
        if key not in {"id", "source_id"} and isinstance(value, (str, int, float))
    )


def _cv_skill_inventory(cv_text: str, parsed_cv: dict[str, Any]) -> dict[str, dict[str, Any]]:
    inventory: dict[str, dict[str, Any]] = {}
    detected = _extract_canonical_skills(cv_text)
    declared = _skill_values(parsed_cv)
    for skill in _unique([*declared, *detected]):
        evidence: list[dict[str, str]] = []
        strength = "declared"
        for section in ("experience", "projects", "certifications", "education"):
            for index, record in enumerate(parsed_cv.get(section) or []):
                text = _record_text(record)
                if skill in _extract_canonical_skills(text):
                    quote = str(record.get("evidence_quote") or record.get("description") or text).strip()
                    evidence.append(
                        {
                            "section": section,
                            "quote": quote[:1000],
                            "source_id": str(record.get("id") or f"{section}-{index + 1}"),
                        }
                    )
                    strength = "strong" if section in {"experience", "projects"} else "medium"
        if not evidence:
            quote = _sentence_for_term(cv_text, skill)
            if quote:
                evidence.append({"section": "raw_text", "quote": quote, "source_id": "cv-raw"})
                action_terms = (
                    "develop",
                    "build",
                    "design",
                    "implement",
                    "phat trien",
                    "xay dung",
                    "thiet ke",
                    "trien khai",
                )
                strength = "strong" if any(term in _fold(quote) for term in action_terms) else "declared"
        inventory[skill] = {"strength": strength, "evidence": evidence}
    return inventory


def _match_skill_requirement(
    requirement: dict[str, Any], inventory: dict[str, dict[str, Any]], requirement_type: str
) -> dict[str, Any]:
    skill = canonical_skill(str(requirement["name"]))
    direct = inventory.get(skill)
    if direct:
        points = {"strong": 100.0, "medium": 85.0, "declared": 70.0}.get(direct["strength"], 70.0)
        return {
            "requirement_id": requirement["id"],
            "requirement": skill,
            "requirement_type": requirement_type,
            "importance": requirement["importance"],
            "status": "matched",
            "evidence_strength": direct["strength"],
            "evidence": direct["evidence"],
            "reason": f"CV có bằng chứng cho {skill}.",
            "confidence": 0.98 if direct["evidence"] else 0.82,
            "score": points,
        }

    related = sorted(RELATED_SKILLS.get(skill, set()).intersection(inventory))
    if related:
        evidence = [entry for name in related for entry in inventory[name]["evidence"]][:4]
        return {
            "requirement_id": requirement["id"],
            "requirement": skill,
            "requirement_type": requirement_type,
            "importance": requirement["importance"],
            "status": "partial",
            "evidence_strength": "partial",
            "evidence": evidence,
            "reason": f"CV có kỹ năng liên quan ({', '.join(related)}) nhưng chưa có bằng chứng trực tiếp về {skill}.",
            "confidence": 0.85,
            "score": 50.0,
        }

    return {
        "requirement_id": requirement["id"],
        "requirement": skill,
        "requirement_type": requirement_type,
        "importance": requirement["importance"],
        "status": "missing",
        "evidence_strength": "missing",
        "evidence": [],
        "reason": f"Chưa tìm thấy bằng chứng về {skill} trong CV.",
        "confidence": 0.92,
        "score": 0.0,
    }


def _token_set(text: str) -> set[str]:
    stop = {"va", "voi", "cac", "cho", "trong", "the", "and", "with", "for", "from", "using", "a", "an"}
    return {token for token in re.findall(r"[a-z0-9+#.]{2,}", _fold(text)) if token not in stop}


def _match_text_requirement(
    requirement: dict[str, Any], cv_text: str, parsed_cv: dict[str, Any], requirement_type: str
) -> dict[str, Any]:
    target = str(requirement.get("text") or requirement.get("name") or "")
    target_tokens = _token_set(target)
    candidates: list[tuple[str, str, str]] = []
    for section in ("experience", "projects", "education", "certifications"):
        for index, record in enumerate(parsed_cv.get(section) or []):
            text = _record_text(record)
            candidates.append((section, str(record.get("id") or f"{section}-{index + 1}"), text))
    candidates.extend(("raw_text", "cv-raw", sentence) for sentence in _sentences(cv_text))

    best: tuple[float, str, str, str] | None = None
    for section, source_id, candidate in candidates:
        candidate_tokens = _token_set(candidate)
        overlap = len(target_tokens.intersection(candidate_tokens)) / max(1, len(target_tokens))
        if best is None or overlap > best[0]:
            best = (overlap, section, source_id, candidate)

    overlap, section, source_id, candidate = best or (0.0, "", "", "")
    if overlap >= 0.55:
        status: RequirementStatus = "matched"
        score, strength, confidence = 100.0, "strong", 0.86
    elif overlap >= 0.25:
        status = "partial"
        score, strength, confidence = 50.0, "partial", 0.72
    else:
        status = "unknown" if requirement_type == "soft_skill" else "missing"
        score, strength, confidence = 0.0, "unknown" if status == "unknown" else "missing", 0.65
    return {
        "requirement_id": requirement["id"],
        "requirement": target,
        "requirement_type": requirement_type,
        "importance": requirement.get("importance", 1),
        "status": status,
        "evidence_strength": strength,
        "evidence": (
            [{"section": section, "quote": candidate[:1000], "source_id": source_id}] if overlap >= 0.25 else []
        ),
        "reason": (
            f"Tìm thấy bằng chứng liên quan trong mục {section}."
            if overlap >= 0.25
            else "Chưa có đủ bằng chứng trong CV để kết luận."
        ),
        "confidence": confidence,
        "score": score,
    }


def _parse_period_months(text: str) -> int | None:
    folded = _fold(text)
    years = re.findall(r"\b(19\d{2}|20\d{2})\b", folded)
    if len(years) >= 2:
        return max(0, (int(years[-1]) - int(years[0])) * 12)
    duration_years = re.search(r"(\d+(?:[.,]\d+)?)\s*(?:nam|years?)", folded)
    if duration_years:
        return round(float(duration_years.group(1).replace(",", ".")) * 12)
    duration_months = re.search(r"(\d+)\s*(?:thang|months?)", folded)
    return int(duration_months.group(1)) if duration_months else None


def _experience_months(parsed_cv: dict[str, Any]) -> tuple[int | None, bool]:
    records = parsed_cv.get("experience") or []
    durations = []
    for record in records:
        if isinstance(record, dict) and isinstance(record.get("duration_months"), (int, float)):
            durations.append(int(record["duration_months"]))
        else:
            duration = _parse_period_months(_record_text(record))
            if duration is not None:
                durations.append(duration)
    return (sum(durations) if durations else None, bool(records))


def _cv_seniority(parsed_cv: dict[str, Any], cv_text: str) -> str | None:
    titles = " ".join(
        str(record.get("title") or "") for record in parsed_cv.get("experience") or [] if isinstance(record, dict)
    )
    targets = " ".join(str(value) for value in parsed_cv.get("target_roles") or [])
    return _seniority(f"{titles}\n{targets}\n{cv_text[:1000]}")


def _role_fit(title: str, cv_text: str, inventory: dict[str, dict[str, Any]]) -> float:
    folded_title = _fold(title).replace("full stack", "fullstack")
    folded_cv = _fold(cv_text).replace("full stack", "fullstack")
    roles = [role for role in ROLE_SKILLS if role in folded_title]
    if not roles:
        return 100.0 if any(skill in inventory for skill in _extract_canonical_skills(title)) else 70.0
    if any(role in folded_cv for role in roles):
        return 100.0
    relevant = set().union(*(ROLE_SKILLS[role] for role in roles))
    overlap = len(relevant.intersection(inventory))
    return min(90.0, 45.0 + overlap * 10.0) if overlap else 20.0


def _group_score(items: list[dict[str, Any]]) -> float | None:
    scored = [item for item in items if item["status"] != "unknown"]
    denominator = sum(float(item.get("importance") or 1) for item in scored)
    if not denominator:
        return None
    return round(
        sum(float(item["score"]) * float(item.get("importance") or 1) for item in scored) / denominator,
        2,
    )


def _weighted_score(groups: dict[str, float | None]) -> float:
    weights = {
        "must_have_skills": 35.0,
        "experience_seniority": 20.0,
        "responsibilities": 15.0,
        "nice_to_have_skills": 10.0,
        "role_domain_fit": 10.0,
        "education_certification": 5.0,
        "soft_skills": 5.0,
    }
    active = {key: value for key, value in groups.items() if value is not None}
    denominator = sum(weights[key] for key in active)
    if not denominator:
        return 0.0
    return round(sum(float(value) * weights[key] for key, value in active.items()) / denominator, 2)


def _match_level(score: float, must_coverage: float, confidence: float) -> str:
    if confidence < 0.5:
        return "insufficient_data"
    if score >= 80 and must_coverage >= 0.85:
        return "high_match"
    if score >= 60 and must_coverage >= 0.65:
        return "application_ready"
    if score >= 40:
        return "partial_match"
    return "low_match"


def _run_spec_pipeline(
    *,
    cv_text: str,
    parsed_cv: dict[str, Any],
    jd: dict[str, Any],
    rubric: dict[str, Any] | None = None,
) -> dict[str, Any]:
    from src.config import get_settings
    from src.services.cv_jd_pipeline import PipelineConfig, run_cv_jd_pipeline

    settings = get_settings()
    normalized_cv = _attach_source_pages(parsed_cv, cv_text)
    normalized_cv["skills"] = _original_skill_values(parsed_cv, cv_text)
    result = run_cv_jd_pipeline(
        cv_text=cv_text,
        parsed_cv=normalized_cv,
        job_id=str(jd.get("job_id") or jd.get("title") or "JOB_UNKNOWN"),
        requirements=jd["requirements"],
        rubric=rubric,
        config=PipelineConfig(
            bm25_top_k=settings.cv_jd_bm25_top_k,
            semantic_top_k=settings.cv_jd_semantic_top_k,
            semantic_min_score=settings.cv_jd_semantic_min_score,
            rrf_k=settings.cv_jd_rrf_k,
            hybrid_top_k=settings.cv_jd_hybrid_top_k,
            max_evidence_per_requirement=settings.cv_jd_evidence_max_per_requirement,
            score_decimal_places=settings.cv_jd_score_decimal_places,
            embedding_provider=settings.cv_jd_embedding_provider,
            embedding_model=settings.cv_jd_embedding_model,
            embedding_api_key=settings.google_genai_api_key,
            embedding_dimensions=settings.cv_jd_embedding_dimensions,
            rating_poor_max=settings.cv_jd_rating_poor_max,
            rating_average_max=settings.cv_jd_rating_average_max,
            rating_good_max=settings.cv_jd_rating_good_max,
            extraction_min_confidence=settings.cv_jd_extraction_min_confidence,
        ),
    )
    evaluated = [
        *result["requirements"]["matched"],
        *result["requirements"]["partial"],
        *result["requirements"]["missing"],
        *result["requirements"]["uncertain"],
    ]
    evaluated.sort(key=lambda item: item["requirement_id"])
    legacy_status = {
        "SUPPORTED": "matched",
        "PARTIALLY_SUPPORTED": "partial",
        "NOT_FOUND": "missing",
        "CONFLICTING": "missing",
        "UNCERTAIN": "unknown",
    }
    matrix = []
    for item in evaluated:
        requirement_type = str(item["requirement_type"])
        compatibility_type = {
            "JD_REQUIRED_SKILL": "must_have_skill",
            "JD_PREFERRED_SKILL": "nice_to_have_skill",
            "JD_RESPONSIBILITY": "responsibility",
            "JD_REQUIRED_QUALIFICATION": "soft_skill",
            "JD_PREFERRED_QUALIFICATION": "soft_skill",
            "JD_EDUCATION": "education",
            "JD_CERTIFICATION": "certification",
            "JD_EXPERIENCE": "experience",
            "JD_DOMAIN": "domain",
        }.get(requirement_type, requirement_type.casefold())
        status = legacy_status[item["status"]]
        if compatibility_type == "soft_skill" and item["status"] == "NOT_FOUND":
            status = "unknown"
            item["reason"] = "Chưa có đủ bằng chứng trong CV để kết luận."
        evidence = [
            {
                "section": source.get("source_section") or "unknown",
                "quote": source["text"],
                "source_id": source["chunk_id"],
                **source,
            }
            for source in item["evidence"]
        ]
        matrix.append(
            {
                "requirement_id": item["requirement_id"],
                "requirement": item.get("normalized_value") or item.get("text") or "",
                "requirement_type": compatibility_type,
                "importance": {"critical": 5, "high": 4, "medium": 3, "low": 2}.get(item.get("priority"), 1),
                "status": status,
                "evaluation_status": item["status"],
                "match_classification": item["match_classification"],
                "evidence_strength": (
                    "strong"
                    if item["status"] == "SUPPORTED"
                    else "partial"
                    if item["status"] == "PARTIALLY_SUPPORTED"
                    else "unknown"
                    if item["status"] == "UNCERTAIN"
                    else "missing"
                ),
                "evidence": evidence,
                "reason": item["reason"],
                "confidence": float(item.get("confidence", 0.9)),
                "score": item["criterion_score"],
            }
        )

    required_skills = [item for item in evaluated if item["requirement_type"] == "JD_REQUIRED_SKILL"]
    preferred_skills = [item for item in evaluated if item["requirement_type"] == "JD_PREFERRED_SKILL"]
    skill_items = [*required_skills, *preferred_skills]
    matched = [str(item.get("normalized_value")) for item in skill_items if item["status"] == "SUPPORTED"]
    partial = [str(item.get("normalized_value")) for item in skill_items if item["status"] == "PARTIALLY_SUPPORTED"]
    missing = [
        str(item.get("normalized_value")) for item in skill_items if item["status"] in {"NOT_FOUND", "CONFLICTING"}
    ]
    coverage = (
        sum(
            1.0 if item["status"] == "SUPPORTED" else 0.5 if item["status"] == "PARTIALLY_SUPPORTED" else 0.0
            for item in required_skills
        )
        / len(required_skills)
        if required_skills
        else 1.0
    )
    cv_quality = float((parsed_cv.get("ats_quality") or {}).get("score") or (75 if parsed_cv else 55)) / 100
    jd_quality = float((jd.get("parse_quality") or {}).get("score") or 50) / 100
    evidence_ratio = len(result["evidence"]) / max(1, len(evaluated) * 3)
    confidence = round(min(1.0, cv_quality * 0.4 + jd_quality * 0.4 + evidence_ratio * 0.2), 2)
    score = float(result["final_score"])
    score_breakdown = {
        item["criterion_id"].removeprefix("CRIT_").casefold(): item["raw_score"] for item in result["criteria"]
    }
    unknown = [
        str(item.get("normalized_value") or item["text"])
        for item in evaluated
        if item["status"] == "UNCERTAIN"
        or (
            item["requirement_type"] in {"JD_REQUIRED_QUALIFICATION", "JD_PREFERRED_QUALIFICATION"}
            and item["status"] == "NOT_FOUND"
        )
    ]
    soft_gap = [
        str(item.get("normalized_value") or item["text"])
        for item in evaluated
        if item["requirement_type"] in {"JD_REQUIRED_QUALIFICATION", "JD_PREFERRED_QUALIFICATION"}
        and item["status"] != "SUPPORTED"
    ]
    strengths = [
        f"{item.get('normalized_value') or item['text']}: {item['reason']}"
        for item in evaluated
        if item["status"] == "SUPPORTED"
    ][:5] or ["Chưa có đủ bằng chứng trực tiếp cho các yêu cầu chính của JD."]
    risks = [
        f"{item.get('normalized_value') or item['text']}: {item['reason']}"
        for item in evaluated
        if item.get("mandatory") and item["status"] != "SUPPORTED"
    ][:5]
    return {
        **result,
        "pipeline_version": PIPELINE_VERSION,
        "match_score": score,
        "raw_match_score": score,
        "match_level": _match_level(score, coverage, confidence),
        "confidence_score": confidence,
        "confidence_level": "high" if confidence >= 0.8 else "medium" if confidence >= 0.5 else "low",
        "must_have_coverage": round(coverage, 2),
        "must_have_gate": {
            "applied": False,
            "mandatory_requirement_failed": result["mandatory_requirement_failed"],
            "raw_score": score,
            "final_score": score,
            "note": "Spec v1 chỉ cảnh báo mandatory failure; không cap hoặc tự động đưa điểm về 0.",
        },
        "cv_skills": _skill_values(parsed_cv),
        "jd_skills": [item["name"] for item in [*jd["must_have_skills"], *jd["nice_to_have_skills"]]],
        "jd_parsed": jd,
        "structured_jd": jd,
        "requirement_evidence": matrix,
        "hard_skills_matching": _unique(matched),
        "hard_skills_partial": _unique(partial),
        "hard_skills_missing": _unique([*partial, *missing]),
        "soft_skills_gap": _unique(soft_gap),
        "unknown_requirements": _unique(unknown),
        "score_breakdown": score_breakdown,
        "strengths": strengths,
        "risks": risks,
    }


def build_cv_jd_evidence(
    *,
    cv_text: str,
    parsed_cv: dict[str, Any],
    jd_title: str,
    jd_requirements: str,
    jd_parsed: dict[str, Any] | None = None,
    rubric: dict[str, Any] | None = None,
) -> dict[str, Any]:
    jd = parse_job_description(
        title=jd_title,
        requirements_text=jd_requirements,
        metadata=jd_parsed,
    )
    return _run_spec_pipeline(cv_text=cv_text, parsed_cv=parsed_cv, jd=jd, rubric=rubric)

    # Legacy v3 implementation retained below temporarily for migration reference.
    inventory = _cv_skill_inventory(cv_text, parsed_cv)
    matrix: list[dict[str, Any]] = []
    must_items = [_match_skill_requirement(item, inventory, "must_have_skill") for item in jd["must_have_skills"]]
    nice_items = [_match_skill_requirement(item, inventory, "nice_to_have_skill") for item in jd["nice_to_have_skills"]]
    responsibility_items = [
        _match_text_requirement(item, cv_text, parsed_cv, "responsibility") for item in jd["responsibilities"]
    ]
    soft_items = [
        _match_text_requirement(item, cv_text, parsed_cv, "soft_skill") for item in jd["soft_skill_requirements"]
    ]
    education_items = [
        _match_text_requirement(item, cv_text, parsed_cv, "education") for item in jd["education_requirements"]
    ]
    certification_items = [
        _match_text_requirement(item, cv_text, parsed_cv, "certification") for item in jd["certification_requirements"]
    ]
    matrix.extend(
        [*must_items, *nice_items, *responsibility_items, *soft_items, *education_items, *certification_items]
    )

    months, has_experience = _experience_months(parsed_cv)
    has_projects = bool(parsed_cv.get("projects"))
    min_years = jd.get("min_years_experience")
    seniority = jd.get("job_level") or _seniority(jd_title)
    if min_years is not None:
        if months is None:
            experience_score = 55.0 if has_experience else 30.0 if has_projects else 0.0
        else:
            experience_score = min(100.0, months / max(1.0, float(min_years) * 12.0) * 100.0)
    elif seniority in {"senior", "lead", "manager"}:
        experience_score = 70.0 if has_experience and months is None else min(100.0, (months or 0) / 36 * 100.0)
    elif seniority in {"intern", "fresher"}:
        experience_score = 100.0 if has_experience or has_projects else 60.0
    elif seniority in {"junior", "middle"}:
        experience_score = 100.0 if has_experience else 70.0 if has_projects else 30.0
    else:
        experience_score = 85.0 if has_experience else 65.0 if has_projects else None

    groups: dict[str, float | None] = {
        "must_have_skills": _group_score(must_items),
        "experience_seniority": round(experience_score, 2) if experience_score is not None else None,
        "responsibilities": _group_score(responsibility_items),
        "nice_to_have_skills": _group_score(nice_items),
        "role_domain_fit": _role_fit(jd_title, cv_text, inventory),
        "education_certification": _group_score([*education_items, *certification_items]),
        "soft_skills": _group_score(soft_items),
    }
    raw_score = _weighted_score(groups)
    if must_items:
        coverage_points = sum(
            1.0 if item["status"] == "matched" else 0.5 if item["status"] == "partial" else 0.0 for item in must_items
        )
        must_coverage = coverage_points / len(must_items)
    else:
        must_coverage = 1.0
    final_score = min(raw_score, 49.0) if must_items and must_coverage < 0.5 else raw_score
    exclusion_missing = any(
        item["status"] == "missing"
        and next(
            (
                bool(requirement.get("is_exclusion"))
                for requirement in jd["must_have_skills"]
                if requirement["id"] == item["requirement_id"]
            ),
            False,
        )
        for item in must_items
    )
    if exclusion_missing:
        final_score = min(final_score, 59.0)

    seniority_rank = {
        "intern": 0,
        "fresher": 1,
        "junior": 2,
        "middle": 3,
        "senior": 4,
        "lead": 5,
        "manager": 6,
    }
    cv_seniority = _cv_seniority(parsed_cv, cv_text)
    jd_seniority = seniority if seniority in seniority_rank else None
    seniority_gap = (
        seniority_rank[jd_seniority] - seniority_rank[cv_seniority] if jd_seniority and cv_seniority else None
    )
    if seniority_gap is not None and seniority_gap > 2:
        final_score = min(final_score, 79.0)

    cv_quality = float((parsed_cv.get("ats_quality") or {}).get("score") or (75 if parsed_cv else 55)) / 100.0
    jd_quality = float((jd.get("parse_quality") or {}).get("score") or 50) / 100.0
    unknown_ratio = sum(item["status"] == "unknown" for item in matrix) / max(1, len(matrix))
    direct_ratio = sum(bool(item["evidence"]) for item in matrix) / max(1, len(matrix))
    confidence = max(
        0.0,
        min(1.0, cv_quality * 0.3 + jd_quality * 0.3 + (1 - unknown_ratio) * 0.25 + direct_ratio * 0.15),
    )
    confidence = round(confidence, 2)

    matched = [item["requirement"] for item in [*must_items, *nice_items] if item["status"] == "matched"]
    partial = [item["requirement"] for item in [*must_items, *nice_items] if item["status"] == "partial"]
    missing = [item["requirement"] for item in [*must_items, *nice_items] if item["status"] == "missing"]
    unknown = [item["requirement"] for item in matrix if item["status"] == "unknown"]
    soft_gap = [item["requirement"] for item in soft_items if item["status"] in {"missing", "unknown"}]
    strengths = [f"{item['requirement']}: {item['reason']}" for item in matrix if item["status"] == "matched"][:5]
    risks = [
        f"{item['requirement']}: {item['reason']}"
        for item in matrix
        if item["status"] in {"partial", "missing"} and item["requirement_type"] == "must_have_skill"
    ][:5]
    if not strengths:
        strengths = ["Chưa có đủ bằng chứng trực tiếp cho các yêu cầu chính của JD."]
    if not risks and unknown:
        risks = ["Một số yêu cầu chưa đủ dữ liệu để kết luận; người dùng nên kiểm tra thủ công."]

    return {
        "pipeline_version": PIPELINE_VERSION,
        "cv_skills": list(inventory),
        "jd_skills": [item["name"] for item in [*jd["must_have_skills"], *jd["nice_to_have_skills"]]],
        "jd_parsed": jd,
        "requirement_evidence": matrix,
        "hard_skills_matching": matched,
        "hard_skills_partial": partial,
        "hard_skills_missing": _unique([*partial, *missing]),
        "soft_skills_gap": soft_gap,
        "unknown_requirements": unknown,
        "score_breakdown": {key: value for key, value in groups.items() if value is not None},
        "raw_match_score": raw_score,
        "match_score": round(max(0.0, min(100.0, final_score)), 2),
        "match_level": _match_level(final_score, must_coverage, confidence),
        "confidence_score": confidence,
        "confidence_level": "high" if confidence >= 0.8 else "medium" if confidence >= 0.5 else "low",
        "must_have_coverage": round(must_coverage, 2),
        "must_have_gate": {
            "applied": final_score < raw_score,
            "missing_exclusion_requirement": exclusion_missing,
            "seniority_gap_levels": seniority_gap,
            "raw_score": raw_score,
            "final_score": round(final_score, 2),
        },
        "strengths": strengths,
        "risks": risks,
    }
