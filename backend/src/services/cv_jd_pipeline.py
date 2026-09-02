from __future__ import annotations

import hashlib
import json
import logging
import math
import re
import unicodedata
from collections import Counter, defaultdict
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from time import perf_counter
from typing import Any

from src.services.semantic_relations import (
    canonical_skill,
    match_semantic_relation,
)

PIPELINE_VERSION = "1.0"
SCHEMA_VERSION = "1.0"
logger = logging.getLogger(__name__)

ALLOWED_CHUNK_TYPES: dict[str, set[str]] = {
    "JD_REQUIRED_SKILL": {"CV_SKILL", "CV_EXPERIENCE", "CV_PROJECT", "CV_SUMMARY", "CV_CERTIFICATION"},
    "JD_PREFERRED_SKILL": {"CV_SKILL", "CV_EXPERIENCE", "CV_PROJECT", "CV_SUMMARY", "CV_CERTIFICATION"},
    "JD_EXPERIENCE": {"CV_EXPERIENCE", "CV_PROJECT", "CV_SUMMARY"},
    "JD_EDUCATION": {"CV_EDUCATION"},
    "JD_CERTIFICATION": {"CV_CERTIFICATION"},
    "JD_LANGUAGE": {"CV_LANGUAGE", "CV_CERTIFICATION"},
    "JD_RESPONSIBILITY": {"CV_EXPERIENCE", "CV_PROJECT"},
    "JD_DOMAIN": {"CV_EXPERIENCE", "CV_PROJECT", "CV_SUMMARY"},
    "JD_REQUIRED_QUALIFICATION": {"CV_EXPERIENCE", "CV_PROJECT", "CV_SUMMARY", "CV_SKILL", "CV_CERTIFICATION"},
    "JD_PREFERRED_QUALIFICATION": {"CV_EXPERIENCE", "CV_PROJECT", "CV_SUMMARY", "CV_SKILL", "CV_CERTIFICATION"},
    "JD_LOCATION": set(),
    "JD_WORK_MODE": set(),
    "JD_EMPLOYMENT_TYPE": set(),
    "JD_OTHER_REQUIREMENT": {"CV_OTHER", "CV_SUMMARY", "CV_EXPERIENCE", "CV_PROJECT", "CV_SKILL", "CV_EDUCATION"},
}

SKILL_FACTORS = {
    "DIRECT": 1.0,
    "EQUIVALENT": 1.0,
    "INFERRED": 0.95,
    "EXACT_MATCH": 1.0,
    "NORMALIZED_MATCH": 1.0,
    "SEMANTIC_MATCH": 0.8,
    "ADJACENT": 0.45,
    "PARTIAL_MATCH": 0.5,
    "NO_EVIDENCE": 0.0,
    "NOT_FOUND": 0.0,
}

# A standalone Skills section is a self-declaration. High scores require the
# skill to be demonstrated in a project, work-experience record, or summary context.
SUBSTANTIVE_SKILL_EVIDENCE_CHUNK_TYPES = {"CV_EXPERIENCE", "CV_PROJECT", "CV_SUMMARY"}

DEGREE_RANK = {
    "high_school": 1,
    "associate": 2,
    "bachelor": 3,
    "master": 4,
    "doctorate": 5,
}

DEGREE_LABELS = {
    "high_school": "Trung học phổ thông",
    "associate": "Cao đẳng",
    "bachelor": "Cử nhân / Đại học",
    "master": "Thạc sĩ",
    "doctorate": "Tiến sĩ",
}

SIX_GROUPS: list[tuple[str, str, str]] = [
    ("skills", "CRIT_SKILLS", "Kỹ năng chuyên môn"),
    ("responsibilities_task_fit", "CRIT_RESPONSIBILITIES", "Trách nhiệm & Nhiệm vụ"),
    ("experience_seniority", "CRIT_EXPERIENCE", "Kinh nghiệm & Cấp bậc"),
    ("education", "CRIT_EDUCATION", "Học vấn & Bằng cấp"),
    ("domain_industry", "CRIT_DOMAIN", "Lĩnh vực chuyên môn"),
    ("certifications_languages_other", "CRIT_CERTIFICATIONS_OTHER", "Chứng chỉ, Ngoại ngữ & Khác"),
]

# Legacy rubric weights - isolated and kept only as a reference fallback for custom rubric validations;
# does not influence JD-driven requirement scoring.
DEFAULT_RUBRIC = {
    "CRIT_SKILLS": 35.0,
    "CRIT_RESPONSIBILITIES": 20.0,
    "CRIT_EXPERIENCE": 20.0,
    "CRIT_EDUCATION": 10.0,
    "CRIT_DOMAIN": 10.0,
    "CRIT_CERTIFICATIONS_OTHER": 5.0,
}

NORMALIZATION_ALIASES = {
    "amazon web services": "aws",
    "postgres sql": "postgresql",
    "postgres": "postgresql",
    "react.js": "react",
    "reactjs": "react",
    "restful api": "rest api",
    "node.js": "nodejs",
    "js": "javascript",
}

SOFT_SKILL_SYNONYMS: dict[str, list[str]] = {
    "giai quyet van de": [
        "problem solving", "problem-solving", "troubleshooting", "troubleshoot", "giai quyet van de", "xu ly van de",
        "toi uu", "optimize", "optimization", "khac phuc", "fix", "resolve", "solution", "critical thinking"
    ],
    "tu duy logic": [
        "logical thinking", "logic", "analytical", "analytical thinking", "tu duy logic", "tu duy phan bien",
        "algorithm", "system design", "thiet ke he thong", "clean architecture", "data structure", "cau truc du lieu"
    ],
    "tinh than trach nhiem": [
        "responsibility", "responsible", "ownership", "accountable", "accountability", "dedicated", "dedication",
        "tinh than trach nhiem", "trach nhiem cao", "proactive", "chu dong", "cam ket", "commitment", "clean code",
        "maintainable", "self-healing", "reliability", "bao mat", "security"
    ],
    "lam viec nhom": [
        "teamwork", "team work", "collaborate", "collaboration", "team player", "lam viec nhom", "phoi hop",
        "dong nghiep", "cross-functional", "scrum", "agile", "pair programming", "code review"
    ],
    "tu nghien cuu": [
        "self-learning", "self-study", "research", "scientific research", "nghien cuu", "tu hoc", "proactive learning",
        "fast learner", "autonomous", "doc lap"
    ],
    "giao tiep": [
        "communication", "giao tiep", "presentation", "thuyet trinh", "interpersonal", "bao cao", "report"
    ],
    "chiu ap luc": [
        "stress tolerance", "work under pressure", "chiu ap luc", "deadline", "fast-paced", "resilience"
    ],
    "he thong phan tan": [
        "distributed", "distributed system", "microservices", "microservice", "kafka", "rabbitmq", "event-driven", "he thong phan tan"
    ],
    "dien toan dam may": [
        "cloud", "cloud computing", "aws", "docker", "kubernetes", "dien toan dam may", "dam may"
    ],
    "lap trinh": [
        "programming", "software engineering", "developer", "java", "python", "javascript", "typescript", "clean code", "lap trinh"
    ],
    "nghien cuu khoa hoc": [
        "scientific research", "research", "paper", "nghien cuu khoa hoc", "nghien cuu"
    ],
    "tri tue nhan tao": [
        "ai", "artificial intelligence", "machine learning", "ml", "nlp", "llm", "genai", "tri tue nhan tao"
    ],
}


def fold(value: Any) -> str:
    text = str(value or "").casefold().replace("đ", "d").replace("Đ", "d")
    text = unicodedata.normalize("NFD", text)
    text = "".join(char for char in text if unicodedata.category(char) != "Mn")
    return re.sub(r"\s+", " ", text).strip()


def _soft_skill_synonyms(name: str) -> list[str]:
    folded_name = fold(name)
    terms = [name]
    for key, syns in SOFT_SKILL_SYNONYMS.items():
        if key in folded_name or folded_name in key:
            terms.extend(syns)
    return list(dict.fromkeys(terms))


def tokenize(value: str) -> list[str]:
    stopwords = {
        "a",
        "an",
        "and",
        "are",
        "as",
        "at",
        "be",
        "by",
        "for",
        "from",
        "in",
        "is",
        "of",
        "on",
        "or",
        "that",
        "the",
        "to",
        "using",
        "with",
        "va",
        "voi",
        "cac",
        "cho",
        "cua",
        "la",
        "trong",
    }
    return [token for token in re.findall(r"[a-z0-9+#.]{2,}", fold(value)) if token not in stopwords]


def normalize_terms(value: str) -> str:
    normalized = fold(value)
    for alias, canonical in sorted(NORMALIZATION_ALIASES.items(), key=lambda item: -len(item[0])):
        normalized = re.sub(rf"(?<!\w){re.escape(alias)}(?!\w)", canonical, normalized)
    return normalized


def _id(prefix: str, *parts: Any) -> str:
    digest = hashlib.sha256("|".join(str(part) for part in parts).encode("utf-8")).hexdigest()[:12].upper()
    return f"{prefix}_{digest}"


def _record_text(record: Any) -> str:
    if not isinstance(record, dict):
        return str(record or "").strip()
    preferred = [
        record.get("evidence_quote"),
        record.get("description"),
        record.get("text"),
        record.get("summary"),
        record.get("title"),
        record.get("job_title_original"),
        record.get("organization"),
        record.get("company"),
        record.get("period"),
        record.get("degree_original"),
        record.get("major"),
        record.get("name"),
    ]
    values = [str(value).strip() for value in preferred if value]
    for key in ("descriptions", "skills", "domain"):
        if isinstance(record.get(key), list):
            values.extend(str(value).strip() for value in record[key] if str(value).strip())
    return " ".join(dict.fromkeys(values)).strip()


def _normalized_text(value: str) -> str:
    return " ".join(tokenize(normalize_terms(value)))


@dataclass(frozen=True)
class PipelineConfig:
    bm25_top_k: int = 20
    semantic_top_k: int = 20
    semantic_min_score: float = 0.45
    rrf_k: int = 60
    hybrid_top_k: int = 10
    max_evidence_per_requirement: int = 3
    score_decimal_places: int = 1
    embedding_provider: str = "auto"
    embedding_model: str = "gemini-embedding-2"
    embedding_api_key: str = ""
    embedding_dimensions: int = 768
    rating_poor_max: float = 49.9
    rating_average_max: float = 69.9
    rating_good_max: float = 84.9
    extraction_min_confidence: float = 0.50
    declared_skill_score_cap: float = 50.0
    mandatory_failure_score_cap: float = 49.0


def _is_contact_or_header_text(text: str) -> bool:
    value = re.sub(r"\s+", " ", str(text or "")).strip()
    if not value or len(value) < 3:
        return True
    lowered = value.casefold()
    unaccented = fold(value)
    if re.search(r"[\w.+-]+@[\w.-]+\.[a-z]{2,}", value, flags=re.IGNORECASE):
        return True
    if re.search(r"(?:facebook|linkedin|github|instagram|gitlab)\.com/", lowered):
        return True
    if re.search(r"https?://|www\.", value, flags=re.IGNORECASE):
        return True
    if re.search(r"(?:\+?84|0)[\s.()-]*\d(?:[\s.()-]*\d){7,9}", value):
        return True
    if re.search(r"^(?:ho\s+ten|full\s*name|name|email|dien\s+thoai|phone|so\s+dien\s+thoai|tel|mobile|dia\s+chi|address|location|ngay\s+sinh|dob|date\s+of\s+birth|gioi\s+tinh|gender)\s*[:：]", unaccented):
        return True
    if re.search(r"^(?:địa\s+chỉ|họ\s+tên|số\s+điện\s+thoại|ngày\s+sinh|giới\s+tính)\s*[:：]", lowered):
        return True
    if re.search(r"\b(?:xa|phuong|quan|huyen|tinh|tp\.?|thanh pho|district|ward|city|province)\b", unaccented):
        if re.search(r"^(?:dia\s+chi|address|location)\s*[:：]", unaccented) or re.search(r"^(?:địa\s+chỉ|address|location)\s*[:：]", lowered):
            return True
        # If line contains address markers and city/district names without any experience/project verbs
        if re.search(r"\b(?:ha noi|ho chi minh|da nang|cau giay|ba dinh|hai ba trung|dong da|quan\s+\d+|district\s+\d+)\b", unaccented):
            if not any(v in unaccented for v in ("du an", "kinh nghiem", "phat trien", "xay dung", "thiet ke", "lap trinh", "lam viec", "chuc vu", "role", "experience")):
                return True
    return False


EVIDENCE_STRENGTH_BASELINES: dict[str, float] = {
    "work_experience": 1.0,
    "project": 0.9,
    "certification": 0.85,
    "achievement": 0.8,
    "education": 0.7,
    "language": 0.6,
    "skills": 0.4,
    "summary": 0.3,
    "other": 0.2,
}


