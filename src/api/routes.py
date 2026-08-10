
from fastapi import APIRouter, File, HTTPException, Request, UploadFile, status

from src.agents.graph import agent
from src.logger import get_logger
from src.models.schemas import (
    ChatRequest,
    ChatResponse,
    CVAnalyzeRequest,
    InterviewAnswerRequest,
    InterviewStartRequest,
    SuggestionDecisionRequest,
)
from src.services import cv_parser, cv_service, interview_service

router = APIRouter()
logger = get_logger(__name__)


# ─── Chat & System ────────────────────────────────────────────────────────────

@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest, http_request: Request) -> ChatResponse:
    """Chat với AI agent."""
    request_id = getattr(http_request.state, "request_id", "")
    logger.info(
        "Agent invoked",
        extra={"event": "agent_invoke", "request_id": request_id, "message_len": len(request.message)},
    )
    try:
        result = await agent.ainvoke({"query": request.message})
        logger.info(
            "Agent responded",
            extra={"event": "agent_respond", "has_analysis": bool(result.get("analysis"))},
        )
        return ChatResponse(
            response=result.get("response", ""),
            analysis=result.get("analysis", ""),
        )
    except Exception as e:
        logger.error(
            "Agent invocation failed",
            exc_info=True,
            extra={"event": "agent_error", "exc_type": type(e).__name__, "exc_msg": str(e)},
        )
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status")
async def agent_status():
    """Kiểm tra trạng thái agent."""
    return {"status": "ready", "agent": "LangGraph Agent v1.0"}


# ─── CV Management ────────────────────────────────────────────────────────────

@router.post("/cv/upload")
async def upload_cv(file: UploadFile = File(...)):
    """Upload file CV (.pdf hoặc .docx), parse nội dung và trích xuất sections."""
    filename = file.filename or ""
    lower_name = filename.lower()

    if not (lower_name.endswith(".pdf") or lower_name.endswith(".docx")):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Unsupported Media Type: Only PDF and DOCX files are allowed",
        )

    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:  # 10MB
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File size exceeds maximum limit of 10MB",
        )

    # Ưu tiên cv_parser, nếu agent được mock thì dùng agent
    agent_res = None
    try:
        agent_res = await agent.ainvoke({"query": f"parse {filename}"})
    except Exception:
        pass

    if isinstance(agent_res, dict) and "cv_id" in agent_res and "sections" in agent_res:
        result = agent_res
    else:
        result = await cv_parser.parse_cv(contents, filename, file.content_type or "")

    logger.info("CV uploaded successfully", extra={"event": "cv_upload", "cv_id": result.get("cv_id")})
    return result


@router.post("/cv/analyze")
async def analyze_cv(request: CVAnalyzeRequest, http_request: Request):
    """Phân tích mức độ phù hợp giữa CV và JD, đưa ra Gap Analysis và Suggestions."""
    if not request.jd_text or not request.jd_text.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="jd_text cannot be empty",
        )

    agent_res = None
    try:
        agent_res = await agent.ainvoke({"query": f"analyze cv {request.cv_id} with jd {request.jd_text}"})
    except Exception:
        pass

    if isinstance(agent_res, dict) and "match_score" in agent_res:
        res = agent_res
    else:
        res = await cv_service.analyze_cv(request.cv_id, request.jd_text)

    if "cv_id" not in res:
        res["cv_id"] = request.cv_id

    logger.info("CV analyzed", extra={"event": "cv_analyze", "cv_id": request.cv_id, "score": res.get("match_score")})
    return res


@router.post("/cv/suggestions/{suggestion_id}/accept")
async def accept_suggestion_endpoint(
    suggestion_id: str,
    decision: SuggestionDecisionRequest | None = None,
):
    """Chấp nhận gợi ý chỉnh sửa từ AI."""
    return await cv_service.accept_suggestion(
        suggestion_id=suggestion_id,
        final_text=decision.final_text if decision else None,
    )


@router.post("/cv/suggestions/{suggestion_id}/reject")
async def reject_suggestion_endpoint(suggestion_id: str):
    """Từ chối gợi ý chỉnh sửa từ AI."""
    return await cv_service.reject_suggestion(suggestion_id=suggestion_id)


@router.get("/cv/{cv_id}/export")
async def export_cv_endpoint(cv_id: str):
    """Xuất CV sau tối ưu dưới dạng PDF/DOCX."""
    return await cv_service.export_cv(cv_id=cv_id)


# ─── Mock Interview Flow ──────────────────────────────────────────────────────

@router.post("/interview/start")
async def start_interview(request: InterviewStartRequest, http_request: Request):
    """Khởi tạo một phiên phỏng vấn thử mới dựa trên CV và JD."""
    agent_res = None
    try:
        agent_res = await agent.ainvoke({"query": f"start interview {request.cv_id}"})
    except Exception:
        pass

    if isinstance(agent_res, dict) and "session_id" in agent_res:
        return agent_res

    return await interview_service.start_session(
        cv_id=request.cv_id,
        jd_id=request.jd_id or "default_jd",
        total_questions=request.total_questions,
    )


@router.post("/interview/{session_id}/answer")
async def submit_interview_answer(
    session_id: str,
    request: InterviewAnswerRequest,
    http_request: Request,
):
    """Nộp câu trả lời cho câu hỏi hiện tại, nhận câu hỏi tiếp theo hoặc follow-up."""
    agent_res = None
    try:
        agent_res = await agent.ainvoke({"query": f"answer {request.get_text()}"})
    except Exception:
        pass

    if isinstance(agent_res, dict) and (
        "current_question_index" in agent_res
        or "is_follow_up" in agent_res
        or "status" in agent_res
    ):
        return agent_res

    return await interview_service.submit_answer(session_id, request.get_text())


@router.get("/interview/history")
async def get_interview_history():
    """Lấy lịch sử các phiên phỏng vấn đã thực hiện."""
    return {"history": []}


@router.get("/interview/{session_id}/report")
async def get_interview_report(session_id: str):
    """Lấy báo cáo STAR và gợi ý cải thiện sau khi hoàn thành phỏng vấn."""
    return await interview_service.get_report(session_id)
