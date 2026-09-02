import json
import logging
from datetime import UTC, datetime, timedelta
from time import perf_counter

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.encoders import jsonable_encoder
from fastapi.responses import StreamingResponse
from sqlalchemy import func, or_, select
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
    JobDescription,
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
from src.services.assistant_rag import get_assistant_rag_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/assistant", tags=["Career Assistant Agent"])


def _iso(value) -> str:
    return value.isoformat() if value else ""


async def _load_orchestration_resources(db: AsyncSession, user_id: str) -> dict:
    cvs = (
        await db.execute(
            select(CV)
            .where(CV.user_id == user_id)
            .order_by(CV.updated_at.desc())
            .limit(20)
        )
    ).scalars().all()
    jds = (
        await db.execute(
            select(JobDescription)
            .where(
                or_(
                    JobDescription.is_system.is_(True),
                    JobDescription.is_published.is_(True),
                    JobDescription.created_by_user_id == user_id,
                )
            )
            .order_by(JobDescription.created_at.desc())
            .limit(20)
        )
    ).scalars().all()
    analyses = (
        await db.execute(
            select(CVAnalysis)
            .where(CVAnalysis.user_id == user_id)
            .options(selectinload(CVAnalysis.cv), selectinload(CVAnalysis.jd))
            .order_by(CVAnalysis.created_at.desc())
            .limit(20)
        )
    ).scalars().all()

    analysis_items = []
    for analysis in analyses:
        details = analysis.gap_analysis_json or {}
        evidence_items = []
        for requirement in details.get("requirement_evidence", [])[:8]:
            sources = requirement.get("evidence") or []
            if not sources:
                continue
            quote = str(sources[0].get("quote") or sources[0].get("text") or "").strip()
            if not quote:
                continue
            evidence_items.append(
                {
                    "requirement": str(requirement.get("requirement") or "Yêu cầu JD")[:240],
                    "quote": quote[:360],
                }
            )
        analysis_items.append(
            {
                "id": analysis.id,
                "cv_id": analysis.cv_id,
                "cv_title": analysis.cv.title,
                "jd_id": analysis.jd_id,
                "jd_title": analysis.jd.title,
                "company": analysis.jd.company or "",
                "match_score": float(analysis.match_score),
                "created_at": _iso(analysis.created_at),
                "matching": details.get("hard_skills_matching", []),
                "missing": details.get("hard_skills_missing", []),
                "evidence": evidence_items,
                "priority_actions": details.get("priority_actions", []),
                "learning": details.get("learning_recommendations", []),
                "integrity_guardrail": details.get("integrity_guardrail", "passed"),
            }
        )

    return {
        "cvs": [
            {"id": cv.id, "title": cv.title, "updated_at": _iso(cv.updated_at)}
            for cv in cvs
        ],
        "jds": [
            {
                "id": jd.id,
                "title": jd.title,
                "company": jd.company or "",
                "location": jd.location or "",
                "created_at": _iso(jd.created_at),
                "owned": jd.created_by_user_id == user_id,
            }
            for jd in jds
        ],
        "analyses": analysis_items,
    }


def _resource_by_id(resources: list[dict], resource_id: str) -> dict | None:
    return next((item for item in resources if item["id"] == resource_id), None)


