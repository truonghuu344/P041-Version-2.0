"""Intelligent Job Description parser with deterministic rules and LLM enrichment."""

from __future__ import annotations

import base64
import json
import logging
import re
import unicodedata
from pathlib import Path
from typing import Any

from src.config import get_settings
from src.services.cv_jd_matching import parse_job_description

logger = logging.getLogger(__name__)

MIME_TYPES: dict[str, str] = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".pdf": "application/pdf",
}


def _llm_content_to_text(content: Any) -> str:
    """Normalize text blocks returned by LangChain providers into plain text."""
    if isinstance(content, str):
        return content
    if isinstance(content, dict):
        return str(content.get("text") or content.get("content") or "")
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict):
                value = item.get("text") or item.get("content")
                if value:
                    parts.append(str(value))
            else:
                value = getattr(item, "text", None) or getattr(item, "content", None)
                if value:
                    parts.append(str(value))
        return "\n".join(parts)
    return str(content or "")


def extract_json_from_llm_response(content: Any) -> dict[str, Any] | None:
    """Robustly extract a JSON object from text or provider content blocks."""
    text = _llm_content_to_text(content)
    if not text:
        return None
    raw = text.strip()

    # 1. Direct JSON parse
    try:
        data = json.loads(raw)
        if isinstance(data, dict):
            return data
    except Exception:
        pass

    # 2. Markdown fence parse
    for match in re.finditer(r"```(?:json)?\s*([\s\S]*?)\s*```", raw, re.IGNORECASE):
        candidate = match.group(1).strip()
        try:
            data = json.loads(candidate)
            if isinstance(data, dict):
                return data
        except Exception:
            pass

    # 3. Outer brace slice
    first_brace = raw.find("{")
    last_brace = raw.rfind("}")
    if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
        candidate = raw[first_brace : last_brace + 1].strip()
        try:
            data = json.loads(candidate)
            if isinstance(data, dict):
                return data
        except Exception:
            try:
                # Remove trailing commas
                cleaned = re.sub(r",\s*([}\]])", r"\1", candidate)
                data = json.loads(cleaned)
                if isinstance(data, dict):
                    return data
            except Exception:
                pass

    return None