class ChunkingService:
    """Structure-aware parent-child CV chunking (20-120 tokens per child) with full source metadata."""

    @staticmethod
    def build(cv_text: str, parsed_cv: dict[str, Any]) -> tuple[str, str, list[dict[str, Any]]]:
        candidate_id = str(parsed_cv.get("_candidate_id") or _id("CAND", cv_text))
        document_id = _id("DOC", candidate_id, cv_text)
        chunks: list[dict[str, Any]] = []

        def add(
            chunk_type: str,
            text: str,
            section: str,
            page: int | None,
            parent_type: str,
            parent_title: str,
            evidence_type: str,
            evidence_strength: float,
            metadata: dict[str, Any] | None = None,
            company: str | None = None,
            role: str | None = None,
            start_date: str | None = None,
            end_date: str | None = None,
            duration_months: int | None = None,
        ) -> None:
            clean = re.sub(r"\s+", " ", text).strip()
            if not clean or _is_contact_or_header_text(clean):
                return
            index = len(chunks) + 1
            from src.agents.tools.career_tools import SOFT_SKILLS, TECH_SKILLS, extract_known_terms
            skills_exp = extract_known_terms(clean, TECH_SKILLS) + extract_known_terms(clean, SOFT_SKILLS)
            skills_norm = [canonical_skill(s) for s in skills_exp]

            meta = dict(metadata or {})
            meta.update({
                "parent_type": parent_type,
                "parent_title": parent_title,
                "evidence_type": evidence_type,
                "evidence_strength": evidence_strength,
                "skills_explicit": skills_exp,
                "skills_normalized": skills_norm,
                "company": company,
                "role": role,
                "start_date": start_date,
                "end_date": end_date,
                "duration_months": duration_months,
            })

            chunks.append(
                {
                    "chunk_id": f"CV_CHUNK_{index:03d}_{_id('', document_id, section, clean).strip('_')[:8]}",
                    "candidate_id": candidate_id,
                    "document_id": document_id,
                    "chunk_type": chunk_type,
                    "text": clean[:3000],
                    "normalized_text": _normalized_text(clean)[:3000],
                    "source_section": section,
                    "source_page": page,
                    "parent_type": parent_type,
                    "parent_title": parent_title,
                    "evidence_type": evidence_type,
                    "evidence_strength": evidence_strength,
                    "skills_explicit": skills_exp,
                    "skills_normalized": skills_norm,
                    "company": company,
                    "role": role,
                    "start_date": start_date,
                    "end_date": end_date,
                    "duration_months": duration_months,
                    "metadata": meta,
                }
            )

        # 1. Summary: 1-2 sentences per child chunk
        summary = str(parsed_cv.get("summary") or parsed_cv.get("professional_summary") or "").strip()
        if not summary and cv_text:
            first_paragraphs = [
                p.strip() for p in cv_text.split("\n\n")
                if p.strip() and not _is_contact_or_header_text(p)
                and not re.search(r"^(?:skills|kỹ năng|technical skills)\s*[:：]", p.strip(), re.IGNORECASE)
            ]
            if first_paragraphs:
                summary = first_paragraphs[0]
            elif cv_text and not _is_contact_or_header_text(cv_text.strip()) and not re.search(r"^(?:skills|kỹ năng|technical skills)\s*[:：]", cv_text.strip(), re.IGNORECASE):
                summary = cv_text.strip()
        if summary and not _is_contact_or_header_text(summary):
            summary_sentences = [s.strip() for s in re.split(r"(?<=[.!?;])\s+", summary) if s.strip()]
            if len(summary_sentences) <= 2:
                add(
                    "CV_SUMMARY", summary, "summary", parsed_cv.get("summary_source_page"),
                    parent_type="summary", parent_title="Tóm tắt nghề nghiệp",
                    evidence_type="sentence", evidence_strength=EVIDENCE_STRENGTH_BASELINES["summary"],
                )
            else:
                for i in range(0, len(summary_sentences), 2):
                    chunk_text = " ".join(summary_sentences[i:i+2])
                    add(
                        "CV_SUMMARY", chunk_text, f"summary.part[{i // 2}]", parsed_cv.get("summary_source_page"),
                        parent_type="summary", parent_title="Tóm tắt nghề nghiệp",
                        evidence_type="sentence", evidence_strength=EVIDENCE_STRENGTH_BASELINES["summary"],
                    )

        # 2. Skills: grouped skill chunks
        skills: list[str] = []
        for key in ("skills", "hard_skills", "soft_skills"):
            for item in parsed_cv.get(key) or []:
                if isinstance(item, dict):
                    value = item.get("original_name") or item.get("name") or item.get("normalized_name")
                else:
                    value = item
                if value and fold(value) not in {fold(existing) for existing in skills}:
                    skills.append(str(value))
        if cv_text:
            from src.agents.tools.career_tools import SOFT_SKILLS, TECH_SKILLS, extract_known_terms
            for sk in extract_known_terms(cv_text, TECH_SKILLS) + extract_known_terms(cv_text, SOFT_SKILLS):
                if sk and fold(sk) not in {fold(existing) for existing in skills}:
                    skills.append(str(sk))
        if skills:
            # Add full skill list & grouped sub-chunks
            add(
                "CV_SKILL", ", ".join(skills), "skills", None,
                parent_type="skills", parent_title="Kỹ năng chuyên môn",
                evidence_type="list", evidence_strength=EVIDENCE_STRENGTH_BASELINES["skills"],
                metadata={"skills": skills},
            )
            if len(skills) > 8:
                for i in range(0, len(skills), 6):
                    group = skills[i:i+6]
                    add(
                        "CV_SKILL", ", ".join(group), f"skills.group[{i // 6}]", None,
                        parent_type="skills", parent_title="Kỹ năng chuyên môn",
                        evidence_type="list", evidence_strength=EVIDENCE_STRENGTH_BASELINES["skills"],
                        metadata={"skills": group},
                    )

        # 3. Work Experience: Parent (company + role + dates) -> Child (individual bullets)
        for index, record in enumerate(parsed_cv.get("experience") or []):
            if not isinstance(record, dict):
                continue
            company = str(record.get("company") or record.get("organization") or "Công ty").strip()
            role = str(record.get("position") or record.get("role") or record.get("title") or "Kỹ sư phần mềm").strip()
            start_d = str(record.get("start_date") or record.get("from") or "").strip() or None
            end_d = str(record.get("end_date") or record.get("to") or "").strip() or None
            period_str = str(record.get("period") or (f"{start_d} - {end_d}" if start_d else "")).strip()
            dur_months = record.get("duration_months")
            parent_title = f"{company} — {role}" + (f" ({period_str})" if period_str else "")
            page = record.get("source_page")

            bullets = [str(b).strip() for b in record.get("bullets") or [] if str(b).strip()]
            desc = str(record.get("description") or record.get("summary") or record.get("details") or "").strip()

            if bullets:
                for b_idx, bullet in enumerate(bullets):
                    if not bullet or _is_contact_or_header_text(bullet):
                        continue
                    add(
                        "CV_EXPERIENCE", bullet, f"experience[{index}].bullet[{b_idx}]", page,
                        parent_type="work_experience", parent_title=parent_title,
                        evidence_type="bullet", evidence_strength=EVIDENCE_STRENGTH_BASELINES["work_experience"],
                        company=company, role=role, start_date=start_d, end_date=end_d, duration_months=dur_months,
                        metadata=record,
                    )
            elif desc:
                sentences = [s.strip() for s in re.split(r"(?<=[.!?;])\s+", desc) if s.strip()]
                for s_idx, sentence in enumerate(sentences):
                    if not sentence or _is_contact_or_header_text(sentence):
                        continue
                    add(
                        "CV_EXPERIENCE", sentence, f"experience[{index}].sentence[{s_idx}]", page,
                        parent_type="work_experience", parent_title=parent_title,
                        evidence_type="bullet", evidence_strength=EVIDENCE_STRENGTH_BASELINES["work_experience"],
                        company=company, role=role, start_date=start_d, end_date=end_d, duration_months=dur_months,
                        metadata=record,
                    )
            else:
                full_rec = _record_text(record)
                if full_rec and not _is_contact_or_header_text(full_rec):
                    add(
                        "CV_EXPERIENCE", full_rec, f"experience[{index}]", page,
                        parent_type="work_experience", parent_title=parent_title,
                        evidence_type="record", evidence_strength=EVIDENCE_STRENGTH_BASELINES["work_experience"],
                        company=company, role=role, start_date=start_d, end_date=end_d, duration_months=dur_months,
                        metadata=record,
                    )

        # 4. Projects: Parent (project name + role/context) -> Child (individual bullets)
        for index, record in enumerate(parsed_cv.get("projects") or []):
            if not isinstance(record, dict):
                continue
            proj_name = str(record.get("name") or record.get("title") or record.get("project_name") or f"Project {index + 1}").strip()
            role = str(record.get("role") or record.get("position") or "Dự án").strip()
            parent_title = f"{proj_name} — {role}"
            page = record.get("source_page")

            bullets = [str(b).strip() for b in record.get("bullets") or [] if str(b).strip()]
            desc = str(record.get("description") or record.get("summary") or record.get("details") or "").strip()

            if bullets:
                for b_idx, bullet in enumerate(bullets):
                    if not bullet or _is_contact_or_header_text(bullet):
                        continue
                    add(
                        "CV_PROJECT", bullet, f"projects[{index}].bullet[{b_idx}]", page,
                        parent_type="project", parent_title=parent_title,
                        evidence_type="bullet", evidence_strength=EVIDENCE_STRENGTH_BASELINES["project"],
                        role=role, metadata=record,
                    )
            elif desc:
                sentences = [s.strip() for s in re.split(r"(?<=[.!?;])\s+", desc) if s.strip()]
                for s_idx, sentence in enumerate(sentences):
                    if not sentence or _is_contact_or_header_text(sentence):
                        continue
                    add(
                        "CV_PROJECT", sentence, f"projects[{index}].sentence[{s_idx}]", page,
                        parent_type="project", parent_title=parent_title,
                        evidence_type="bullet", evidence_strength=EVIDENCE_STRENGTH_BASELINES["project"],
                        role=role, metadata=record,
                    )
            else:
                full_rec = _record_text(record)
                if full_rec and not _is_contact_or_header_text(full_rec):
                    add(
                        "CV_PROJECT", full_rec, f"projects[{index}]", page,
                        parent_type="project", parent_title=parent_title,
                        evidence_type="record", evidence_strength=EVIDENCE_STRENGTH_BASELINES["project"],
                        role=role, metadata=record,
                    )

        # 5. Education: 1 degree per chunk
        for index, record in enumerate(parsed_cv.get("education") or []):
            rec_text = _record_text(record)
            if not rec_text or _is_contact_or_header_text(rec_text):
                continue
            deg = str(record.get("degree") or record.get("degree_original") or "Bằng cấp").strip() if isinstance(record, dict) else "Bằng cấp"
            school = str(record.get("school") or record.get("institution") or record.get("university") or "").strip() if isinstance(record, dict) else ""
            parent_title = f"{deg}" + (f" — {school}" if school else "")
            page = record.get("source_page") if isinstance(record, dict) else None
            add(
                "CV_EDUCATION", rec_text, f"education[{index}]", page,
                parent_type="education", parent_title=parent_title,
                evidence_type="record", evidence_strength=EVIDENCE_STRENGTH_BASELINES["education"],
                metadata=record if isinstance(record, dict) else {},
            )

        # 6. Certifications: 1 cert per chunk
        for index, record in enumerate(parsed_cv.get("certifications") or []):
            rec_text = _record_text(record)
            if not rec_text or _is_contact_or_header_text(rec_text):
                continue
            cert_name = str(record.get("name") or record.get("title") or rec_text).strip() if isinstance(record, dict) else str(record).strip()
            parent_title = f"Chứng chỉ — {cert_name}"
            page = record.get("source_page") if isinstance(record, dict) else None
            add(
                "CV_CERTIFICATION", rec_text, f"certifications[{index}]", page,
                parent_type="certification", parent_title=parent_title,
                evidence_type="record", evidence_strength=EVIDENCE_STRENGTH_BASELINES["certification"],
                metadata=record if isinstance(record, dict) else {},
            )

        # 7. Languages: 1 language per chunk
        for index, record in enumerate(parsed_cv.get("languages") or []):
            rec_text = _record_text(record)
            if not rec_text or _is_contact_or_header_text(rec_text):
                continue
            lang_name = str(record.get("language") or record.get("name") or rec_text).strip() if isinstance(record, dict) else str(record).strip()
            parent_title = f"Ngoại ngữ — {lang_name}"
            page = record.get("source_page") if isinstance(record, dict) else None
            add(
                "CV_LANGUAGE", rec_text, f"languages[{index}]", page,
                parent_type="language", parent_title=parent_title,
                evidence_type="record", evidence_strength=EVIDENCE_STRENGTH_BASELINES["language"],
                metadata=record if isinstance(record, dict) else {},
            )

        # 8. Awards & Achievements
        for index, record in enumerate(parsed_cv.get("awards") or parsed_cv.get("achievements") or []):
            rec_text = _record_text(record)
            if not rec_text or _is_contact_or_header_text(rec_text):
                continue
            parent_title = "Giải thưởng & Thành tích"
            page = record.get("source_page") if isinstance(record, dict) else None
            add(
                "CV_AWARD", rec_text, f"awards[{index}]", page,
                parent_type="achievement", parent_title=parent_title,
                evidence_type="record", evidence_strength=EVIDENCE_STRENGTH_BASELINES["achievement"],
                metadata=record if isinstance(record, dict) else {},
            )

        # Fallback raw text parsing if parsed_cv lacks projects/experience
        has_experience_or_project = any(c["chunk_type"] in {"CV_EXPERIENCE", "CV_PROJECT"} for c in chunks)
        if not has_experience_or_project and cv_text and cv_text.strip():
            safe_lines = [
                line.strip()
                for line in cv_text.splitlines()
                if line.strip() and not _is_contact_or_header_text(line)
            ]
            full_text = " ".join(safe_lines)
            if full_text:
                if any(k in full_text.lower() for k in ("đồ án", "dự án", "project")):
                    add(
                        "CV_PROJECT", full_text, "raw_projects", None,
                        parent_type="project", parent_title="Dự án tiêu biểu",
                        evidence_type="record", evidence_strength=EVIDENCE_STRENGTH_BASELINES["project"],
                    )
                elif any(k in full_text.lower() for k in ("kinh nghiệm", "years experience", "làm việc", "phát triển", "develop")):
                    add(
                        "CV_EXPERIENCE", full_text, "raw_experience", None,
                        parent_type="work_experience", parent_title="Kinh nghiệm làm việc",
                        evidence_type="record", evidence_strength=EVIDENCE_STRENGTH_BASELINES["work_experience"],
                    )
                elif not chunks:
                    add(
                        "CV_OTHER", full_text, "raw_text", None,
                        parent_type="other", parent_title="Thông tin khác",
                        evidence_type="record", evidence_strength=EVIDENCE_STRENGTH_BASELINES["other"],
                    )
        return candidate_id, document_id, chunks


def _skill_category(skill: str) -> str:
    value = normalize_terms(skill)
    categories = {
        "programming_language": {"python", "java", "javascript", "typescript", "go", "c", "c++", "c#", "ruby", "php", "dart", "r"},
        "framework": {"fastapi", "django", "flask", "spring boot", "react", "vue", "angular", "next.js", "rails"},
        "database": {"sql", "postgresql", "mysql", "sql server", "mongodb", "redis", "oracle"},
        "cloud": {"aws", "azure", "gcp", "google cloud"},
        "devops": {"docker", "kubernetes", "terraform", "jenkins", "ci/cd", "linux"},
        "methodology": {"agile", "scrum", "kanban", "tdd"},
        "soft_skill": {"communication", "teamwork", "leadership", "problem solving", "giao tiep", "lam viec nhom"},
    }
    for category, values in categories.items():
        if value in values:
            return category
    return "other"


def normalize_structured_cv(cv_text: str, parsed_cv: dict[str, Any]) -> dict[str, Any]:
    """Build the complete versioned CV taxonomy without removing legacy/original values."""
    candidate_id, document_id, chunks = ChunkingService.build(cv_text, parsed_cv)
    skill_chunks = [chunk for chunk in chunks if chunk["chunk_type"] == "CV_SKILL"]
    raw_skills = list((skill_chunks[0].get("metadata") or {}).get("skills") or []) if skill_chunks else []
    skills = [
        {
            "original_name": skill,
            "normalized_name": normalize_terms(skill),
            "category": _skill_category(skill),
            "confidence": 0.96,
            "source_text": skill_chunks[0]["text"] if skill_chunks else skill,
            "source_page": skill_chunks[0]["source_page"] if skill_chunks else None,
        }
        for skill in raw_skills
    ]
    chunk_map: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for chunk in chunks:
        chunk_map[chunk["chunk_type"]].append(chunk)

    def records(key: str, chunk_type: str) -> list[dict[str, Any]]:
        output = []
        source = parsed_cv.get(key) or []
        for index, value in enumerate(source):
            item = dict(value) if isinstance(value, dict) else {"text": str(value)}
            matching = chunk_map[chunk_type][index] if index < len(chunk_map[chunk_type]) else None
            item.setdefault("source_page", (matching or {}).get("source_page"))
            item.setdefault("source_text", item.get("evidence_quote") or _record_text(item))
            item.setdefault("confidence", 0.9)
            output.append(item)
        return output

    personal = parsed_cv.get("personal_info") or {}
    return {
        "schema_version": SCHEMA_VERSION,
        "candidate_id": candidate_id,
        "document_id": document_id,
        "candidate": {
            "name": str(personal.get("full_name") or ""),
            "current_title": str(parsed_cv.get("current_title") or ""),
            "location": str(personal.get("location") or ""),
        },
        "summary": {
            "text": str(parsed_cv.get("summary") or parsed_cv.get("professional_summary") or ""),
            "source_page": next((chunk["source_page"] for chunk in chunk_map["CV_SUMMARY"]), None),
        },
        "skills": skills,
        "experience": records("experience", "CV_EXPERIENCE"),
        "projects": records("projects", "CV_PROJECT"),
        "education": records("education", "CV_EDUCATION"),
        "certifications": records("certifications", "CV_CERTIFICATION"),
        "languages": records("languages", "CV_LANGUAGE"),
        "awards": records("awards", "CV_AWARD"),
        "publications": records("publications", "CV_PUBLICATION"),
        "volunteer": records("volunteer", "CV_VOLUNTEER"),
        "other": records("other", "CV_OTHER"),
        "missing_information": list(parsed_cv.get("missing_information") or []),
        "parse_quality": dict(parsed_cv.get("parse_quality") or parsed_cv.get("ats_quality") or {}),
        "chunks": chunks,
    }


