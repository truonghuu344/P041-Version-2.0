from __future__ import annotations

import json
import re
import unicodedata
from functools import lru_cache
from html.parser import HTMLParser
from pathlib import Path
from typing import Any

from src.agents.tools.career_tools import TECH_SKILLS, collect_cv_skills, extract_known_terms

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
    return re.sub(r"\s+", " ", text).casefold().strip()


def _as_list(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if value:
        return [str(value).strip()]
    return []


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

    description = "\n".join(parser.job_content) or og_description
    location_match = re.search(r"\s(?:tại|in)\s(.+?)(?:\.|\|)", og_description, flags=re.IGNORECASE)
    location = location_match.group(1).strip() if location_match else "Chưa xác định"
    skills = extract_known_terms(f"{title}\n{description}", TECH_SKILLS)
    lowered = _search_text(f"{title} {description}")
    remote_type = "Hybrid" if "hybrid" in lowered else "Remote" if "remote" in lowered else "On-site"
    level = next(
        (label for token, label in (("intern", "Intern"), ("junior", "Junior"), ("senior", "Senior"), ("lead", "Lead")) if token in lowered),
        "Chưa xác định",
    )
    source_url = parser.canonical.strip()
    return {
        "job_id": path.stem,
        "job_title": title,
        "company_name": company.strip(),
        "location": [location],
        "job_level": level,
        "employment_type": "Full-time",
        "remote_type": remote_type,
        "domain_category": skills[0] if skills else "Công nghệ",
        "skills": skills,
        "clean_description": description,
        "source_url": source_url if source_url.startswith(("http://", "https://")) else None,
    }


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
        description = str(record.get("clean_description") or record.get("must_have_text") or "").strip()
        item = {
            "source_id": source_id,
            "title": str(record.get("job_title") or "Vị trí chưa đặt tên").strip(),
            "company": str(record.get("company_name") or "Doanh nghiệp chưa xác định").strip(),
            "location": ", ".join(locations) or "Chưa xác định",
            "job_level": str(record.get("job_level") or "Chưa xác định").strip(),
            "employment_type": str(record.get("employment_type") or "Chưa xác định").strip(),
            "remote_type": str(record.get("remote_type") or "Chưa xác định").strip(),
            "domain": str(record.get("domain_category") or "Khác").strip(),
            "salary_range": str(record.get("salary_range") or "").strip(),
            "skills": skills,
            "description": description,
            "source_url": str(record.get("source_url") or "").strip() or None,
        }
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


def _score_job_for_cv(job: dict[str, Any], cv_text: str, parsed: dict[str, Any]) -> dict[str, Any]:
    cv_skills = collect_cv_skills(cv_text, parsed)
    cv_haystack = _search_text(f"{cv_text} {' '.join(cv_skills)} {parsed.get('summary', '')}")
    job_skills = list(job.get("skills") or [])
    matched = [skill for skill in job_skills if _search_text(skill) in cv_haystack]

    title_tokens = {
        token
        for token in re.findall(r"[a-z0-9+#.]{2,}", _search_text(f"{job.get('title', '')} {job.get('domain', '')}"))
        if token not in {"intern", "junior", "senior", "engineer", "developer", "specialist"}
    }
    domain_hits = sum(1 for token in title_tokens if token in cv_haystack)
    skill_score = (len(matched) / len(job_skills) * 75.0) if job_skills else 25.0
    domain_score = min(20.0, domain_hits * 6.0)
    evidence_score = 5.0 if parsed.get("experience") or parsed.get("projects") else 0.0
    match_score = round(min(100.0, skill_score + domain_score + evidence_score), 1)

    result = {key: value for key, value in job.items() if not key.startswith("_")}
    result.update(
        {
            "match_score": match_score,
            "matched_skills": matched[:8],
            "missing_skills": [skill for skill in job_skills if skill not in matched][:8],
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
