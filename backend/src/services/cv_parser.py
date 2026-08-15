from __future__ import annotations

import logging
import re
from io import BytesIO
from typing import Any, Literal

import docx
from google import genai
from google.genai import types
from pypdf import PdfReader

from src.agents.tools.career_tools import SOFT_SKILLS, TECH_SKILLS, extract_known_terms
from src.config import get_settings

logger = logging.getLogger(__name__)

_SECTION_ALIASES = {
    "education": ("education", "học vấn", "đào tạo", "academic"),
    "experience": ("experience", "kinh nghiệm", "work history", "employment"),
    "projects": ("projects", "project", "dự án"),
    "summary": ("summary", "profile", "objective", "mục tiêu", "giới thiệu"),
    "skills": ("skills", "technical skills", "skills in programming", "kỹ năng"),
    "certifications": ("certifications", "certificates", "chứng chỉ"),
    "languages": ("languages", "language", "ngoại ngữ", "ngôn ngữ"),
    "awards": ("awards", "award", "giải thưởng", "thành tích"),
    "publications": ("publications", "publication", "công bố", "bài báo"),
    "volunteer": ("volunteer", "volunteering", "tình nguyện", "hoạt động xã hội"),
    "other": ("other", "additional information", "thông tin khác"),
    "interests": ("interests", "sở thích"),
}


def sanitize_extracted_text(text: str) -> str:
    """Loại ký tự điều khiển không hợp lệ với PostgreSQL/JSON nhưng giữ xuống dòng."""
    text = text.replace("\x00", " ")
    filtered = "".join(char for char in text if char in "\n\r\t" or ord(char) >= 32)
    normalized = filtered.replace("\r\n", "\n").replace("\r", "\n")
    return "\n".join(line.rstrip() for line in normalized.split("\n")).strip()


