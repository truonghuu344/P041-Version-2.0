from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.agents.career_assistant_agent import career_assistant_agent
from src.config import get_settings
from src.core.security import get_current_user
from src.db.database import get_db
from src.db.models import CV, CVAnalysis, InterviewSession, User
from src.models.schemas import (
    AssistantChatRequest,
    AssistantChatResponse,
    AssistantStatusResponse,
)

router = APIRouter(prefix="/assistant", tags=["Career Assistant Agent"])


@router.get("/status", response_model=AssistantStatusResponse)
async def assistant_status() -> AssistantStatusResponse:
    settings = get_settings()
    return AssistantStatusResponse(
        agent_name="Nova Career Assistant",
        provider="google_gemini",
        model=settings.model_name,
        configured=bool(settings.google_genai_api_key),
        weather_configured=bool(settings.weather_api_key),
    )


@router.post("/chat", response_model=AssistantChatResponse)
async def assistant_chat(
    payload: AssistantChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AssistantChatResponse:
    cv_count = await db.scalar(select(func.count(CV.id)).where(CV.user_id == current_user.id))
    analysis_count = await db.scalar(
        select(func.count(CVAnalysis.id)).where(CVAnalysis.user_id == current_user.id)
    )
    interview_count = await db.scalar(
        select(func.count(InterviewSession.id)).where(InterviewSession.user_id == current_user.id)
    )
    latest_cv = await db.scalar(
        select(CV)
        .where(CV.user_id == current_user.id)
        .order_by(CV.created_at.desc())
        .limit(1)
    )
    result = await career_assistant_agent.run(
        message=payload.message,
        history=[item.model_dump() for item in payload.history],
        user_context={
            "full_name": current_user.full_name,
            "role": current_user.role,
            "current_page": payload.current_page,
            "cv_count": cv_count or 0,
            "latest_cv_title": latest_cv.title if latest_cv else None,
            "analysis_count": analysis_count or 0,
            "interview_count": interview_count or 0,
        },
    )
    return AssistantChatResponse(
        response=result.get("response", "Nova chưa thể trả lời lúc này."),
        provider=result.get("provider", "google_gemini"),
        model=result.get("model", get_settings().model_name),
        llm_succeeded=bool(result.get("llm_succeeded")),
        suggested_actions=result.get("suggested_actions", []),
    )