class BM25Service:
    def __init__(self, chunks: list[dict[str, Any]]) -> None:
        self.chunks = chunks
        self.tokens = [tokenize(chunk["normalized_text"] or chunk["text"]) for chunk in chunks]
        self.avgdl = sum(map(len, self.tokens)) / max(1, len(self.tokens))
        self.df: Counter[str] = Counter()
        for tokens in self.tokens:
            self.df.update(set(tokens))

    def search(self, query: str, allowed: set[str], top_k: int) -> list[dict[str, Any]]:
        query_tokens = tokenize(query)
        results = []
        total = max(1, len(self.chunks))
        for index, (chunk, tokens) in enumerate(zip(self.chunks, self.tokens, strict=True)):
            if chunk["chunk_type"] not in allowed:
                continue
            frequencies = Counter(tokens)
            score = 0.0
            for term in query_tokens:
                df = self.df.get(term, 0)
                if not df:
                    continue
                idf = math.log(1 + (total - df + 0.5) / (df + 0.5))
                tf = frequencies[term]
                denominator = tf + 1.5 * (1 - 0.75 + 0.75 * len(tokens) / max(1.0, self.avgdl))
                score += idf * (tf * 2.5 / denominator)
            if score > 0:
                results.append({"chunk_id": chunk["chunk_id"], "bm25_score": round(score, 6), "_index": index})
        results.sort(key=lambda item: (-item["bm25_score"], item["chunk_id"]))
        for rank, item in enumerate(results[:top_k], start=1):
            item["bm25_rank"] = rank
        return results[:top_k]


_EMBEDDING_CACHE: dict[str, dict[int, float]] = {}


class EmbeddingService:
    """Deterministic local vector model; model name/version is persisted in the result."""

    def __init__(self, dimensions: int = 768) -> None:
        self.dimensions = dimensions
        self.name = "local-hashing-embedding-v1"

    def embed(self, text: str) -> dict[int, float]:
        cache_key = f"{self.name}:{self.dimensions}:{hashlib.sha256((text or '').encode('utf-8')).hexdigest()}"
        if cache_key in _EMBEDDING_CACHE:
            return _EMBEDDING_CACHE[cache_key]
        features: Counter[int] = Counter()
        normalized = f" {fold(text)} "
        for token in tokenize(normalized):
            digest = int(hashlib.blake2b(token.encode(), digest_size=8).hexdigest(), 16)
            features[digest % self.dimensions] += 1.0
        compact = re.sub(r"\s+", " ", normalized)
        for index in range(max(0, len(compact) - 2)):
            trigram = compact[index : index + 3]
            digest = int(hashlib.blake2b(trigram.encode(), digest_size=8).hexdigest(), 16)
            features[digest % self.dimensions] += 0.15
        norm = math.sqrt(sum(value * value for value in features.values())) or 1.0
        result = {key: value / norm for key, value in features.items()}
        _EMBEDDING_CACHE[cache_key] = result
        return result

    def embed_batch(self, texts: Sequence[str]) -> list[dict[int, float]]:
        return [self.embed(text) for text in texts]

    @staticmethod
    def cosine(left: dict[int, float], right: dict[int, float]) -> float:
        if len(left) > len(right):
            left, right = right, left
        return sum(value * right.get(key, 0.0) for key, value in left.items())


_PERSISTENT_CACHE_PATH = Path("data/cache/embedding_vectors.json")
_PERSISTENT_CACHE_INITIALIZED = False


def _init_persistent_cache() -> None:
    global _PERSISTENT_CACHE_INITIALIZED
    if _PERSISTENT_CACHE_INITIALIZED:
        return
    _PERSISTENT_CACHE_INITIALIZED = True
    try:
        if _PERSISTENT_CACHE_PATH.exists():
            with open(_PERSISTENT_CACHE_PATH, encoding="utf-8") as f:
                data = json.load(f)
                for k, v in data.items():
                    if k not in _EMBEDDING_CACHE:
                        _EMBEDDING_CACHE[k] = {int(vk): float(vv) for vk, vv in v.items()}
    except Exception:
        pass


def _persist_embedding_cache() -> None:
    try:
        _PERSISTENT_CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
        serializable = {k: {str(vk): vv for vk, vv in v.items()} for k, v in _EMBEDDING_CACHE.items()}
        with open(_PERSISTENT_CACHE_PATH, "w", encoding="utf-8") as f:
            json.dump(serializable, f)
    except Exception:
        pass


class GeminiEmbeddingService(EmbeddingService):
    """Real semantic embedding provider with batching, in-memory caching and fallback."""

    def __init__(self, api_key: str, model: str = "gemini-embedding-2", dimensions: int = 768) -> None:
        from google import genai

        super().__init__(dimensions)
        self.name = model
        self._client = genai.Client(api_key=api_key)
        _init_persistent_cache()

    def embed_batch(self, texts: Sequence[str]) -> list[dict[int, float]]:
        from google.genai import types

        if not texts:
            return []

        _init_persistent_cache()
        results: list[dict[int, float] | None] = [None] * len(texts)
        missing_indices: list[int] = []
        missing_texts: list[str] = []
        newly_embedded = False

        for index, text in enumerate(texts):
            clean_text = str(text or "").strip()
            cache_key = f"{self.name}:{self.dimensions}:{hashlib.sha256(clean_text.encode('utf-8')).hexdigest()}"
            if cache_key in _EMBEDDING_CACHE:
                results[index] = _EMBEDDING_CACHE[cache_key]
            else:
                missing_indices.append(index)
                missing_texts.append(clean_text or " ")

        if missing_texts:
            try:
                batch_size = 50
                for batch_start in range(0, len(missing_texts), batch_size):
                    batch_slice = missing_texts[batch_start : batch_start + batch_size]
                    idx_slice = missing_indices[batch_start : batch_start + batch_size]

                    response = self._client.models.embed_content(
                        model=self.name,
                        contents=batch_slice,
                        config=types.EmbedContentConfig(output_dimensionality=self.dimensions),
                    )
                    for i, emb in enumerate(response.embeddings):
                        vals = list(emb.values)
                        if len(vals) != self.dimensions:
                            raise ValueError(f"Embedding dimension {len(vals)} != {self.dimensions}.")
                        vector = {v_idx: float(val) for v_idx, val in enumerate(vals) if val}
                        original_idx = idx_slice[i]
                        text_key = (
                            f"{self.name}:{self.dimensions}:"
                            f"{hashlib.sha256(missing_texts[batch_start + i].encode('utf-8')).hexdigest()}"
                        )
                        _EMBEDDING_CACHE[text_key] = vector
                        results[original_idx] = vector
                        newly_embedded = True
                if newly_embedded:
                    _persist_embedding_cache()
            except Exception as exc:
                logger.warning(
                    "Gemini batch embedding error (quota/rate-limit); falling back to deterministic hashing: %s",
                    exc,
                )
                fallback_embedder = EmbeddingService(self.dimensions)
                for i, original_idx in enumerate(missing_indices):
                    if results[original_idx] is None:
                        fallback_vec = fallback_embedder.embed(missing_texts[i])
                        results[original_idx] = fallback_vec

        return [res if res is not None else {} for res in results]

    def embed(self, text: str) -> dict[int, float]:
        return self.embed_batch([text])[0]


class VectorSearchService:
    def __init__(self, chunks: list[dict[str, Any]], embedder: EmbeddingService) -> None:
        self.chunks = chunks
        self.embedder = embedder
        texts = [chunk["normalized_text"] or chunk["text"] for chunk in chunks]
        self.vectors = embedder.embed_batch(texts)

    def search(self, query: str, allowed: set[str], top_k: int, min_score: float) -> list[dict[str, Any]]:
        vector = self.embedder.embed(query)
        return self.search_with_vector(vector, allowed, top_k, min_score)

    def search_with_vector(
        self, vector: dict[int, float], allowed: set[str], top_k: int, min_score: float
    ) -> list[dict[str, Any]]:
        results = []
        for index, (chunk, candidate) in enumerate(zip(self.chunks, self.vectors, strict=True)):
            if chunk["chunk_type"] not in allowed:
                continue
            score = self.embedder.cosine(vector, candidate)
            if score >= min_score:
                results.append({"chunk_id": chunk["chunk_id"], "semantic_score": round(score, 6), "_index": index})
        results.sort(key=lambda item: (-item["semantic_score"], item["chunk_id"]))
        for rank, item in enumerate(results[:top_k], start=1):
            item["semantic_rank"] = rank
        return results[:top_k]


class HybridFusionService:
    @staticmethod
    def rrf(
        bm25_results: list[dict[str, Any]], semantic_results: list[dict[str, Any]], *, k: int, top_k: int
    ) -> list[dict[str, Any]]:
        combined: dict[str, dict[str, Any]] = defaultdict(dict)
        for item in bm25_results:
            combined[item["chunk_id"]].update(item)
            combined[item["chunk_id"]]["fusion_score"] = combined[item["chunk_id"]].get("fusion_score", 0.0) + 1 / (
                k + item["bm25_rank"]
            )
        for item in semantic_results:
            combined[item["chunk_id"]].update(item)
            combined[item["chunk_id"]]["fusion_score"] = combined[item["chunk_id"]].get("fusion_score", 0.0) + 1 / (
                k + item["semantic_rank"]
            )
        results = [{**value, "chunk_id": chunk_id} for chunk_id, value in combined.items()]
        results.sort(key=lambda item: (-item["fusion_score"], item["chunk_id"]))
        for rank, item in enumerate(results[:top_k], start=1):
            item["fusion_score"] = round(item["fusion_score"], 8)
            item["fusion_rank"] = rank
        return results[:top_k]


class RetrievalService:
    def __init__(self, chunks: list[dict[str, Any]], config: PipelineConfig) -> None:
        self.chunks = chunks
        self.by_id = {chunk["chunk_id"]: chunk for chunk in chunks}
        self.config = config
        self.bm25 = BM25Service(chunks)
        use_gemini = config.embedding_provider in {"auto", "gemini"} and bool(config.embedding_api_key)
        if use_gemini:
            try:
                self.embedding = GeminiEmbeddingService(
                    api_key=config.embedding_api_key,
                    model=config.embedding_model,
                    dimensions=config.embedding_dimensions,
                )
            except Exception as exc:
                if config.embedding_provider == "gemini":
                    raise
                logger.warning("Gemini embedding unavailable; using deterministic fallback: %s", exc)
                self.embedding = EmbeddingService(config.embedding_dimensions)
        else:
            self.embedding = EmbeddingService(config.embedding_dimensions)
        try:
            self.vector = VectorSearchService(chunks, self.embedding)
        except Exception as exc:
            if config.embedding_provider == "gemini":
                raise RuntimeError("EMBEDDING_001: Không thể tạo Gemini embedding.") from exc
            logger.warning("Semantic embedding failed; using deterministic fallback: %s", exc)
            self.embedding = EmbeddingService(config.embedding_dimensions)
            self.vector = VectorSearchService(chunks, self.embedding)

    def prefetch_queries(self, requirements: list[dict[str, Any]]) -> dict[str, dict[int, float]]:
        """Batch embed all requirement queries in a single API call."""
        queries: list[str] = []
        req_ids: list[str] = []
        for requirement in requirements:
            if requirement.get("requirement_type") in {"JD_REQUIRED_SKILL", "JD_PREFERRED_SKILL"}:
                semantic_query = str(requirement.get("normalized_value") or requirement.get("text") or "")
            else:
                semantic_query = str(requirement.get("text") or requirement.get("normalized_value") or "")
            queries.append(semantic_query)
            req_ids.append(requirement["requirement_id"])
        vectors = self.embedding.embed_batch(queries)
        return dict(zip(req_ids, vectors, strict=True))

    def retrieve(
        self, requirement: dict[str, Any], precomputed_vector: dict[int, float] | None = None
    ) -> dict[str, Any]:
        req_type = requirement.get("requirement_type") or ("JD_REQUIRED_SKILL" if requirement.get("type") == "REQUIRED" else "JD_PREFERRED_SKILL" if requirement.get("type") == "PREFERRED" else "JD_OTHER_REQUIREMENT")
        allowed = ALLOWED_CHUNK_TYPES.get(
            req_type, set(ALLOWED_CHUNK_TYPES["JD_OTHER_REQUIREMENT"])
        )
        if req_type in {"JD_REQUIRED_SKILL", "JD_PREFERRED_SKILL"}:
            semantic_query = str(requirement.get("normalized_value") or requirement.get("text") or "")
            bm25_query = " ".join(
                [
                    semantic_query,
                    *[str(value) for value in requirement.get("related_values") or []],
                ]
            )
        elif req_type in {"JD_REQUIRED_QUALIFICATION", "JD_PREFERRED_QUALIFICATION"}:
            semantic_query = str(requirement.get("normalized_value") or requirement.get("text") or "")
            syns = _soft_skill_synonyms(semantic_query)
            bm25_query = " ".join([semantic_query, *syns])
            semantic_query = " ".join([semantic_query, *syns[:4]])
        else:
            semantic_query = str(requirement.get("text") or requirement.get("normalized_value") or "")
            bm25_query = semantic_query
        if precomputed_vector is not None:
            semantic = self.vector.search_with_vector(
                precomputed_vector,
                allowed,
                self.config.semantic_top_k,
                self.config.semantic_min_score,
            )
        else:
            semantic = self.vector.search(
                semantic_query,
                allowed,
                self.config.semantic_top_k,
                self.config.semantic_min_score,
            )
        bm25 = self.bm25.search(bm25_query, allowed, self.config.bm25_top_k)
        hybrid = HybridFusionService.rrf(bm25, semantic, k=self.config.rrf_k, top_k=self.config.hybrid_top_k)
        return {
            "requirement_id": requirement["requirement_id"],
            "allowed_chunk_types": sorted(allowed),
            "bm25_results": [{key: value for key, value in item.items() if key != "_index"} for item in bm25],
            "semantic_results": [{key: value for key, value in item.items() if key != "_index"} for item in semantic],
            "hybrid_results": [{key: value for key, value in item.items() if key != "_index"} for item in hybrid],
        }


