from __future__ import annotations

import json
import re
import unicodedata
from functools import lru_cache
from html.parser import HTMLParser
from pathlib import Path
from typing import Any

from src.agents.tools.career_tools import TECH_SKILLS, collect_cv_skills, extract_known_terms
from src.services.text_cleaning import (
    derive_metadata_from_text,
    heal_soft_wrapped_lines,
    resolve_job_level,
    split_title_decorations,
    strip_redaction_markers,
)

APP_ROOT = Path(__file__).resolve().parents[2]
# In Docker the application and data directories both live in /app. In local
# development the Python application lives in backend/ while shared fixtures
# remain at the repository root. Do not select backend/data merely because the
# directory exists: developer tools can create an empty backend/data folder.
_docker_data_root = APP_ROOT / "data"
_docker_catalog_is_available = (
    (_docker_data_root / "clean" / "jds_clean.json").is_file()
    and any((_docker_data_root / "jds" / "raw").glob("JD-*.html"))
)
PROJECT_ROOT = APP_ROOT if _docker_catalog_is_available else APP_ROOT.parent
RAW_JD_DIR = PROJECT_ROOT / "data" / "jds" / "raw"
CLEAN_JD_PATH = PROJECT_ROOT / "data" / "clean" / "jds_clean.json"


def _search_text(value: Any) -> str:
    text = unicodedata.normalize("NFD", str(value or ""))
    text = "".join(char for char in text if unicodedata.category(char) != "Mn")
    # `đ`/`Đ` are not decomposed by Unicode NFD, unlike vowel accents.
    # Fold them explicitly so Vietnamese values compare consistently.
    text = text.replace("đ", "d").replace("Đ", "D")
    text = re.sub(r"\bfull\s*[- ]\s*stack\b", "fullstack", text, flags=re.IGNORECASE)
    text = re.sub(r"\bon\s*[- ]?\s*site\b", "onsite", text, flags=re.IGNORECASE)
    return re.sub(r"\s+", " ", text).casefold().strip()


def _as_list(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if value:
        return [str(value).strip()]
    return []


def _candidate_facing_lines(value: Any, *, limit: int = 8) -> list[str]:
    """Return concise, non-empty JD lines appropriate for a student UI."""
    return [line for line in _as_list(value) if len(line) >= 3][:limit]


# Sources contain spelling variants such as `Ha Noi`, `Ha_Noi`, `TP.HCM`, and
# a work model appended to the city.  Use one canonical location for all job
# facets; work model belongs in `remote_type`, not in the location label.
_CANONICAL_LOCATIONS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("Hà Nội", ("ha noi", "hanoi", "ha_noi", "ha-noi")),
    ("TP. Hồ Chí Minh", ("ho chi minh", "ho chi minh city", "hcm", "tphcm", "tp hcm", "saigon")),
    ("Đà Nẵng", ("da nang", "danang", "da_nang")),
    ("Bình Dương", ("binh duong", "binh_duong")),
    ("Bà Rịa - Vũng Tàu", ("ba ria vung tau", "ba_ria_vung_tau", "vung tau")),
    ("Quy Nhơn", ("quy nhon", "quy_nhon")),
    ("Hải Phòng", ("hai phong", "hai_phong")),
    ("Cần Thơ", ("can tho", "can_tho")),
)
_UNKNOWN_LOCATION_KEYS = {"", "unknown", "unknown location", "n/a", "na", "chua xac dinh"}


def canonicalize_job_location(value: Any) -> str | None:
    """Return a canonical primary city, or ``None`` when it is unknown."""
    raw = re.sub(r"\s+", " ", str(value or "").replace("_", " ")).strip()
    normalized = _search_text(raw)
    if normalized in _UNKNOWN_LOCATION_KEYS:
        return None
    if normalized in {"remote", "work from home", "wfh"}:
        return "Remote"
    for canonical, aliases in _CANONICAL_LOCATIONS:
        if any(alias in normalized for alias in aliases):
            return canonical
    return raw or None