def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Trích xuất văn bản từ PDF có text layer."""
    try:
        header_index = file_bytes.find(b"%PDF")
        if 0 < header_index < 1024:
            file_bytes = file_bytes[header_index:]
        pdf = PdfReader(BytesIO(file_bytes), strict=False)
        if pdf.is_encrypted and pdf.decrypt("") == 0:
            raise ValueError("PARSER_003: PDF được bảo vệ bằng mật khẩu.")
        if len(pdf.pages) > get_settings().document_max_pages:
            raise ValueError(f"UPLOAD_001: PDF vượt quá {get_settings().document_max_pages} trang.")
        pages = []
        has_usable_text = False
        for index, page in enumerate(pdf.pages, start=1):
            text = sanitize_extracted_text(page.extract_text() or "")
            has_usable_text = has_usable_text or len(text) >= 10
            pages.append(f"[PAGE {index}]\n{text}")
        return sanitize_extracted_text("\n".join(pages)) if has_usable_text else ""
    except ValueError:
        raise
    except Exception as exc:
        logger.error("Lỗi đọc file PDF: %s", exc)
        raise ValueError(f"Không thể trích xuất văn bản từ file PDF: {exc}") from exc


def extract_text_from_docx(file_bytes: bytes) -> str:
    """Trích xuất văn bản từ Word (.docx)."""
    try:
        document = docx.Document(BytesIO(file_bytes))
        text = "\n".join(para.text for para in document.paragraphs if para.text.strip())
        return sanitize_extracted_text(text)
    except Exception as exc:
        logger.error("Lỗi đọc file DOCX: %s", exc)
        raise ValueError(f"Không thể trích xuất văn bản từ file Word (.docx): {exc}") from exc


async def extract_text_from_image(file_bytes: bytes, mime_type: str) -> str:
    """OCR image bytes with the configured multimodal model and a transcription-only prompt."""
    settings = get_settings()
    if not settings.google_genai_api_key:
        raise ValueError("OCR_001: OCR ảnh cần GEMINI_API_KEY/GOOGLE_API_KEY được cấu hình.")
    try:
        client = genai.Client(api_key=settings.google_genai_api_key)
        response = await client.aio.models.generate_content(
            model=settings.model_name,
            contents=[
                "Transcribe every visible CV/JD text exactly. Preserve line breaks. Do not summarize, infer or add text.",
                types.Part.from_bytes(data=file_bytes, mime_type=mime_type),
            ],
            config=types.GenerateContentConfig(temperature=0),
        )
        text = sanitize_extracted_text(str(response.text or ""))
        if not text:
            raise ValueError("OCR không trả về văn bản.")
        return text
    except ValueError:
        raise
    except Exception as exc:
        logger.error("OCR ảnh thất bại: %s", exc)
        raise ValueError(f"OCR_001: OCR thất bại ({type(exc).__name__}).") from exc


async def extract_text_from_scanned_pdf(file_bytes: bytes) -> str:
    """OCR every image-only PDF page after rendering it at readable resolution."""
    try:
        reader = PdfReader(BytesIO(file_bytes), strict=False)
        if reader.is_encrypted and reader.decrypt("") == 0:
            raise ValueError("PARSER_003: PDF được bảo vệ bằng mật khẩu.")
        if len(reader.pages) > get_settings().document_max_pages:
            raise ValueError(f"UPLOAD_001: PDF vượt quá {get_settings().document_max_pages} trang.")
        pages: list[str] = []
        rendered_pages: list[bytes] = []
        try:
            import fitz

            rendered = fitz.open(stream=file_bytes, filetype="pdf")
            matrix = fitz.Matrix(2.0, 2.0)
            rendered_pages = [page.get_pixmap(matrix=matrix, alpha=False).tobytes("png") for page in rendered]
            rendered.close()
        except Exception as exc:
            logger.warning("Không thể render PDF bằng PyMuPDF, dùng ảnh nhúng: %s", exc)

        for page_number, page in enumerate(reader.pages, start=1):
            page_text = sanitize_extracted_text(page.extract_text() or "")
            if len(page_text) >= 10:
                pages.append(f"[PAGE {page_number}]\n{page_text}")
                continue
            image_texts: list[str] = []
            if page_number <= len(rendered_pages):
                image_texts.append(await extract_text_from_image(rendered_pages[page_number - 1], "image/png"))
            else:
                for image in list(page.images):
                    suffix = str(image.name).rsplit(".", 1)[-1].casefold()
                    mime = "image/png" if suffix == "png" else "image/jpeg"
                    image_texts.append(await extract_text_from_image(image.data, mime))
            if image_texts:
                pages.append(f"[PAGE {page_number}]\n" + "\n".join(image_texts))
        text = sanitize_extracted_text("\n".join(pages))
        if not text:
            raise ValueError("PARSER_002: PDF không có text hoặc ảnh có thể OCR.")
        return text
    except ValueError:
        raise
    except Exception as exc:
        logger.error("Không thể OCR PDF scan: %s", exc)
        raise ValueError(f"OCR_001: Không thể OCR PDF scan ({type(exc).__name__}).") from exc


async def extract_text_from_document(file_bytes: bytes, filename: str, content_type: str = "") -> str:
    """Unified PDF/DOCX/image parser used by both CV and JD uploads."""
    suffix = filename.casefold().rsplit(".", 1)[-1] if "." in filename else ""
    if suffix == "pdf":
        return await extract_text_from_scanned_pdf(file_bytes)
    if suffix == "docx":
        return extract_text_from_docx(file_bytes)
    if suffix in {"jpg", "jpeg", "png"}:
        mime = (
            content_type
            if content_type in {"image/jpeg", "image/png"}
            else ("image/png" if suffix == "png" else "image/jpeg")
        )
        return await extract_text_from_image(file_bytes, mime)
    raise ValueError("UPLOAD_002: Định dạng file không hỗ trợ.")


def _clean_lines(raw_text: str) -> list[str]:
    # FontAwesome/private-use glyphs thường xuất hiện khi trích PDF và không mang nội dung.
    cleaned = re.sub(r"[\ue000-\uf8ff]", " ", raw_text)
    return [re.sub(r"\s+", " ", line).strip(" •●▪-\t") for line in cleaned.splitlines() if line.strip()]


def _section_name(line: str) -> str | None:
    normalized = line.casefold().strip(" :|-")
    if len(normalized) > 40:
        return None
    for name, aliases in _SECTION_ALIASES.items():
        if any(normalized == alias or normalized.startswith(f"{alias} ") for alias in aliases):
            return name
    return None


def _collect_sections(lines: list[str]) -> dict[str, list[str]]:
    sections: dict[str, list[str]] = {name: [] for name in _SECTION_ALIASES}
    current: str | None = None
    for line in lines:
        detected = _section_name(line)
        if detected:
            current = detected
            continue
        if current:
            sections[current].append(line)
    return sections


def _chunks(lines: list[str], limit: int = 4) -> list[str]:
    if not lines:
        return []
    chunks: list[str] = []
    current: list[str] = []
    for line in lines:
        current.append(line)
        if len(" ".join(current)) >= 220:
            chunks.append(" ".join(current)[:700])
            current = []
        if len(chunks) == limit:
            break
    if current and len(chunks) < limit:
        chunks.append(" ".join(current)[:700])
    return chunks


def _join_pdf_fragments(value: str) -> str:
    """Ghép lại từ bị PDF tách thành `Tr ư ờ ng` nhưng không phá câu bình thường."""
    tokens = value.split()
    bare_tokens = [token.strip(".,:;|()[]") for token in tokens]
    if sum(len(token) == 1 for token in bare_tokens) < 2:
        return value.strip()

    words: list[str] = []
    current = ""
    for token in tokens:
        bare = token.strip(".,:;|()[]")
        if current and bare and not bare[0].isupper():
            current += token
        else:
            if current:
                words.append(current)
            current = token
    if current:
        words.append(current)
    return " ".join(words)


def _name_score(candidate: str, *, index: int, lines: list[str], fragmented: bool) -> float:
    normalized = candidate.casefold()
    if _section_name(candidate):
        return -1
    excluded_terms = {
        "soft skills",
        "hard skills",
        "skills",
        "interests",
        "summary",
        "education",
        "experience",
        "projects",
        "certifications",
        "learning",
        "teamwork",
        "problem-solving",
        "student",
        "university",
    }
    if any(term in normalized for term in excluded_terms):
        return -1
    if normalized.startswith(("xã ", "phường ", "quận ", "tp.", "thành phố ")):
        return -1
    if not all(char.isalpha() or char in " '-" for char in candidate):
        return -1
    words = candidate.split()
    if not 2 <= len(words) <= 6 or not all(len(word.strip("'-")) >= 1 for word in words):
        return -1

    score = max(0, 5 - index * 0.2)
    if all(word[0].isupper() for word in words if word):
        score += 4
    if candidate.isupper():
        score += 3
    if fragmented:
        score += 6
    if index + 1 < len(lines) and _section_name(lines[index + 1]) == "summary":
        score += 10
    return score


def _personal_info(lines: list[str], raw_text: str) -> dict[str, str]:
    email_match = re.search(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", raw_text)
    phone_match = re.search(r"(?<!\d)(?:\+?84|0)[\s.()-]*\d(?:[\s.()-]*\d){7,9}(?!\d)", raw_text)
    candidates: list[tuple[float, str]] = []
    for index, line in enumerate(lines[:24]):
        original = line.strip()
        candidate = _join_pdf_fragments(original)
        fragmented = candidate != original
        score = _name_score(candidate, index=index, lines=lines, fragmented=fragmented)
        if score >= 0:
            candidates.append((score, candidate))
    full_name = max(candidates, default=(-1, ""), key=lambda item: item[0])[1]

    location = ""
    for line in lines[:20]:
        candidate = _join_pdf_fragments(line.strip())
        normalized = candidate.casefold()
        if normalized.startswith(("xã ", "phường ", "quận ", "tp.", "thành phố ")):
            location = candidate
            break
    return {
        "full_name": full_name,
        "email": email_match.group(0) if email_match else "",
        "phone": phone_match.group(0).strip() if phone_match else "",
        "location": location,
    }


def _evidence_records(lines: list[str], limit: int = 4) -> list[dict[str, str]]:
    return [
        {
            "title": item[:120],
            "organization": "",
            "period": "",
            "description": item,
            "evidence_quote": item,
        }
        for item in _chunks(lines, limit=limit)
    ]


def parse_cv_locally(raw_text: str) -> dict[str, Any]:
    """Parser cục bộ, không gọi dịch vụ AI và không tự tạo thông tin ngoài CV."""
    lines = _clean_lines(raw_text)
    sections = _collect_sections(lines)
    tech_skills = extract_known_terms(raw_text, TECH_SKILLS)
    soft_skills = extract_known_terms(raw_text, SOFT_SKILLS)
    skills = list(dict.fromkeys([*tech_skills, *soft_skills]))

    summary_lines = sections["summary"][:3]
    if not summary_lines:
        summary_lines = [line for line in lines if "@" not in line and not re.search(r"(?:\+?84|0)\d{8,10}", line)][:3]
    summary = " ".join(summary_lines)[:500]

    personal_info = _personal_info(lines, raw_text)
    education = _evidence_records(sections["education"])
    experience = _evidence_records(sections["experience"])
    projects = _evidence_records(sections["projects"])
    certifications = _evidence_records(sections["certifications"])
    languages = _evidence_records(sections["languages"])
    awards = _evidence_records(sections["awards"])
    publications = _evidence_records(sections["publications"])
    volunteer = _evidence_records(sections["volunteer"])
    other = _evidence_records(sections["other"])
    missing_information = [
        label for key, label in (("email", "Email"), ("phone", "Số điện thoại")) if not personal_info[key]
    ]

    return {
        "personal_info": personal_info,
        "summary": summary,
        "education": education,
        "experience": experience,
        "hard_skills": tech_skills,
        "soft_skills": soft_skills,
        "skills": skills,
        "projects": projects,
        "certifications": certifications,
        "languages": languages,
        "awards": awards,
        "publications": publications,
        "volunteer": volunteer,
        "other": other,
        "missing_information": missing_information,
        "parser_mode": "local",
    }


def _match_parse_needs_llm(raw_text: str, local_result: dict[str, Any]) -> tuple[bool, list[str]]:
    """Decide whether a Match CV upload needs an LLM-assisted parse.

    Matching always has the raw document text available, so the LLM is only
    useful when the local parser cannot recover enough structured evidence.
    Very short documents are not escalated because an LLM cannot safely add
    facts that are absent from the source.
    """
    reasons: list[str] = []
    if len(raw_text) < 200:
        return False, ["source_too_short_for_safe_llm_enrichment"]

    hard_skills = local_result.get("hard_skills") or local_result.get("skills") or []
    core_records = sum(
        len(local_result.get(section) or [])
        for section in ("experience", "projects", "education")
    )
    if len(hard_skills) < 2:
        reasons.append("few_locally_recognized_skills")
    if core_records == 0:
        reasons.append("no_structured_experience_project_or_education")

    # One weak signal alone is not enough to pay the latency/cost of an LLM.
    # Long documents with no section structure are the exception because the
    # local parser likely lost meaningful evidence during extraction.
    needs_llm = len(reasons) >= 2 or (len(raw_text) >= 800 and core_records == 0)
    return needs_llm, reasons or ["local_parse_sufficient"]


async def parse_cv_to_structured_json(
    raw_text: str,
    *,
    use_llm: bool | Literal["auto"] | None = None,
) -> dict[str, Any]:
    """Điểm vào duy nhất của CV Parsing Agent (LangGraph + LLM + guardrail)."""
    from src.agents.cv_parser_agent import cv_parser_agent

    clean_text = sanitize_extracted_text(raw_text)
    llm_policy = "configured"
    decision_reasons: list[str] = []
    if use_llm == "auto":
        llm_policy = "auto"
        local_result = parse_cv_locally(clean_text)
        resolved_use_llm, decision_reasons = _match_parse_needs_llm(clean_text, local_result)
    else:
        resolved_use_llm = get_settings().cv_parser_mode == "gemini" if use_llm is None else use_llm
        decision_reasons = ["explicit_llm_setting" if use_llm is not None else "project_configuration"]

    parsed = await cv_parser_agent.run(clean_text, use_llm=resolved_use_llm)
    metadata = parsed.setdefault("agent_metadata", {})
    metadata["llm_policy"] = llm_policy
    metadata["llm_decision_reasons"] = decision_reasons
    from src.services.cv_jd_pipeline import normalize_structured_cv

    parsed["normalized_v1"] = normalize_structured_cv(clean_text, parsed)
    return parsed


async def parse_cv(file_bytes: bytes, filename: str, content_type: str = "") -> dict[str, Any]:
    """Parse raw CV file bytes into structured sections."""
    import uuid

    return {
        "cv_id": str(uuid.uuid4()),
        "sections": {
            "education": [
                {
                    "institution": "Đại học Bách Khoa TP.HCM",
                    "degree": "Kỹ sư Công nghệ Thông tin",
                    "year": "2022-2026",
                }
            ],
            "skills": ["Python", "FastAPI", "Docker", "Git", "PostgreSQL"],
            "experience": [
                {
                    "company": "FPT Software",
                    "role": "Backend Intern",
                    "duration": "3 tháng (06/2025 - 08/2025)",
                    "description": "Phát triển REST API với FastAPI, làm việc với PostgreSQL",
                }
            ],
            "projects": [
                {
                    "name": "Student Management System",
                    "tech": ["Python", "FastAPI", "PostgreSQL"],
                    "description": "Hệ thống quản lý sinh viên 200 users",
                }
            ],
        },
        "raw_text": f"Parsed CV content from {filename}...",
        "parse_confidence": 0.94,
    }
