from __future__ import annotations

import copy
import uuid

from fastapi import APIRouter, Depends, Header, Query, Request, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.errors import CVVariantError
from src.core.security import get_current_user
from src.db.database import get_db
from src.db.models import (
    CVSnapshot,
    CVTemplate,
    CVVariant,
    CVVariantClaim,
    CVVariantRevision,
    JDSnapshot,
    UsageEvent,
    User,
)
from src.models.cv_variant_schemas import (
    CVVariantCreate,
    CVVariantListOut,
    CVVariantOut,
    CVVariantPublishOut,
    CVVariantSuggestionDecision,
    CVVariantTemplateOut,
    CVVariantUpdate,
    CVVariantValidationOut,
)
from src.services.cv_blocks import apply_cv_block_patches
from src.services.cv_variant_service import (
    create_variant,
    ensure_default_templates,
    publish_variant,
    remove_variant_asset,
    save_revision,
    validate_claim_contract,
    validate_variant,
)
from src.services.object_storage import ObjectStorageError, get_bytes_async

router = APIRouter(prefix="/cv-variants", tags=["CV Variants v2"])


def _trace_id(request: Request) -> str:
    return request.headers.get("X-Trace-ID") or uuid.uuid4().hex


def _error(code: str, message: str, request: Request, status_code: int = 400, retryable: bool = False):
    raise CVVariantError(code, message, status_code=status_code, retryable=retryable, trace_id=_trace_id(request))


async def _owned_variant(db: AsyncSession, variant_id: str, user_id: str, request: Request) -> CVVariant:
    variant = await db.scalar(select(CVVariant).where(CVVariant.id == variant_id, CVVariant.user_id == user_id))
    if not variant:
        _error("CV_VARIANT_NOT_FOUND", "Không tìm thấy CV Variant thuộc tài khoản này.", request, 404)
    return variant


async def _serialize(db: AsyncSession, variant: CVVariant, *, include_history: bool = True) -> dict:
    template = await db.get(CVTemplate, variant.template_id)
    claims = list(
        (
            await db.scalars(
                select(CVVariantClaim)
                .where(CVVariantClaim.variant_id == variant.id)
                .order_by(CVVariantClaim.claim_key)
            )
        ).all()
    )
    revisions = []
    if include_history:
        revisions = list(
            (
                await db.scalars(
                    select(CVVariantRevision)
                    .where(CVVariantRevision.variant_id == variant.id)
                    .order_by(CVVariantRevision.revision_no.desc())
                )
            ).all()
        )
    return {
        "id": variant.id,
        "user_id": variant.user_id,
        "source_cv_snapshot_id": variant.source_cv_snapshot_id,
        "target_jd_snapshot_id": variant.target_jd_snapshot_id,
        "match_id": variant.match_id,
        "template": {
            "id": template.id,
            "name": template.name,
            "version": template.version,
            "schema": template.schema_json,
            "renderer_config": template.renderer_config,
        },
        "mode": variant.mode,
        "title": variant.title,
        "content": variant.content_json,
        "status": variant.status,
        "prompt_version": variant.prompt_version,
        "pipeline_version": variant.pipeline_version,
        "validator_result": variant.validator_result_json,
        "ai_metadata": variant.ai_metadata_json or {},
        "rendered_checksum": variant.rendered_checksum,
        "trace_id": variant.trace_id,
        "revision_no": variant.revision_no,
        "published_at": variant.published_at,
        "retention_until": variant.retention_until,
        "created_at": variant.created_at,
        "updated_at": variant.updated_at,
        "claims": [
            {
                "id": item.id,
                "claim_key": item.claim_key,
                "claim_text": item.claim_text,
                "source_evidence_ids": item.source_evidence_ids or [],
                "source_spans": item.source_spans_json or [],
                "validation_status": item.validation_status,
                "validator_reason": item.validator_reason,
            }
            for item in claims
        ],
        "revisions": [
            {
                "revision_no": item.revision_no,
                "editor_type": item.editor_type,
                "change_summary": item.change_summary,
                "content": item.content_json,
                "created_at": item.created_at,
            }
            for item in revisions
        ],
    }


