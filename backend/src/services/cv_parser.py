"""MinerU-only document extraction and deterministic CV structuring."""
from __future__ import annotations

import re
from typing import Any, Literal

from src.agents.tools.career_tools import SOFT_SKILLS, TECH_SKILLS, extract_known_terms
from src.config import get_settings

_ALIASES = {
    "education": ("education", "học vấn", "đào tạo", "academic"),
    "experience": ("experience", "kinh nghiệm", "work history", "employment"),
    "projects": ("projects", "project", "dự án"),
    "summary": ("summary", "profile", "objective", "mục tiêu", "giới thiệu"),
    "skills": ("skills", "technical skills", "kỹ năng"),
    "certifications": ("certifications", "certificates", "chứng chỉ"),
    "languages": ("languages", "language", "ngoại ngữ"),
    "awards": ("awards", "award", "giải thưởng"),
    "publications": ("publications", "publication", "công bố"),
    "volunteer": ("volunteer", "volunteering", "tình nguyện"),
    "other": ("other", "additional information", "thông tin khác"),
}


def sanitize_extracted_text(text: str) -> str:
    text = text.replace("\x00", " ")
    text = "".join(char for char in text if char in "\n\r\t" or ord(char) >= 32)
    return "\n".join(line.rstrip() for line in text.replace("\r\n", "\n").replace("\r", "\n").split("\n")).strip()


async def extract_text_from_document(file_bytes: bytes, filename: str, content_type: str = "") -> str:
    """Extract PDF/DOCX/image content exclusively via MinerU."""
    del content_type
    suffix = filename.casefold().rsplit(".", 1)[-1] if "." in filename else ""
    if suffix not in {"pdf", "docx", "jpg", "jpeg", "png"}:
        raise ValueError("UPLOAD_002: Định dạng file không hỗ trợ.")
    from src.services.mineru_ocr import MinerUError, extract_text_with_mineru
    try:
        text = sanitize_extracted_text(await extract_text_with_mineru(file_bytes, filename))
    except MinerUError as exc:
        raise ValueError(str(exc)) from exc
    if not text:
        raise ValueError("OCR_002: MinerU không trả về văn bản có thể sử dụng.")
    return text


def _lines(text: str) -> list[str]:
    text = re.sub(r"[\ue000-\uf8ff]", " ", text)
    return [re.sub(r"\s+", " ", line).strip(" •●▪-\t") for line in text.splitlines() if line.strip()]


def _sections(lines: list[str]) -> dict[str, list[str]]:
    result = {key: [] for key in _ALIASES}
    current: str | None = None
    for line in lines:
        normalized = line.casefold().strip(" :|#-")
        section = next((key for key, aliases in _ALIASES.items() if normalized in aliases), None)
        if section:
            current = section
        elif current:
            result[current].append(line)
    return result


def _records(lines: list[str]) -> list[dict[str, str]]:
    return [{"title": line[:120], "organization": "", "period": "", "description": line, "evidence_quote": line} for line in lines[:4]]


def _repair_fragmented_vietnamese(value: str) -> str:
    """Join OCR-split Vietnamese/mojibake character fragments without touching words."""
    value = re.sub(r"(?<=[A-Za-z])\s+(?=[ÅÆĂá])", "", value)
    value = re.sub(r"(?<=[©¡¯°»™])\s+(?=[a-zá])", "", value)
    # OCR can split a Unicode Vietnamese word into individual characters, e.g.
    # ``V ũ H ữ u Tr ư ờ ng``. A new capitalized token begins the next word;
    # non-capitalized fragments belong to the preceding word.
    words: list[str] = []
    for token in value.split():
        if not words or token[:1].isupper():
            words.append(token)
        else:
            words[-1] += token
    return " ".join(words).strip()


def _is_name_candidate(line: str) -> bool:
    normalized = line.casefold().strip(" :|#-")
    excluded = {
        "soft skills", "technical skills", "skills", "interests", "summary", "profile",
        "objective", "education", "experience", "work history", "projects", "languages",
        "teamwork", "teamwork & collaboration", "learning new things",
    }
    return (
        normalized not in excluded
        and 2 <= len(line.split()) <= 12
        and not re.search(r"[@\d&]", line)
        and all(char.isalpha() or char in " '-©¡¯°»™Ă" for char in line)
    )


def parse_cv_locally(raw_text: str) -> dict[str, Any]:
    lines, sections = _lines(raw_text), _sections(_lines(raw_text))
    hard, soft = extract_known_terms(raw_text, TECH_SKILLS), extract_known_terms(raw_text, SOFT_SKILLS)
    email = re.search(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", raw_text)
    phone = re.search(r"(?<!\d)(?:\+?84|0)[\s.()-]*\d(?:[\s.()-]*\d){7,9}(?!\d)", raw_text)
    name = next((_repair_fragmented_vietnamese(line) for line in lines if _is_name_candidate(line)), "")
    location = next(
        (_repair_fragmented_vietnamese(line) for line in lines if re.search(r"\b(?:tp\.?|thành phố|tỉnh|quận|phường|xã)\b", line, re.IGNORECASE)),
        "",
    )
    personal = {"full_name": name, "email": email.group(0) if email else "", "phone": phone.group(0).strip() if phone else "", "location": location}
    result: dict[str, Any] = {"personal_info": personal, "summary": " ".join(sections["summary"][:3] or lines[:3])[:500], "hard_skills": hard, "soft_skills": soft, "skills": list(dict.fromkeys([*hard, *soft])), "parser_mode": "local"}
    for section in ("education", "experience", "projects", "certifications", "languages", "awards", "publications", "volunteer", "other"):
        result[section] = _records(sections[section])
    result["missing_information"] = [label for key, label in (("email", "Email"), ("phone", "Số điện thoại")) if not personal[key]]
    return result


async def parse_cv_to_structured_json(raw_text: str, *, use_llm: bool | Literal["auto"] | None = None) -> dict[str, Any]:
    from src.agents.cv_parser_agent import cv_parser_agent
    from src.services.cv_jd_pipeline import normalize_structured_cv
    text = sanitize_extracted_text(raw_text)
    local = parse_cv_locally(text)
    if use_llm == "auto":
        evidence = sum(len(local[key]) for key in ("education", "experience", "projects"))
        resolved, reasons, policy = len(text) >= 200 and (len(local["hard_skills"]) < 2 and evidence == 0), ["auto"], "auto"
    else:
        resolved, reasons, policy = (get_settings().cv_parser_mode == "gemini" if use_llm is None else use_llm), ["configuration"], "configured"
    parsed = await cv_parser_agent.run(text, use_llm=resolved)
    parsed.setdefault("agent_metadata", {}).update({"llm_policy": policy, "llm_decision_reasons": reasons})
    if use_llm == "auto" and resolved and not parsed["agent_metadata"].get("llm_called"):
        # Auto mode asked for enrichment but safely retained deterministic local
        # output (for example, when no provider credential is configured).
        parsed["parser_mode"] = "local_fallback"
    parsed["normalized_v1"] = normalize_structured_cv(text, parsed)
    return parsed


async def parse_cv(file_bytes: bytes, filename: str, content_type: str = "") -> dict[str, Any]:
    """Backward-compatible upload parser used by the workflow compatibility API."""
    raw_text = await extract_text_from_document(file_bytes, filename, content_type)
    return await parse_cv_to_structured_json(raw_text)