SYSTEM_PROMPT = (
    "Bạn là chuyên gia phân tích và số hóa tài liệu tuyển dụng (Job Description). "
    "Nhiệm vụ của bạn là trích xuất chính xác 100% các thông tin thực tế có trong bản tin tuyển dụng. "
    "Tuyệt đối không dùng dữ liệu giả lập hoặc bịa đặt. "
    "BẮT BUỘC trả về ĐÚNG MỘT JSON OBJECT theo mẫu dưới đây:\n"
    "{\n"
    '  "raw_text": "Toàn bộ văn bản đầy đủ nhận diện từ JD có phân chia dòng và đề mục rõ ràng",\n'
    '  "title": "Tên vị trí công việc chính xác trong JD (VD: Senior React Developer, Kỹ sư AI...)",\n'
    '  "department": "Phòng ban / Bộ phận nếu có trong JD (hoặc phân loại theo tên công việc)",\n'
    '  "level": "Một trong các cấp bậc: Intern | Fresher | Junior | Middle | Senior | Lead | Manager",\n'
    '  "employment_type": "Một trong các hình thức: Full-time | Part-time | Internship | Contract",\n'
    '  "work_model": "Một trong các mô hình: On-site | Hybrid | Remote",\n'
    '  "location": "Tỉnh / Thành phố làm việc (VD: Hồ Chí Minh | Hà Nội | Đà Nẵng | Khác)",\n'
    '  "address": "Địa chỉ cụ thể văn phòng làm việc nếu có ghi trong JD",\n'
    '  "tags": ["Kỹ năng 1", "Kỹ năng 2", "Kỹ năng 3... các công nghệ và từ khóa bắt buộc/ưu tiên trong JD"],\n'
    '  "salary_min": "Mức lương tối thiểu (VD: 20.000.000, 1000...)",\n'
    '  "salary_max": "Mức lương tối đa (VD: 35.000.000, 2000...)",\n'
    '  "salary_currency": "VND hoặc USD",\n'
    '  "salary_visibility": "Công khai (nếu có số tiền) hoặc Thỏa thuận (nếu ghi Thỏa thuận / Negotiable)",\n'
    '  "quantity": "Số lượng cần tuyển dạng chuỗi (VD: 1, 2)",\n'
    '  "experience": "Yêu cầu kinh nghiệm (VD: 1-3 năm, 3-5 năm, Không yêu cầu)",\n'
    '  "education": "Yêu cầu bằng cấp / học vấn (VD: Đại học / Cao đẳng chuyên ngành CNTT)",\n'
    '  "deadline": "Hạn nộp hồ sơ định dạng YYYY-MM-DD nếu có trong JD",\n'
    '  "overview_html": "<p>Đoạn văn giới thiệu về công ty, dự án và bối cảnh vị trí tuyển dụng</p>",\n'
    '  "responsibilities_html": "<ul><li>Chi tiết trách nhiệm và nhiệm vụ 1</li><li>Chi tiết nhiệm vụ 2</li></ul>",\n'
    '  "must_have_html": "<ul><li>Yêu cầu kỹ thuật bắt buộc 1</li><li>Yêu cầu bắt buộc 2</li></ul>",\n'
    '  "nice_to_have_html": "<ul><li>Yêu cầu ưu tiên/Điểm cộng 1</li><li>Điểm cộng 2</li></ul>",\n'
    '  "benefits_html": "<ul><li>Chế độ đãi ngộ 1</li><li>Chế độ đãi ngộ 2</li></ul>"\n'
    "}"
)


async def parse_jd_image_with_gemini(
    file_bytes: bytes,
    filename: str,
    content_type: str = "",
) -> dict[str, Any] | None:
    """Extract and parse JD image directly using Gemini Multimodal Vision in one shot."""
    settings = get_settings()
    api_key = settings.google_genai_api_key
    if not api_key:
        return None

    suffix = Path(filename).suffix.casefold()
    resolved_mime = content_type if content_type and "/" in content_type else MIME_TYPES.get(suffix, "image/jpeg")
    if resolved_mime == "application/octet-stream":
        resolved_mime = MIME_TYPES.get(suffix, "image/jpeg")

    b64_data = base64.b64encode(file_bytes).decode("utf-8")

    try:
        from langchain_core.messages import HumanMessage, SystemMessage
        from langchain_google_genai import ChatGoogleGenerativeAI

        llm = ChatGoogleGenerativeAI(
            model=settings.model_name,
            api_key=api_key,
            temperature=0.1,
            request_timeout=settings.llm_timeout_seconds,
            retries=settings.llm_max_retries,
        )

        message = HumanMessage(
            content=[
                {"type": "text", "text": "Hãy quan sát kỹ ảnh chụp tin tuyển dụng (JD) này và trích xuất thông tin thành JSON theo định dạng yêu cầu."},
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:{resolved_mime};base64,{b64_data}"},
                },
            ]
        )

        response = await llm.ainvoke([SystemMessage(content=SYSTEM_PROMPT), message])
        raw_res = _llm_content_to_text(response.content).strip()
        parsed_json = extract_json_from_llm_response(raw_res)
        if parsed_json:
            logger.info("Successfully parsed JD image '%s' directly with Gemini Vision.", filename)
            return parsed_json
        logger.warning("Gemini Vision response could not be parsed as JSON: %s", raw_res[:200])
    except Exception as exc:
        logger.warning("parse_jd_image_with_gemini failed: %s", exc)

    return None


