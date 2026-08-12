from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.security import require_role
from src.db.database import get_db
from src.db.models import InterviewFeedback, InterviewReport, UsageEvent, User
from src.models.schemas import ProductMetricsOut

router = APIRouter(prefix="/metrics", tags=["Product Metrics"])


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
