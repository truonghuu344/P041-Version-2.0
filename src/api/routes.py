from fastapi import APIRouter, HTTPException

from src.agents.graph import agent
from src.api.v1.admin import router as admin_router
from src.api.v1.analysis import router as analysis_router
from src.api.v1.auth import router as auth_router
from src.api.v1.cvs import router as cvs_router
from src.api.v1.interviews import router as interviews_router
from src.api.v1.jds import router as jds_router
from src.models.schemas import ChatRequest, ChatResponse

router = APIRouter()

# Include Sub-routers
router.include_router(auth_router)
router.include_router(cvs_router)
router.include_router(jds_router)
router.include_router(analysis_router)
router.include_router(interviews_router)
router.include_router(admin_router)


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
