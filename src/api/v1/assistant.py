from datetime import UTC, datetime, timedelta
from time import perf_counter

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.agents.career_assistant_agent import career_assistant_agent
from src.config import get_settings
from src.core.security import get_current_user
from src.db.database import get_db
from src.db.models import (
    CV,
    AIAuditLog,
    ChatConversation,
    ChatMessage,
    CVAnalysis,
    InterviewSession,
    User,
)
from src.models.schemas import (
    AssistantAction,
    AssistantChatRequest,
    AssistantChatResponse,
    AssistantStatusResponse,
    ConversationDetailOut,
    ConversationMessageOut,
    ConversationSummaryOut,
)

router = APIRouter(prefix="/assistant", tags=["Career Assistant Agent"])


def _conversation_title(prompt: str) -> str:
    normalized = " ".join(prompt.split())
    return normalized if len(normalized) <= 72 else f"{normalized[:69].rstrip()}..."


def _message_out(message: ChatMessage) -> ConversationMessageOut:
    return ConversationMessageOut(
        id=message.id,
        role=message.role,
        content=message.content,
        provider=message.provider,
        model=message.model,
        llm_succeeded=message.llm_succeeded,
        suggested_actions=message.suggested_actions_json or [],
        created_at=message.created_at,
    )


async def _owned_conversation(
    db: AsyncSession,
    conversation_id: str,
    user_id: str,
) -> ChatConversation:
    conversation = await db.scalar(
        select(ChatConversation)
        .where(
            ChatConversation.id == conversation_id,
            ChatConversation.user_id == user_id,
        )
        .options(selectinload(ChatConversation.messages))
    )
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy cuộc hội thoại hoặc bạn không có quyền truy cập.",
        )
    return conversation


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


@router.get("/conversations", response_model=list[ConversationSummaryOut])
async def list_conversations(
    limit: int = Query(default=30, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ConversationSummaryOut]:
    conversations = (
        await db.execute(
            select(ChatConversation)
            .where(ChatConversation.user_id == current_user.id)
            .options(selectinload(ChatConversation.messages))
            .order_by(ChatConversation.updated_at.desc())
            .offset(offset)
            .limit(limit)
        )
    ).scalars().all()
    return [
        ConversationSummaryOut(
            id=conversation.id,
            title=conversation.title,
            message_count=len(conversation.messages),
            last_message_preview=(conversation.messages[-1].content[:140] if conversation.messages else ""),
            created_at=conversation.created_at,
            updated_at=conversation.updated_at,
        )
        for conversation in conversations
    ]


@router.get("/conversations/{conversation_id}", response_model=ConversationDetailOut)
async def get_conversation(
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ConversationDetailOut:
    conversation = await _owned_conversation(db, conversation_id, current_user.id)
    sorted_messages = sorted(
        conversation.messages,
        key=lambda m: (m.created_at, 0 if m.role == "user" else 1),
    )
    return ConversationDetailOut(
        id=conversation.id,
        title=conversation.title,
        messages=[_message_out(message) for message in sorted_messages],
        created_at=conversation.created_at,
        updated_at=conversation.updated_at,
    )


@router.delete("/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation(
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    conversation = await _owned_conversation(db, conversation_id, current_user.id)
    await db.delete(conversation)
    await db.commit()


@router.post("/chat", response_model=AssistantChatResponse)
async def assistant_chat(
    payload: AssistantChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AssistantChatResponse:
    if payload.conversation_id:
        conversation = await _owned_conversation(db, payload.conversation_id, current_user.id)
        sorted_messages = sorted(
            conversation.messages,
            key=lambda m: (m.created_at, 0 if m.role == "user" else 1),
        )
        history = [
            {"role": message.role, "content": message.content}
            for message in sorted_messages[-12:]
        ]
    else:
        conversation = ChatConversation(
            user_id=current_user.id,
            title=_conversation_title(payload.message),
        )
        db.add(conversation)
        await db.flush()
        history = [item.model_dump() for item in payload.history]

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

    started_at = perf_counter()
    try:
        result = await career_assistant_agent.run(
            message=payload.message,
            history=history,
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
    except Exception as exc:
        result = {
            "response": "Nova đang gặp lỗi khi xử lý yêu cầu. Vui lòng thử lại sau ít phút.",
            "provider": "google_gemini",
            "model": get_settings().model_name,
            "llm_succeeded": False,
            "suggested_actions": [],
            "tools_used": [],
            "error": type(exc).__name__,
        }
    latency_ms = max(0, round((perf_counter() - started_at) * 1000))

    response_text = result.get("response", "Nova chưa thể trả lời lúc này.")
    provider = result.get("provider", "google_gemini")
    model = result.get("model", get_settings().model_name)
    llm_succeeded = bool(result.get("llm_succeeded"))
    suggested_actions = result.get("suggested_actions", [])

    message_time = datetime.now(UTC)
    user_message = ChatMessage(
        conversation_id=conversation.id,
        role="user",
        content=payload.message,
        created_at=message_time,
    )
    assistant_message = ChatMessage(
        conversation_id=conversation.id,
        role="assistant",
        content=response_text,
        provider=provider,
        model=model,
        llm_succeeded=llm_succeeded,
        suggested_actions_json=suggested_actions,
        created_at=message_time + timedelta(milliseconds=5),
    )
    conversation.updated_at = datetime.now(UTC)
    db.add_all(
        [
            user_message,
            assistant_message,
            AIAuditLog(
                user_id=current_user.id,
                conversation_id=conversation.id,
                prompt=payload.message,
                response=response_text,
                provider=provider,
                model=model,
                llm_succeeded=llm_succeeded,
                error_code=str(result.get("error") or "")[:160] or None,
                current_page=payload.current_page,
                latency_ms=latency_ms,
                tools_used_json=result.get("tools_used", []),
            ),
        ]
    )
    await db.commit()
    await db.refresh(user_message)
    await db.refresh(assistant_message)

    return AssistantChatResponse(
        response=response_text,
        provider=provider,
        model=model,
        llm_succeeded=llm_succeeded,
        suggested_actions=[AssistantAction.model_validate(item) for item in suggested_actions],
        conversation_id=conversation.id,
        user_message_id=user_message.id,
        assistant_message_id=assistant_message.id,
    )
