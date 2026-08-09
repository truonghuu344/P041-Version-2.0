import asyncio
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request, status

from src.backend.config import get_settings
from src.backend.db.database import check_database_connection, close_database_connection

settings = get_settings()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    try:
        app.state.database_ready = await asyncio.wait_for(
            check_database_connection(),
            timeout=settings.database_healthcheck_timeout,
        )
    except Exception as exc:
        app.state.database_ready = False
        logger.warning("Database is not ready during startup: %s", type(exc).__name__)

    yield
    await close_database_connection()

app = FastAPI(
    title=settings.app_name,
    description="Backend API for CV, interview and career-assistant features.",
    version="0.1.0",
    lifespan=lifespan,
)


@app.get("/health", tags=["System"], summary="Check backend health")
async def health_check() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "backend",
        "environment": settings.app_env,
    }


@app.get("/ready", tags=["System"], summary="Check backend dependencies")
async def readiness_check(request: Request) -> dict[str, str]:
    try:
        database_ready = await asyncio.wait_for(
            check_database_connection(),
            timeout=settings.database_healthcheck_timeout,
        )
    except Exception:
        database_ready = False

    request.app.state.database_ready = database_ready
    if not database_ready:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database is not ready",
        )

    return {"status": "ready", "database": "connected"}