class _RawJobHTMLParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.metadata: dict[str, str] = {}
        self.canonical = ""
        self.job_content: list[str] = []
        self._in_job_content = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = {key: value or "" for key, value in attrs}
        if tag == "meta" and attributes.get("property") in {"og:title", "og:description"}:
            self.metadata[attributes["property"]] = attributes.get("content", "")
        elif tag == "link" and "canonical" in attributes.get("rel", "").split():
            self.canonical = attributes.get("href", "")
        elif tag == "section" and "job-content" in attributes.get("class", "").split():
            self._in_job_content = True

    def handle_endtag(self, tag: str) -> None:
        if tag == "section" and self._in_job_content:
            self._in_job_content = False

    def handle_data(self, data: str) -> None:
        value = re.sub(r"\s+", " ", data).strip()
        if self._in_job_content and value:
            self.job_content.append(value)


def _parse_raw_job(path: Path) -> dict[str, Any]:
    parser = _RawJobHTMLParser()
    parser.feed(path.read_text(encoding="utf-8", errors="ignore"))
    og_title = parser.metadata.get("og:title", "").strip()
    og_description = parser.metadata.get("og:description", "").strip()

    company = "Doanh nghiệp chưa xác định"
    title = og_title or path.stem
    if " tuyển dụng " in og_title:
        company, title = og_title.split(" tuyển dụng ", 1)
        title = re.sub(r"\s+chất\s*\|\s*ITviec\s*$", "", title, flags=re.IGNORECASE).strip()
    elif " hiring " in og_title:
        company, title = og_title.split(" hiring ", 1)
        title = title.split(" in ", 1)[0].strip()

    description = strip_redaction_markers("\n".join(parser.job_content) or og_description)
    location_match = re.search(r"\s(?:tại|in)\s(.+?)(?:\.|\|)", og_description, flags=re.IGNORECASE)
    location = location_match.group(1).strip() if location_match else "Chưa xác định"
    title_parts = split_title_decorations(title)
    skills = extract_known_terms(f"{title_parts['title']}\n{description}", TECH_SKILLS)
    lowered = _search_text(f"{title_parts['title']} {description}")
    remote_type = "Hybrid" if "hybrid" in lowered else "Remote" if "remote" in lowered else "On-site"
    source_metadata = derive_metadata_from_text(description)
    level = resolve_job_level(
        title_level_hint=title_parts.get("level"),
        position_level=source_metadata.get("position_level"),
        experience_level=source_metadata.get("experience_level"),
        current_level=None,
    )
    employment = source_metadata.get(
        "employment_type",
        "Full-time" if "full time" in lowered or "toan thoi gian" in lowered else "Chưa xác định",
    )
    source_url = parser.canonical.strip()
    source_url_val = source_url if source_url.startswith(("http://", "https://")) else None
    source_name = resolve_source_name(None, source_url_val)
    full_text = f"{title_parts['title']}\n{description}"
    return {
        "job_id": path.stem,
        "job_title": title_parts["title"],
        "company_name": company.strip(),
        "location": [location],
        "job_level": level,
        "employment_type": employment,
        "remote_type": remote_type,
        "domain_category": skills[0] if skills else "Công nghệ",
        "skills": skills,
        "must_have_skills": skills,
        "nice_to_have_skills": [],
        "clean_description": description,
        "source": source_name,
        "source_url": source_url_val,
        "openings": _extract_openings(full_text),
        "deadline": _extract_application_deadline(full_text),
    }


def resolve_source_name(source: str | None, source_url: str | None) -> str | None:
    """Resolve display name for the recruitment platform."""
    if source and str(source).strip() and str(source).strip().lower() not in {"unknown", "n/a", "none"}:
        return str(source).strip()
    if not source_url:
        return None
    url = str(source_url).lower()
    if "linkedin.com" in url:
        return "LinkedIn"
    if "topcv.vn" in url:
        return "TopCV"
    if "vietnamworks.com" in url:
        return "VietnamWorks"
    if "itviec.com" in url:
        return "ITviec"
    if "joboko.com" in url:
        return "Joboko"
    if "careerbuilder.vn" in url:
        return "CareerBuilder"
    return None


