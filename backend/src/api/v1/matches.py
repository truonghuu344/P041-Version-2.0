from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, Query, status
from pydantic import BaseModel, model_validator
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from src.config import get_settings
from src.core.errors import PipelineError
from src.core.security import get_current_user
from src.db.database import AsyncSessionLocal, get_db
from src.db.models import CV, CVAnalysis, JobDescription, MatchRun, RubricDefinition, UsageEvent, User
from src.services.gap_analysis_service import perform_cv_jd_gap_analysis
from src.services.match_persistence import persist_match_artifacts
from src.services.pipeline_context import PIPELINE_VERSION, get_or_create_cv_snapshot, get_or_create_jd_snapshot

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/matches", tags=["CV-JD Match Jobs"])

MATCH_PROGRESS = {
    "PENDING": 5,
    "QUEUED": 10,
    "PROCESSING": 20,
    "PARSING": 30,
    "EVALUATING": 40,
    "FINALIZING": 90,
    "COMPLETED": 100,
    "FAILED": 100,
}


def _resolve_progress_percent(match: MatchRun) -> int:
    if match.status == "COMPLETED":
        return 100
    if match.status == "FAILED":
        return 100
    if isinstance(match.pipeline_config_json, dict):
        saved = match.pipeline_config_json.get("progress_percent")
        if isinstance(saved, (int, float)):
            val = int(saved)
            if match.current_step == "EVALUATING" or match.status == "EVALUATING":
                return max(40, min(85, val))
            if match.current_step == "FINALIZING":
                return max(90, min(99, val))
            return max(0, min(100, val))
    return MATCH_PROGRESS.get(match.current_step, MATCH_PROGRESS.get(match.status, 5))


