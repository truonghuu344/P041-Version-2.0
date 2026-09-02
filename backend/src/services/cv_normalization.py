"""Canonical CV data contract used by the editor, preview, and PDF renderer.

This module deliberately cleans *presentation syntax*, not domain punctuation: the
normaliser must never turn C#, C++, .NET, CI/CD, email addresses, or URLs into
different values.
"""
from __future__ import annotations

import copy
import html
import re
import unicodedata
from typing import Any

CV_SECTIONS = ("summary", "skills", "experience", "projects", "education", "certifications")
ITEM_SECTIONS = ("experience", "projects", "education", "certifications")
CONTACT_KEYS = ("email", "phone", "location", "linkedin", "github", "website")
_STATUS_VALUES = {"in progress", "processing", "pending", "draft", "completed", "ready"}
_EMPTY_SKILL_VALUES = {"-", "*", "•", "…", "...", "n/a", "na", "none", "null", "unknown", "không", "chưa có"}
_HEADINGS = {
    "summary": "summary|professional summary|objective|profile|tóm tắt|mục tiêu nghề nghiệp",
    "skills": "skills|technical skills|core skills|kỹ năng|kỹ năng chuyên môn",
    "experience": "experience|work experience|employment|kinh nghiệm|kinh nghiệm làm việc",
    "projects": "projects|featured projects|dự án|dự án tiêu biểu",
    "education": "education|academic background|học vấn",
    "certifications": "certifications?|activities|chứng chỉ|hoạt động",
}


def _fold(value: Any) -> str:
    return re.sub(r"\s+", " ", unicodedata.normalize("NFKC", str(value or "")).casefold()).strip()


def clean_text(value: Any) -> str:
    """Remove Markdown/HTML presentation wrappers while retaining semantic text."""
    text = html.unescape(str(value or "")).replace("\r\n", "\n").replace("\r", "\n")
    # Keep both the visible label and the target so a portfolio URL is not lost.
    text = re.sub(r"\[([^\]]+)\]\((https?://[^\s)]+)\)", r"\1 (\2)", text)
    text = re.sub(r"<\s*br\s*/?\s*>", "\n", text, flags=re.I)
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"(?m)^\s{0,3}#{1,6}\s+", "", text)
    # Require whitespace after Markdown list markers so ``**bold**`` is not
    # mistaken for two bullets.
    text = re.sub(r"(?m)^\s*(?:(?:[-*+]\s+)|(?:•\s+)){1,3}", "", text)
    # Markdown emphasis is only syntax when it wraps a word/phrase.
    text = re.sub(r"\*\*([^*\n]+)\*\*", r"\1", text)
    text = re.sub(r"__([^_\n]+)__", r"\1", text)
    text = re.sub(r"(?<!\w)\*([^*\n]+)\*(?!\w)", r"\1", text)
    text = re.sub(r"(?<!\w)_([^_\n]+)_(?!\w)", r"\1", text)
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in text.split("\n")]
    return "\n".join(line for line in lines if line).strip()


def _strings(value: Any) -> list[str]:
    if isinstance(value, str):
        values = re.split(r"\n|(?<!\w)[•](?!\w)", value)
    elif isinstance(value, list):
        values = value
    else:
        values = []
    result: list[str] = []
    seen: set[str] = set()
    for item in values:
        cleaned = clean_text(item)
        key = _fold(cleaned)
        if cleaned and key not in _EMPTY_SKILL_VALUES and key not in seen:
            seen.add(key)
            result.append(cleaned)
    return result


def _clean_item(value: Any) -> dict[str, Any] | None:
    if isinstance(value, str):
        value = {"title": value}
    if not isinstance(value, dict):
        return None
    item: dict[str, Any] = {}
    aliases = {"name": "title", "position": "role", "job_title": "role", "school_name": "school", "organization": "company", "date": "period", "time": "period"}
    for key, raw in value.items():
        if key.startswith("_") or raw in (None, "", [], {}):
            continue
        key = aliases.get(key, key)
        if key in {"bullets", "highlights", "technologies", "tech_stack"}:
            canonical = "bullets" if key in {"bullets", "highlights"} else "technologies"
            item[canonical] = _strings(raw)
        elif isinstance(raw, str):
            cleaned = clean_text(raw)
            if cleaned:
                item[key] = cleaned
        elif isinstance(raw, (int, float)):
            item[key] = raw
    # A parser often emits the same content as description, summary and bullets.
    for duplicate_key in ("summary", "details"):
        if item.get(duplicate_key) and _fold(item.get(duplicate_key)) == _fold(item.get("description")):
            item.pop(duplicate_key)
    if item.get("bullets"):
        descriptions = {_fold(item.get(k)) for k in ("description", "summary", "details") if item.get(k)}
        item["bullets"] = [bullet for bullet in item["bullets"] if _fold(bullet) not in descriptions]
    return item or None


def _item_key(item: dict[str, Any], section: str) -> str:
    if section == "projects":
        # Dates may be omitted by one parser pass, but two projects with the
        # same title are duplicate entries, not separate work.
        return _fold(item.get("title") or item.get("name"))
    if section == "education":
        return "|".join(_fold(item.get(key)) for key in ("school", "degree", "title", "name"))
    primary = "school" if section == "education" else "title"
    identity = item.get(primary) or item.get("name") or item.get("degree") or item.get("company") or item.get("role")
    # Dedupe only the same entry, never a keyword in two distinct jobs.
    return "|".join(_fold(item.get(key)) for key in ("title", "role", "company", "school", "degree", "period", "start_date", "end_date")) or _fold(identity)