async def parse_jd_with_llm(raw_text: str, current_title: str = "", metadata: dict[str, Any] | None = None) -> dict[str, Any] | None:
    """Use Gemini LLM to extract accurate, structured fields and 5 HTML sections from JD text."""
    settings = get_settings()
    api_key = settings.google_genai_api_key
    if not api_key:
        return None

    try:
        from langchain_core.messages import HumanMessage, SystemMessage
        from langchain_google_genai import ChatGoogleGenerativeAI

        llm = ChatGoogleGenerativeAI(
            model=settings.model_name,
            api_key=api_key,
            temperature=0.1,
            request_timeout=settings.llm_timeout_seconds,
            retries=settings.llm_max_retries,
        )

        user_content = f"Văn bản JD cần phân tích:\n\n{raw_text}"
        if current_title:
            user_content += f"\n\nTiêu đề tham khảo: {current_title}"

        response = await llm.ainvoke([SystemMessage(content=SYSTEM_PROMPT), HumanMessage(content=user_content)])
        raw_res = _llm_content_to_text(response.content).strip()
        parsed_json = extract_json_from_llm_response(raw_res)
        if parsed_json:
            logger.info("Successfully parsed JD text with LLM.")
            return parsed_json
        logger.warning("LLM response could not be parsed as JSON: %s", raw_res[:200])
    except Exception as exc:
        logger.warning("LLM JD parsing failed: %s", exc)

    return None


async def parse_structured_jd(
    *,
    title: str,
    requirements_text: str,
    metadata: dict[str, Any] | None = None,
    file_bytes: bytes | None = None,
    filename: str = "",
    content_type: str = "",
) -> dict[str, Any]:
    """Parse JD with deterministic rules and enrich with LLM extraction when available."""
    metadata = metadata or {}
    parsed = parse_job_description(title=title, requirements_text=requirements_text, metadata=metadata)

    settings = get_settings()
    llm_data: dict[str, Any] | None = None

    # Chỉ gọi LLM khi người dùng bật cờ cấu hình (CV_STRUCTURED_PARSE_LLM_ENABLED),
    # mặc định tắt để tiết kiệm quota Gemini. Luồng ảnh dùng Vision một bước.
    suffix = Path(filename).suffix.casefold()
    is_image = bool(file_bytes) and suffix in {".jpg", ".jpeg", ".png", ".webp"}
    if settings.cv_structured_parse_llm_enabled:
        if is_image and file_bytes:
            llm_data = await parse_jd_image_with_gemini(file_bytes, filename, content_type)
        if not llm_data and requirements_text and len(requirements_text) >= 10:
            llm_data = await parse_jd_with_llm(requirements_text, current_title=title, metadata=metadata)

    if llm_data:
        llm_data = validate_llm_fields_against_source(llm_data, requirements_text, title)
        parsed = merge_llm_fields(parsed, llm_data)

    return parsed


def _text_contains_folded(haystack: str, needle: str) -> bool:
    folded_haystack = re.sub(r"\s+", " ", unicodedata.normalize("NFD", haystack.casefold())).strip()
    return bool(
        re.search(rf"(?<!\w){re.escape(needle.casefold())}(?!\w)", folded_haystack)
    )


ALLOWED_HTML_TAGS = {"p", "ul", "ol", "li", "strong", "em", "b", "i", "u", "br", "table", "thead", "tbody", "tr", "th", "td"}


def _sanitize_html_fragment(html: str) -> str:
    """Chỉ giữ tag an toàn; loại script/style/attribute sự kiện khỏi HTML do LLM trả về."""
    try:
        from html.parser import HTMLParser

        class _Sanitizer(HTMLParser):
            def __init__(self) -> None:
                super().__init__(convert_charrefs=True)
                self.out: list[str] = []
                self.open_stack: list[str] = []

            def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
                if tag in ALLOWED_HTML_TAGS:
                    self.out.append(f"<{tag}>")
                    if tag not in {"br", "li", "tr", "td", "th", "p"}:
                        self.open_stack.append(tag)

            def handle_endtag(self, tag: str) -> None:
                if tag in ALLOWED_HTML_TAGS and tag not in {"br"}:
                    self.out.append(f"</{tag}>")
                    if tag in self.open_stack:
                        self.open_stack.remove(tag)

            def handle_data(self, data: str) -> None:
                self.out.append(data.replace("<", "&lt;"))

        sanitizer = _Sanitizer()
        sanitizer.feed(str(html or ""))
        for tag in reversed(sanitizer.open_stack):
            sanitizer.out.append(f"</{tag}>")
        return "".join(sanitizer.out).strip()
    except Exception:
        return ""


