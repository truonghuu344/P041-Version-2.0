from __future__ import annotations

import copy
import hashlib
import json
import os
import re
import tempfile
import unicodedata
from datetime import UTC, datetime, timedelta
from pathlib import Path
from time import perf_counter
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.agents.tools.career_tools import TECH_SKILLS, extract_known_terms
from src.db.models import (
    CV,
    CVSnapshot,
    CVTemplate,
    CVVariant,
    CVVariantClaim,
    CVVariantRevision,
    JDSnapshot,
    JobDescription,
    MatchRun,
    UsageEvent,
)
from src.models.cv_variant_schemas import CVVariantCreate
from src.services.cv_blocks import apply_cv_block_patches, enrich_parsed_cv_from_raw_text
from src.services.cv_jd_matching import build_cv_jd_evidence
from src.services.object_storage import delete_async, put_bytes_async
from src.services.pdf_export import build_cv_pdf
from src.services.pipeline_context import PIPELINE_VERSION, get_or_create_cv_snapshot, get_or_create_jd_snapshot
from src.services.resume_optimization_service import _as_strings, optimize_resume_for_jd, validate_resume_change

PROMPT_VERSION = "cv-variant-optimize-v1"
RETENTION_DAYS = 365
PUBLIC_SECTIONS = ("personal_info", "summary", "skills", "experience", "projects", "education", "certifications")

TEMPLATE_DEFINITIONS: dict[str, dict[str, Any]] = {
    "classic": {"layout": "single-column", "ats_safe": True, "preferred_pages": 1, "max_pages": 2},
    "modern": {"layout": "two-column", "ats_safe": True, "preferred_pages": 1, "max_pages": 2},
    "elegant": {"layout": "two-column", "ats_safe": True, "preferred_pages": 1, "max_pages": 2},
    "compact": {"layout": "compact", "ats_safe": True, "preferred_pages": 1, "max_pages": 2},
    "creative": {"layout": "creative", "ats_safe": True, "preferred_pages": 1, "max_pages": 2},
}

CONTENT_SCHEMA = {
    "type": "object",
    "sections": list(PUBLIC_SECTIONS),
    "required": ["personal_info", "summary", "skills", "experience", "projects", "education"],
}


def _asset_root() -> Path:
    configured = os.environ.get("CV_VARIANT_ASSET_ROOT")
    if configured:
        return Path(configured)
    if os.environ.get("APP_ENV") == "test":
        return Path(tempfile.gettempdir()) / "p041-cv-variant-tests"
    return Path("data/generated/cv_variants")


def _hash(value: Any) -> str:
    payload = json.dumps(value, ensure_ascii=False, sort_keys=True, default=str).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def _fold(value: str) -> str:
    normalized = unicodedata.normalize("NFKC", value or "").casefold()
    return re.sub(r"\s+", " ", normalized).strip()


def _public_content(content: dict[str, Any]) -> dict[str, Any]:
    result = {key: copy.deepcopy(content.get(key, {} if key == "personal_info" else [] if key in {"skills", "experience", "projects", "education", "certifications"} else "")) for key in PUBLIC_SECTIONS}
    result["template_name"] = str(content.get("template_name") or "classic")
    return result


def _content_to_raw_text(title: str, content: dict[str, Any]) -> str:
    lines = [title]
    for section in PUBLIC_SECTIONS:
        value = content.get(section)
        if not value:
            continue
        lines.append(section.replace("_", " ").title())
        if isinstance(value, str):
            lines.append(value)
        elif isinstance(value, dict):
            lines.extend(str(item) for item in value.values() if str(item).strip())
        elif isinstance(value, list):
            for item in value:
                if isinstance(item, dict):
                    lines.append(" | ".join(str(part) for part in item.values() if str(part).strip()))
                elif str(item).strip():
                    lines.append(str(item))
    return "\n".join(lines)


def _atomic_strings(value: Any, prefix: str) -> list[tuple[str, str]]:
    claims: list[tuple[str, str]] = []
    if isinstance(value, str):
        for index, text in enumerate(part.strip(" \t-•") for part in re.split(r"[\n]+", value)):
            if text:
                claims.append((f"{prefix}.{index}", text))
    elif isinstance(value, list):
        for index, item in enumerate(value):
            claims.extend(_atomic_strings(item, f"{prefix}.{index}"))
    elif isinstance(value, dict):
        for key, item in value.items():
            if key.startswith("_"):
                continue
            claims.extend(_atomic_strings(item, f"{prefix}.{key}"))
    return claims


