from __future__ import annotations

import logging
import re
import time
from datetime import UTC, datetime
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field

from src.agents.state import CVParserAgentState
from src.config import get_settings
from src.services.cv_parser import parse_cv_locally, sanitize_extracted_text

logger = logging.getLogger(__name__)


class PersonalInfoExtraction(BaseModel):
    full_name: str = Field(description="Họ tên đúng như CV; chuỗi rỗng nếu không có")
    email: str = Field(description="Email đúng như CV; chuỗi rỗng nếu không có")
    phone: str = Field(description="Số điện thoại đúng như CV; chuỗi rỗng nếu không có")
    location: str = Field(description="Địa chỉ/địa điểm đúng như CV; chuỗi rỗng nếu không có")


class EvidenceRecord(BaseModel):
    title: str = Field(description="Tên mục hoặc chức danh")
    organization: str = Field(description="Trường học, công ty hoặc đơn vị; rỗng nếu thiếu")
    period: str = Field(description="Khoảng thời gian đúng như CV; rỗng nếu thiếu")
    description: str = Field(description="Mô tả ngắn, không thêm dữ kiện")
    evidence_quote: str = Field(description="Trích dẫn nguyên văn ngắn từ CV làm bằng chứng")


class CVStructuredExtraction(BaseModel):
    personal_info: PersonalInfoExtraction
    professional_summary: str = Field(description="Tóm tắt hồ sơ chỉ từ dữ kiện có trong CV")
    hard_skills: list[str]
    soft_skills: list[str]
    education: list[EvidenceRecord]
    experience: list[EvidenceRecord]
    projects: list[EvidenceRecord]
    certifications: list[EvidenceRecord]
    missing_information: list[str]


def _trace(step: str, status: str, detail: str) -> dict[str, Any]:
    return {
        "step": step,
        "status": status,
        "detail": detail,
        "at": datetime.now(UTC).isoformat(),
    }