def _extract_openings(text: str) -> int | None:
    """Extract recruitment quantity if present in the JD text."""
    patterns = [
        r"(?:số lượng|so luong|quantity|hạn ngạch|headcount|chỉ tiêu)\s*(?:cần tuyển|tuyển dụng)?\s*[:\-]?\s*(\d+)",
        r"(?:cần tuyển|tuyển|tuyển dụng)\s*[:\-]?\s*(\d+)\s*(?:người|nhân sự|vị trí|candidates|bạn|thành viên|lập trình viên|kỹ sư|developer)",
        r"\b(?:sl)\s*[:\-]?\s*(\d+)",
    ]
    for pat in patterns:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            val = int(m.group(1))
            if 1 <= val <= 500:
                return val
    return None


def _extract_application_deadline(text: str) -> str | None:
    """Extract application deadline if present in the JD text."""
    label = r"(?:hạn\s*nộp[^:\-\n]{0,20}?|han\s*nop[^:\-\n]{0,20}?|deadline[^:\-\n]{0,20}?|hạn\s*chót[^:\-\n]{0,10}?|ngày\s*hết\s*hạn)"
    patterns = (
        rf"{label}\s*[:\-]?\s*(\d{{1,2}})\s*[/-]\s*(\d{{1,2}})\s*[/-]\s*(\d{{4}})",
        rf"{label}\s*[:\-]?\s*(\d{{4}})-(\d{{1,2}})-(\d{{1,2}})",
    )
    for pattern in patterns:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            first, second, third = m.groups()
            if len(first) == 4:
                year, month, day = int(first), int(second), int(third)
            else:
                day, month, year = int(first), int(second), int(third)
            if 1 <= month <= 12 and 1 <= day <= 31:
                return f"{year:04d}-{month:02d}-{day:02d}"
    return None