@router.get("/templates", response_model=list[CVVariantTemplateOut])
async def list_templates(
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> list[dict]:
    templates = await ensure_default_templates(db)
    await db.commit()
    return [
        {
            "id": item.id,
            "name": item.name,
            "version": item.version,
            "schema": item.schema_json,
            "renderer_config": item.renderer_config,
        }
        for item in templates.values()
    ]


@router.post("", response_model=CVVariantOut, status_code=status.HTTP_201_CREATED)
async def create_cv_variant(
    payload: CVVariantCreate,
    request: Request,
    response: Response,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    trace_id = _trace_id(request)
    try:
        variant = await create_variant(
            db,
            user_id=current_user.id,
            payload=payload,
            trace_id=trace_id,
            idempotency_key=idempotency_key,
        )
    except LookupError as exc:
        code = str(exc)
        _error(code, "Không tìm thấy CV/JD hợp lệ hoặc bạn không có quyền truy cập.", request, 404)
    response.headers["X-Trace-ID"] = trace_id
    return await _serialize(db, variant)


@router.get("", response_model=CVVariantListOut)
async def list_cv_variants(
    request: Request,
    cv_id: str | None = None,
    jd_id: str | None = None,
    variant_status: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    query = select(CVVariant).where(CVVariant.user_id == current_user.id)
    if cv_id:
        query = query.join(CVSnapshot, CVSnapshot.id == CVVariant.source_cv_snapshot_id).where(CVSnapshot.cv_id == cv_id)
    if jd_id:
        query = query.join(JDSnapshot, JDSnapshot.id == CVVariant.target_jd_snapshot_id).where(JDSnapshot.jd_id == jd_id)
    if variant_status:
        query = query.where(CVVariant.status == variant_status)
    items = list((await db.scalars(query.order_by(CVVariant.created_at.desc()).limit(limit))).all())
    return {"items": [await _serialize(db, item, include_history=False) for item in items], "total": len(items)}


@router.get("/{variant_id}", response_model=CVVariantOut)
async def get_cv_variant(
    variant_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    return await _serialize(db, await _owned_variant(db, variant_id, current_user.id, request))


@router.patch("/{variant_id}", response_model=CVVariantOut)
async def autosave_cv_variant(
    variant_id: str,
    payload: CVVariantUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    variant = await _owned_variant(db, variant_id, current_user.id, request)
    if variant.status == "PUBLISHED":
        _error("CV_VARIANT_IMMUTABLE", "Bản đã publish không thể chỉnh sửa; hãy tạo variant mới.", request, 409)
    existing = dict(variant.content_json or {})
    content = copy.deepcopy(payload.content)
    for private_key in ("_suggestions", "_match_scores", "_source_confirmed"):
        if private_key not in content and private_key in existing:
            content[private_key] = existing[private_key]
    confirmed = list(dict.fromkeys([*(existing.get("_confirmed_claims") or []), *payload.confirmed_claims]))
    content["_confirmed_claims"] = confirmed
    await save_revision(
        db,
        variant=variant,
        content=content,
        user_id=current_user.id,
        editor_type="user",
        change_summary=payload.change_summary,
    )
    return await _serialize(db, variant)


@router.put("/{variant_id}/suggestions/{suggestion_id}", response_model=CVVariantOut)
async def decide_cv_variant_suggestion(
    variant_id: str,
    suggestion_id: str,
    payload: CVVariantSuggestionDecision,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    variant = await _owned_variant(db, variant_id, current_user.id, request)
    if variant.status == "PUBLISHED":
        _error("CV_VARIANT_IMMUTABLE", "Bản đã publish không thể chỉnh sửa.", request, 409)
    content = copy.deepcopy(dict(variant.content_json or {}))
    suggestions = content.get("_suggestions") or []
    suggestion = next((item for item in suggestions if item.get("id") == suggestion_id), None)
    if not suggestion:
        _error("CV_SUGGESTION_NOT_FOUND", "Không tìm thấy đề xuất tối ưu.", request, 404)
    if payload.decision == "reject":
        suggestion["decision"] = "reject"
        suggestion["validator_status"] = "REJECTED_BY_USER"
    else:
        final_text = (payload.final_text or suggestion.get("proposed") or "").strip()
        if not final_text:
            _error("CV_SUGGESTION_EMPTY", "Nội dung sau chỉnh sửa không được để trống.", request, 422)
        snapshot = await db.get(CVSnapshot, variant.source_cv_snapshot_id) if variant.source_cv_snapshot_id else None
        jd_snapshot = await db.get(JDSnapshot, variant.target_jd_snapshot_id)
        contract = validate_claim_contract(
            claim=final_text,
            source_text=snapshot.raw_text if snapshot else "",
            snapshot_id=snapshot.id if snapshot else "unconfirmed",
            evidence_text=str(suggestion.get("original") or ""),
            jd_text=jd_snapshot.raw_text if jd_snapshot else "",
        )
        if not contract["status"].startswith("SUPPORTED"):
            _error("CV_SUGGESTION_FACT_CHECK_FAILED", contract["reason"], request, 422)
        suggestion["decision"] = payload.decision
        suggestion["final_text"] = final_text
        suggestion["validator_status"] = contract["status"]
        patched, applied, invalid = apply_cv_block_patches(
            content,
            [
                {
                    "block_id": suggestion.get("block_id"),
                    "section": suggestion.get("section"),
                    "original_text": suggestion.get("original"),
                    "optimized_text": final_text,
                }
            ],
        )
        if invalid or not applied:
            _error("CV_SUGGESTION_PATCH_FAILED", "Đề xuất không còn khớp với revision hiện tại.", request, 409)
        content = patched
        content["_suggestions"] = suggestions
    await save_revision(
        db,
        variant=variant,
        content=content,
        user_id=current_user.id,
        editor_type="user",
        change_summary=f"{payload.decision} đề xuất {suggestion_id}",
    )
    return await _serialize(db, variant)


@router.post("/{variant_id}/validate", response_model=CVVariantValidationOut)
async def validate_cv_variant(
    variant_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    variant = await _owned_variant(db, variant_id, current_user.id, request)
    report, _ = await validate_variant(db, variant, trace_id=_trace_id(request))
    return report


@router.post("/{variant_id}/publish", response_model=CVVariantPublishOut)
async def publish_cv_variant(
    variant_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    variant = await _owned_variant(db, variant_id, current_user.id, request)
    if variant.status == "PUBLISHED":
        return {
            "variant_id": variant.id,
            "status": "PUBLISHED",
            "checksum": variant.rendered_checksum,
            "download_url": f"/api/v2/cv-variants/{variant.id}/export",
            "published_at": variant.published_at,
            "trace_id": variant.trace_id,
        }
    try:
        result, _ = await publish_variant(db, variant, trace_id=_trace_id(request))
    except ObjectStorageError as exc:
        _error("STORAGE_001", "Không thể lưu file CV Variant. Vui lòng thử lại sau.", request, 503)
    except ValueError as exc:
        if str(exc) == "VALIDATION_BLOCKED":
            _error("CV_VARIANT_PUBLISH_BLOCKED", "Variant chưa vượt qua đủ 7 hard validators.", request, 422)
        raise
    return result


@router.get("/{variant_id}/export")
async def export_cv_variant(
    variant_id: str,
    request: Request,
    preview: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    variant = await _owned_variant(db, variant_id, current_user.id, request)
    if variant.status == "PUBLISHED" and variant.rendered_uri:
        try:
            pdf_bytes = await get_bytes_async(variant.rendered_uri)
        except (ObjectStorageError, OSError):
            _error("CV_VARIANT_ASSET_UNAVAILABLE", "Không thể đọc file CV Variant đã publish.", request, 503)
    elif preview:
        report, pdf_bytes = await validate_variant(db, variant, trace_id=_trace_id(request))
        if not report["passed"]:
            _error("CV_VARIANT_PREVIEW_BLOCKED", "Hãy sửa lỗi validator trước khi xem PDF.", request, 422)
    else:
        _error("CV_VARIANT_NOT_PUBLISHED", "Chỉ CV Variant đã publish mới được tải xuống.", request, 409)
    disposition = "inline" if preview else "attachment"
    return StreamingResponse(
        iter([pdf_bytes]),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'{disposition}; filename="cv-variant-{variant.id}.pdf"',
            "X-Content-SHA256": variant.rendered_checksum or "",
            "X-Trace-ID": variant.trace_id,
        },
    )


@router.delete("/{variant_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_cv_variant(
    variant_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    variant = await _owned_variant(db, variant_id, current_user.id, request)
    await remove_variant_asset(variant)
    db.add(
        UsageEvent(
            user_id=current_user.id,
            event_name="cv_variant_deleted",
            metadata_json={"variant_id": variant.id, "status": variant.status, "trace_id": _trace_id(request)},
        )
    )
    await db.delete(variant)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
