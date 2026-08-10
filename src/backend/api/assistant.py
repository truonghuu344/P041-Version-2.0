from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.backend.core.dependencies import get_current_user
from src.backend.db.database import get_db_session
from src.backend.db.models import User
from src.backend.models.assistant import (
    AssistantChatRequest,
    AssistantChatResponse,
    AssistantStatusResponse,
    ConversationDetailResponse,
    ConversationSummaryResponse,
)
from src.backend.services.assistant import ConversationNotFoundError, assistant_service

router = APIRouter(prefix="/assistant", tags=["Career Assistant"])


@router.get("/status", response_model=AssistantStatusResponse, summary="Get AI agent status")
async def assistant_status() -> AssistantStatusResponse:
    return assistant_service.agent.status()


@router.post("/chat", response_model=AssistantChatResponse, summary="Chat with the career agent")
async def chat(
    payload: AssistantChatRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> AssistantChatResponse:
    try:
        return await assistant_service.chat(session, current_user, payload)
    except ConversationNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        ) from exc


@router.get(
    "/conversations",
    response_model=list[ConversationSummaryResponse],
    summary="List the current user's conversations",
)
async def list_conversations(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[ConversationSummaryResponse]:
    return await assistant_service.list_conversations(session, current_user.id)


@router.get(
    "/conversations/{conversation_id}",
    response_model=ConversationDetailResponse,
    summary="Read one owned conversation",
)
async def conversation_detail(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> ConversationDetailResponse:
    try:
        return await assistant_service.conversation_detail(session, current_user.id, conversation_id)
    except ConversationNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        ) from exc


@router.delete(
    "/conversations/{conversation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete one owned conversation",
)
async def delete_conversation(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> Response:
    try:
        await assistant_service.delete_conversation(session, current_user.id, conversation_id)
    except ConversationNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        ) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)