def validate_llm_fields_against_source(
    llm_data: dict[str, Any],
    raw_text: str,
    fallback_title: str,
) -> dict[str, Any]:
    """Hàng rào chống bịa: chỉ giữ field LLM có dấu vết trong văn bản JD gốc.

    Mọi giá trị không tìm thấy trong raw_text sẽ bị loại và ghi nhận vào
    ``rejected_fields`` để log/audit. Điểm số không bao giờ đọc từ LLM.
    """
    validated: dict[str, Any] = {}
    rejected: list[str] = []
    source = re.sub(r"\s+", " ", str(raw_text or ""))
    source_no_seps = source.replace(".", "").replace(",", "")

    def traced(value: Any, *, numeric: bool = False) -> bool:
        text_value = str(value or "").strip()
        if not text_value:
            return False
        if numeric:
            digits = re.sub(r"[^\d]", "", text_value)
            return bool(digits) and digits in re.sub(r"[^\d]", "", source)
        return _text_contains_folded(source, text_value[:80]) or _text_contains_folded(source_no_seps, text_value[:80])

    candidate_title = str(llm_data.get("title") or "").strip()
    if candidate_title and len(candidate_title) >= 2 and (
        traced(candidate_title) or not fallback_title.strip()
    ):
        validated["title"] = candidate_title
    else:
        rejected.append("title")

    for key in ("department", "address"):
        value = str(llm_data.get(key) or "").strip()
        if value and traced(value):
            validated[key] = value
        elif value:
            rejected.append(key)

    if llm_data.get("level") in {"Intern", "Fresher", "Junior", "Middle", "Senior", "Lead", "Manager"}:
        level_folded = str(llm_data["level"]).casefold()
        alias_map = {
            "intern": ("intern", "internship", "thực tập", "thuc tap"),
            "fresher": ("fresher",),
            "junior": ("junior",),
            "middle": ("middle", "mid-level", "mid level"),
            "senior": ("senior",),
            "lead": ("lead", "leader"),
            "manager": ("manager", "trưởng nhóm", "truong nhom"),
        }
        if any(alias in source.casefold() for alias in alias_map[level_folded]):
            validated["level"] = str(llm_data["level"])
        else:
            rejected.append("level")

    if llm_data.get("employment_type") in {"Full-time", "Part-time", "Internship", "Contract"}:
        validated["employment_type"] = str(llm_data["employment_type"])
    if llm_data.get("work_model") in {"On-site", "Hybrid", "Remote"}:
        validated["work_model"] = str(llm_data["work_model"])

    location_value = str(llm_data.get("location") or "").strip()
    if location_value and (_text_contains_folded(source, location_value) or len(location_value.split()) <= 3):
        # Tỉnh/thành phố ngắn thường được LLM chuẩn hoá từ "TP.HCM" nên chấp nhận
        # khi tên nằm trong văn bản hoặc là cụm tối đa 3 từ.
        validated["location"] = location_value
    else:
        rejected.append("location")

    raw_tags = llm_data.get("tags") if isinstance(llm_data.get("tags"), list) else []
    clean_tags = [str(tag).strip() for tag in raw_tags if str(tag).strip()]
    kept_tags = [tag for tag in clean_tags if traced(tag)]
    dropped_tags = [tag for tag in clean_tags if not traced(tag)]
    if kept_tags:
        validated["tags"] = kept_tags
    if dropped_tags:
        rejected.extend(f"tags:{tag}" for tag in dropped_tags)

    salary_min_raw = str(llm_data.get("salary_min") or "").strip()
    salary_max_raw = str(llm_data.get("salary_max") or "").strip()
    if salary_min_raw and salary_max_raw and traced(salary_min_raw, numeric=True) and traced(salary_max_raw, numeric=True):
        validated["salary_min"] = salary_min_raw
        validated["salary_max"] = salary_max_raw
        currency = str(llm_data.get("salary_currency") or "").strip().upper()
        if currency in {"VND", "USD"}:
            validated["salary_currency"] = currency
        if llm_data.get("salary_visibility") in {"Công khai", "Thỏa thuận"}:
            validated["salary_visibility"] = str(llm_data["salary_visibility"])
    elif salary_min_raw or salary_max_raw:
        rejected.append("salary")

    deadline_value = str(llm_data.get("deadline") or "").strip()
    normalized_date = re.match(r"^(\d{4})-(\d{2})-(\d{2})$", deadline_value)
    if normalized_date:
        year, month, day = normalized_date.groups()
        date_variants = (
            rf"{day}\s*[/.-]{month}\s*[/.-]{year}",
            rf"{year}[/.-]{month}[/.-]{day}",
        )
        if any(re.search(variant, source) for variant in date_variants):
            validated["deadline"] = deadline_value
        else:
            rejected.append("deadline")

    section_map = {
        "overview_html": "overview_html",
        "responsibilities_html": "responsibilities_html",
        "must_have_html": "must_have_html",
        "nice_to_have_html": "nice_to_have_html",
        "benefits_html": "benefits_html",
    }
    for key in section_map:
        html_value = _sanitize_html_fragment(str(llm_data.get(key) or ""))
        if html_value and html_value.lower() not in {"<p></p>", "<ul></ul>"}:
            validated[key] = html_value

    quantity_value = str(llm_data.get("quantity") or "").strip()
    if quantity_value.isdigit() and quantity_value in source:
        validated["quantity"] = quantity_value

    experience_value = str(llm_data.get("experience") or "").strip()
    if experience_value and re.search(r"\d", experience_value) and traced(experience_value):
        validated["experience"] = experience_value

    education_value = str(llm_data.get("education") or "").strip()
    if education_value and traced(education_value):
        validated["education"] = education_value

    validated["_rejected_fields"] = rejected
    return validated


