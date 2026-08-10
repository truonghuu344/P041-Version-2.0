from fastapi import APIRouter, HTTPException, Request

from src.agents.graph import agent
from src.logger import get_logger
from src.models.schemas import ChatRequest, ChatResponse

router = APIRouter()
logger = get_logger(__name__)


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest, http_request: Request) -> ChatResponse:
    """Chat với AI agent."""
    request_id = getattr(http_request.state, "request_id", "")

    logger.info(
        "Agent invoked",
        extra={
            "event": "agent_invoke",
            "message_len": len(request.message),
        },
    )

    try:
        result = await agent.ainvoke({"query": request.message})

        logger.info(
            "Agent responded",
            extra={
                "event": "agent_respond",
                "has_analysis": bool(result.get("analysis")),
            },
        )

        return ChatResponse(
            response=result.get("response", ""),
            analysis=result.get("analysis", ""),
        )
    except Exception as e:
        logger.error(
            "Agent invocation failed",
            exc_info=True,
            extra={
                "event": "agent_error",
                "exc_type": type(e).__name__,
                "exc_msg": str(e),
            },
        )
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status")
async def agent_status():
    """Kiểm tra trạng thái agent."""
    return {"status": "ready", "agent": "LangGraph Agent v1.0"}