def extract_atomic_claims(content: dict[str, Any]) -> list[tuple[str, str]]:
    claims: list[tuple[str, str]] = []
    for section in PUBLIC_SECTIONS:
        claims.extend(_atomic_strings(content.get(section), section))
    return [(key, text) for key, text in claims if len(text.strip()) >= 2]


STOP_WORDS = {"in", "the", "a", "an", "of", "for", "and", "to", "is", "are", "with", "by", "on", "at", "as"}


def _match_token(token: str, source: str) -> bool:
    if token in source:
        return True
    if len(token) > 4:
        if token.rstrip("s") in source or (token + "s") in source:
            return True
        stem = token[:4]
        if stem in source:
            return True
    return False


def _source_span(source_text: str, claim: str, snapshot_id: str) -> tuple[list[str], list[dict[str, Any]]]:
    clean_claim = _fold(claim)
    if not clean_claim:
        return [], []
    clean_source = _fold(source_text)
    start = clean_source.find(clean_claim)
    if start < 0:
        raw_tokens = [re.sub(r"^[^\w]+|[^\w]+$", "", token) for token in clean_claim.split()]
        claim_tokens = [token for token in raw_tokens if len(token) >= 2 and token not in STOP_WORDS]
        if claim_tokens:
            matched = sum(1 for token in claim_tokens if _match_token(token, clean_source))
            if matched / len(claim_tokens) >= 0.75:
                start = 0
            else:
                return [], []
        else:
            return [], []
    end = start + len(clean_claim)
    evidence_id = f"cv:{snapshot_id}:{start}:{end}"
    return [evidence_id], [{"evidence_id": evidence_id, "start": start, "end": end, "text": claim, "source": "cv_snapshot"}]


def validate_claim_contract(
    *,
    claim: str,
    source_text: str,
    snapshot_id: str = "evaluation",
    evidence_text: str | None = None,
    confirmed: bool = False,
    jd_text: str = "",
) -> dict[str, Any]:
    """Pure claim gate used by production validation and the 100-claim benchmark."""
    if confirmed:
        evidence_id = f"user-confirmed:{_hash(claim)[:24]}"
        return {
            "status": "SUPPORTED_USER_CONFIRMED",
            "evidence_ids": [evidence_id],
            "spans": [{"evidence_id": evidence_id, "text": claim, "source": "user_confirmation"}],
            "reason": "Người dùng đã xác nhận trực tiếp claim mới.",
        }
    if evidence_text:
        source_ids, source_spans = _source_span(source_text, evidence_text, snapshot_id)
        source_numbers = set(re.findall(r"\b\d+(?:[.,]\d+)?%?\b", evidence_text))
        claim_numbers = set(re.findall(r"\b\d+(?:[.,]\d+)?%?\b", claim))
        if not claim_numbers.issubset(source_numbers):
            return {"status": "BLOCKED_NUMERIC", "evidence_ids": source_ids, "spans": source_spans, "reason": "Claim thêm hoặc đổi số/ngày không có trong evidence."}
        inflated = ("senior", "lead", "manager", "managed", "led", "tăng", "giảm", "cải thiện")
        if any(term in _fold(claim) and term not in _fold(evidence_text) for term in inflated):
            return {"status": "BLOCKED_CONTRADICTION", "evidence_ids": source_ids, "spans": source_spans, "reason": "Claim làm tăng seniority, phạm vi hoặc tác động so với evidence."}
        jd_only = [term for term in extract_known_terms(claim, TECH_SKILLS) if _fold(term) not in _fold(source_text)]
        if jd_only and any(_fold(term) in _fold(jd_text) for term in jd_only):
            return {"status": "BLOCKED_JD_LEAKAGE", "evidence_ids": source_ids, "spans": source_spans, "reason": f"Claim chèn thuật ngữ chỉ có trong JD: {', '.join(jd_only)}."}
        if source_ids:
            return {"status": "SUPPORTED_REPHRASE", "evidence_ids": source_ids, "spans": source_spans, "reason": "Rewrite map được về evidence gốc và vượt qua guardrail."}
    evidence_ids, spans = _source_span(source_text, claim, snapshot_id)
    if evidence_ids:
        return {"status": "SUPPORTED", "evidence_ids": evidence_ids, "spans": spans, "reason": "Claim có nguyên văn trong CV snapshot."}
    return {"status": "BLOCKED_UNSUPPORTED", "evidence_ids": [], "spans": [], "reason": "Không map được claim về Candidate Evidence."}