class EvidenceService:
    def __init__(self, chunks: list[dict[str, Any]], max_per_requirement: int) -> None:
        self.by_id = {chunk["chunk_id"]: chunk for chunk in chunks}
        self.max_per_requirement = max_per_requirement

    def select(self, requirement: dict[str, Any], retrieval: dict[str, Any]) -> list[dict[str, Any]]:
        target_name = canonical_skill(str(requirement.get("normalized_value") or requirement.get("text") or ""))
        fold(target_name)

        candidates = []
        seen_text: set[str] = set()

        # Normalize RRF scale before linear combination:
        active_rankers = 0
        if retrieval.get("bm25_results"):
            active_rankers += 1
        if retrieval.get("semantic_results"):
            active_rankers += 1
        active_rankers = max(1, active_rankers)
        rrf_k = getattr(self, "rrf_k", 60)
        max_rrf = active_rankers / (rrf_k + 1)

        for result in retrieval["hybrid_results"]:
            chunk = self.by_id.get(result["chunk_id"])
            if not chunk:
                continue
            key = fold(chunk["text"])
            if not key or key in seen_text:
                continue
            seen_text.add(key)

            # 1. Normalized RRF [0, 1]
            raw_rrf = float(result.get("fusion_score") or 0.0)
            rrf_norm = min(1.0, max(0.0, raw_rrf / max_rrf)) if max_rrf > 0 else 0.0

            # 2. Evidence strength [0, 1]
            strength = float(chunk.get("evidence_strength") or 0.5)

            # 3. Section quality [0, 1]
            section = chunk.get("chunk_type") or chunk.get("source_section") or ""
            section_quality = 1.0 if section in {"CV_EXPERIENCE", "CV_PROJECT"} else 0.7 if section in {"CV_CERTIFICATION", "CV_EDUCATION"} else 0.3 if section == "CV_SKILL" else 0.2

            # 4. Context bonus [0, 1]
            has_parent_context = bool(chunk.get("parent_title") or chunk.get("company"))
            context_bonus = 1.0 if has_parent_context else 0.0

            # Bounded formula: 0.55 * rrf_norm + 0.25 * strength + 0.15 * section_quality + 0.05 * context_bonus
            rerank_score = (
                (0.55 * rrf_norm)
                + (0.25 * strength)
                + (0.15 * section_quality)
                + (0.05 * context_bonus)
            )
            candidates.append({
                "chunk": chunk,
                "result": result,
                "raw_rrf": raw_rrf,
                "rrf_norm": round(rrf_norm, 4),
                "rerank_score": round(rerank_score, 4),
            })

        # Sort by metadata-aware rerank score descending
        candidates.sort(key=lambda item: -item["rerank_score"])

        selected = []
        for item in candidates[:self.max_per_requirement]:
            chunk = item["chunk"]
            result = item["result"]
            selected.append(
                {
                    "evidence_id": _id("EVD", requirement["requirement_id"], chunk["chunk_id"]),
                    "requirement_id": requirement["requirement_id"],
                    "chunk_id": chunk["chunk_id"],
                    "text": chunk["text"],
                    "source_page": chunk.get("source_page"),
                    "source_section": chunk.get("source_section"),
                    "parent_type": chunk.get("parent_type"),
                    "parent_title": chunk.get("parent_title"),
                    "evidence_type": chunk.get("evidence_type"),
                    "evidence_strength": chunk.get("evidence_strength"),
                    "company": chunk.get("company"),
                    "role": chunk.get("role"),
                    "start_date": chunk.get("start_date"),
                    "end_date": chunk.get("end_date"),
                    "duration_months": chunk.get("duration_months"),
                    "semantic_score": result.get("semantic_score"),
                    "semantic_rank": result.get("semantic_rank"),
                    "bm25_score": result.get("bm25_score"),
                    "bm25_rank": result.get("bm25_rank"),
                    "fusion_score": result.get("fusion_score"),
                    "fusion_rank": result.get("fusion_rank"),
                    "rerank_score": round(item["rerank_score"], 4),
                }
            )
        return selected


def _contains_term(text: str, term: str) -> bool:
    return bool(
        re.search(
            rf"(?<!\w){re.escape(normalize_terms(term))}(?!\w)",
            normalize_terms(text),
        )
    )


def _contains_exact(text: str, term: str) -> bool:
    return bool(re.search(rf"(?<!\w){re.escape(fold(term))}(?!\w)", fold(text)))


def _requirement_match_class(requirement: dict[str, Any], evidence: list[dict[str, Any]]) -> str:
    requirement_type = requirement.get("requirement_type") or ("JD_REQUIRED_SKILL" if requirement.get("type") == "REQUIRED" else "JD_PREFERRED_SKILL" if requirement.get("type") == "PREFERRED" else "JD_OTHER_REQUIREMENT")
    if not evidence:
        return "NOT_FOUND"
    target_original = str(requirement.get("original_value") or requirement.get("text") or "")
    target_normalized = str(requirement.get("normalized_value") or target_original)
    combined = " ".join(item["text"] for item in evidence)
    if requirement_type in {"JD_REQUIRED_SKILL", "JD_PREFERRED_SKILL"}:
        sem = match_semantic_relation(target_normalized, combined)
        if sem.get("classification") in {"DIRECT", "EQUIVALENT", "INFERRED", "ADJACENT"}:
            return sem["classification"]
        if _contains_exact(combined, target_original):
            return "DIRECT"
        if _contains_term(combined, target_normalized):
            return "EQUIVALENT"
        related = {fold(value) for value in requirement.get("related_values") or []}
        if related.intersection(tokenize(combined)) or any(_contains_term(combined, value) for value in related):
            return "ADJACENT"
        return "NOT_FOUND"
    best_semantic = max((float(item.get("semantic_score") or 0) for item in evidence), default=0.0)
    if best_semantic >= 0.72:
        return "INFERRED"
    if best_semantic >= 0.45 or any(item.get("bm25_score") for item in evidence):
        return "ADJACENT"
    return "NOT_FOUND"


def _status_for(match_class: str, requirement: dict[str, Any], min_confidence: float) -> str:
    confidence = float(requirement.get("confidence", 1.0))
    if confidence < min_confidence:
        return "UNCERTAIN"
    if match_class in {"DIRECT", "EQUIVALENT", "INFERRED", "EXACT_MATCH", "NORMALIZED_MATCH", "SEMANTIC_MATCH"}:
        return "SUPPORTED"
    if match_class in {"ADJACENT", "PARTIAL_MATCH"}:
        return "PARTIALLY_SUPPORTED"
    return "NOT_FOUND"


def _evidence_supports_requirement(requirement: dict[str, Any], evidence: dict[str, Any]) -> bool:
    """Reject retrieval hits that do not actually substantiate a technical requirement."""
    text = str(evidence.get("text") or "")
    if _is_contact_or_header_text(text):
        return False
    req_text = str(requirement.get("normalized_value") or requirement.get("text") or "")
    folded_req = fold(req_text)
    # A title-only project hit (for example, a project name) is never adequate
    # proof for a technical/AI-tool requirement.
    technical_terms = {
        term for term in ("ai", "coding", "lap trinh", "programming", "docker", "kubernetes", "python", "java", "react", "fastapi")
        if term in folded_req
    }
    if technical_terms:
        return any(_contains_term(text, term) for term in technical_terms)
    return True


def _parse_year_month(value: str) -> tuple[int, int] | None:
    text = fold(value)
    match = re.search(r"\b(19\d{2}|20\d{2})[-/.](0?[1-9]|1[0-2])\b", text)
    if match:
        return int(match.group(1)), int(match.group(2))
    match = re.search(r"\b(0?[1-9]|1[0-2])[-/.](19\d{2}|20\d{2})\b", text)
    if match:
        return int(match.group(2)), int(match.group(1))
    match = re.search(r"\b(19\d{2}|20\d{2})\b", text)
    return (int(match.group(1)), 1) if match else None


def _record_months(record: dict[str, Any]) -> set[int]:
    start = _parse_year_month(str(record.get("start_date") or ""))
    end = _parse_year_month(str(record.get("end_date") or ""))
    period = str(record.get("period") or "")
    values = re.findall(
        r"(?:0?[1-9]|1[0-2])[-/.](?:19\d{2}|20\d{2})|(?:19\d{2}|20\d{2})[-/.](?:0?[1-9]|1[0-2])|(?:19\d{2}|20\d{2})",
        period,
    )
    if not start and values:
        start = _parse_year_month(values[0])
    if not end and len(values) >= 2:
        end = _parse_year_month(values[-1])
    if start and (record.get("is_current") or re.search(r"present|current|now|hien tai|nay", fold(period))):
        now = datetime.now(UTC)
        end = (now.year, now.month)
    if start and end:
        first = start[0] * 12 + start[1] - 1
        last = end[0] * 12 + end[1] - 1
        return set(range(first, max(first, last) + 1))
    return set()