async def _execute_confirmed_operation(
    payload: AssistantChatRequest,
    resources: dict,
    db: AsyncSession,
    current_user: User,
) -> dict:
    operation = payload.operation
    if operation is None:
        raise ValueError("Thiếu operation")
    cv = _resource_by_id(resources.get("cvs", []), operation.cv_id)
    jd = _resource_by_id(resources.get("jds", []), operation.jd_id)
    if not cv or not jd:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="CV hoặc JD không tồn tại, không thuộc tài khoản, hoặc bạn không có quyền sử dụng.",
        )
    if not operation.confirmed:
        return {
            "response": f"Nova chưa thực hiện tác vụ vì bạn chưa xác nhận dùng CV “{cv['title']}” và JD “{jd['title']}”.",
            "provider": "nova_orchestrator",
            "model": "deterministic_orchestration",
            "llm_succeeded": True,
            "suggested_actions": [],
            "tools_used": ["confirmation_guardrail"],
        }

    if operation.action_type == "run_gap_analysis":
        from src.api.v1.analysis import analyze_cv_jd_gap
        from src.models.schemas import GapAnalysisRequest

        analysis = await analyze_cv_jd_gap(
            GapAnalysisRequest(cv_id=operation.cv_id, jd_id=operation.jd_id),
            db=db,
            current_user=current_user,
        )
        evidence_sources = []
        for item in analysis.requirement_evidence[:5]:
            if not item.evidence:
                continue
            evidence_sources.append(
                {
                    "source_type": "analysis",
                    "source_id": analysis.id,
                    "title": item.requirement,
                    "quote": item.evidence[0].quote[:360],
                    "updated_at": analysis.created_at,
                    "provenance": "verified_analysis",
                }
            )
        evidence_sources.extend(
            [
                {"source_type": "cv", "source_id": cv["id"], "title": cv["title"], "updated_at": cv.get("updated_at") or None, "provenance": "user_data"},
                {"source_type": "jd", "source_id": jd["id"], "title": jd["title"], "updated_at": jd.get("created_at") or None, "provenance": "user_data" if jd.get("owned") else "system_data"},
            ]
        )
        missing = ", ".join(analysis.hard_skills_missing[:5]) or "chưa ghi nhận"
        return {
            "response": (
                f"Đã hoàn thành Gap Analysis cho CV “{cv['title']}” và JD “{jd['title']}”. "
                f"Điểm phù hợp: {analysis.match_score:.1f}%. Kỹ năng còn thiếu: {missing}. "
                "Các mục học tập/dự án là khuyến nghị tương lai, không phải thành tích đã hoàn thành."
            ),
            "provider": "nova_orchestrator",
            "model": "gap_analysis_agent",
            "llm_succeeded": True,
            "suggested_actions": [
                {"label": "Nguồn và bằng chứng", "action_type": "evidence", "sources": evidence_sources},
                {"label": "Mở kết quả Gap Analysis", "page": "gap"},
            ],
            "tools_used": ["gap_analysis_agent", "integrity_guardrail"],
        }

    from src.api.v1.interviews import start_interview_session
    from src.models.schemas import InterviewStartRequest

    question = await start_interview_session(
        InterviewStartRequest(
            cv_id=operation.cv_id,
            jd_id=operation.jd_id,
            total_questions=operation.total_questions,
        ),
        db=db,
        current_user=current_user,
    )
    return {
        "response": (
            f"Đã tạo phiên phỏng vấn cho CV “{cv['title']}” và JD “{jd['title']}”. "
            f"Câu hỏi đầu tiên: {question.question_text}"
        ),
        "provider": "nova_orchestrator",
        "model": "interview_agent",
        "llm_succeeded": True,
        "suggested_actions": [
            {
                "label": "Dữ liệu phiên phỏng vấn",
                "action_type": "evidence",
                "sources": [
                    {"source_type": "cv", "source_id": cv["id"], "title": cv["title"], "updated_at": cv.get("updated_at") or None, "provenance": "user_data"},
                    {"source_type": "jd", "source_id": jd["id"], "title": jd["title"], "updated_at": jd.get("created_at") or None, "provenance": "user_data" if jd.get("owned") else "system_data"},
                ],
            },
            {"label": "Vào phòng phỏng vấn", "page": "interview", "payload": {"session_id": question.session_id}},
        ],
        "tools_used": ["interview_agent"],
    }


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
    request_started_at = perf_counter()
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

    cv_count, analysis_count, interview_count = (
        await db.execute(
            select(
                select(func.count(CV.id)).where(CV.user_id == current_user.id).scalar_subquery(),
                select(func.count(CVAnalysis.id)).where(CVAnalysis.user_id == current_user.id).scalar_subquery(),
                select(func.count(InterviewSession.id)).where(InterviewSession.user_id == current_user.id).scalar_subquery(),
            )
        )
    ).one()
    latest_cv = await db.scalar(
        select(CV)
        .where(CV.user_id == current_user.id)
        .order_by(CV.created_at.desc())
        .limit(1)
    )
    orchestration_resources = await _load_orchestration_resources(db, current_user.id)

    rag_service = get_assistant_rag_service()
    rag_chunks = await rag_service.search(
        session=db,
        user_id=current_user.id,
        query=payload.message,
        top_k=3,
    )

    # Legacy-data fallback: index only the latest CV and one recent JD. New or
    # updated documents are indexed by their write hooks, so indexing ten rows
    # here only made the first chat request unnecessarily slow.
    if not rag_chunks and (orchestration_resources.get("cvs") or orchestration_resources.get("jds")):
        try:
            if latest_cv:
                await rag_service.index_cv(
                    session=db,
                    user_id=current_user.id,
                    cv_id=latest_cv.id,
                    title=latest_cv.title,
                    raw_text=latest_cv.raw_text,
                    parsed_json=latest_cv.parsed_json,
                )
            recent_jds = orchestration_resources.get("jds") or []
            if recent_jds:
                jd_row = await db.get(JobDescription, recent_jds[0]["id"])
                if jd_row:
                    await rag_service.index_jd(
                        session=db,
                        user_id=current_user.id,
                        jd_id=jd_row.id,
                        title=jd_row.title,
                        company=jd_row.company,
                        requirements_text=jd_row.requirements_text,
                        normalized_json=jd_row.normalized_json,
                    )
            await db.commit()
            rag_chunks = await rag_service.search(
                session=db,
                user_id=current_user.id,
                query=payload.message,
                top_k=3,
            )
        except Exception:
            await db.rollback()
            logger.warning("Không thể auto-index RAG embeddings trong assistant_chat", exc_info=True)

    orchestration_resources["rag_chunks"] = rag_chunks

    try:
        if payload.operation:
            result = await _execute_confirmed_operation(
                payload,
                orchestration_resources,
                db,
                current_user,
            )
        else:
            result = await career_assistant_agent.run(
                message=payload.message,
                history=history,
                user_context={
                    "user_id": current_user.id,
                    "full_name": current_user.full_name,
                    "role": current_user.role,
                    "current_page": payload.current_page,
                    "timezone": payload.timezone or get_settings().app_timezone,
                    "cv_count": cv_count or 0,
                    "latest_cv_title": latest_cv.title if latest_cv else None,
                    "analysis_count": analysis_count or 0,
                    "interview_count": interview_count or 0,
                    "_resources": orchestration_resources,
                    "rag_context": rag_chunks,
                },
            )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Assistant chat run error: %s", exc)
        result = {
            "response": "Nova đang gặp lỗi khi xử lý yêu cầu. Vui lòng thử lại sau ít phút.",
            "provider": "google_gemini",
            "model": get_settings().model_name,
            "llm_succeeded": False,
            "suggested_actions": [],
            "tools_used": [],
            "error": type(exc).__name__,
        }
    latency_ms = max(0, round((perf_counter() - request_started_at) * 1000))

    response_text = result.get("response", "Nova chưa thể trả lời lúc này.")
    provider = result.get("provider", "google_gemini")
    model = result.get("model", get_settings().model_name)
    llm_succeeded = bool(result.get("llm_succeeded"))
    suggested_actions = jsonable_encoder(result.get("suggested_actions", []))

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

    try:
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
    except Exception as save_err:
        await db.rollback()
        logger.error("Lỗi khi lưu ChatMessage / AIAuditLog: %s", save_err, exc_info=True)

    return AssistantChatResponse(
        response=response_text,
        provider=provider,
        model=model,
        llm_succeeded=llm_succeeded,
        suggested_actions=[AssistantAction.model_validate(item) for item in suggested_actions],
        conversation_id=conversation.id,
        user_message_id=user_message.id,
        assistant_message_id=assistant_message.id,
        rag_tier=str(result.get("rag_tier") or ("tier3_generative" if rag_chunks else "none")),
        latency_ms=latency_ms,
    )