@lru_cache(maxsize=1)
def load_enterprise_job_catalog() -> tuple[dict[str, Any], ...]:
    """Load only cleaned jobs that still have their source HTML in data/jds/raw."""
    raw_paths = sorted(RAW_JD_DIR.glob("JD-*.html"))
    if not CLEAN_JD_PATH.is_file() or not raw_paths:
        return ()

    records = json.loads(CLEAN_JD_PATH.read_text(encoding="utf-8"))
    records_by_id = {str(record.get("job_id") or "").casefold(): record for record in records}
    catalog: list[dict[str, Any]] = []
    for raw_path in raw_paths:
        record = records_by_id.get(raw_path.stem.casefold()) or _parse_raw_job(raw_path)
        source_id = raw_path.stem
        locations = _as_list(record.get("location"))
        skills = _as_list(record.get("skills") or record.get("must_have_skills"))
        must_skills = _as_list(record.get("must_have_skills"))
        nice_skills = _as_list(record.get("nice_to_have_skills"))
        if not must_skills and skills:
            must_skills = skills

        description = strip_redaction_markers(
            str(record.get("clean_description") or record.get("must_have_text") or "").strip()
        )
        # Ghép lại các dòng bị trang nguồn ngắt giữa câu để hiển thị và
        # tách yêu cầu chính xác hơn.
        description = "\n".join(heal_soft_wrapped_lines(description))
        must_have = record.get("must_have") if isinstance(record.get("must_have"), dict) else {}

        # Làm sạch tiêu đề và suy ra metadata thật từ bản tin thay vì tin
        # cứng giá trị cũ (ví dụ job_level="Intern" cho vị trí [Junior] 1-2 năm).
        title_parts = split_title_decorations(str(record.get("job_title") or "Vị trí chưa đặt tên"))
        source_metadata = derive_metadata_from_text(description)

        requirements = _candidate_facing_lines(
            record.get("requirements") or must_have.get("requirements")
        )
        responsibilities = _candidate_facing_lines(record.get("responsibilities"))
        requirements = [strip_redaction_markers(line) for line in requirements if line.strip()]
        responsibilities = [strip_redaction_markers(line) for line in responsibilities if line.strip()]

        resolved_level = resolve_job_level(
            title_level_hint=title_parts.get("level"),
            position_level=source_metadata.get("position_level"),
            experience_level=source_metadata.get("experience_level"),
            current_level=str(record.get("job_level") or ""),
        )
        # employment_type: chỉ nhận khi bản tin nêu rõ, không gán cứng Full-time.
        derived_employment = source_metadata.get("employment_type")
        record_employment = str(record.get("employment_type") or "").strip()
        lowered_desc = _search_text(f"{title_parts['title']} {description}")
        if derived_employment:
            employment_type_value = derived_employment
        elif record_employment and record_employment not in {"Chưa xác định", ""}:
            employment_type_value = record_employment
        elif any(k in lowered_desc for k in ("full time", "toan thoi gian")):
            employment_type_value = "Full-time"
        else:
            employment_type_value = "Chưa xác định"

        full_text = f"{title_parts['title']}\n{description}\n{' '.join(requirements)}"
        raw_qty = record.get("quantity") or record.get("openings") or record.get("number_of_positions")
        openings = int(raw_qty) if raw_qty and str(raw_qty).isdigit() else _extract_openings(full_text)

        raw_deadline = record.get("deadline") or record.get("application_deadline")
        deadline = str(raw_deadline).strip() if raw_deadline else _extract_application_deadline(full_text)

        raw_meta = record.get("metadata") if isinstance(record.get("metadata"), dict) else {}
        raw_posted = raw_meta.get("crawl_date") or raw_meta.get("cleaned_at") or record.get("created_at") or record.get("posted_at")
        posted_at = str(raw_posted).strip() if raw_posted else None

        source_url_val = str(record.get("source_url") or "").strip() or None
        source_name_val = resolve_source_name(record.get("source"), source_url_val)

        raw_salary = str(record.get("salary_range") or record.get("salary") or "").strip()
        salary_val = raw_salary if raw_salary and raw_salary not in {"Chưa xác định", ""} else None

        raw_applicant = record.get("applicant_count")
        applicant_count = int(raw_applicant) if raw_applicant is not None and str(raw_applicant).isdigit() else None

        company_logo_val = str(record.get("company_logo") or record.get("logo_url") or "").strip() or None

        item = {
            "source_id": source_id,
            "title": title_parts["title"],
            "company": str(record.get("company_name") or "Doanh nghiệp chưa xác định").strip(),
            "location": ", ".join(locations) or "Chưa xác định",
            "job_level": resolved_level,
            "seniority": resolved_level,
            "employment_type": employment_type_value,
            "remote_type": str(record.get("remote_type") or "Chưa xác định").strip(),
            "work_mode": str(record.get("remote_type") or "Chưa xác định").strip(),
            "domain": str(record.get("domain_category") or "Khác").strip(),
            "salary_range": salary_val or "",
            "salary": salary_val,
            "openings": openings,
            "quantity": openings,
            "deadline": deadline,
            "posted_at": posted_at,
            "applicant_count": applicant_count,
            "company_logo": company_logo_val,
            "source": source_name_val,
            "source_name": source_name_val,
            "skills": skills,
            "must_have_skills": must_skills,
            "required_skills": must_skills,
            "nice_to_have_skills": nice_skills,
            "preferred_skills": nice_skills,
            "description": description,
            "responsibilities": responsibilities,
            "requirements": requirements,
            "source_url": source_url_val,
        }
        item["location"] = canonicalize_job_location(", ".join(locations)) or item["location"]
        item["_search"] = _search_text(
            " ".join(
                [
                    item["title"],
                    item["company"],
                    item["location"],
                    item["domain"],
                    " ".join(skills),
                    description,
                ]
            )
        )
        catalog.append(item)
    return tuple(catalog)


def _contains_skill(haystack_folded: str, skill: str) -> bool:
    """Khớp kỹ năng theo biên từ; kỹ năng ngắn (C, Go, R) không dùng substring."""
    needle = _search_text(skill)
    if not needle:
        return False
    return bool(re.search(rf"(?<!\w){re.escape(needle)}(?!\w)", haystack_folded))