class EvaluationService:
    def __init__(
        self,
        chunks: list[dict[str, Any]],
        parsed_cv: dict[str, Any],
        extraction_min_confidence: float,
        declared_skill_score_cap: float,
    ) -> None:
        self.chunks = chunks
        self.chunks_by_id = {chunk["chunk_id"]: chunk for chunk in chunks}
        self.parsed_cv = parsed_cv
        self.cv_text = str(parsed_cv.get("raw_text") or " ".join(str(c.get("text") or "") for c in chunks))
        self.extraction_min_confidence = extraction_min_confidence
        self.declared_skill_score_cap = declared_skill_score_cap

    def evaluate_requirement(self, requirement: dict[str, Any], evidence: list[dict[str, Any]]) -> dict[str, Any]:
        req_type_raw = str(requirement.get("requirement_type") or "")
        req_type = str(requirement.get("type") or ("REQUIRED" if requirement.get("mandatory") else "PREFERRED"))
        req_name = str(requirement.get("normalized_value") or requirement.get("requirement") or requirement.get("text") or "")
        is_hard = bool(requirement.get("is_hard_constraint") or req_type == "HARD_CONSTRAINT")
        evidence = [item for item in evidence if _evidence_supports_requirement(requirement, item)]

        if req_type_raw in {"JD_REQUIRED_SKILL", "JD_PREFERRED_SKILL"}:
            target = str(requirement.get("normalized_value") or requirement.get("text") or "")
            if target and not any(_contains_term(str(item.get("text") or ""), target) for item in evidence):
                allowed = ALLOWED_CHUNK_TYPES.get(req_type_raw, {"CV_SKILL", "CV_EXPERIENCE", "CV_PROJECT", "CV_CERTIFICATION"})
                direct = next(
                    (
                        chunk
                        for chunk in self.chunks
                        if chunk.get("chunk_type") in allowed and _contains_term(str(chunk.get("text") or ""), target)
                    ),
                    None,
                )
                if direct is not None:
                    evidence = [
                        *evidence,
                        {
                            "evidence_id": _id("EVD", requirement["requirement_id"], direct["chunk_id"]),
                            "requirement_id": requirement["requirement_id"],
                            "chunk_id": direct["chunk_id"],
                            "text": direct["text"],
                            "source_page": direct["source_page"],
                            "source_section": direct["source_section"],
                            "semantic_score": None,
                            "bm25_score": None,
                            "fusion_score": None,
                            "fusion_rank": None,
                        },
                    ]

        match_class = _requirement_match_class(requirement, evidence)
        status = _status_for(match_class, requirement, self.extraction_min_confidence)
        factor = SKILL_FACTORS.get(match_class, 0.0)
        match_score_val = factor
        match_status_val = "MATCHED" if factor >= 1.0 else "PARTIAL" if factor > 0.0 else "NOT_FOUND"
        evidence_strength_val = "NONE"

        primary_quote = ""
        if evidence:
            first_ev = evidence[0]
            if first_ev.get("source_section") == "skills" or first_ev.get("chunk_type") == "CV_SKILL":
                primary_quote = f'"{req_name}" — mục Kỹ năng' if req_name else "Mục Kỹ năng"
            else:
                primary_quote = str(first_ev.get("text") or "").strip()
                if len(primary_quote) > 160:
                    primary_quote = primary_quote[:157] + "..."

        cv_text_val = primary_quote or "Chưa tìm thấy bằng chứng phù hợp trong CV."
        jd_text_val = str(requirement.get("source_text") or requirement.get("original_value") or requirement.get("text") or req_name)
        comparison_text = ""

        if is_hard:
            conflict_terms = ("khong co", "chua co", "het han", "khong du dieu kien", "ineligible", "expired", "not authorized", "no work permit")
            has_explicit_conflict = any(any(ct in fold(item["text"]) for ct in conflict_terms) for item in evidence)
            if has_explicit_conflict:
                match_status_val = "CONFLICT"
                match_score_val = 0.0
                status = "CONFLICTING"
                comparison_text = f"JD yêu cầu {jd_text_val}; CV ghi nhận thông tin không thỏa mãn điều kiện."
            elif match_class in {"DIRECT", "EQUIVALENT", "INFERRED", "EXACT_MATCH", "NORMALIZED_MATCH", "SEMANTIC_MATCH", "ADJACENT", "PARTIAL_MATCH"} and evidence:
                match_status_val = "MATCHED"
                match_score_val = 1.0
                status = "SUPPORTED"
                comparison_text = f"CV xác nhận đáp ứng điều kiện: \"{primary_quote}\"."
            else:
                match_status_val = "NOT_FOUND"
                match_score_val = 0.0
                status = "NOT_FOUND"
                comparison_text = f"JD yêu cầu {jd_text_val}; CV không cung cấp thông tin về điều kiện này."

        elif req_type_raw in {"JD_REQUIRED_SKILL", "JD_PREFERRED_SKILL"}:
            target = str(requirement.get("normalized_value") or requirement.get("text") or "")
            cv_full_text = " ".join(str(c.get("text") or "") for c in self.chunks)
            semantic_res = match_semantic_relation(target, cv_full_text, evidence_chunks=self.chunks)
            sem_class = semantic_res.get("classification", "NO_EVIDENCE")
            sem_strength = semantic_res.get("evidence_strength", "NONE")
            matched_skill = semantic_res.get("matched_skill")

            # Try to locate the best matching chunk for this matched_skill or target
            relevant_term = matched_skill or target
            matching_chunk = next(
                (
                    chunk for chunk in self.chunks
                    if chunk.get("chunk_type") in {"CV_EXPERIENCE", "CV_PROJECT", "CV_SUMMARY"}
                    and (_contains_exact(chunk["text"], relevant_term) or _contains_term(chunk["text"], relevant_term))
                ),
                None,
            )
            if not matching_chunk and evidence:
                matching_chunk = evidence[0]
            if not matching_chunk:
                matching_chunk = next(
                    (
                        chunk for chunk in self.chunks
                        if _contains_exact(chunk["text"], relevant_term) or _contains_term(chunk["text"], relevant_term)
                    ),
                    None,
                )

            if matching_chunk:
                primary_quote = str(matching_chunk.get("text") or "").strip()
                if len(primary_quote) > 160:
                    primary_quote = primary_quote[:157] + "..."
                matching_ev = next((e for e in evidence if e.get("chunk_id") == matching_chunk.get("chunk_id")), None)
                if matching_ev:
                    evidence.remove(matching_ev)
                    evidence.insert(0, matching_ev)
                else:
                    evidence.insert(0, {
                        "evidence_id": _id("EVD", requirement["requirement_id"], matching_chunk.get("chunk_id", "c1")),
                        "requirement_id": requirement["requirement_id"],
                        "chunk_id": matching_chunk.get("chunk_id", "c1"),
                        "text": matching_chunk.get("text", ""),
                        "source_page": matching_chunk.get("source_page", 1),
                        "source_section": matching_chunk.get("source_section", "raw"),
                        "parent_title": matching_chunk.get("parent_title"),
                        "parent_type": matching_chunk.get("parent_type"),
                        "company": matching_chunk.get("company"),
                        "role": matching_chunk.get("role"),
                        "evidence_type": matching_chunk.get("evidence_type"),
                        "evidence_strength": matching_chunk.get("evidence_strength"),
                        "semantic_score": None,
                        "bm25_score": None,
                        "fusion_score": None,
                        "fusion_rank": None,
                    })

            is_in_project = any(
                chunk.get("chunk_type") == "CV_PROJECT" and (_contains_exact(chunk["text"], relevant_term) or _contains_term(chunk["text"], relevant_term))
                for chunk in self.chunks
            )
            is_in_experience = any(
                chunk.get("chunk_type") == "CV_EXPERIENCE" and (_contains_exact(chunk["text"], relevant_term) or _contains_term(chunk["text"], relevant_term))
                for chunk in self.chunks
            )
            is_in_summary = any(
                chunk.get("chunk_type") == "CV_SUMMARY"
                and (_contains_exact(chunk["text"], relevant_term) or _contains_term(chunk["text"], relevant_term))
                and any(k in chunk["text"].lower() for k in ("kinh nghiệm", "years experience", "experience", "làm việc", "engineer", "developer", "kỹ sư", "lập trình", "phát triển", "xây dựng", "triển khai"))
                and not re.search(r"^(?:technologies|skills|kỹ năng|tech stack|tools)\s*[:：]", chunk["text"].strip(), re.IGNORECASE)
                for chunk in self.chunks
            )
            has_project_or_experience = any(c.get("chunk_type") in {"CV_EXPERIENCE", "CV_PROJECT"} for c in self.chunks)

            if sem_class == "DIRECT":
                if (is_in_experience or is_in_project or (is_in_summary and has_project_or_experience)) and primary_quote:
                    status = "SUPPORTED"
                    match_status_val = "MATCHED"
                    match_score_val = 1.0
                    evidence_strength_val = "STRONG"
                    comparison_text = f'CV thể hiện kinh nghiệm làm việc thực tế với {target} ("{primary_quote}").'
                    cv_text_val = primary_quote
                else:
                    status = "PARTIALLY_SUPPORTED"
                    match_status_val = "PARTIAL"
                    match_score_val = min(1.0, self.declared_skill_score_cap / 100.0)
                    evidence_strength_val = "WEAK"
                    comparison_text = f"CV có đề cập {target} trong mục Kỹ năng, nhưng chưa có bằng chứng về việc đã sử dụng {target} trong dự án hoặc kinh nghiệm thực tế."
                    cv_text_val = f'"{target}" — mục Kỹ năng'

            elif sem_class == "EQUIVALENT":
                alias_name = matched_skill or target
                if (is_in_experience or is_in_project or (is_in_summary and has_project_or_experience)) and primary_quote:
                    status = "SUPPORTED"
                    match_status_val = "MATCHED"
                    match_score_val = 1.0
                    evidence_strength_val = "STRONG"
                    comparison_text = f'CV thể hiện kinh nghiệm thực tế với {alias_name} (tương đương {target}) ("{primary_quote}").'
                    cv_text_val = primary_quote
                else:
                    status = "PARTIALLY_SUPPORTED"
                    match_status_val = "PARTIAL"
                    match_score_val = min(1.0, self.declared_skill_score_cap / 100.0)
                    evidence_strength_val = "WEAK"
                    comparison_text = f"CV có đề cập {alias_name} (tương đương {target}) trong mục Kỹ năng, nhưng chưa có bằng chứng thực tế trong dự án hoặc kinh nghiệm làm việc."
                    cv_text_val = f'"{alias_name}" — mục Kỹ năng'

            elif sem_class == "INFERRED":
                status = "SUPPORTED"
                match_status_val = "MATCHED"
                match_score_val = semantic_res.get("score_factor", 0.95)
                evidence_strength_val = sem_strength
                comparison_text = semantic_res.get("reason") or f'CV có bằng chứng hỗ trợ năng lực {target} ("{primary_quote}").'
                cv_text_val = primary_quote or str(matched_skill or target)

            elif sem_class == "ADJACENT":
                status = "PARTIALLY_SUPPORTED"
                match_status_val = "PARTIAL"
                match_score_val = semantic_res.get("score_factor", 0.45)
                evidence_strength_val = "WEAK"
                comparison_text = semantic_res.get("reason") or f"CV có kỹ năng liên quan ({matched_skill}) nhưng chưa đủ bằng chứng trực tiếp cho {target}."
                cv_text_val = primary_quote or str(matched_skill or target)

            else:
                # Check if there is high semantic retrieval hit from embedding
                best_semantic = max((float(item.get("semantic_score") or 0) for item in evidence), default=0.0)
                if best_semantic >= 0.72 and primary_quote:
                    status = "SUPPORTED"
                    match_status_val = "MATCHED"
                    match_score_val = 0.85
                    evidence_strength_val = "MEDIUM"
                    comparison_text = f'CV có kinh nghiệm liên quan ("{primary_quote}") phù hợp với {target}.'
                    cv_text_val = primary_quote
                    sem_class = "INFERRED"
                else:
                    status = "NOT_FOUND"
                    match_status_val = "NOT_FOUND"
                    match_score_val = 0.0
                    evidence_strength_val = "NONE"
                    cv_text_val = "Chưa tìm thấy bằng chứng phù hợp trong CV."
                    comparison_text = f"CV không đề cập {target} (yêu cầu ưu tiên)." if req_type == "PREFERRED" else f"CV không đề cập {target}."
                    sem_class = "NOT_FOUND"

            match_class = "NOT_FOUND" if sem_class == "NO_EVIDENCE" else sem_class

        elif req_type_raw == "JD_EXPERIENCE":
            required_years = float(requirement.get("minimum_years") or 0)
            relevant_chunk_ids = {item["chunk_id"] for item in evidence}
            relevant_months: set[int] = set()
            undated_months = 0
            for chunk in self.chunks:
                if chunk["chunk_id"] in relevant_chunk_ids and chunk["chunk_type"] == "CV_EXPERIENCE":
                    months = _record_months(chunk["metadata"])
                    if months:
                        relevant_months.update(months)
                    elif isinstance(chunk["metadata"].get("duration_months"), (int, float)):
                        undated_months += int(chunk["metadata"]["duration_months"])

            if not relevant_months and not undated_months:
                for chunk in self.chunks:
                    if chunk["chunk_type"] == "CV_EXPERIENCE":
                        months = _record_months(chunk["metadata"])
                        if months:
                            relevant_months.update(months)
                        elif isinstance(chunk["metadata"].get("duration_months"), (int, float)):
                            undated_months += int(chunk["metadata"]["duration_months"])

            candidate_years = round((len(relevant_months) + undated_months) / 12, 2)
            requirement["candidate_relevant_years"] = candidate_years

            if required_years > 0:
                if candidate_years >= required_years:
                    match_status_val = "MATCHED"
                    match_score_val = 1.0
                    status = "SUPPORTED"
                    evidence_strength_val = "STRONG"
                    comparison_text = f"JD yêu cầu tối thiểu {required_years:g} năm kinh nghiệm; CV thể hiện khoảng {candidate_years:g} năm, đáp ứng tốt yêu cầu."
                elif candidate_years > 0:
                    match_status_val = "PARTIAL"
                    match_score_val = round(candidate_years / required_years, 2)
                    status = "PARTIALLY_SUPPORTED"
                    evidence_strength_val = "WEAK" if match_score_val < 0.5 else "MEDIUM"
                    gap_years = round(required_years - candidate_years, 1)
                    comparison_text = f"JD yêu cầu tối thiểu {required_years:g} năm kinh nghiệm; CV thể hiện khoảng {candidate_years:g} năm (thiếu khoảng {gap_years:g} năm)."
                else:
                    match_status_val = "NOT_FOUND"
                    match_score_val = 0.0
                    status = "NOT_FOUND"
                    comparison_text = f"JD yêu cầu tối thiểu {required_years:g} năm kinh nghiệm; CV không đề cập kinh nghiệm liên quan."
            else:
                if candidate_years > 0 or evidence:
                    match_status_val = "MATCHED"
                    match_score_val = 1.0
                    status = "SUPPORTED"
                    comparison_text = f"CV ghi nhận khoảng {candidate_years:g} năm kinh nghiệm phù hợp."
                else:
                    match_status_val = "NOT_FOUND"
                    match_score_val = 0.0
                    status = "NOT_FOUND"
                    comparison_text = "CV không đề cập kinh nghiệm liên quan."

        elif req_type_raw == "JD_EDUCATION":
            required = str(requirement.get("minimum_degree") or "bachelor").casefold()
            required_degree_name = DEGREE_LABELS.get(required, required)
            candidate_records = self.parsed_cv.get("education") or []
            best_degree_level = 0
            best_degree_key = ""
            for record in candidate_records:
                text = fold(_record_text(record))
                degree = str(record.get("degree_level") or "").casefold() if isinstance(record, dict) else ""
                if not degree:
                    for name in reversed(list(DEGREE_RANK)):
                        vietnamese_alias = {
                            "high_school": "thpt",
                            "associate": "cao dang",
                            "bachelor": "cu nhan",
                            "master": "thac si",
                            "doctorate": "tien si",
                        }.get(name)
                        if name in text or (vietnamese_alias and vietnamese_alias in text):
                            degree = name
                            break
                rank = DEGREE_RANK.get(degree, 0)
                if rank > best_degree_level:
                    best_degree_level = rank
                    best_degree_key = degree

            req_rank = DEGREE_RANK.get(required, 3)
            cand_degree_name = DEGREE_LABELS.get(best_degree_key, "Cao đẳng/Đại học" if best_degree_level > 0 else "")

            if best_degree_level >= req_rank:
                match_status_val = "MATCHED"
                match_score_val = 1.0
                status = "SUPPORTED"
                evidence_strength_val = "STRONG"
                comparison_text = f"JD yêu cầu bằng {required_degree_name}; CV ghi nhận bằng {cand_degree_name}, đáp ứng yêu cầu học vấn."
            elif best_degree_level > 0:
                match_status_val = "PARTIAL"
                match_score_val = 0.5
                status = "PARTIALLY_SUPPORTED"
                evidence_strength_val = "WEAK"
                comparison_text = f"JD yêu cầu tối thiểu bằng {required_degree_name}; CV ghi nhận bằng {cand_degree_name}."
            else:
                match_status_val = "NOT_FOUND"
                match_score_val = 0.0
                status = "NOT_FOUND"
                comparison_text = f"JD yêu cầu bằng {required_degree_name}; CV không đề cập thông tin bằng cấp / học vấn."

        elif req_type_raw == "JD_RESPONSIBILITY":
            if match_class in {"EXACT_MATCH", "NORMALIZED_MATCH", "SEMANTIC_MATCH"}:
                match_status_val = "MATCHED"
                match_score_val = 1.0
                status = "SUPPORTED"
                comparison_text = f"CV ghi nhận kinh nghiệm: \"{primary_quote}\", phù hợp với yêu cầu của JD."
            elif match_class == "PARTIAL_MATCH":
                match_status_val = "PARTIAL"
                match_score_val = 0.6
                status = "PARTIALLY_SUPPORTED"
                comparison_text = f"CV có kinh nghiệm liên quan một phần qua nội dung: \"{primary_quote}\"."
            else:
                match_status_val = "NOT_FOUND"
                match_score_val = 0.0
                status = "NOT_FOUND"
                comparison_text = f"CV không đề cập kinh nghiệm thực hiện '{req_name[:80]}'."

        elif req_type_raw == "JD_DOMAIN":
            domain_val = str(requirement.get("domain") or req_name)
            if match_class in {"EXACT_MATCH", "NORMALIZED_MATCH", "SEMANTIC_MATCH"}:
                match_status_val = "MATCHED"
                match_score_val = 1.0
                status = "SUPPORTED"
                comparison_text = f"CV có kinh nghiệm trong lĩnh vực {domain_val} phù hợp với yêu cầu JD."
            else:
                match_status_val = "NOT_FOUND"
                match_score_val = 0.0
                status = "NOT_FOUND"
                comparison_text = f"JD ưu tiên lĩnh vực {domain_val}; CV không đề cập kinh nghiệm trong lĩnh vực này."

        elif req_type_raw == "JD_LANGUAGE":
            lang_name = str(requirement.get("language") or requirement.get("normalized_value") or req_name)
            sem_result = match_semantic_relation(
                target_requirement=lang_name,
                cv_text=self.cv_text,
                evidence_chunks=self.chunks,
            )
            if sem_result["classification"] in {"DIRECT", "EQUIVALENT"}:
                status = "SUPPORTED"
                match_status_val = "MATCHED"
                match_score_val = 1.0
                evidence_strength_val = sem_result.get("evidence_strength", "STRONG")
                comparison_text = sem_result.get("reason", f"CV có chứng chỉ hoặc kinh nghiệm làm việc bằng {lang_name}.")
                cv_text_val = sem_result.get("matched_skill") or lang_name
                sem_class = sem_result["classification"]
            elif sem_result["classification"] == "INFERRED":
                status = "PARTIALLY_SUPPORTED"
                match_status_val = "PARTIAL"
                match_score_val = sem_result.get("score_factor", 0.70)
                evidence_strength_val = sem_result.get("evidence_strength", "WEAK")
                comparison_text = sem_result.get("reason", f"CV được trình bày bằng {lang_name}, nhưng chưa có chứng chỉ cụ thể.")
                cv_text_val = "Trình bày toàn bộ bằng tiếng Anh"
                sem_class = "INFERRED"
            else:
                status = "NOT_FOUND"
                match_status_val = "NOT_FOUND"
                match_score_val = 0.0
                evidence_strength_val = "NONE"
                comparison_text = f"CV không đề cập chứng chỉ hoặc trình độ {lang_name}."
                cv_text_val = "Chưa tìm thấy bằng chứng phù hợp trong CV."
                sem_class = "NOT_FOUND"
            match_class = sem_class

        elif is_hard:
            conflict_terms = ("khong co", "chua co", "het han", "khong du dieu kien", "ineligible", "expired", "not authorized", "no work permit")
            has_explicit_conflict = any(any(ct in fold(item["text"]) for ct in conflict_terms) for item in evidence)
            if has_explicit_conflict:
                match_status_val = "CONFLICT"
                match_score_val = 0.0
                status = "CONFLICTING"
                comparison_text = f"JD yêu cầu {jd_text_val}; CV ghi nhận thông tin không thỏa mãn điều kiện."
            elif match_class in {"EXACT_MATCH", "NORMALIZED_MATCH", "SEMANTIC_MATCH", "PARTIAL_MATCH"} and evidence:
                match_status_val = "MATCHED"
                match_score_val = 1.0
                status = "SUPPORTED"
                comparison_text = f"CV xác nhận đáp ứng điều kiện: \"{primary_quote}\"."
            else:
                match_status_val = "NOT_FOUND"
                match_score_val = 0.0
                status = "NOT_FOUND"
                comparison_text = f"JD yêu cầu {jd_text_val}; CV không cung cấp thông tin về điều kiện này."

        elif req_type_raw in {"JD_LOCATION", "JD_WORK_MODE", "JD_EMPLOYMENT_TYPE"}:
            preferences = self.parsed_cv.get("preferences") or {}
            key = {
                "JD_LOCATION": "location",
                "JD_WORK_MODE": "work_mode",
                "JD_EMPLOYMENT_TYPE": "employment_type",
            }[req_type_raw]
            candidate_value = str(preferences.get(key) or "")
            if not candidate_value:
                match_status_val = "NOT_FOUND"
                match_score_val = 0.0
                status = "UNCERTAIN"
                comparison_text = f"JD yêu cầu {jd_text_val}; CV không đề cập thông tin này."
            elif normalize_terms(candidate_value) == normalize_terms(jd_text_val):
                match_status_val = "MATCHED"
                match_score_val = 1.0
                status = "SUPPORTED"
                comparison_text = f"CV ghi nhận {candidate_value}, phù hợp với yêu cầu {jd_text_val} của JD."
            else:
                match_status_val = "CONFLICT"
                match_score_val = 0.0
                status = "CONFLICTING"
                comparison_text = f"JD yêu cầu {jd_text_val}; CV ghi nhận {candidate_value}."

        elif req_type_raw in {"JD_REQUIRED_QUALIFICATION", "JD_PREFERRED_QUALIFICATION"}:
            norm_val = str(requirement.get("normalized_value") or req_name)
            synonym_terms = _soft_skill_synonyms(norm_val)

            matching_chunks = []
            for chunk in self.chunks:
                text_clean = chunk["text"]
                if any(_contains_term(text_clean, s) for s in synonym_terms):
                    matching_chunks.append(chunk)

            if matching_chunks and not evidence:
                evidence = [
                    {
                        "evidence_id": _id("EVD", requirement["requirement_id"], c["chunk_id"]),
                        "requirement_id": requirement["requirement_id"],
                        "chunk_id": c["chunk_id"],
                        "text": c["text"],
                        "source_page": c.get("source_page"),
                        "source_section": c.get("source_section"),
                        "semantic_score": None,
                        "bm25_score": None,
                        "fusion_score": None,
                        "fusion_rank": None,
                    }
                    for c in matching_chunks[:2]
                ]

            is_in_project = any(c.get("chunk_type") == "CV_PROJECT" for c in matching_chunks)
            is_in_experience = any(c.get("chunk_type") == "CV_EXPERIENCE" for c in matching_chunks)
            is_in_summary = any(c.get("chunk_type") == "CV_SUMMARY" for c in matching_chunks)
            is_in_skills = any(c.get("chunk_type") == "CV_SKILL" for c in matching_chunks)

            first_quote = ""
            if matching_chunks:
                first_chunk = matching_chunks[0]
                first_quote = str(first_chunk.get("text") or "").strip()
                if len(first_quote) > 160:
                    first_quote = first_quote[:157] + "..."
            elif evidence:
                first_quote = str(evidence[0].get("text") or "").strip()
                if len(first_quote) > 160:
                    first_quote = first_quote[:157] + "..."

            if is_in_experience or is_in_project or is_in_summary:
                status = "SUPPORTED"
                match_status_val = "MATCHED"
                match_score_val = 1.0
                evidence_strength_val = "STRONG"
                comparison_text = f"CV thể hiện {norm_val} qua kinh nghiệm/dự án/tóm tắt (\"{first_quote}\")."
                cv_text_val = first_quote
            elif is_in_skills:
                status = "PARTIALLY_SUPPORTED"
                match_status_val = "PARTIAL"
                match_score_val = 0.5
                evidence_strength_val = "WEAK"
                comparison_text = f"CV có đề cập {norm_val} trong mục Kỹ năng nhưng chưa có nhiều minh chứng chi tiết."
                cv_text_val = f'"{norm_val}" — mục Kỹ năng'
            elif match_class in {"EXACT_MATCH", "NORMALIZED_MATCH", "SEMANTIC_MATCH"} and evidence:
                status = "SUPPORTED"
                match_status_val = "MATCHED"
                match_score_val = 1.0
                evidence_strength_val = "STRONG"
                comparison_text = f"CV ghi nhận {norm_val}, đáp ứng yêu cầu của JD."
                cv_text_val = first_quote or norm_val
            elif match_class == "PARTIAL_MATCH" and evidence:
                status = "PARTIALLY_SUPPORTED"
                match_status_val = "PARTIAL"
                match_score_val = 0.5
                evidence_strength_val = "MEDIUM"
                comparison_text = f"CV có thông tin liên quan đến {norm_val} nhưng chưa đầy đủ."
                cv_text_val = first_quote or norm_val
            else:
                status = "UNCERTAIN"
                match_status_val = "UNCERTAIN"
                match_score_val = 0.0
                evidence_strength_val = "NONE"
                comparison_text = f"Chưa có đủ bằng chứng trong CV cho thuộc tính '{norm_val}'."
                cv_text_val = "Chưa tìm thấy bằng chứng phù hợp trong CV."

        else:
            other_text = str(requirement.get("normalized_value") or requirement.get("text") or req_name)
            raw_terms = [t.strip() for t in re.split(r"[,:;.\n]+", other_text) if len(t.strip()) >= 3]
            other_terms = list(raw_terms)
            for rt in raw_terms:
                other_terms.extend(_soft_skill_synonyms(rt))
            direct_chunk = next(
                (
                    c for c in self.chunks
                    if _contains_term(c["text"], other_text)
                    or any(_contains_term(c["text"], t) for t in other_terms)
                ),
                None,
            )
            if direct_chunk and not evidence:
                evidence = [
                    {
                        "evidence_id": _id("EVD", requirement["requirement_id"], direct_chunk["chunk_id"]),
                        "requirement_id": requirement["requirement_id"],
                        "chunk_id": direct_chunk["chunk_id"],
                        "text": direct_chunk["text"],
                        "source_page": direct_chunk.get("source_page"),
                        "source_section": direct_chunk.get("source_section"),
                        "semantic_score": None,
                        "bm25_score": None,
                        "fusion_score": None,
                        "fusion_rank": None,
                    }
                ]
                if not primary_quote:
                    primary_quote = str(direct_chunk.get("text") or "").strip()
                    if len(primary_quote) > 160:
                        primary_quote = primary_quote[:157] + "..."

            if match_class in {"EXACT_MATCH", "NORMALIZED_MATCH", "SEMANTIC_MATCH"} or direct_chunk:
                match_status_val = "MATCHED"
                match_score_val = 1.0
                status = "SUPPORTED"
                comparison_text = f"CV ghi nhận thông tin phù hợp: \"{primary_quote or req_name}\"."
                cv_text_val = primary_quote or req_name
            elif match_class == "PARTIAL_MATCH":
                match_status_val = "PARTIAL"
                match_score_val = 0.5
                status = "PARTIALLY_SUPPORTED"
                comparison_text = f"CV có thông tin liên quan: \"{primary_quote or req_name}\"."
                cv_text_val = primary_quote or req_name
            else:
                match_status_val = "NOT_FOUND"
                match_score_val = 0.0
                status = "NOT_FOUND"
                comparison_text = f"CV không đề cập {req_name}."

        score_points = round(match_score_val * 100, 1)

        return {
            **requirement,
            "status": status,
            "match_status": match_status_val,
            "match_score": round(match_score_val, 2),
            "match_classification": match_class,
            "evidence_strength": evidence_strength_val,
            "criterion_score": score_points,
            "score": score_points,
            "reason": comparison_text,
            "comparison": comparison_text,
            "jd_text": jd_text_val,
            "cv_text": cv_text_val,
            "evidence_ids": [item["evidence_id"] for item in evidence],
            "evidence": evidence,
        }


