from fastapi import FastAPI

from src.backend.config import get_settings

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    description="Backend API for CV, interview and career-assistant features.",
    version="0.1.0",
)


@app.get("/health", tags=["System"], summary="Check backend health")
async def health_check() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "backend",
        "environment": settings.app_env,
    }

