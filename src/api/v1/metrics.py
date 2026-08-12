from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.security import require_role
from src.db.database import get_db
from src.db.models import InterviewFeedback, InterviewReport, MatchRun, UsageEvent, User
from src.models.schemas import ProductMetricsOut

router = APIRouter(prefix="/metrics", tags=["Product Metrics"])


def _percentile(values: list[float], percentile: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    index = min(len(ordered) - 1, max(0, round((len(ordered) - 1) * percentile)))
    return round(ordered[index], 2)


@router.get("/product", response_model=ProductMetricsOut)
async def get_product_metrics(
    db: AsyncSession = Depends(get_db),
    _viewer: User = Depends(require_role(["admin", "counselor"])),
) -> ProductMetricsOut:
    total_users = await db.scalar(select(func.count(User.id)).where(User.role != "admin")) or 0
    active_users = await db.scalar(select(func.count(func.distinct(UsageEvent.user_id)))) or 0
    average_csat = await db.scalar(select(func.avg(InterviewFeedback.rating)))
    completed_interviews = await db.scalar(select(func.count(InterviewReport.id))) or 0
    average_interview_score = await db.scalar(select(func.avg(InterviewReport.total_score)))
    latency_result = await db.execute(
        select(UsageEvent.event_name, func.avg(UsageEvent.duration_ms))
        .where(UsageEvent.duration_ms.is_not(None))
        .group_by(UsageEvent.event_name)
    )
    latency = {name: round(float(value), 2) for name, value in latency_result.all() if value is not None}
    adoption = round((active_users / total_users * 100.0), 2) if total_users else 0.0
    return ProductMetricsOut(
        active_users=int(active_users),
        total_users=int(total_users),
        adoption_rate=adoption,
        adoption_target=60.0,
        adoption_target_met=adoption >= 60.0,
        average_csat=round(float(average_csat), 2) if average_csat is not None else None,
        csat_target=4.0,
        csat_target_met=(float(average_csat) >= 4.0) if average_csat is not None else None,
        completed_interviews=int(completed_interviews),
        average_interview_score=(
            round(float(average_interview_score), 2) if average_interview_score is not None else None
        ),
        latency_by_event_ms=latency,
    )


@router.get("/cv-jd", response_model=dict)
async def get_cv_jd_pipeline_metrics(
    db: AsyncSession = Depends(get_db),
    _viewer: User = Depends(require_role(["admin", "counselor"])),
) -> dict:
    """Operational metrics computed from persisted match jobs without exposing candidate content."""
    matches = list((await db.execute(select(MatchRun))).scalars().all())
    total = len(matches)
    completed = [item for item in matches if item.status == "COMPLETED"]
    failed = [item for item in matches if item.status == "FAILED"]
    results = [dict(item.result_json or {}) for item in completed]
    retrievals = [entry for result in results for entry in result.get("retrieval_results", [])]
    requirements = [
        item
        for result in results
        for group in (result.get("requirements") or {}).values()
        for item in group
    ]
    latencies = [
        (item.completed_at - item.created_at).total_seconds() * 1000
        for item in matches
        if item.completed_at is not None and item.created_at is not None
    ]

    def rate(numerator: int, denominator: int) -> float:
        return round(numerator / denominator, 4) if denominator else 0.0

    return {
        "total_matches": total,
        "match_completed_rate": rate(len(completed), total),
        "evaluation_failure_rate": rate(
            sum((item.error_code or "").startswith("EVALUATION") for item in failed), total
        ),
        "embedding_failure_rate": rate(
            sum((item.error_code or "").startswith(("EMBEDDING", "VECTOR")) for item in failed), total
        ),
        "parse_success_rate": rate(
            sum(not (item.error_code or "").startswith(("PARSER", "OCR", "EXTRACTION")) for item in matches),
            total,
        ),
        "average_chunk_count": round(
            sum(len(result.get("cv_chunks", [])) for result in results) / len(results), 2
        )
        if results
        else 0.0,
        "semantic_empty_result_rate": rate(
            sum(not item.get("semantic_results") for item in retrievals), len(retrievals)
        ),
        "bm25_empty_result_rate": rate(sum(not item.get("bm25_results") for item in retrievals), len(retrievals)),
        "evidence_not_found_rate": rate(
            sum(item.get("status") in {"NOT_FOUND", "CONFLICTING"} for item in requirements),
            len(requirements),
        ),
        "match_latency_p50_ms": _percentile(latencies, 0.50),
        "match_latency_p95_ms": _percentile(latencies, 0.95),
        "match_latency_p99_ms": _percentile(latencies, 0.99),
    }