def merge_llm_fields(parsed: dict[str, Any], llm_data: dict[str, Any]) -> dict[str, Any]:
    """Ghép field LLM đã qua kiểm chứng vào kết quả parse deterministic."""
    import logging

    logger = logging.getLogger(__name__)
    rejected = llm_data.pop("_rejected_fields", [])
    if rejected:
        logger.info("JD LLM enrichment rejected untraceable fields: %s", ", ".join(rejected))

    if llm_data.get("title") and len(str(llm_data["title"]).strip()) >= 2:
        real_title = str(llm_data["title"]).strip()
        parsed["title"] = real_title
        parsed["job"]["title_original"] = real_title

    if llm_data.get("department"):
        parsed["department"] = str(llm_data["department"]).strip()

    if llm_data.get("level"):
        parsed["level"] = str(llm_data["level"])
        parsed["job_level"] = str(llm_data["level"]).lower()
        parsed["job"]["seniority"] = str(llm_data["level"]).lower()

    if llm_data.get("employment_type"):
        parsed["employment_type"] = str(llm_data["employment_type"])

    if llm_data.get("work_model"):
        parsed["work_model"] = str(llm_data["work_model"])

    if llm_data.get("location"):
        parsed["location"] = str(llm_data["location"]).strip()
        parsed["work_constraints"]["location"] = str(llm_data["location"]).strip()

    if llm_data.get("address"):
        parsed["address"] = str(llm_data["address"]).strip()

    if isinstance(llm_data.get("tags"), list) and len(llm_data["tags"]) > 0:
        parsed["tags"] = [str(t).strip() for t in llm_data["tags"] if str(t).strip()]

    if llm_data.get("salary_min"):
        parsed["salary_min"] = str(llm_data["salary_min"]).strip()
        parsed["salary_visibility"] = "Công khai"
    if llm_data.get("salary_max"):
        parsed["salary_max"] = str(llm_data["salary_max"]).strip()
    if llm_data.get("salary_currency"):
        parsed["salary_currency"] = str(llm_data["salary_currency"]).strip()
    if llm_data.get("salary_visibility") and not llm_data.get("salary_min"):
        parsed["salary_visibility"] = str(llm_data["salary_visibility"])

    if llm_data.get("quantity"):
        parsed["quantity"] = str(llm_data["quantity"]).strip()

    if llm_data.get("experience"):
        parsed["experience"] = str(llm_data["experience"]).strip()

    if llm_data.get("education"):
        parsed["education"] = str(llm_data["education"]).strip()

    if llm_data.get("deadline"):
        parsed["deadline"] = str(llm_data["deadline"]).strip()

    # Update 5 HTML sections
    overview_c = str(llm_data.get("overview_html") or "").strip()
    resp_c = str(llm_data.get("responsibilities_html") or "").strip()
    must_c = str(llm_data.get("must_have_html") or "").strip()
    nice_c = str(llm_data.get("nice_to_have_html") or "").strip()
    benefit_c = str(llm_data.get("benefits_html") or "").strip()

    sections = [
        {
            "id": "sec-overview",
            "type": "overview",
            "title": "1. Giới thiệu tổng quan về vị trí",
            "hint": "Mô tả bối cảnh dự án, sứ mệnh của phòng ban và vai trò của vị trí trong công ty.",
            "content": overview_c or parsed["sections"][0]["content"],
            "source": "extracted" if overview_c else parsed["sections"][0].get("source", "empty"),
            "isRequired": True,
        },
        {
            "id": "sec-resp",
            "type": "responsibilities",
            "title": "2. Trách nhiệm & Nhiệm vụ chính",
            "hint": "Liệt kê các đầu việc thực tế mà ứng viên sẽ đảm nhận hàng ngày.",
            "content": resp_c or parsed["sections"][1]["content"],
            "source": "extracted" if resp_c else parsed["sections"][1].get("source", "empty"),
            "isRequired": True,
        },
        {
            "id": "sec-musthave",
            "type": "must_have",
            "title": "3. Yêu cầu bắt buộc (Must-Have)",
            "hint": "Các kỹ năng, kinh nghiệm cốt lõi bắt buộc ứng viên phải có — dùng để đối chiếu hồ sơ.",
            "content": must_c or parsed["sections"][2]["content"],
            "source": "extracted" if must_c else parsed["sections"][2].get("source", "empty"),
            "isRequired": True,
        },
        {
            "id": "sec-nicetohave",
            "type": "nice_to_have",
            "title": "4. Yêu cầu ưu tiên (Nice-To-Have)",
            "hint": "Điểm cộng giúp ứng viên nổi bật hơn trong quá trình tuyển chọn.",
            "content": nice_c or parsed["sections"][3]["content"],
            "source": "extracted" if nice_c else parsed["sections"][3].get("source", "empty"),
            "isRequired": False,
        },
        {
            "id": "sec-benefits",
            "type": "benefits",
            "title": "5. Quyền lợi & Đãi ngộ (Benefits)",
            "hint": "Chế độ lương thưởng, bảo hiểm, đào tạo và văn hóa doanh nghiệp.",
            "content": benefit_c or parsed["sections"][4]["content"],
            "source": "extracted" if benefit_c else parsed["sections"][4].get("source", "empty"),
            "isRequired": True,
        },
    ]
    parsed["sections"] = sections

    return parsed
