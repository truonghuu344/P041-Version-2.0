import asyncio
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

# pyrefly: ignore [missing-import]
from src.api.routes import router

# pyrefly: ignore [missing-import]
from src.api.v2.routes import router as v2_router

# pyrefly: ignore [missing-import]
from src.config import get_settings

# pyrefly: ignore [missing-import]
from src.core.errors import CVVariantError, PipelineError

# pyrefly: ignore [missing-import]
from src.db.database import engine, init_db

# pyrefly: ignore [missing-import]
from src.middleware.security import ApiProtectionMiddleware

# pyrefly: ignore [missing-import]
from src.services.job_rag import sync_market_jobs_safely


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    print(f"Starting {settings.app_name} in {settings.app_env} mode...")
    # Tự động tạo bảng DB khi startup
    await init_db()
    rag_sync_task = None
    if settings.vector_search_enabled and settings.vector_sync_on_startup:
        rag_sync_task = asyncio.create_task(sync_market_jobs_safely())
    yield
    if rag_sync_task and not rag_sync_task.done():
        rag_sync_task.cancel()
        with suppress(asyncio.CancelledError):
            await rag_sync_task
    print("Stopping service...")


app = FastAPI(
    title="Career Assistant X - API Backend",
    description="API Backend hệ thống Trợ Lý Nghề Nghiệp X: Tối ưu CV theo JD & Phòng Phỏng Vấn Thử STAR Rubric",
    version="1.0.0",
    lifespan=lifespan,
)

settings = get_settings()
origins = [origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()]

app.add_middleware(
    ApiProtectionMiddleware,
    requests_per_minute=settings.api_rate_limit_per_minute,
    max_body_bytes=settings.max_request_body_mb * 1024 * 1024,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins else ["*"],
    allow_origin_regex=(r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$" if settings.app_env == "development" else None),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api/v1")
app.include_router(v2_router, prefix="/api/v2")


@app.exception_handler(PipelineError)
async def pipeline_error_handler(_request: Request, exc: PipelineError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content=exc.payload())


@app.exception_handler(CVVariantError)
async def cv_variant_error_handler(_request: Request, exc: CVVariantError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content=exc.payload(),
        headers={"X-Trace-ID": exc.trace_id},
    )


@app.get("/health", tags=["System"])
async def health():
    return {"status": "ok", "app": settings.app_name, "env": settings.app_env}


@app.get("/ready", tags=["System"])
async def readiness():
    """Readiness probe: chỉ báo sẵn sàng khi database nhận truy vấn."""
    try:
        async with engine.connect() as connection:
            await connection.execute(text("SELECT 1"))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database unavailable",
        ) from exc
    return {"status": "ok", "database": "ready", "app": settings.app_name, "env": settings.app_env}