def _score_job_for_cv(job: dict[str, Any], cv_text: str, parsed: dict[str, Any]) -> dict[str, Any]:
    cv_skills = collect_cv_skills(cv_text, parsed)
    cv_haystack = _search_text(f"{cv_text} {' '.join(cv_skills)} {parsed.get('summary', '')}")
    job_skills = list(job.get("skills") or [])
    matched = [skill for skill in job_skills if _contains_skill(cv_haystack, skill)]

    title_tokens = {
        token
        for token in re.findall(r"[a-z0-9+#.]{2,}", _search_text(f"{job.get('title', '')} {job.get('domain', '')}"))
        if token not in {"intern", "junior", "senior", "engineer", "developer", "specialist"}
    }
    domain_hits = sum(1 for token in title_tokens if token in cv_haystack.split())
    # Thang điểm minh bạch: 75% kỹ năng + 20% lĩnh vực + 5% bằng chứng thực tế
    # trong CV (kinh nghiệm/dự án). Không dùng số điểm mẫu.
    skill_score = (len(matched) / len(job_skills) * 75.0) if job_skills else 25.0
    domain_score = min(20.0, domain_hits * 6.0)
    evidence_records = sum(len(parsed.get(key) or []) for key in ("experience", "projects"))
    evidence_score = 5.0 if evidence_records else 0.0
    match_score = round(min(100.0, skill_score + domain_score + evidence_score), 1)

    top_strengths = [f"Đáp ứng tốt kỹ năng: {s}" for s in matched[:4]]
    missing = [skill for skill in job_skills if skill not in matched]
    top_gaps = [f"Cần bổ sung: {s}" for s in missing[:4]]
    breakdown = [
        {
            "criterion_id": "must_have",
            "label": "Yêu cầu cốt lõi",
            "raw_score": round(skill_score / 0.75 if job_skills else 50.0, 1),
            "reason": f"Đáp ứng {len(matched)}/{len(job_skills)} kỹ năng yêu cầu",
        },
        {
            "criterion_id": "domain",
            "label": "Lĩnh vực chuyên môn",
            "raw_score": round(min(100.0, domain_hits * 30.0), 1),
            "reason": f"Phù hợp {domain_hits} từ khóa lĩnh vực giữa JD và CV",
        },
        {
            "criterion_id": "experience",
            "label": "Kinh nghiệm & Dự án",
            "raw_score": round(min(100.0, evidence_records * 25.0), 1),
            "reason": f"CV có {evidence_records} bản ghi kinh nghiệm/dự án",
        },
    ]

    result = {key: value for key, value in job.items() if not key.startswith("_")}
    result.update(
        {
            "match_score": match_score,
            "display_fit_score": match_score,
            "score_scale": "prefilter",
            "matched_skills": matched[:8],
            "missing_skills": missing[:8],
            "top_strengths": top_strengths,
            "top_gaps": top_gaps,
            "score_breakdown": breakdown,
        }
    )
    return result


def search_enterprise_jobs(
    *,
    query: str = "",
    cv_text: str | None = None,
    parsed_cv: dict[str, Any] | None = None,
    limit: int = 60,
) -> tuple[list[dict[str, Any]], int]:
    catalog = load_enterprise_job_catalog()
    normalized_query = _search_text(query)
    query_terms = normalized_query.split()
    filtered = [job for job in catalog if all(term in job["_search"] for term in query_terms)]
    total = len(filtered)

    if cv_text is not None:
        ranked = [_score_job_for_cv(job, cv_text, parsed_cv or {}) for job in filtered]
        ranked.sort(key=lambda job: (-float(job["match_score"]), job["title"].casefold()))
        suitable = [job for job in ranked if job["match_score"] >= 8.0]
        filtered_results = suitable or ranked[:10]
    else:
        filtered_results = [
            {key: value for key, value in job.items() if not key.startswith("_")} for job in filtered
        ]
        filtered_results.sort(key=lambda job: (job["title"].casefold(), job["company"].casefold()))

    return filtered_results[:limit], total
