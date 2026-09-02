from fastapi import APIRouter, File, HTTPException, Request, UploadFile, status

from src.agents.graph import agent
from src.api.v1.admin import router as admin_router
from src.api.v1.analysis import router as analysis_router
from src.api.v1.assistant import router as assistant_router
from src.api.v1.auth import router as auth_router
from src.api.v1.candidates import router as candidates_router
from src.api.v1.counselor import router as counselor_router
from src.api.v1.cvs import router as cvs_router
from src.api.v1.interview_agendas import router as interview_agendas_router
from src.api.v1.interviews import router as interviews_router
from src.api.v1.jds import router as jds_router
from src.api.v1.jobs import router as jobs_router
from src.api.v1.matches import router as matches_router
from src.api.v1.metrics import router as metrics_router
from src.api.v1.notifications import router as notifications_router
from src.api.v1.rendercv import router as rendercv_router
from src.api.v1.storage import router as storage_router
from src.api.v1.ws_interview import router as ws_interview_router
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

# Include Sub-routers
router.include_router(auth_router)
router.include_router(candidates_router)
router.include_router(cvs_router)
router.include_router(jds_router)
router.include_router(jobs_router)
router.include_router(analysis_router)
# Đăng ký TRƯỚC interviews_router: "/interviews/agenda" phải khớp trước khi
# rơi vào pattern "/interviews/{session_id}" của interviews_router.
router.include_router(interview_agendas_router)
router.include_router(interviews_router)
router.include_router(admin_router)
router.include_router(assistant_router)
router.include_router(counselor_router)
router.include_router(notifications_router)
router.include_router(rendercv_router)
router.include_router(storage_router)
router.include_router(metrics_router)
router.include_router(matches_router)
router.include_router(ws_interview_router)



@router.post("/chat", response_model=ChatResponse, tags=["Legacy Agent"])
async def chat(request: ChatRequest) -> ChatResponse:
    """Chat với AI agent (Legacy endpoint)."""
    try:
        result = await agent.ainvoke({"query": request.message})
        return ChatResponse(
            response=result.get("response", ""),
            analysis=result.get("analysis", ""),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status", tags=["System"])
async def agent_status():
    """Kiểm tra trạng thái agent."""
    return {
        "status": "ready",
        "agents": ["CV Gap Analysis Agent", "Mock Interview STAR Agent"],
        "orchestration": "LangGraph",
        "backend": "FastAPI + PostgreSQL",
    }


# ─── Workflow & Guardrail Compatibility Endpoints ─────────────────────────────

@router.post("/cv/upload", tags=["CV Compatibility"])
async def upload_cv_compat(file: UploadFile = File(...)):
    """Upload file CV (.pdf hoặc .docx), parse nội dung và trích xuất sections."""
    filename = file.filename or ""
    lower_name = filename.lower()

    if not (lower_name.endswith(".pdf") or lower_name.endswith(".docx")):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Unsupported Media Type: Only PDF and DOCX files are allowed",
        )

    try:
        contents = await file.read()
        if len(contents) > 10 * 1024 * 1024:  # 10MB
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="File size exceeds maximum limit of 10MB",
            )

        result = await cv_parser.parse_cv(contents, filename, file.content_type or "")
        return result
    finally:
        await file.close()


@router.post("/cv/analyze", tags=["CV Compatibility"])
async def analyze_cv_compat(request: CVAnalyzeRequest, http_request: Request):
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
    return res


@router.post("/cv/suggestions/{suggestion_id}/accept", tags=["CV Compatibility"])
async def accept_suggestion_compat(
    suggestion_id: str,
    decision: SuggestionDecisionRequest | None = None,
):
    """Chấp nhận gợi ý chỉnh sửa từ AI."""
    return await cv_service.accept_suggestion(
        suggestion_id=suggestion_id,
        final_text=decision.final_text if decision else None,
    )


@router.post("/cv/suggestions/{suggestion_id}/reject", tags=["CV Compatibility"])
async def reject_suggestion_compat(suggestion_id: str):
    """Từ chối gợi ý chỉnh sửa từ AI."""
    return await cv_service.reject_suggestion(suggestion_id=suggestion_id)


@router.get("/cv/{cv_id}/export", tags=["CV Compatibility"])
async def export_cv_compat(cv_id: str):
    """Xuất CV sau tối ưu dưới dạng PDF/DOCX."""
    return await cv_service.export_cv(cv_id=cv_id)


@router.post("/interview/start", tags=["Interview Compatibility"])
async def start_interview_compat(request: InterviewStartRequest, http_request: Request):
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


@router.post("/interview/{session_id}/answer", tags=["Interview Compatibility"])
async def submit_interview_answer_compat(
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


@router.get("/interview/history", tags=["Interview Compatibility"])
async def get_interview_history_compat():
    """Lấy lịch sử các phiên phỏng vấn đã thực hiện."""
    return {"history": []}


@router.get("/interview/{session_id}/report", tags=["Interview Compatibility"])
async def get_interview_report_compat(session_id: str):
    """Lấy báo cáo STAR và gợi ý cải thiện sau khi hoàn thành phỏng vấn."""
    return await interview_service.get_report(session_id)