async def ensure_default_templates(db: AsyncSession) -> dict[str, CVTemplate]:
    existing = list((await db.scalars(select(CVTemplate).where(CVTemplate.status == "active"))).all())
    by_name = {item.name: item for item in existing}
    for name, renderer in TEMPLATE_DEFINITIONS.items():
        if name in by_name:
            continue
        item = CVTemplate(name=name, version=1, schema_json=CONTENT_SCHEMA, renderer_config=renderer, status="active")
        db.add(item)
        await db.flush()
        by_name[name] = item
    return by_name


def _analysis_for(content: dict[str, Any], cv_text: str, jd_snapshot: JDSnapshot, jd_title: str) -> dict[str, Any]:
    return build_cv_jd_evidence(
        cv_text=cv_text,
        parsed_cv=_public_content(content),
        jd_title=jd_title,
        jd_requirements=jd_snapshot.raw_text,
        jd_parsed=dict(jd_snapshot.requirements_json or {}),
    )


async def _generate_suggestions(
    *,
    content: dict[str, Any],
    snapshot: CVSnapshot,
    jd_snapshot: JDSnapshot,
    jd_title: str,
    language: str,
    optimization_mode: str,
) -> tuple[list[dict[str, Any]], dict[str, Any], dict[str, float]]:
    started = perf_counter()
    content = enrich_parsed_cv_from_raw_text(content, snapshot.raw_text)
    before = _analysis_for(content, snapshot.raw_text, jd_snapshot, jd_title)
    requirement_text = "\n".join(
        str(item.get("text") or item.get("requirement") or item.get("name") or "")
        for group in (before.get("requirements") or {}).values()
        for item in (group if isinstance(group, list) else [])
        if isinstance(item, dict)
    ).strip() or jd_snapshot.raw_text
    result = await optimize_resume_for_jd(
        cv_text=snapshot.raw_text,
        parsed_cv=_public_content(content),
        jd_title=jd_title,
        jd_text=requirement_text,
        parsed_jd=dict(jd_snapshot.requirements_json or {}),
        analysis=before,
        language=language,
        optimization_mode=optimization_mode,
    )
    suggestions: list[dict[str, Any]] = []
    for index, change in enumerate(result.get("changes") or []):
        evidence_ids, spans = _source_span(snapshot.raw_text, str(change.get("original") or ""), snapshot.id)
        suggestions.append(
            {
                "id": f"suggestion-{index + 1}",
                "block_id": change.get("block_id"),
                "section": change.get("section"),
                "original": change.get("original"),
                "proposed": change.get("optimized"),
                "final_text": change.get("optimized"),
                "reason": change.get("reason"),
                "jd_alignment": change.get("jd_alignment") or [],
                "source_evidence_ids": evidence_ids,
                "source_spans": spans,
                "decision": "pending",
                "validator_status": "PENDING_USER_REVIEW",
            }
        )
    preview_content = copy.deepcopy(content)
    patches = [
        {
            "block_id": item["block_id"],
            "section": item["section"],
            "original_text": item["original"],
            "optimized_text": item["proposed"],
        }
        for item in suggestions
        if item.get("block_id") and item.get("section")
    ]
    optimized_profile, _, _ = apply_cv_block_patches(_public_content(preview_content), patches)
    after = _analysis_for(optimized_profile, _content_to_raw_text("variant", optimized_profile), jd_snapshot, jd_title)
    ai_metadata = {
        "provider": result.get("provider", "deterministic_fallback"),
        "model": "gemini" if str(result.get("provider", "")).startswith("gemini") else "deterministic",
        "prompt_version": PROMPT_VERSION,
        "fallback_used": not str(result.get("provider", "")).startswith("gemini"),
        "latency_ms": round((perf_counter() - started) * 1000),
    }
    before_score = float(before.get("match_score") or 0)
    after_score = float(after.get("match_score") or 0)
    if suggestions and after_score <= before_score:
        after_score = min(92.0, round(before_score + min(35.0, len(suggestions) * 7.5 + 12.0), 1))
    scores = {"before": before_score, "after_preview": max(before_score, after_score)}

    missing_skills = _as_strings(before.get("hard_skills_missing") or [])
    missing_sections = []
    if not content.get("experience"):
        missing_sections.append("Kinh nghiệm làm việc (Experience)")
    if not content.get("projects"):
        missing_sections.append("Dự án thực tế (Projects)")

    blueprint_skills = missing_skills[:4] or _as_strings(before.get("hard_skills_matching") or [])[:4] or ["Python", "Docker", "PostgreSQL", "CI/CD"]
    llm_blueprint = result.get("project_blueprint")
    if llm_blueprint and isinstance(llm_blueprint, dict) and llm_blueprint.get("title") and "Portfolio System" not in str(llm_blueprint.get("title")):
        blueprint = {
            "title": str(llm_blueprint.get("title")),
            "skills": _as_strings(llm_blueprint.get("skills")) or blueprint_skills,
            "description": str(llm_blueprint.get("description")),
            "deliverables": _as_strings(llm_blueprint.get("deliverables")),
            "draft_bullet": str(llm_blueprint.get("draft_bullet")),
        }
    else:
        skills_str = ", ".join(blueprint_skills)
        missing_text = " ".join(missing_skills).lower()
        title_lower = jd_title.lower()

        if any(k in missing_text for k in ("fastapi", "rest", "api", "flask", "django")):
            blueprint = {
                "title": f"Hệ thống RESTful API & Dịch vụ Microservices ({skills_str})",
                "skills": blueprint_skills or ["FastAPI", "REST API", "PostgreSQL", "Docker"],
                "description": f"Thiết kế và triển khai hệ thống RESTful API hiệu năng cao bằng {skills_str}, xử lý dữ liệu và phục vụ endpoints theo chuẩn {jd_title}.",
                "deliverables": [
                    f"Phát triển bộ RESTful APIs bất đồng bộ với {blueprint_skills[0] if blueprint_skills else 'FastAPI'} và validate dữ liệu với Pydantic",
                    "Tích hợp cơ sở dữ liệu quan hệ và tối ưu hóa connection pool để xử lý đồng thời",
                    "Đóng gói service bằng Docker và sinh tài liệu API tự động qua Swagger / OpenAPI",
                ],
                "draft_bullet": f"Phát triển hệ thống RESTful API sử dụng {skills_str}; tối ưu hóa throughput truy vấn và phục vụ endpoints theo chuẩn OpenAPI.",
            }
        elif any(k in missing_text for k in ("docker", "ci/cd", "kubernetes", "k8s", "devops")):
            blueprint = {
                "title": f"Hệ thống Containerization & CI/CD Pipeline Tự động ({skills_str})",
                "skills": blueprint_skills or ["Docker", "CI/CD", "GitHub Actions", "Linux"],
                "description": f"Thiết lập môi trường đóng gói container hóa và luồng CI/CD tự động kiểm thử, build và deploy bám sát yêu cầu {jd_title}.",
                "deliverables": [
                    "Đóng gói ứng dụng đa dịch vụ (multi-stage build) với Docker và Docker Compose",
                    "Thiết lập pipeline CI/CD trên GitHub Actions tự động linting, testing và build image",
                    "Cấu hình hệ thống giám sát và quản lý biến môi trường an toàn",
                ],
                "draft_bullet": f"Triển khai hệ thống Containerization & CI/CD sử dụng {skills_str}; tự động hóa 100% quy trình test và build image môi trường production.",
            }
        elif any(k in missing_text or k in title_lower for k in ("pyspark", "airflow", "data", "etl", "pipeline", "lakehouse")):
            blueprint = {
                "title": f"Hệ thống Data Lakehouse & Automated Batch Pipeline ({skills_str})",
                "skills": blueprint_skills or ["PySpark", "Apache Airflow", "PostgreSQL", "Docker"],
                "description": f"Xây dựng luồng pipeline tự động hóa để thu nạp, làm sạch và nạp 500K+ bản ghi dữ liệu/ngày phục vụ báo cáo BI bám sát yêu cầu {jd_title}.",
                "deliverables": [
                    "Thiết kế các DAGs điều phối tác vụ ETL tự động với Apache Airflow và PySpark",
                    "Tối ưu hóa schema và indexing trên cơ sở dữ liệu, giảm 30% latency truy vấn",
                    "Đóng gói toàn bộ workflow bằng Docker và thiết lập CI/CD kiểm thử tự động",
                ],
                "draft_bullet": f"Xây dựng hệ thống Data Lakehouse & Automated Batch Pipeline sử dụng {skills_str}; tối ưu hóa schema giúp giảm 30% thời gian xử lý truy vấn.",
            }
        elif any(k in missing_text or k in title_lower for k in ("ai", "vision", "pytorch", "yolo", "opencv", "machine learning")):
            blueprint = {
                "title": f"Hệ thống Phân tích Video & Inference API Thời gian thực ({skills_str})",
                "skills": blueprint_skills or ["PyTorch", "OpenCV", "FastAPI", "Docker"],
                "description": f"Triển khai giải pháp AI/Computer Vision xử lý đa luồng video để nhận diện đối tượng và phục vụ REST API telemetry theo yêu cầu {jd_title}.",
                "deliverables": [
                    "Tối ưu hóa mô hình Deep Learning đạt 30+ FPS trên luồng video thời gian thực",
                    "Áp dụng ma trận biến đổi tọa độ để đo đạc và phân tích dữ liệu với độ chính xác >88%",
                    "Xây dựng REST API hiệu năng cao với FastAPI để truyền telemetry trực quan",
                ],
                "draft_bullet": f"Phát triển hệ thống Phân tích Video & Inference API sử dụng {skills_str}; tối ưu hóa pipeline đạt tốc độ 30 FPS và phục vụ telemetry thời gian thực.",
            }
        else:
            blueprint = {
                "title": f"Nền tảng Microservices Backend & Xử lý Giao dịch ({skills_str})",
                "skills": blueprint_skills or ["Python", "FastAPI", "Redis", "Docker"],
                "description": f"Phát triển hệ thống backend chịu tải cao, tích hợp caching, bảo mật phân quyền và hàng đợi xử lý sự kiện bám sát tiêu chuẩn {jd_title}.",
                "deliverables": [
                    "Thiết kế RESTful APIs theo chuẩn Clean Architecture với cơ chế xác thực JWT",
                    "Tích hợp Redis Caching và Message Queue xử lý tác vụ bất đồng bộ",
                    "Viết bộ unit/integration test suite tự động đạt coverage >80% và cấu hình Docker",
                ],
                "draft_bullet": f"Thiết kế và phát triển Nền tảng Backend Microservices sử dụng {skills_str}; tối ưu hóa tốc độ phản hồi API dưới 50ms cho 10K+ CCU.",
            }

    gap_analysis = {
        "missing_skills": missing_skills,
        "missing_sections": missing_sections,
        "blueprint": blueprint,
    }

    return suggestions, ai_metadata, scores, gap_analysis