async def _update_match_progress(
    match_id: str,
    progress: int,
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    try:
        async with session_factory() as db:
            m = await db.get(MatchRun, match_id)
            if m and m.status in ("PROCESSING", "EVALUATING") and m.current_step in ("EVALUATING", "PARSING"):
                cfg = dict(m.pipeline_config_json or {})
                if cfg.get("progress_percent") != progress:
                    cfg["progress_percent"] = progress
                    m.pipeline_config_json = cfg
                    await db.commit()
    except Exception:
        pass


class MatchCreateRequest(BaseModel):
    candidate_id: str | None = None
    cv_id: str | None = None
    job_id: str
    rubric_id: str = "RUBRIC_DEFAULT_V1"

    @model_validator(mode="after")
    def require_candidate(self) -> MatchCreateRequest:
        if not self.candidate_id and not self.cv_id:
            raise ValueError("candidate_id hoặc cv_id là bắt buộc.")
        return self

    @property
    def selected_cv_id(self) -> str:
        return str(self.cv_id or self.candidate_id)


class MatchJobResponse(BaseModel):
    match_id: str
    status: str
    current_step: str
    progress_percent: int
    analysis_id: str | None = None
    final_score: float | None = None
    rating: str | None = None
    error: dict[str, Any] | None = None
    result: dict[str, Any] | None = None


async def _process_match(
    match_id: str,
    user_id: str,
    cv_id: str,
    jd_id: str,
    session_factory: async_sessionmaker[AsyncSession] = AsyncSessionLocal,
) -> None:
    logger.info("[Match] Task started match_id=%s", match_id)
    try:
        async with session_factory() as db:
            match = await db.get(MatchRun, match_id)
            if not match:
                logger.error("[Match] Record not found match_id=%s", match_id)
                return
            try:
                # 1. Start processing / parsing
                match.status = "PROCESSING"
                match.current_step = "PARSING"
                config = dict(match.pipeline_config_json or {})
                config["progress_percent"] = 30
                match.pipeline_config_json = config
                await db.commit()
                logger.info("[Match] Step transition match_id=%s step=PARSING status=PROCESSING", match_id)

                cv = await db.get(CV, cv_id)
                jd = await db.get(JobDescription, jd_id)
                if not cv or not jd:
                    raise ValueError("MATCH_001: CV hoặc JD không còn tồn tại.")

                # 2. Evaluating
                match.status = "PROCESSING"
                match.current_step = "EVALUATING"
                config = dict(match.pipeline_config_json or {})
                config["progress_percent"] = 40
                match.pipeline_config_json = config
                await db.commit()
                logger.info("[Match] EVALUATING_START match_id=%s", match_id)

                rubric_definition = await db.get(RubricDefinition, match.rubric_id) if match.rubric_id else None
                rubric_config = dict(rubric_definition.config_json or {}) if rubric_definition else None

                loop = asyncio.get_running_loop()

                def on_progress_sync(done: int, total: int) -> None:
                    if total <= 0:
                        prog = 40
                    else:
                        prog = min(85, max(40, 40 + int((done / total) * 45)))
                    asyncio.run_coroutine_threadsafe(_update_match_progress(match_id, prog, session_factory), loop)

                eval_timeout_seconds = float(get_settings().llm_timeout_seconds or 30.0) * 2 + 15.0
                try:
                    async with asyncio.timeout(eval_timeout_seconds):
                        result = await perform_cv_jd_gap_analysis(
                            cv_raw_text=cv.raw_text or "",
                            cv_parsed_json={**(cv.parsed_json or {}), "_candidate_id": f"CAND_{user_id}"},
                            jd_title=jd.title,
                            jd_requirements=jd.requirements_text,
                            jd_parsed_json={**(jd.normalized_json or {}), "job_id": jd.id},
                            rubric=rubric_config,
                            on_progress=on_progress_sync,
                        )
                except TimeoutError as exc:
                    raise TimeoutError(
                        f"MATCH_EVALUATION_TIMEOUT: Quá trình đánh giá vượt quá {eval_timeout_seconds} giây."
                    ) from exc

                logger.info("[Match] REQUIREMENTS_DONE match_id=%s", match_id)
                logger.info("[Match] SCORING_DONE match_id=%s", match_id)

                result["match_id"] = match_id
                logger.info("[Match] RESULT_BUILT match_id=%s", match_id)

                # 3. Finalizing
                match.status = "PROCESSING"
                match.current_step = "FINALIZING"
                config = dict(match.pipeline_config_json or {})
                config["progress_percent"] = 90
                match.pipeline_config_json = config
                await db.commit()
                logger.info("[Match] Step transition match_id=%s step=FINALIZING status=PROCESSING", match_id)

                analysis = CVAnalysis(
                    user_id=user_id,
                    cv_id=cv_id,
                    jd_id=jd_id,
                    cv_snapshot_id=match.cv_snapshot_id,
                    jd_snapshot_id=match.jd_snapshot_id,
                    pipeline_version=PIPELINE_VERSION,
                    match_score=result.get("match_score", 0.0),
                    gap_analysis_json=result,
                    optimized_suggestions_json=result.get("suggestions", []),
                )
                timeout_seconds = get_settings().match_finalization_timeout_seconds
                try:
                    async with asyncio.timeout(timeout_seconds):
                        db.add(analysis)
                        await db.flush()
                        result.setdefault("status", "COMPLETED")
                        result.setdefault("final_score", float(result.get("match_score", 0.0)))
                        result.setdefault("rating", "POOR")
                        match.analysis_id = analysis.id
                        match.trace_id = result.get("trace_id")
                        match.status = "COMPLETED"
                        match.current_step = "COMPLETED"
                        match.final_score = result["final_score"]
                        match.rating = result["rating"]
                        match.mandatory_requirement_failed = result.get("mandatory_requirement_failed", False)
                        match.result_json = result
                        match.completed_at = datetime.now(UTC)
                        duration_ms = None
                        if match.created_at:
                            created_at = match.created_at
                            if created_at.tzinfo is None:
                                created_at = created_at.replace(tzinfo=UTC)
                            duration_ms = round((match.completed_at - created_at).total_seconds() * 1000)
                        db.add(
                            UsageEvent(
                                user_id=user_id,
                                event_name="cv_jd_match_completed",
                                duration_ms=duration_ms,
                                metadata_json={"match_id": match_id, "cv_id": cv_id, "jd_id": jd_id},
                            )
                        )
                        await db.commit()
                except TimeoutError as exc:
                    raise TimeoutError(
                        f"MATCH_FINALIZATION_TIMEOUT: Saving match results exceeded {timeout_seconds} seconds."
                    ) from exc

                logger.info("[Match] ANALYSIS_SAVED match_id=%s analysis_id=%s", match_id, analysis.id)
                logger.info("[Match] COMPLETED match_id=%s", match_id)

                try:
                    async with asyncio.timeout(timeout_seconds):
                        await persist_match_artifacts(
                            db,
                            user_id=user_id,
                            cv_id=cv_id,
                            jd_id=jd_id,
                            analysis_id=analysis.id,
                            result=result,
                            match=match,
                        )
                        await db.commit()
                except Exception:
                    await db.rollback()
                    logger.exception("[Match] Non-critical artifact persistence failed match_id=%s", match_id)
            except Exception as exc:
                await db.rollback()
                message = str(exc)
                match = await db.get(MatchRun, match_id)
                if match:
                    match.status = "FAILED"
                    match.current_step = "FAILED"
                    match.error_code = message.split(":", 1)[0] if ":" in message else "EVALUATION_001"
                    match.error_message = message[:1000]
                    match.completed_at = datetime.now(UTC)
                    await db.commit()
                logger.error("[Match] Failed reason match_id=%s reason=%s", match_id, message)
    except BaseException as outer_exc:
        logger.error("[Match] Unhandled failure match_id=%s reason=%s", match_id, outer_exc)
        try:
            async with session_factory() as fallback_db:
                m = await fallback_db.get(MatchRun, match_id)
                if m and m.status not in ("COMPLETED", "FAILED"):
                    m.status = "FAILED"
                    m.current_step = "FAILED"
                    m.error_code = "EVALUATION_CRASH"
                    m.error_message = "Tiến trình phân tích bị gián đoạn."
                    m.completed_at = datetime.now(UTC)
                    await fallback_db.commit()
        except Exception:
            pass


@router.post("", response_model=MatchJobResponse, status_code=status.HTTP_202_ACCEPTED)
async def start_match(
    payload: MatchCreateRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MatchJobResponse:
    cv = None
    if payload.cv_id:
        cv = (
            await db.execute(select(CV).where(CV.id == payload.cv_id, CV.user_id == current_user.id))
        ).scalar_one_or_none()
    elif payload.candidate_id in {current_user.id, f"CAND_{current_user.id}"}:
        cv = (
            await db.execute(
                select(CV).where(CV.user_id == current_user.id).order_by(CV.updated_at.desc()).limit(1)
            )
        ).scalar_one_or_none()
    elif payload.candidate_id:
        # Compatibility: older clients used candidate_id for a concrete CV id.
        cv = (
            await db.execute(select(CV).where(CV.id == payload.candidate_id, CV.user_id == current_user.id))
        ).scalar_one_or_none()
    jd_id = payload.job_id.removeprefix("catalog:") if payload.job_id else ""
    jd = (
        await db.execute(
            select(JobDescription).where(
                JobDescription.id == jd_id,
                or_(
                    JobDescription.is_system.is_(True),
                    JobDescription.is_published.is_(True),
                    JobDescription.created_by_user_id == current_user.id,
                ),
            )
        )
    ).scalar_one_or_none()
    if not jd and jd_id:
        existing_system = await db.execute(select(JobDescription).where(JobDescription.is_system.is_(True)))
        for existing in existing_system.scalars().all():
            normalized = existing.normalized_json or {}
            if str(normalized.get("source_id") or "").casefold() == jd_id.casefold():
                jd = existing
                break
    if not cv or not jd:
        raise PipelineError("MATCH_001", "CV hoặc JD không tồn tại.", status_code=404)
    if payload.rubric_id != "RUBRIC_DEFAULT_V1" and await db.get(RubricDefinition, payload.rubric_id) is None:
        raise PipelineError("RUBRIC_001", "Rubric không tồn tại hoặc chưa được cấu hình.", status_code=422)
    match = MatchRun(
        id=f"MATCH_{uuid.uuid4().hex.upper()[:12]}",
        user_id=current_user.id,
        cv_id=cv.id,
        jd_id=jd.id,
        rubric_id=payload.rubric_id,
        status="PENDING",
        current_step="PENDING",
        pipeline_version=PIPELINE_VERSION,
    )
    db.add(match)
    cv_snapshot = await get_or_create_cv_snapshot(db, cv)
    jd_snapshot = await get_or_create_jd_snapshot(db, jd)
    match.cv_snapshot_id = cv_snapshot.id
    match.jd_snapshot_id = jd_snapshot.id
    await db.commit()

    # Create independent session factory for background execution
    session_factory = async_sessionmaker(
        bind=db.bind,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )
    background_tasks.add_task(_process_match, match.id, current_user.id, cv.id, jd.id, session_factory)
    logger.info("[Match] Task scheduled match_id=%s", match.id)

    return MatchJobResponse(
        match_id=match.id,
        status=match.status,
        current_step=match.current_step,
        progress_percent=MATCH_PROGRESS.get(match.current_step, 5),
    )


async def _owned_match(match_id: str, db: AsyncSession, user_id: str) -> MatchRun:
    match = (
        await db.execute(select(MatchRun).where(MatchRun.id == match_id, MatchRun.user_id == user_id))
    ).scalar_one_or_none()
    if not match:
        raise PipelineError("MATCH_001", "Match không tồn tại.", status_code=404)
    return match


@router.get("/{match_id}", response_model=MatchJobResponse)
async def get_match(
    match_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MatchJobResponse:
    match = await _owned_match(match_id, db, current_user.id)
    error = None
    if match.error_code:
        error = {"code": match.error_code, "message": match.error_message, "retryable": False}
    return MatchJobResponse(
        match_id=match.id,
        status=match.status,
        current_step=match.current_step,
        progress_percent=_resolve_progress_percent(match),
        analysis_id=match.analysis_id,
        final_score=match.final_score,
        rating=match.rating,
        error=error,
        result=match.result_json if match.status == "COMPLETED" else None,
    )


@router.get("/{match_id}/evidence", response_model=list[dict])
async def get_evidence(
    match_id: str,
    requirement_id: str | None = Query(default=None),
    criterion_id: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    match = await _owned_match(match_id, db, current_user.id)
    result = match.result_json or {}
    evidence = list(result.get("evidence", []))
    if requirement_id:
        evidence = [item for item in evidence if item.get("requirement_id") == requirement_id]
    if criterion_id:
        criterion = next((item for item in result.get("criteria", []) if item.get("criterion_id") == criterion_id), {})
        ids = set(criterion.get("evidence_ids", []))
        evidence = [item for item in evidence if item.get("evidence_id") in ids]
    return evidence


@router.get("/{match_id}/report", response_model=dict)
async def get_report(
    match_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    match = await _owned_match(match_id, db, current_user.id)
    if match.status != "COMPLETED":
        raise PipelineError("MATCH_002", "Match chưa hoàn tất.", status_code=409, retryable=True)
    return dict(match.result_json or {})