MAX_PREFERRED_TOTAL_SHARE = 0.25  # Max 25% total weight budget for PREFERRED items when CORE exists


def calculate_requirement_weights(
    scoreable_items: list[dict[str, Any]],
    decimal_places: int = 1,
    max_preferred_share: float = MAX_PREFERRED_TOTAL_SHARE,
) -> None:
    """Assign dynamic weight and weighted_score directly to each scoreable requirement in-place.

    Guardrail:
    - HARD_CONSTRAINT and items satisfied by alternative in ANY_OF are excluded from budget calculation.
    - If CORE (REQUIRED/RESPONSIBILITY) and PREFERRED items both exist:
      - If raw PREFERRED share > max_preferred_share (default 25%), cap total PREFERRED budget at 25%
        and grant CORE budget 75%.
      - Otherwise, use natural linear importance share.
    - If only PREFERRED items exist, PREFERRED receives 100% budget.
    - If only CORE items exist, CORE receives 100% budget.
    """
    if not scoreable_items:
        return

    # Filter strictly to scoreable items only (excluding HARD_CONSTRAINT and items satisfied by alternative)
    valid_scoreable = [
        item for item in scoreable_items
        if not item.get("is_hard_constraint")
        and item.get("type") != "HARD_CONSTRAINT"
        and item.get("is_scorable", True) is True
        and not item.get("is_satisfied_by_alternative")
    ]
    for item in scoreable_items:
        if item.get("is_satisfied_by_alternative"):
            item["weight"] = 0.0
            item["weighted_score"] = 0.0

    if not valid_scoreable:
        for item in scoreable_items:
            item["weight"] = 0.0
            item["weighted_score"] = 0.0
        return

    # Normalize group weights for ALL_OF compound groups
    all_of_groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for item in valid_scoreable:
        if item.get("group_id") and item.get("group_operator") == "ALL_OF":
            all_of_groups[item["group_id"]].append(item)
    for grp_id, grp_items in all_of_groups.items():
        if len(grp_items) > 1:
            base_grp_imp = float(grp_items[0].get("group_importance") or grp_items[0].get("importance") or 3.0)
            split_imp = base_grp_imp / len(grp_items)
            for itm in grp_items:
                itm["_effective_importance"] = split_imp

    core_items = [
        item for item in valid_scoreable
        if not item.get("is_hard_constraint")
        and item.get("type") != "HARD_CONSTRAINT"
        and (item.get("type") in {"REQUIRED", "RESPONSIBILITY"} or item.get("mandatory"))
    ]
    pref_items = [
        item for item in valid_scoreable
        if item not in core_items
    ]

    core_imp = sum(float(item.get("_effective_importance") or item.get("importance") or 1.0) for item in core_items)
    pref_imp = sum(float(item.get("_effective_importance") or item.get("importance") or 1.0) for item in pref_items)
    total_imp = core_imp + pref_imp

    if total_imp <= 0:
        for item in scoreable_items:
            item["weight"] = 0.0
            item["weighted_score"] = 0.0
        return

    if core_items and pref_items:
        raw_pref_share = pref_imp / total_imp
        if raw_pref_share > max_preferred_share:
            # Guardrail triggered: allocate capped budgets
            pref_budget = max_preferred_share * 100.0
            core_budget = (1.0 - max_preferred_share) * 100.0
            for item in core_items:
                imp = float(item.get("_effective_importance") or item.get("importance") or 1.0)
                item["weight"] = round((imp / core_imp) * core_budget, decimal_places)
                item["weighted_score"] = round(item["weight"] * float(item.get("match_score", 0.0)), decimal_places)
            for item in pref_items:
                imp = float(item.get("_effective_importance") or item.get("importance") or 1.0)
                item["weight"] = round((imp / pref_imp) * pref_budget, decimal_places)
                item["weighted_score"] = round(item["weight"] * float(item.get("match_score", 0.0)), decimal_places)
        else:
            for item in valid_scoreable:
                imp = float(item.get("_effective_importance") or item.get("importance") or 1.0)
                item["weight"] = round((imp / total_imp) * 100.0, decimal_places)
                item["weighted_score"] = round(item["weight"] * float(item.get("match_score", 0.0)), decimal_places)
    elif core_items:
        for item in core_items:
            imp = float(item.get("_effective_importance") or item.get("importance") or 1.0)
            item["weight"] = round((imp / core_imp) * 100.0, decimal_places)
            item["weighted_score"] = round(item["weight"] * float(item.get("match_score", 0.0)), decimal_places)
    elif pref_items:
        for item in pref_items:
            imp = float(item.get("_effective_importance") or item.get("importance") or 1.0)
            item["weight"] = round((imp / pref_imp) * 100.0, decimal_places)
            item["weighted_score"] = round(item["weight"] * float(item.get("match_score", 0.0)), decimal_places)

    # Ensure exact sum of valid scoreable weights is 100.0
    weight_sum = sum(item["weight"] for item in valid_scoreable)
    delta = round(100.0 - weight_sum, decimal_places)
    if delta != 0 and valid_scoreable:
        valid_scoreable[-1]["weight"] = round(valid_scoreable[-1]["weight"] + delta, decimal_places)
        valid_scoreable[-1]["weighted_score"] = round(
            valid_scoreable[-1]["weight"] * float(valid_scoreable[-1].get("match_score", 0.0)), decimal_places
        )


def build_blockers(
    evaluated: list[dict[str, Any]],
    decimal_places: int = 1,
) -> tuple[list[dict[str, Any]], list[str]]:
    scoreable_items = [
        item for item in evaluated
        if item.get("is_scorable", True) is True
        and not item.get("is_hard_constraint")
        and item.get("type") != "HARD_CONSTRAINT"
    ]

    def blocker_priority(item: dict[str, Any]) -> tuple[int, float, float]:
        is_hard = item.get("hard_gate")
        is_req = item.get("mandatory") or item.get("type") == "REQUIRED" or is_hard
        status = item.get("status", "NOT_FOUND")
        lost = round(max(0.0, float(item.get("weight", 0.0)) - float(item.get("weighted_score", 0.0))), decimal_places)
        req_type = item.get("requirement_type", "")
        group = item.get("group", "")

        if is_hard and status in ("NOT_FOUND", "CONFLICTING"):
            tier = 0
        elif is_req and status in ("NOT_FOUND", "CONFLICTING"):
            if group == "experience_seniority" or req_type == "JD_EXPERIENCE":
                tier = 1
            elif group == "responsibilities_task_fit" or req_type == "JD_RESPONSIBILITY":
                tier = 2
            else:
                tier = 3
        elif is_req and status == "UNCERTAIN":
            tier = 4
        elif not is_req and status in ("NOT_FOUND", "CONFLICTING"):
            tier = 5
        elif is_req and status == "PARTIALLY_SUPPORTED":
            tier = 6
        elif not is_req and status == "PARTIALLY_SUPPORTED":
            tier = 7
        else:
            tier = 8

        return (tier, -lost, -float(item.get("weight", 0.0)))

    # Only include items that lost points and are not satisfied by alternative in ANY_OF group
    items_with_loss = [
        item for item in scoreable_items
        if round(max(0.0, float(item.get("weight", 0.0)) - float(item.get("weighted_score", 0.0))), decimal_places) > 0
        and not item.get("is_satisfied_by_alternative")
    ]

    candidates = sorted(items_with_loss, key=blocker_priority)
    selected = candidates[:5]

    structured_blockers = []
    string_blockers = []
    seen_blockers: set[str] = set()

    for item in selected:
        title = item.get("normalized_value") or item.get("text") or item.get("requirement") or ""
        canon_name = item.get("canonical_name") or title
        src_sent = item.get("source_sentence") or item.get("text", "")
        b_key = f"{fold(canon_name)}_{fold(src_sent)}"
        if b_key in seen_blockers:
            continue
        seen_blockers.add(b_key)

        is_hard = bool(item.get("hard_gate"))
        is_req = bool(item.get("mandatory") or item.get("type") == "REQUIRED" or is_hard)
        importance = "required" if is_req else "preferred"
        status = item.get("status", "NOT_FOUND")
        weight = float(item.get("weight", 0.0))
        contribution = float(item.get("weighted_score", 0.0))
        lost = round(max(0.0, weight - contribution), decimal_places)
        reason = item.get("comparison") or item.get("reason") or f"Chưa tìm thấy bằng chứng {title} trong CV."
        req_type = item.get("requirement_type", "")
        group = item.get("group", "")
        match_classification = item.get("match_classification", "")
        ev_strength = item.get("evidence_strength", "")

        if is_hard and status in ("NOT_FOUND", "CONFLICTING"):
            blocker_type = "HARD_GATE"
            category_label = "Thiếu yêu cầu bắt buộc"
            display_badge = "🔴 Tiên quyết · Thiếu yêu cầu bắt buộc"
        elif group == "experience_seniority" or req_type == "JD_EXPERIENCE":
            blocker_type = "EXPERIENCE_GAP"
            category_label = "Thiếu kinh nghiệm/thâm niên"
            display_badge = f"{'Bắt buộc' if is_req else 'Ưu tiên'} · {category_label}"
        elif match_classification == "ADJACENT":
            blocker_type = "ADJACENT"
            category_label = "Có bằng chứng liên quan"
            display_badge = f"{'Bắt buộc' if is_req else 'Ưu tiên'} · {category_label}"
        elif ev_strength == "WEAK" or status == "PARTIALLY_SUPPORTED":
            blocker_type = "WEAK_EVIDENCE"
            category_label = "Thiếu bằng chứng thực tế"
            display_badge = f"{'Bắt buộc' if is_req else 'Ưu tiên'} · {category_label}"
        else:
            blocker_type = "NO_EVIDENCE"
            category_label = "Chưa có bằng chứng"
            display_badge = f"{'Bắt buộc' if is_req else 'Ưu tiên'} · {category_label}"

        structured_blockers.append({
            "requirement_id": item.get("requirement_id", ""),
            "source_sentence": src_sent,
            "canonical_name": canon_name,
            "group_id": item.get("group_id", ""),
            "evidence_status": item.get("evidence_status") or match_classification or "NO_EVIDENCE",
            "title": title,
            "importance": importance,
            "is_mandatory": is_req,
            "hard_gate": is_hard,
            "is_scorable": True,
            "blocker_type": blocker_type,
            "impact": "HIGH" if is_req else "MEDIUM",
            "impact_label": category_label,
            "display_badge": display_badge,
            "status": status,
            "match_classification": match_classification,
            "evidence_strength": ev_strength,
            "weight": weight,
            "earned": contribution,
            "lost": lost,
            "reason": reason,
        })
        string_blockers.append(f"{title}: {reason}")

    return structured_blockers, string_blockers