@router.post("/chat/stream")
async def assistant_chat_stream(
    payload: AssistantChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Stream Nova events over SSE and persist the final response."""
    if payload.conversation_id:
        conversation = await _owned_conversation(
            db, payload.conversation_id, current_user.id
        )
        messages = sorted(
            conversation.messages,
            key=lambda message: (
                message.created_at,
                0 if message.role == "user" else 1,
            ),
        )
        history = [
            {"role": message.role, "content": message.content}
            for message in messages[-8:]
        ]
    else:
        conversation = ChatConversation(
            user_id=current_user.id,
            title=_conversation_title(payload.message),
        )
        db.add(conversation)
        await db.flush()
        history = [item.model_dump() for item in payload.history[-8:]]

    cv_count, analysis_count, interview_count = (
        await db.execute(
            select(
                select(func.count(CV.id))
                .where(CV.user_id == current_user.id)
                .scalar_subquery(),
                select(func.count(CVAnalysis.id))
                .where(CVAnalysis.user_id == current_user.id)
                .scalar_subquery(),
                select(func.count(InterviewSession.id))
                .where(InterviewSession.user_id == current_user.id)
                .scalar_subquery(),
            )
        )
    ).one()
    latest_cv = await db.scalar(
        select(CV)
        .where(CV.user_id == current_user.id)
        .order_by(CV.created_at.desc())
        .limit(1)
    )
    resources = await _load_orchestration_resources(db, current_user.id)

    async def events():
        started_at = perf_counter()
        final_result: dict = {}
        conversation_id = conversation.id
        try:
            if payload.operation:
                final_result = await _execute_confirmed_operation(
                    payload, resources, db, current_user
                )
                response_text = final_result.get("response", "")
                yield _sse_data(
                    {
                        "type": "metadata",
                        "suggested_actions": final_result.get(
                            "suggested_actions", []
                        ),
                        "conversation_id": conversation_id,
                    }
                )
                yield _sse_data(
                    {
                        "type": "chunk",
                        "content": response_text,
                        "conversation_id": conversation_id,
                    }
                )
            else:
                user_context = {
                    "full_name": current_user.full_name,
                    "role": current_user.role,
                    "current_page": payload.current_page,
                    "timezone": payload.timezone or get_settings().app_timezone,
                    "cv_count": cv_count or 0,
                    "latest_cv_title": latest_cv.title if latest_cv else None,
                    "analysis_count": analysis_count or 0,
                    "interview_count": interview_count or 0,
                    "_resources": resources,
                }
                yield _sse_data(
                    {"type": "init", "conversation_id": conversation_id}
                )
                async for event in career_assistant_agent.astream_run(
                    message=payload.message,
                    history=history,
                    user_context=user_context,
                ):
                    if event.get("type") == "done":
                        final_result = event
                    yield _sse_data(
                        {**event, "conversation_id": conversation_id}
                    )
        except Exception as exc:
            logger.exception("Assistant stream error: %s", exc)
            final_result = {
                "response": "Nova đang gặp lỗi khi xử lý yêu cầu. Vui lòng thử lại sau ít phút.",
                "provider": "google_gemini",
                "model": get_settings().model_name,
                "llm_succeeded": False,
                "suggested_actions": [],
                "tools_used": [],
                "error": type(exc).__name__,
            }
            yield _sse_data(
                {
                    "type": "done",
                    **final_result,
                    "conversation_id": conversation_id,
                }
            )

        response_text = final_result.get(
            "response", "Nova chưa thể trả lời lúc này."
        )
        provider = final_result.get("provider", "google_gemini")
        model = final_result.get("model", get_settings().model_name)
        message_time = datetime.now(UTC)
        db.add_all(
            [
                ChatMessage(
                    conversation_id=conversation_id,
                    role="user",
                    content=payload.message,
                    created_at=message_time,
                ),
                ChatMessage(
                    conversation_id=conversation_id,
                    role="assistant",
                    content=response_text,
                    provider=provider,
                    model=model,
                    llm_succeeded=bool(final_result.get("llm_succeeded")),
                    suggested_actions_json=jsonable_encoder(
                        final_result.get("suggested_actions", [])
                    ),
                    created_at=message_time + timedelta(milliseconds=5),
                ),
                AIAuditLog(
                    user_id=current_user.id,
                    conversation_id=conversation_id,
                    prompt=payload.message,
                    response=response_text,
                    provider=provider,
                    model=model,
                    llm_succeeded=bool(final_result.get("llm_succeeded")),
                    error_code=str(final_result.get("error") or "")[:160] or None,
                    current_page=payload.current_page,
                    latency_ms=max(0, round((perf_counter() - started_at) * 1000)),
                    tools_used_json=final_result.get("tools_used", []),
                ),
            ]
        )
        conversation.updated_at = datetime.now(UTC)
        await db.commit()

    return StreamingResponse(events(), media_type="text/event-stream")


def _sse_data(payload: dict) -> str:
    """Serialize one Server-Sent Event data frame."""
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"