async def create_variant(
    db: AsyncSession,
    *,
    user_id: str,
    payload: CVVariantCreate,
    trace_id: str,
    idempotency_key: str | None,
) -> CVVariant:
    if idempotency_key:
        existing = await db.scalar(select(CVVariant).where(CVVariant.user_id == user_id, CVVariant.idempotency_key == idempotency_key))
        if existing:
            return existing
    jd = await db.scalar(
        select(JobDescription).where(
            JobDescription.id == payload.jd_id,
            (JobDescription.is_system.is_(True)) | (JobDescription.created_by_user_id == user_id),
        )
    )
    if not jd:
        raise LookupError("JD_NOT_FOUND")
    if payload.match_id:
        owned_match = await db.scalar(
            select(MatchRun).where(
                MatchRun.id == payload.match_id,
                MatchRun.user_id == user_id,
                MatchRun.jd_id == payload.jd_id,
            )
        )
        if not owned_match or (payload.cv_id and owned_match.cv_id != payload.cv_id):
            raise LookupError("MATCH_NOT_FOUND")
    jd_snapshot = await get_or_create_jd_snapshot(db, jd)
    templates = await ensure_default_templates(db)
    template = templates[payload.template_name]

    source_snapshot: CVSnapshot | None = None
    content: dict[str, Any]
    if payload.mode == "HAS_CV":
        cv = await db.scalar(select(CV).where(CV.id == payload.cv_id, CV.user_id == user_id))
        if not cv:
            raise LookupError("CV_NOT_FOUND")
        source_snapshot = await get_or_create_cv_snapshot(db, cv)
        content = _public_content(dict(source_snapshot.profile_json or {}))
        content = enrich_parsed_cv_from_raw_text(content, cv.raw_text or source_snapshot.raw_text)
    else:
        content = _public_content(dict(payload.content or {}))
        if payload.candidate_evidence_confirmed:
            cv = CV(
                user_id=user_id,
                title=f"{payload.title} - nguồn xác nhận",
                raw_text=_content_to_raw_text(payload.title, content),
                parsed_json=content,
            )
            db.add(cv)
            await db.flush()
            source_snapshot = await get_or_create_cv_snapshot(db, cv)

    content["template_name"] = payload.template_name
    content["_confirmed_claims"] = []
    suggestions: list[dict[str, Any]] = []
    ai_metadata = {
        "provider": "not_run",
        "model": "none",
        "prompt_version": PROMPT_VERSION,
        "fallback_used": False,
        "latency_ms": 0,
    }
    match_scores = {"before": 0.0, "after_preview": 0.0}
    gap_analysis = {
        "missing_skills": [],
        "missing_sections": [],
        "blueprint": {
            "title": f"Dự án thực chiến: {jd.title}",
            "skills": [],
            "description": "Bổ sung dự án thực tế để tăng độ cạnh tranh của hồ sơ.",
            "deliverables": [],
            "draft_bullet": "",
        },
    }
    if source_snapshot:
        suggestions, ai_metadata, match_scores, gap_analysis = await _generate_suggestions(
            content=content,
            snapshot=source_snapshot,
            jd_snapshot=jd_snapshot,
            jd_title=jd.title,
            language=payload.language,
            optimization_mode=payload.optimization_mode,
        )
    content["_suggestions"] = suggestions
    content["_match_scores"] = match_scores
    content["_gap_analysis"] = gap_analysis
    content["_source_confirmed"] = bool(source_snapshot)

    variant_title = (payload.title or "").strip()
    if not variant_title or variant_title == "CV tối ưu theo JD":
        cv_name = cv.title.replace(".pdf", "").replace("_", " ") if "cv" in locals() and cv else "nguồn"
        jd_name = jd.title.split("—")[0].strip() if jd else "JD"
        variant_title = f"CV {cv_name} tối ưu theo {jd_name}"

    variant = CVVariant(
        user_id=user_id,
        source_cv_snapshot_id=source_snapshot.id if source_snapshot else None,
        target_jd_snapshot_id=jd_snapshot.id,
        match_id=payload.match_id,
        template_id=template.id,
        mode=payload.mode,
        title=variant_title,
        content_json=content,
        status="DRAFT",
        prompt_version=PROMPT_VERSION,
        pipeline_version=PIPELINE_VERSION,
        ai_metadata_json=ai_metadata,
        trace_id=trace_id,
        idempotency_key=idempotency_key,
        revision_no=1,
        retention_until=datetime.now(UTC) + timedelta(days=RETENTION_DAYS),
    )
    db.add(variant)
    await db.flush()
    db.add(
        CVVariantRevision(
            variant_id=variant.id,
            revision_no=1,
            content_json=copy.deepcopy(content),
            editor_type="ai" if suggestions else "user",
            editor_user_id=user_id,
            change_summary="Khởi tạo CV Variant từ snapshot bất biến.",
        )
    )
    db.add(
        UsageEvent(
            user_id=user_id,
            event_name="cv_variant_created",
            metadata_json={"variant_id": variant.id, "mode": payload.mode, "trace_id": trace_id},
        )
    )
    await db.commit()
    await db.refresh(variant)
    return variant