def _infer_group_from_requirement(group_val: str, req_type: str) -> str:
    valid_groups = {"skills", "responsibilities_task_fit", "experience_seniority", "education", "domain_industry", "certifications_languages_other"}
    if group_val in valid_groups:
        return group_val
    if req_type in {"JD_REQUIRED_SKILL", "JD_PREFERRED_SKILL", "JD_REQUIRED_QUALIFICATION", "JD_PREFERRED_QUALIFICATION"}:
        return "skills"
    if req_type == "JD_RESPONSIBILITY":
        return "responsibilities_task_fit"
    if req_type == "JD_EXPERIENCE":
        return "experience_seniority"
    if req_type == "JD_EDUCATION":
        return "education"
    if req_type == "JD_DOMAIN":
        return "domain_industry"
    return "certifications_languages_other"


class RubricService:
    @staticmethod
    def evaluate(
        evaluated_requirements: list[dict[str, Any]],
        rubric: dict[str, float] | None = None,
        decimal_places: int = 1,
    ) -> list[dict[str, Any]]:
        """Dynamic JD-driven rubric evaluator.

        The 6 groups serve strictly as taxonomy/UI aggregation.
        Weights and scores are derived from underlying requirements.
        """
        if rubric:
            if isinstance(rubric, dict) and "criteria" in rubric:
                supplied = {
                    item["criterion_id"]: float(item["weight"])
                    for item in rubric["criteria"]
                    if item.get("enabled", True)
                }
                if supplied:
                    if not math.isclose(sum(supplied.values()), 100.0, abs_tol=0.001):
                        raise ValueError("RUBRIC_001: Tổng trọng số criterion đang bật phải bằng 100%.")
            elif isinstance(rubric, dict):
                if not math.isclose(sum(float(v) for v in rubric.values()), 100.0, abs_tol=0.001):
                    raise ValueError("RUBRIC_001: Tổng trọng số criterion đang bật phải bằng 100%.")

        scoreable_items = [
            i for i in evaluated_requirements
            if i.get("is_scorable", True) is True
            and not i.get("is_hard_constraint")
            and i.get("type") != "HARD_CONSTRAINT"
        ]
        if not scoreable_items:
            return []

        # Ensure requirement-level weights are calculated
        if any("weight" not in i for i in scoreable_items):
            calculate_requirement_weights(scoreable_items, decimal_places)

        group_items: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for item in evaluated_requirements:
            g_val = item.get("group") or ""
            group_key = _infer_group_from_requirement(g_val, item.get("requirement_type", ""))
            item["group"] = group_key
            group_items[group_key].append(item)

        criteria = []
        for group_key, criterion_id, label in SIX_GROUPS:
            all_in_group = group_items.get(group_key, [])
            scoring_in_group = [
                i for i in all_in_group
                if i.get("is_scorable", True) is True
                and not i.get("is_hard_constraint")
                and i.get("type") != "HARD_CONSTRAINT"
            ]
            if not scoring_in_group:
                continue

            g_weight = round(sum(i.get("weight", 0.0) for i in scoring_in_group), decimal_places)
            g_weighted_score = round(sum(i.get("weighted_score", 0.0) for i in scoring_in_group), decimal_places)
            g_raw = round((g_weighted_score / g_weight * 100.0) if g_weight > 0 else 0.0, decimal_places)

            statuses = {item["status"] for item in scoring_in_group}
            status = (
                "SUPPORTED"
                if statuses == {"SUPPORTED"}
                else "NOT_FOUND"
                if statuses <= {"NOT_FOUND", "CONFLICTING"}
                else "UNCERTAIN"
                if statuses == {"UNCERTAIN"}
                else "PARTIALLY_SUPPORTED"
            )
            met_count = sum(
                1 for item in scoring_in_group
                if item.get("match_status") == "MATCHED" or item.get("status") == "SUPPORTED"
            )
            criteria.append(
                {
                    "criterion_id": criterion_id,
                    "group": group_key,
                    "label": label,
                    "raw_score": g_raw,
                    "weight": g_weight,
                    "weighted_score": g_weighted_score,
                    "status": status,
                    "reason": f"Đáp ứng {met_count}/{len(scoring_in_group)} yêu cầu đối chiếu.",
                    "requirement_ids": [item["requirement_id"] for item in scoring_in_group],
                    "evidence_ids": list(dict.fromkeys(eid for item in scoring_in_group for eid in item.get("evidence_ids", []))),
                }
            )

        if criteria:
            weight_delta = round(100.0 - sum(item["weight"] for item in criteria), decimal_places)
            if weight_delta != 0:
                criteria[-1]["weight"] = round(criteria[-1]["weight"] + weight_delta, decimal_places)
                criteria[-1]["weighted_score"] = round(
                    (criteria[-1]["raw_score"] / 100.0) * criteria[-1]["weight"], decimal_places
                )

        return criteria


def _rating(score: float, config: PipelineConfig) -> str:
    if score <= config.rating_poor_max:
        return "POOR"
    if score <= config.rating_average_max:
        return "AVERAGE"
    if score <= config.rating_good_max:
        return "GOOD"
    return "EXCELLENT"


def get_impact_level(weight: float, is_mandatory: bool = False, importance: float = 3.0) -> tuple[str, str]:
    """Return (impact_code, impact_label) for human-friendly student display."""
    if weight >= 15.0 or importance >= 4.0:
        return "HIGH", "Ảnh hưởng cao"
    if weight >= 8.0 or importance >= 3.0 or is_mandatory:
        return "MEDIUM", "Ảnh hưởng trung bình"
    return "LOW", "Ảnh hưởng thấp"


def get_category_impact_level(weight: float) -> tuple[str, str]:
    """Return (impact_code, impact_label) for category-level display."""
    if weight >= 25.0:
        return "HIGH", "Mức ảnh hưởng: Cao"
    if weight >= 12.0:
        return "MEDIUM", "Mức ảnh hưởng: Trung bình"
    return "LOW", "Mức ảnh hưởng: Thấp"