def _normalized(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip().casefold()


def _compact(value: str) -> str:
    return re.sub(r"\W+", "", value, flags=re.UNICODE).casefold()


def _is_evidenced(value: str, raw_text: str) -> bool:
    if not value:
        return False
    normalized_value = _normalized(value)
    normalized_raw = _normalized(raw_text)
    return normalized_value in normalized_raw or _compact(value) in _compact(raw_text)


async def validate_cv_node(state: CVParserAgentState) -> dict[str, Any]:
    raw_text = sanitize_extracted_text(state.get("cv_raw_text", ""))
    trace = [_trace("validate_input", "passed", f"Đã nhận {len(raw_text)} ký tự sạch.")]
    if len(raw_text) < 40:
        return {
            "cv_raw_text": raw_text,
            "trace": trace,
            "error": "Nội dung CV quá ngắn hoặc không có text layer để AI phân tích.",
        }
    return {
        "cv_raw_text": raw_text,
        "started_at": time.perf_counter(),
        "trace": trace,
        "error": "",
    }


async def local_evidence_node(state: CVParserAgentState) -> dict[str, Any]:
    local = parse_cv_locally(state["cv_raw_text"])
    trace = [
        *state.get("trace", []),
        _trace(
            "local_evidence",
            "passed",
            f"Phát hiện {len(local.get('hard_skills', []))} hard skills và {len(local.get('soft_skills', []))} soft skills.",
        ),
    ]
    return {"local_extraction": local, "trace": trace}


async def llm_structured_parse_node(state: CVParserAgentState) -> dict[str, Any]:
    settings = get_settings()
    requested = state.get("llm_requested", settings.cv_parser_mode == "openai")
    base = {
        "llm_requested": requested,
        "provider": "openai",
        "model": settings.model_name,
    }
    if not requested:
        return {
            **base,
            "llm_called": False,
            "llm_succeeded": False,
            "llm_error": "CV_PARSER_MODE đang là local.",
            "trace": [*state.get("trace", []), _trace("llm_parse", "skipped", "Chế độ local được cấu hình.")],
        }
    if not settings.openai_api_key or settings.openai_api_key == "sk-your-key-here":
        return {
            **base,
            "llm_called": False,
            "llm_succeeded": False,
            "llm_error": "OPENAI_API_KEY chưa được cấu hình.",
            "trace": [
                *state.get("trace", []),
                _trace("llm_parse", "fallback", "Thiếu API key; dùng kết quả local có kiểm chứng."),
            ],
        }

    system_prompt = """Bạn là CV Parsing Agent trong Career Assistant X.
Nhiệm vụ: trích xuất CV thành dữ liệu có cấu trúc để người dùng xác nhận.

RÀNG BUỘC BẮT BUỘC:
1. Chỉ sử dụng thông tin xuất hiện trong CV; không suy đoán và không thêm thành tích/kỹ năng.
2. Mỗi education/experience/project/certification phải có evidence_quote là đoạn nguyên văn ngắn trong CV.
3. Nếu thiếu email, điện thoại, kinh nghiệm hoặc thông tin quan trọng, để chuỗi/danh sách rỗng và ghi vào missing_information.
4. Giữ nguyên tên công nghệ, tên tổ chức, mốc thời gian và số liệu.
5. Không chấm điểm phù hợp với một JD vì bước này chỉ parse CV.
"""
    try:
        llm = ChatOpenAI(
            model=settings.model_name,
            temperature=0,
            api_key=settings.openai_api_key,
            timeout=settings.llm_timeout_seconds,
            max_retries=settings.llm_max_retries,
        )
        structured_llm = llm.with_structured_output(
            CVStructuredExtraction,
            method="json_schema",
            strict=True,
        )
        extraction = await structured_llm.ainvoke(
            [
                SystemMessage(content=system_prompt),
                HumanMessage(content=f"CV cần phân tích:\n---\n{state['cv_raw_text']}\n---"),
            ]
        )
        payload = extraction.model_dump() if isinstance(extraction, BaseModel) else dict(extraction)
        return {
            **base,
            "llm_called": True,
            "llm_succeeded": True,
            "llm_error": "",
            "llm_extraction": payload,
            "trace": [
                *state.get("trace", []),
                _trace("llm_parse", "passed", f"Structured output nhận từ {settings.model_name}."),
            ],
        }
    except Exception as exc:
        logger.exception("CV Parsing Agent không thể hoàn tất structured LLM call")
        return {
            **base,
            "llm_called": True,
            "llm_succeeded": False,
            "llm_error": f"{type(exc).__name__}: Không thể hoàn tất yêu cầu LLM.",
            "trace": [
                *state.get("trace", []),
                _trace("llm_parse", "fallback", "LLM lỗi; agent chuyển sang bằng chứng local."),
            ],
        }


def _verified_records(records: Any, raw_text: str) -> tuple[list[dict[str, Any]], int]:
    accepted: list[dict[str, Any]] = []
    rejected = 0
    for record in records if isinstance(records, list) else []:
        item = record.model_dump() if isinstance(record, BaseModel) else record
        if not isinstance(item, dict) or not _is_evidenced(str(item.get("evidence_quote", "")), raw_text):
            rejected += 1
            continue
        accepted.append({key: str(item.get(key, "")).strip() for key in EvidenceRecord.model_fields})
    return accepted, rejected


def _verified_skills(values: Any, raw_text: str, local_values: list[str]) -> tuple[list[str], int]:
    candidates = [str(item).strip() for item in values if str(item).strip()] if isinstance(values, list) else []
    accepted = list(dict.fromkeys([*local_values, *[skill for skill in candidates if _is_evidenced(skill, raw_text)]]))
    rejected = len([skill for skill in candidates if not _is_evidenced(skill, raw_text)])
    return accepted, rejected


async def evidence_guardrail_node(state: CVParserAgentState) -> dict[str, Any]:
    raw_text = state["cv_raw_text"]
    local = state["local_extraction"]
    llm = state.get("llm_extraction", {}) if state.get("llm_succeeded") else {}
    personal_llm = llm.get("personal_info", {}) if isinstance(llm, dict) else {}
    personal_local = local.get("personal_info", {})
    personal = {}
    rejected = 0
    for key in ("full_name", "email", "phone", "location"):
        candidate = str(personal_llm.get(key, "")).strip()
        if candidate and _is_evidenced(candidate, raw_text):
            personal[key] = candidate
        else:
            if candidate:
                rejected += 1
            personal[key] = str(personal_local.get(key, "")).strip()

    hard_skills, hard_rejected = _verified_skills(
        llm.get("hard_skills", []), raw_text, local.get("hard_skills", [])
    )
    soft_skills, soft_rejected = _verified_skills(
        llm.get("soft_skills", []), raw_text, local.get("soft_skills", [])
    )
    rejected += hard_rejected + soft_rejected
    llm_summary = str(llm.get("professional_summary", "")).strip()
    if llm_summary and _is_evidenced(llm_summary, raw_text):
        summary = llm_summary
    else:
        if llm_summary:
            rejected += 1
        summary = str(local.get("summary", "")).strip()

    verified: dict[str, Any] = {
        "personal_info": personal,
        "summary": summary,
        "hard_skills": hard_skills,
        "soft_skills": soft_skills,
        "skills": list(dict.fromkeys([*hard_skills, *soft_skills])),
    }
    for key in ("education", "experience", "projects", "certifications"):
        records, dropped = _verified_records(llm.get(key, []), raw_text)
        rejected += dropped
        verified[key] = records or local.get(key, [])

    missing: list[str] = []
    labels = {
        "full_name": "Họ tên",
        "email": "Email",
        "phone": "Số điện thoại",
    }
    missing.extend(label for key, label in labels.items() if not personal.get(key))
    if not verified["education"]:
        missing.append("Học vấn")
    if not verified["experience"]:
        missing.append("Kinh nghiệm làm việc")
    if not verified["projects"]:
        missing.append("Dự án")
    if not verified["skills"]:
        missing.append("Kỹ năng")
    verified["missing_information"] = list(dict.fromkeys([*missing, *llm.get("missing_information", [])]))
    verified["guardrail"] = {
        "status": "passed",
        "rejected_unverified_claims": rejected,
        "is_verified_real": rejected == 0,
    }
    return {
        "verified_extraction": verified,
        "trace": [
            *state.get("trace", []),
            _trace("evidence_guardrail", "passed", f"Đã loại {rejected} claim không có bằng chứng."),
        ],
    }


async def finalize_cv_node(state: CVParserAgentState) -> dict[str, Any]:
    verified = state["verified_extraction"]
    personal = verified["personal_info"]
    components = {
        "contact": 15 if personal.get("email") and personal.get("phone") else 8 if any(personal.values()) else 0,
        "summary": 10 if verified.get("summary") else 0,
        "skills": 20 if len(verified.get("skills", [])) >= 5 else min(20, len(verified.get("skills", [])) * 4),
        "education": 15 if verified.get("education") else 0,
        "experience": 20 if verified.get("experience") else 0,
        "projects": 15 if verified.get("projects") else 0,
        "parse_quality": 5,
    }
    ats_score = float(sum(components.values()))
    fallback_used = bool(state.get("llm_requested") and not state.get("llm_succeeded", False))
    elapsed_ms = round((time.perf_counter() - state.get("started_at", time.perf_counter())) * 1000)
    result = {
        **verified,
        "ats_quality": {
            "score": ats_score,
            "components": components,
            "status": "strong" if ats_score >= 80 else "needs_review" if ats_score >= 60 else "incomplete",
        },
        "agent_metadata": {
            "agent_name": "CV Parsing & ATS Agent",
            "workflow_version": "2.0",
            "provider": state.get("provider", "openai"),
            "model": state.get("model", ""),
            "llm_requested": state.get("llm_requested", False),
            "llm_called": state.get("llm_called", False),
            "llm_succeeded": state.get("llm_succeeded", False),
            "llm_error": state.get("llm_error", ""),
            "fallback_used": fallback_used,
            "latency_ms": elapsed_ms,
            "trace": [*state.get("trace", []), _trace("finalize", "passed", "Kết quả sẵn sàng cho HITL review.")],
        },
        "parser_mode": (
            "openai_agent"
            if state.get("llm_succeeded")
            else "local_fallback"
            if state.get("llm_requested")
            else "local"
        ),
    }
    return {"final_result": result}