def _markdown_sections(raw_text: str) -> tuple[str, dict[str, list[str]]]:
    name = ""
    sections: dict[str, list[str]] = {key: [] for key in CV_SECTIONS}
    current: str | None = None
    for raw in str(raw_text or "").replace("\r", "").split("\n"):
        heading = re.match(r"^\s*(#{1,6})\s+(.+?)\s*$", raw)
        if heading:
            label = _fold(clean_text(heading.group(2)))
            found = next((key for key, pattern in _HEADINGS.items() if re.fullmatch(f"(?:{pattern})", label, re.I)), None)
            if found:
                current = found
            elif len(heading.group(1)) == 1 and not name:
                name = clean_text(heading.group(2))
                current = None
            else:
                current = None
            continue
        if current and clean_text(raw):
            sections[current].append(clean_text(raw))
    return name, sections


def normalize_cv_data(data: dict[str, Any] | None, *, title: str = "", source_text: str = "") -> dict[str, Any]:
    """Return the one safe structured representation accepted by every renderer."""
    source = copy.deepcopy(data or {})
    markdown_name, markdown = _markdown_sections(source_text)
    personal_source = source.get("personal_info") or source.get("contact") or {}
    personal_source = personal_source if isinstance(personal_source, dict) else {}
    personal: dict[str, str] = {}
    name = clean_text(personal_source.get("full_name") or personal_source.get("name") or source.get("full_name") or markdown_name)
    if _fold(name) in _STATUS_VALUES:
        name = ""  # never allow workflow state to become candidate identity
    if name:
        personal["full_name"] = name
    for key in CONTACT_KEYS:
        value = clean_text(personal_source.get(key) or source.get(key))
        if value:
            personal[key] = value

    result: dict[str, Any] = {"personal_info": personal}
    result["headline"] = clean_text(source.get("headline") or source.get("title") or source.get("professional_title"))
    if _fold(result["headline"]) in _STATUS_VALUES or _fold(result["headline"]).startswith("cv "):
        result["headline"] = ""
    summary = clean_text(source.get("summary") or source.get("professional_summary"))
    if not summary and markdown["summary"]:
        summary = " ".join(markdown["summary"])
    # Contact belongs exclusively in the header/contact fields, never in the
    # Professional Summary.  Removing a contact-only line does not remove CV
    # evidence; it removes a parser-placement artifact.
    contact_values = [value for value in personal.values() if value]
    summary_lines = []
    for line in summary.split("\n"):
        compact = _fold(line)
        is_contact_only_line = bool(
            re.fullmatch(
                r"\s*(?:contact|liên hệ|email|phone|điện thoại|tel|mobile|linkedin|github|website)?\s*[:\-–—]?\s*(?:[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:https?://|www\.)\S+|(?:\+?\d[\d\s().-]{7,}\d))\s*",
                line,
                re.I,
            )
        )
        if compact.startswith(("contact:", "liên hệ:", "email:", "phone:", "điện thoại:", "linkedin:", "github:", "website:")) or is_contact_only_line:
            continue
        if any(_fold(value) == compact for value in contact_values):
            continue
        summary_lines.append(line)
    summary = " ".join(summary_lines).strip()
    result["summary"] = summary
    skills = _strings(source.get("skills") or source.get("hard_skills") or source.get("technical_skills"))
    if not skills and markdown["skills"]:
        skills = _strings(markdown["skills"])
    result["skills"] = skills
    for section in ITEM_SECTIONS:
        raw_items = source.get(section)
        if not raw_items and markdown[section]:
            raw_items = [{"title": line} for line in markdown[section]]
        if isinstance(raw_items, dict):
            raw_items = [raw_items]
        items = [_clean_item(item) for item in raw_items] if isinstance(raw_items, list) else []
        seen: set[str] = set()
        result[section] = []
        for item in items:
            if not item:
                continue
            key = _item_key(item, section)
            if key and key in seen:
                continue
            if key:
                seen.add(key)
            result[section].append(item)
    result["template_name"] = str(source.get("template_name") or "classic")
    return result


def normalized_cv_errors(original: dict[str, Any] | None, normalized: dict[str, Any]) -> list[str]:
    """Quality guard run before export; it checks structure, not visual decoration."""
    errors: list[str] = []
    original_normalized = normalize_cv_data(original)
    for section in CV_SECTIONS:
        if original_normalized.get(section) and not normalized.get(section):
            errors.append(f"A valid source section disappeared: {section}.")
    source_personal = original_normalized.get("personal_info", {})
    current_personal = normalized.get("personal_info", {})
    if source_personal.get("full_name") and not current_personal.get("full_name"):
        errors.append("Candidate name is missing or malformed.")
    for key in ("email", "phone"):
        if source_personal.get(key) and not current_personal.get(key):
            errors.append(f"Candidate {key} disappeared.")
    for value in _walk(normalized):
        if re.search(r"(?m)^\s*#{1,6}\s+|\*\*[^*]+\*\*|^\s*(?:[-*+]\s*){2,}", value):
            errors.append("Raw Markdown remains in normalized CV data.")
            break
    return errors


def _walk(value: Any):
    if isinstance(value, dict):
        for item in value.values():
            yield from _walk(item)
    elif isinstance(value, list):
        for item in value:
            yield from _walk(item)
    elif isinstance(value, str):
        yield value