def build_score_explanation(
    evaluated: list[dict[str, Any]],
    criteria: list[dict[str, Any]],
    final_score: float,
    decimal_places: int = 1,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """Build dual-layer explanation for deterministic Match scoring."""
    total_earned = round(sum(item["weighted_score"] for item in criteria), decimal_places)
    total_max = round(sum(item["weight"] for item in criteria), decimal_places)

    category_explanations = []
    for crit in criteria:
        group_key = crit.get("group") or ""
        group_label = crit.get("label") or group_key
        crit_weight = float(crit.get("weight", 0.0))
        crit_weighted_score = float(crit.get("weighted_score", 0.0))
        crit_raw_score = float(crit.get("raw_score", 0.0))

        impact_code, impact_label = get_category_impact_level(crit_weight)

        group_evals = [
            item for item in evaluated
            if (item.get("group") == group_key)
            and item.get("is_scorable", True) is True
            and not item.get("is_hard_constraint")
            and item.get("type") != "HARD_CONSTRAINT"
        ]

        req_count = len(group_evals)
        supported_count = sum(1 for item in group_evals if item.get("status") == "SUPPORTED")
        partial_count = sum(1 for item in group_evals if item.get("status") == "PARTIALLY_SUPPORTED")
        missing_count = sum(1 for item in group_evals if item.get("status") in ("NOT_FOUND", "CONFLICTING"))

        category_explanations.append({
            "group": group_key,
            "label": group_label,
            "weight": crit_weight,
            "earned_points": crit_weighted_score,
            "max_points": crit_weight,
            "raw_score": crit_raw_score,
            "match_percentage": crit_raw_score,
            "impact": impact_code,
            "impact_label": impact_label,
            "display_impact": impact_label,
            "total_requirements": req_count,
            "supported_count": supported_count,
            "partial_count": partial_count,
            "missing_count": missing_count,
            "summary": f"{supported_count}/{req_count} yêu cầu đáp ứng hoàn toàn",
        })

    scoreable_items = [
        item for item in evaluated
        if item.get("is_scorable", True) is True
        and not item.get("is_hard_constraint")
        and item.get("type") != "HARD_CONSTRAINT"
    ]

    positive_contributions = []
    partial_contributions = []
    lost_points = []

    for item in scoreable_items:
        req_id = item.get("requirement_id", "")
        title = item.get("normalized_value") or item.get("text") or item.get("requirement") or ""
        is_mand = bool(item.get("mandatory") or item.get("type") == "REQUIRED")
        importance = "required" if is_mand else "preferred"
        status = item.get("status", "NOT_FOUND")
        weight = float(item.get("weight", 0.0))
        match_score = float(item.get("match_score", 0.0))
        contribution = float(item.get("weighted_score", 0.0))
        evidence_summary = item.get("comparison") or item.get("reason") or ""
        imp_val = float(item.get("importance") or (3.0 if is_mand else 1.0))
        impact_code, impact_label = get_impact_level(weight, is_mand, imp_val)

        if status == "SUPPORTED" and contribution > 0:
            positive_contributions.append({
                "requirement_id": req_id,
                "title": title,
                "importance": importance,
                "is_mandatory": is_mand,
                "impact": impact_code,
                "impact_label": impact_label,
                "status": "SUPPORTED",
                "weight": weight,
                "match_score": match_score,
                "contribution": contribution,
                "evidence_summary": evidence_summary or "Có bằng chứng trong CV đáp ứng yêu cầu.",
            })
        elif status == "PARTIALLY_SUPPORTED" and contribution > 0:
            partial_contributions.append({
                "requirement_id": req_id,
                "title": title,
                "importance": importance,
                "is_mandatory": is_mand,
                "impact": impact_code,
                "impact_label": impact_label,
                "status": "PARTIALLY_SUPPORTED",
                "weight": weight,
                "match_score": match_score,
                "contribution": contribution,
                "evidence_summary": evidence_summary or "Có đề cập nhưng bằng chứng thực tế còn hạn chế.",
            })

        lost = round(max(0.0, weight - contribution), decimal_places)
        if lost > 0:
            lost_points.append({
                "requirement_id": req_id,
                "title": title,
                "importance": importance,
                "is_mandatory": is_mand,
                "impact": impact_code,
                "impact_label": impact_label,
                "status": status,
                "weight": weight,
                "earned": contribution,
                "lost": lost,
                "reason": evidence_summary or (
                    "Không tìm thấy bằng chứng trong CV."
                    if status in ("NOT_FOUND", "CONFLICTING")
                    else "Chưa đủ bằng chứng thực tế để tính trọn điểm."
                ),
            })

    positive_contributions.sort(key=lambda x: (x["contribution"], x["weight"]), reverse=True)
    partial_contributions.sort(key=lambda x: (x["contribution"], x["weight"]), reverse=True)
    lost_points.sort(key=lambda x: (x["lost"], x["weight"]), reverse=True)

    overall_explanation = {
        "final_score": final_score,
        "total_earned_points": total_earned,
        "total_max_points": total_max,
        "earned_points": total_earned,
        "maximum_points": total_max,
        "rating": "EXCELLENT" if final_score >= 80 else ("GOOD" if final_score >= 60 else ("AVERAGE" if final_score >= 40 else "POOR")),
        "score_formula": "final_score = sum(weighted_score_i) = sum(weight_i * match_score_i)",
        "weight_distribution_rule": "Dynamic requirement-driven weighting with 100% budget",
        "transparency_note": "Điểm Match phản ánh mức độ bằng chứng trong CV đáp ứng các yêu cầu của JD. Yêu cầu bắt buộc, kinh nghiệm và trách nhiệm chính có ảnh hưởng lớn hơn các yêu cầu ưu tiên. Nội dung giới thiệu công ty, quyền lợi và hướng dẫn ứng tuyển không được dùng để chấm điểm.",
        "positive_contributions": positive_contributions,
        "partial_contributions": partial_contributions,
        "lost_points": lost_points,
    }

    return overall_explanation, category_explanations


def build_strengths(
    evaluated: list[dict[str, Any]],
    decimal_places: int = 1,
) -> tuple[list[dict[str, Any]], list[str]]:
    scoreable_items = [
        item for item in evaluated
        if item.get("is_scorable", True) is True
        and not item.get("is_hard_constraint")
        and item.get("type") != "HARD_CONSTRAINT"
    ]
    supported_items = [item for item in scoreable_items if item.get("status") == "SUPPORTED"]
    partial_items = [item for item in scoreable_items if item.get("status") == "PARTIALLY_SUPPORTED"]

    def strength_priority(item: dict[str, Any]) -> tuple[int, float, int]:
        is_req = item.get("mandatory") or item.get("type") == "REQUIRED"
        weight = float(item.get("weight", 0.0))
        ev_strength = str(item.get("evidence_strength", "")).upper()
        is_strong = 1 if ev_strength == "STRONG" else 0

        # Tier 0: required + SUPPORTED + strong evidence
        # Tier 1: required + SUPPORTED
        # Tier 2: preferred + SUPPORTED + strong evidence
        # Tier 3: preferred + SUPPORTED
        # Tier 4: required + PARTIALLY_SUPPORTED
        # Tier 5: preferred + PARTIALLY_SUPPORTED
        if item.get("status") == "SUPPORTED":
            tier = 0 if (is_req and is_strong) else (1 if is_req else (2 if is_strong else 3))
        else:
            tier = 4 if is_req else 5
        return (tier, -weight, -is_strong)

    candidates = sorted(supported_items, key=strength_priority)
    if len(candidates) < 3 and partial_items:
        candidates.extend(sorted(partial_items, key=strength_priority))

    selected = candidates[:5]
    structured_strengths = []
    string_strengths = []

    for item in selected:
        title = item.get("normalized_value") or item.get("text") or item.get("requirement") or ""
        status = item.get("status", "SUPPORTED")
        weight = float(item.get("weight", 0.0))
        contribution = float(item.get("weighted_score", 0.0))
        ev_strength = str(item.get("evidence_strength", "STRONG")).upper()
        reason = item.get("comparison") or item.get("reason") or f"CV có bằng chứng đáp ứng {title}."
        is_req = bool(item.get("mandatory") or item.get("type") == "REQUIRED")
        imp_val = float(item.get("importance") or (3.0 if is_req else 1.0))
        impact_code, impact_label = get_impact_level(weight, is_req, imp_val)
        display_badge = "Bắt buộc" if is_req else "Ưu tiên"

        structured_strengths.append({
            "requirement_id": item.get("requirement_id", ""),
            "title": title,
            "status": status,
            "is_mandatory": is_req,
            "is_scorable": True,
            "impact": impact_code,
            "impact_label": impact_label,
            "display_badge": display_badge,
            "weight": weight,
            "contribution": contribution,
            "evidence_strength": ev_strength,
            "reason": reason,
        })
        string_strengths.append(f"{title}: {reason}")

    if not string_strengths:
        string_strengths = ["Chưa có đủ bằng chứng trực tiếp cho các yêu cầu chính của JD."]

    return structured_strengths, string_strengths



def run_cv_jd_pipeline(
    *,
    cv_text: str,
    parsed_cv: dict[str, Any],
    job_id: str,
    requirements: list[dict[str, Any]],
    jd_title: str = "",
    rubric: dict[str, float] | None = None,
    config: PipelineConfig | None = None,
    on_progress: Any = None,
) -> dict[str, Any]:
    config = config or PipelineConfig()
    trace_id = _id("TRACE", job_id)
    match_id = _id("MATCH", job_id)

    state_trace: list[dict[str, Any]] = []
    previous_time = perf_counter()
    previous_at = datetime.now(UTC)

    def trace(step: str) -> None:
        nonlocal previous_time, previous_at
        now_time = perf_counter()
        now_at = datetime.now(UTC)
        duration_ms = round((now_time - previous_time) * 1000, 2)
        state_trace.append(
            {
                "pipeline_step": step,
                "status": "COMPLETED" if step == "COMPLETED" else "SUCCESS",
                "started_at": previous_at.isoformat(),
                "completed_at": now_at.isoformat(),
                "duration_ms": duration_ms,
            }
        )
        previous_time = now_time
        previous_at = now_at

    trace("PENDING")
    trace("PARSING")
    trace("EXTRACTING")
    trace("NORMALIZING")
    candidate_id, document_id, chunks = ChunkingService.build(cv_text, parsed_cv)
    trace("CHUNKING")

    retrieval_service = RetrievalService(chunks, config)
    evidence_service = EvidenceService(chunks, config.max_evidence_per_requirement)
    evaluator = EvaluationService(
        chunks,
        parsed_cv,
        config.extraction_min_confidence,
        config.declared_skill_score_cap,
    )
    trace("INDEXING")

    requirements = [
        item for item in requirements
        if item.get("is_scorable", True) is True
        or item.get("is_hard_constraint")
        or item.get("type") == "HARD_CONSTRAINT"
    ]

    query_vectors = retrieval_service.prefetch_queries(requirements)

    retrieval_results = []
    evidence_all = []
    evaluated = []
    trace("RETRIEVING")
    total_requirements = len(requirements)
    if on_progress:
        try:
            on_progress(0, total_requirements)
        except Exception:
            pass

    for idx, requirement in enumerate(requirements):
        req_id = requirement.get("requirement_id")
        retrieval = retrieval_service.retrieve(requirement, precomputed_vector=query_vectors.get(req_id))
        evidence = evidence_service.select(requirement, retrieval)
        retrieval_results.append(retrieval)
        evidence_all.extend(evidence)
        evaluated.append(evaluator.evaluate_requirement(dict(requirement), evidence))
        if on_progress:
            try:
                on_progress(idx + 1, total_requirements)
            except Exception:
                pass

    # Process Boolean Requirement Groups (ANY_OF and ALL_OF):
    group_map: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for item in evaluated:
        if item.get("group_id"):
            group_map[item["group_id"]].append(item)

    for grp_id, grp_items in group_map.items():
        op = grp_items[0].get("group_operator", "ALL_OF")
        if op == "ANY_OF":
            supported_opts = [
                i for i in grp_items
                if i.get("status") == "SUPPORTED" or float(i.get("match_score", 0.0)) >= 0.8
            ]
            min_req = grp_items[0].get("min_required", 1)
            if len(supported_opts) >= min_req:
                satisfied_names = [str(s.get("canonical_name") or s.get("normalized_value") or s.get("text")) for s in supported_opts]
                for item in grp_items:
                    if item in supported_opts:
                        item["group_status"] = "SATISFIED"
                        item["satisfied_by"] = satisfied_names
                        item["satisfied_by_alternative"] = False
                        item["is_satisfied_by_alternative"] = False
                        item["is_required_after_group_resolution"] = True
                        item["score_contribution"] = float(item.get("match_score", 1.0)) * 100.0
                    else:
                        # Unsatisfied alternative option: MUST NOT be marked as matched when CV has no evidence
                        item["evidence_status"] = "NO_EVIDENCE"
                        item["status"] = "NOT_FOUND"
                        item["match_status"] = "NOT_FOUND"
                        item["match_classification"] = "NO_EVIDENCE"
                        item["match_score"] = 0.0
                        item["criterion_score"] = 0.0
                        item["group_status"] = "SATISFIED"
                        item["satisfied_by"] = satisfied_names
                        item["satisfied_by_alternative"] = True
                        item["is_satisfied_by_alternative"] = True
                        item["is_required_after_group_resolution"] = False
                        item["score_contribution"] = 0.0
                        item["weight"] = 0.0
                        item["weighted_score"] = 0.0
                        item["is_scorable"] = False
                        item["reason"] = f"Đã thỏa mãn qua lựa chọn thay thế trong nhóm ANY_OF ({', '.join(satisfied_names)})"
                        item["comparison"] = item["reason"]
            else:
                for item in grp_items:
                    item["group_status"] = "NOT_FOUND"
                    item["satisfied_by"] = []
                    item["satisfied_by_alternative"] = False
                    item["is_satisfied_by_alternative"] = False
                    item["is_required_after_group_resolution"] = True
        elif op == "ALL_OF":
            all_supported = all(
                i.get("status") == "SUPPORTED" or float(i.get("match_score", 0.0)) >= 0.8
                for i in grp_items
            )
            any_supported = any(
                i.get("status") == "SUPPORTED" or float(i.get("match_score", 0.0)) >= 0.8
                for i in grp_items
            )
            grp_status = "SATISFIED" if all_supported else "PARTIALLY_SUPPORTED" if any_supported else "NOT_FOUND"
            for item in grp_items:
                item["group_status"] = grp_status
                item["satisfied_by_alternative"] = False
                item["is_satisfied_by_alternative"] = False
                item["is_required_after_group_resolution"] = True

    trace("EVALUATING")
    # Direct Requirement-Driven Scoring:
    scoreable_items = [
        item for item in evaluated
        if item.get("is_scorable", True) is True
        and not item.get("is_hard_constraint")
        and item.get("type") != "HARD_CONSTRAINT"
    ]
    calculate_requirement_weights(scoreable_items, config.score_decimal_places)

    criteria = RubricService.evaluate(evaluated, rubric, config.score_decimal_places)
    raw_final_score = (
        round(sum(item["weighted_score"] for item in criteria), config.score_decimal_places) if criteria else 0.0
    )
    raw_final_score = min(100.0, max(0.0, raw_final_score))

    hard_constraints = [
        item for item in evaluated if item.get("is_hard_constraint") or item.get("type") == "HARD_CONSTRAINT"
    ]
    eligibility_details = []
    eligibility_status = "ELIGIBLE"
    eligibility_reason = None

    has_conflict = False
    has_unknown = False

    for hc in hard_constraints:
        h_status = hc.get("match_status", "NOT_FOUND")
        h_comp = hc.get("comparison") or hc.get("reason") or ""
        eligibility_details.append(
            {
                "requirement_id": hc["requirement_id"],
                "requirement": hc.get("requirement") or hc.get("text"),
                "status": h_status,
                "reason": h_comp,
                "comparison": h_comp,
            }
        )
        if h_status == "CONFLICT" or hc.get("status") == "CONFLICTING":
            has_conflict = True
            eligibility_reason = h_comp
        elif h_status in {"NOT_FOUND", "PARTIAL", "UNCERTAIN"} or hc.get("status") in {"NOT_FOUND", "UNCERTAIN"}:
            has_unknown = True
            if not eligibility_reason:
                eligibility_reason = h_comp

    if has_conflict:
        eligibility_status = "NOT_ELIGIBLE"
    elif has_unknown:
        eligibility_status = "UNKNOWN"
    else:
        eligibility_status = "ELIGIBLE"

    warnings = []
    # Hard Gate check: Only explicit non-negotiable requirements (hard_gate=True) cap final score at 49.0
    hard_gate_failed = any(
        bool(item.get("hard_gate"))
        and item.get("status") in {"NOT_FOUND", "CONFLICTING"}
        for item in evaluated
    )
    if hard_gate_failed:
        final_score = min(raw_final_score, config.mandatory_failure_score_cap or 49.0)
        warnings.append("Không đáp ứng yêu cầu tiên quyết bắt buộc (Hard Gate).")
    else:
        final_score = raw_final_score

    mandatory_failed = any(
        (item.get("mandatory") or item.get("type") == "REQUIRED")
        and item.get("status") in {"NOT_FOUND", "CONFLICTING"}
        for item in evaluated
    )
    if mandatory_failed and not hard_gate_failed:
        warnings.append("Có requirement bắt buộc chưa tìm thấy evidence trong CV.")

    req_scoring = [
        i
        for i in evaluated
        if (
            i.get("type") == "REQUIRED"
            or i.get("requirement_type") == "JD_REQUIRED_SKILL"
            or (i.get("mandatory") and not i.get("is_hard_constraint"))
        )
        and i.get("is_scorable", True) is True
        and not i.get("is_hard_constraint")
        and i.get("type") != "HARD_CONSTRAINT"
    ]
    pref_scoring = [
        i
        for i in evaluated
        if (
            i.get("type") == "PREFERRED"
            or i.get("requirement_type") == "JD_PREFERRED_SKILL"
            or (not i.get("mandatory") and i.get("type") != "RESPONSIBILITY")
        )
        and i.get("is_scorable", True) is True
        and not i.get("is_hard_constraint")
        and i.get("type") != "HARD_CONSTRAINT"
    ]

    req_matched = sum(1 for i in req_scoring if i.get("status") == "SUPPORTED")
    req_partial = sum(1 for i in req_scoring if i.get("status") == "PARTIALLY_SUPPORTED")
    req_missing = sum(1 for i in req_scoring if i.get("status") in ("NOT_FOUND", "CONFLICTING"))
    req_total = len(req_scoring)
    req_rate = round((req_matched + 0.5 * req_partial) / max(1, req_total), 2) if req_total else 1.0

    pref_matched = sum(1 for i in pref_scoring if i.get("status") == "SUPPORTED")
    pref_partial = sum(1 for i in pref_scoring if i.get("status") == "PARTIALLY_SUPPORTED")
    pref_missing = sum(1 for i in pref_scoring if i.get("status") in ("NOT_FOUND", "CONFLICTING"))
    pref_total = len(pref_scoring)
    pref_rate = round((pref_matched + 0.5 * pref_partial) / max(1, pref_total), 2) if pref_total else 1.0

    required_coverage = {
        "matched": req_matched,
        "partial": req_partial,
        "not_found": req_missing,
        "total": req_total,
        "rate": req_rate,
    }
    preferred_coverage = {
        "matched": pref_matched,
        "partial": pref_partial,
        "not_found": pref_missing,
        "total": pref_total,
        "rate": pref_rate,
    }

    groups_list = []
    for g_key, c_id, g_lbl in SIX_GROUPS:
        crit_entry = next((c for c in criteria if c["criterion_id"] == c_id), None)
        g_reqs = [
            i
            for i in evaluated
            if i.get("is_scorable", True) is True
            and (
                i.get("group") == g_key
                or (
                    not i.get("group")
                    and (
                        (
                            g_key == "skills"
                            and i.get("requirement_type") in {"JD_REQUIRED_SKILL", "JD_PREFERRED_SKILL", "JD_REQUIRED_QUALIFICATION", "JD_PREFERRED_QUALIFICATION"}
                        )
                        or (g_key == "responsibilities_task_fit" and i.get("requirement_type") == "JD_RESPONSIBILITY")
                        or (g_key == "experience_seniority" and i.get("requirement_type") == "JD_EXPERIENCE")
                        or (g_key == "education" and i.get("requirement_type") == "JD_EDUCATION")
                        or (g_key == "domain_industry" and i.get("requirement_type") == "JD_DOMAIN")
                        or (
                            g_key == "certifications_languages_other"
                            and i.get("requirement_type")
                            in {
                                "JD_CERTIFICATION",
                                "JD_LANGUAGE",
                                "JD_LOCATION",
                                "JD_WORK_MODE",
                                "JD_EMPLOYMENT_TYPE",
                                "JD_OTHER_REQUIREMENT",
                            }
                        )
                    )
                )
            )
        ]
        is_active = crit_entry is not None and bool(g_reqs)
        groups_list.append(
            {
                "group": g_key,
                "criterion_id": c_id,
                "label": g_lbl,
                "active": is_active,
                "weight": crit_entry["weight"] if crit_entry else 0.0,
                "score": crit_entry["raw_score"] if crit_entry else 0.0,
                "weighted_score": crit_entry["weighted_score"] if crit_entry else 0.0,
                "requirements": g_reqs,
            }
        )

    scorable_evaluated = [
        item for item in evaluated
        if item.get("is_scorable", True) is True
        and not item.get("is_hard_constraint")
        and item.get("type") != "HARD_CONSTRAINT"
    ]

    groups_map = {
        "matched": [item for item in scorable_evaluated if item["status"] == "SUPPORTED"],
        "partial": [item for item in scorable_evaluated if item["status"] == "PARTIALLY_SUPPORTED"],
        "missing": [
            item
            for item in scorable_evaluated
            if item.get("match_status") in {"NOT_FOUND", "CONFLICT"}
            or item["status"] in {"NOT_FOUND", "CONFLICTING"}
        ],
        "uncertain": [item for item in scorable_evaluated if item["status"] == "UNCERTAIN"],
    }

    # Deterministic Score Explanation & Category Contributions
    score_explanation, category_score_explanation = build_score_explanation(
        evaluated=evaluated,
        criteria=criteria,
        final_score=final_score,
        decimal_places=config.score_decimal_places,
    )
    structured_strengths, strengths = build_strengths(
        evaluated=evaluated,
        decimal_places=config.score_decimal_places,
    )
    structured_blockers, blockers = build_blockers(
        evaluated=evaluated,
        decimal_places=config.score_decimal_places,
    )

    requirement_summary = {
        "total": len(scorable_evaluated),
        "supported": len(groups_map["matched"]),
        "partial": len(groups_map["partial"]),
        "missing": len(groups_map["missing"]),
        "uncertain": len(groups_map["uncertain"]),
    }

    trace("COMPLETED")
    logger.info(
        "CV-JD match completed trace_id=%s match_id=%s candidate_id=%s job_id=%s requirements=%d score=%.1f",
        trace_id,
        match_id,
        candidate_id,
        job_id,
        len(requirements),
        final_score,
    )
    return {
        "trace_id": trace_id,
        "match_id": match_id,
        "candidate_id": candidate_id,
        "job_id": job_id,
        "document_id": document_id,
        "status": "COMPLETED",
        "final_score": final_score,
        "raw_final_score": raw_final_score,
        "rating": _rating(final_score, config),
        "hard_gate_failed": hard_gate_failed,
        "mandatory_requirement_failed": mandatory_failed,
        "eligibility_status": eligibility_status,
        "eligibility_reason": eligibility_reason,
        "eligibility_details": eligibility_details,
        "required_coverage": required_coverage,
        "preferred_coverage": preferred_coverage,
        "groups": groups_list,
        "criteria": criteria,
        "requirements": groups_map,
        "evaluated_requirements": evaluated,
        "score_explanation": score_explanation,
        "category_score_explanation": category_score_explanation,
        "requirement_summary": requirement_summary,
        "structured_strengths": structured_strengths,
        "strengths": strengths,
        "structured_blockers": structured_blockers,
        "blockers": blockers,
        "risks": blockers,
        "evidence": evidence_all,
        "retrieval_results": retrieval_results,
        "cv_chunks": chunks,
        "embedding_records": [
            {
                "chunk_id": chunk["chunk_id"],
                "model": retrieval_service.embedding.name,
                "dimensions": retrieval_service.embedding.dimensions,
                "vector": {str(key): value for key, value in vector.items()},
            }
            for chunk, vector in zip(chunks, retrieval_service.vector.vectors, strict=True)
        ],
        "structured_cv": normalize_structured_cv(cv_text, parsed_cv),
        "debug_trace": [
            {
                "requirement_id": item.get("requirement_id"),
                "original_text": item.get("source_sentence") or item.get("text"),
                "canonical_name": item.get("canonical_name") or item.get("normalized_value"),
                "concept_type": item.get("concept_type") or item.get("type"),
                "importance_level": item.get("importance_level"),
                "classification": item.get("match_classification"),
                "evidence_strength": item.get("evidence_strength"),
                "evidence_quotes": [e.get("text") for e in item.get("evidence", [])[:2]],
                "score": item.get("match_score"),
                "status": item.get("status"),
                "reason": item.get("reason") or item.get("comparison"),
            }
            for item in evaluated
        ],
        "warnings": warnings,
        "versions": {
            "pipeline": PIPELINE_VERSION,
            "cv_schema": SCHEMA_VERSION,
            "jd_schema": SCHEMA_VERSION,
            "normalization": "1.0",
            "chunking": "1.0-structural",
            "embedding_model": retrieval_service.embedding.name,
            "retrieval": "1.0-bm25-vector-rrf",
            "rubric": str((rubric or {}).get("version", "1.0")),
            "scoring": "1.0-dynamic",
        },
        "processing_trace": state_trace,
        "created_at": datetime.now(UTC).isoformat(),
    }