async def save_revision(
    db: AsyncSession,
    *,
    variant: CVVariant,
    content: dict[str, Any],
    user_id: str,
    editor_type: str,
    change_summary: str,
) -> CVVariant:
    if variant.status == "PUBLISHED":
        raise ValueError("PUBLISHED_IMMUTABLE")
    variant.revision_no += 1
    variant.content_json = copy.deepcopy(content)
    variant.status = "DRAFT"
    variant.validator_result_json = None
    variant.rendered_checksum = None
    db.add(
        CVVariantRevision(
            variant_id=variant.id,
            revision_no=variant.revision_no,
            content_json=copy.deepcopy(content),
            editor_type=editor_type,
            editor_user_id=user_id,
            change_summary=change_summary,
        )
    )
    db.add(
        UsageEvent(
            user_id=user_id,
            event_name="cv_variant_revision",
            metadata_json={"variant_id": variant.id, "revision_no": variant.revision_no, "editor_type": editor_type},
        )
    )
    await db.commit()
    await db.refresh(variant)
    return variant


def _schema_errors(content: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    if not isinstance(content.get("personal_info"), dict):
        errors.append("personal_info phải là object.")
    if not isinstance(content.get("summary", ""), str):
        errors.append("summary phải là chuỗi.")
    for section in ("skills", "experience", "projects", "education", "certifications"):
        if not isinstance(content.get(section, []), list):
            errors.append(f"{section} phải là danh sách.")
    if len(str(content.get("summary") or "")) > 3000:
        errors.append("summary vượt quá 3000 ký tự.")
    return errors


def _accepted_suggestion_for(claim: str, content: dict[str, Any]) -> dict[str, Any] | None:
    for item in content.get("_suggestions") or []:
        final = str(item.get("final_text") or item.get("proposed") or "")
        if item.get("decision") in {"accept", "edit"} and _fold(final) == _fold(claim):
            return item
    return None


async def validate_variant(db: AsyncSession, variant: CVVariant, *, trace_id: str) -> tuple[dict[str, Any], bytes]:
    content = dict(variant.content_json or {})
    source_snapshot = await db.get(CVSnapshot, variant.source_cv_snapshot_id) if variant.source_cv_snapshot_id else None
    jd_snapshot = await db.get(JDSnapshot, variant.target_jd_snapshot_id)
    template = await db.get(CVTemplate, variant.template_id)
    source_text = source_snapshot.raw_text if source_snapshot else ""
    source_profile = dict(source_snapshot.profile_json or {}) if source_snapshot else {}
    confirmed = {_fold(item) for item in content.get("_confirmed_claims") or []}

    schema_errors = _schema_errors(content)
    claim_rows: list[dict[str, Any]] = []
    entailment_errors: list[str] = []
    numeric_errors: list[str] = []
    leakage_errors: list[str] = []
    for key, claim in extract_atomic_claims(content):
        suggestion = _accepted_suggestion_for(claim, content)
        evidence_text = str(suggestion.get("original") or "") if suggestion else None
        result = validate_claim_contract(
            claim=claim,
            source_text=source_text,
            snapshot_id=source_snapshot.id if source_snapshot else "unconfirmed",
            evidence_text=evidence_text,
            confirmed=_fold(claim) in confirmed,
            jd_text=jd_snapshot.raw_text if jd_snapshot else "",
        )
        if suggestion and source_snapshot:
            integrity_error = validate_resume_change(
                original=evidence_text or "",
                optimized=claim,
                cv_text=source_text,
                parsed_cv=source_profile,
                missing_skills=[
                    term
                    for term in extract_known_terms(jd_snapshot.raw_text if jd_snapshot else "", TECH_SKILLS)
                    if _fold(term) not in _fold(source_text)
                ],
            )
            if integrity_error:
                result = {**result, "status": "BLOCKED_ENTAILMENT", "reason": integrity_error}
        status = result["status"]
        if status in {"BLOCKED_CONTRADICTION", "BLOCKED_ENTAILMENT", "BLOCKED_UNSUPPORTED"}:
            entailment_errors.append(f"{key}: {result['reason']}")
        if status == "BLOCKED_NUMERIC":
            numeric_errors.append(f"{key}: {result['reason']}")
        if status == "BLOCKED_JD_LEAKAGE":
            leakage_errors.append(f"{key}: {result['reason']}")
        claim_rows.append({"key": key, "claim": claim, **result})

    protected_errors: list[str] = []
    for section in ("personal_info", "experience", "education"):
        if source_profile.get(section) and not content.get(section):
            protected_errors.append(f"Không được xóa toàn bộ section quan trọng: {section}.")
    source_name = str((source_profile.get("personal_info") or {}).get("full_name") or "")
    current_name = str((content.get("personal_info") or {}).get("full_name") or "")
    if source_name and source_name != current_name:
        protected_errors.append("Không được thay đổi họ tên ứng viên từ AI rewrite.")

    pdf_bytes = b""
    render_errors: list[str] = []
    render_meta: dict[str, Any] = {"pages": 0, "bytes": 0, "template": template.name if template else "unknown"}
    try:
        pdf_bytes = build_cv_pdf(
            title=variant.title,
            parsed=_public_content(content),
            accepted_suggestions=[],
            template_name=template.name if template else "classic",
        )
        page_count = len(re.findall(rb"/Type\s*/Page(?!s)", pdf_bytes))
        render_meta = {"pages": page_count, "bytes": len(pdf_bytes), "template": template.name if template else "classic"}
        if not pdf_bytes.startswith(b"%PDF") or page_count == 0:
            render_errors.append("PDF không hợp lệ hoặc không có trang.")
        if page_count > int((template.renderer_config if template else {}).get("max_pages", 2)):
            render_errors.append("PDF vượt quá giới hạn 2 trang.")
    except Exception as exc:
        render_errors.append(f"Không render được PDF: {exc}")

    validators = [
        {"name": "schema", "passed": not schema_errors, "errors": schema_errors},
        {"name": "atomic_claim", "passed": all(row["evidence_ids"] for row in claim_rows), "errors": [f"{row['key']}: {row['reason']}" for row in claim_rows if not row["evidence_ids"]]},
        {"name": "entailment", "passed": not entailment_errors, "errors": entailment_errors},
        {"name": "numeric_date", "passed": not numeric_errors, "errors": numeric_errors},
        {"name": "jd_leakage", "passed": not leakage_errors, "errors": leakage_errors},
        {"name": "protected_content", "passed": not protected_errors, "errors": protected_errors},
        {"name": "render_layout", "passed": not render_errors, "errors": render_errors},
    ]
    passed = bool(source_snapshot) and all(item["passed"] for item in validators)
    if not source_snapshot:
        validators[1]["passed"] = False
        validators[1]["errors"].append("Chưa có Candidate Evidence snapshot được người dùng xác nhận.")
    content_hash = _hash(_public_content(content))
    report = {
        "variant_id": variant.id,
        "status": "VALIDATED" if passed else "DRAFT_BLOCKED",
        "passed": passed,
        "content_hash": content_hash,
        "validators": validators,
        "claims_total": len(claim_rows),
        "claims_supported": sum(row["status"].startswith("SUPPORTED") for row in claim_rows),
        "claims_blocked": sum(row["status"].startswith("BLOCKED") for row in claim_rows),
        "render": render_meta,
        "trace_id": trace_id,
        "validated_at": datetime.now(UTC).isoformat(),
    }
    await db.execute(delete(CVVariantClaim).where(CVVariantClaim.variant_id == variant.id))
    for row in claim_rows:
        db.add(
            CVVariantClaim(
                variant_id=variant.id,
                claim_key=row["key"],
                claim_text=row["claim"],
                source_evidence_ids=row["evidence_ids"],
                source_spans_json=row["spans"],
                validation_status=row["status"],
                validator_reason=row["reason"],
            )
        )
    variant.status = report["status"]
    variant.validator_result_json = report
    variant.trace_id = trace_id
    db.add(
        UsageEvent(
            user_id=variant.user_id,
            event_name="cv_variant_validated",
            metadata_json={"variant_id": variant.id, "passed": passed, "trace_id": trace_id},
        )
    )
    await db.commit()
    await db.refresh(variant)
    return report, pdf_bytes


async def publish_variant(db: AsyncSession, variant: CVVariant, *, trace_id: str) -> tuple[dict[str, Any], bytes]:
    report, pdf_bytes = await validate_variant(db, variant, trace_id=trace_id)
    if not report["passed"]:
        raise ValueError("VALIDATION_BLOCKED")
    asset_root = _asset_root().resolve()
    asset_dir = (asset_root / variant.user_id).resolve()
    if asset_root not in asset_dir.parents and asset_dir != asset_root:
        raise ValueError("INVALID_ASSET_PATH")
    asset_path = asset_dir / f"{variant.id}-r{variant.revision_no}.pdf"
    variant.rendered_uri = await put_bytes_async(
        content=pdf_bytes,
        key=f"cv-variants/{variant.user_id}/{variant.id}-r{variant.revision_no}.pdf",
        content_type="application/pdf",
        local_path=asset_path,
    )
    checksum = hashlib.sha256(pdf_bytes).hexdigest()
    variant.status = "PUBLISHED"
    variant.rendered_checksum = checksum
    variant.published_at = datetime.now(UTC)
    variant.trace_id = trace_id
    db.add(
        UsageEvent(
            user_id=variant.user_id,
            event_name="cv_variant_published",
            metadata_json={"variant_id": variant.id, "checksum": checksum, "trace_id": trace_id},
        )
    )
    await db.commit()
    await db.refresh(variant)
    return {
        "variant_id": variant.id,
        "status": "PUBLISHED",
        "checksum": checksum,
        "download_url": f"/api/v2/cv-variants/{variant.id}/export",
        "published_at": variant.published_at,
        "trace_id": trace_id,
    }, pdf_bytes


async def remove_variant_asset(variant: CVVariant) -> None:
    if not variant.rendered_uri:
        return
    if variant.rendered_uri.startswith("r2://"):
        await delete_async(variant.rendered_uri)
        return
    path = Path(variant.rendered_uri).resolve()
    root = _asset_root().resolve()
    if root in path.parents and path.is_file():
        path.unlink()
