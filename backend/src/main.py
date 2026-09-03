import asyncio
from contextlib import asynccontextmanager, suppress
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from starlette.staticfiles import StaticFiles

from src.api.routes import router
from src.api.v2.routes import router as v2_router
from src.config import get_settings
from src.core.errors import CVVariantError, PipelineError
from src.core.logging_config import log_error_with_context, log_startup_config, mask_sensitive_data, setup_logging
from src.db.database import engine, init_db
from src.middleware.logging import RequestLoggingMiddleware
from src.middleware.security import ApiProtectionMiddleware
from src.services.deployed_data_sync import sync_deployed_job_catalog
from src.services.job_rag import sync_market_jobs_safely

settings = get_settings()
logger = setup_logging(settings.app_env, settings.log_level)


@asynccontextmanager
async def lifespan(app: FastAPI):
    log_startup_config(settings, logger)
    logger.info("Initializing database and models...")
    logger.info("[Startup] Build marker: CV-JD Matching & Scoring Engine v2026.08.28-v1")
    # Tự động tạo bảng DB khi startup
    await init_db()
    if settings.deployed_data_sync_on_startup:
        sync_result = await sync_deployed_job_catalog()
        logger.info(
            "Synchronized deployed JD catalog: created=%s, updated=%s, unchanged=%s",
            sync_result["created"],
            sync_result["updated"],
            sync_result["unchanged"],
        )
    rag_sync_task = None
    if settings.vector_search_enabled and settings.vector_sync_on_startup:
        rag_sync_task = asyncio.create_task(sync_market_jobs_safely())
    yield
    if rag_sync_task and not rag_sync_task.done():
        rag_sync_task.cancel()
        with suppress(asyncio.CancelledError):
            await rag_sync_task
    logger.info("Application shutdown complete.")


app = FastAPI(
    title="Career Assistant X - API Backend",
    description="API Backend hệ thống Trợ Lý Nghề Nghiệp X: Tối ưu CV theo JD & Phòng Phỏng Vấn Thử STAR Rubric",
    version="1.0.0",
    lifespan=lifespan,
)

origins = [origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()]

# 1. Logging Middleware (outermost for accurate full round-trip duration)
app.add_middleware(RequestLoggingMiddleware)

# 2. Rate Limiting & Body Protection Middleware
app.add_middleware(
    ApiProtectionMiddleware,
    requests_per_minute=settings.api_rate_limit_per_minute,
    max_body_bytes=settings.max_request_body_mb * 1024 * 1024,
)

# 3. CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins else ["*"],
    allow_origin_regex=(r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$" if settings.app_env == "development" else None),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Path("data/uploads/logos").mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory="data/uploads"), name="uploads")

app.include_router(router, prefix="/api/v1")
app.include_router(v2_router, prefix="/api/v2")


@app.exception_handler(PipelineError)
async def pipeline_error_handler(request: Request, exc: PipelineError) -> JSONResponse:
    logger.warning(
        "PipelineError at %s %s: %s (status_code=%d)",
        request.method,
        request.url.path,
        exc.message,
        exc.status_code,
    )
    return JSONResponse(status_code=exc.status_code, content=exc.payload())


@app.exception_handler(CVVariantError)
async def cv_variant_error_handler(request: Request, exc: CVVariantError) -> JSONResponse:
    logger.warning(
        "CVVariantError at %s %s [trace=%s]: %s (status_code=%d)",
        request.method,
        request.url.path,
        exc.trace_id,
        exc.message,
        exc.status_code,
    )
    return JSONResponse(
        status_code=exc.status_code,
        content=exc.payload(),
        headers={"X-Trace-ID": exc.trace_id},
    )


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    req_id = getattr(request.state, "request_id", "-")
    logger.warning(
        "Validation error [requestId=%s] at %s %s | Errors: %s",
        req_id,
        request.method,
        request.url.path,
        mask_sensitive_data(exc.errors()),
    )
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        content={"detail": jsonable_encoder(exc.errors())},
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    if exc.status_code >= 500:
        log_error_with_context(
            logger=logger,
            service=f"HTTP Exception {request.method} {request.url.path}",
            error=f"Status {exc.status_code}: {exc.detail}",
            req_data=str(request.query_params),
            exc=exc,
        )
    else:
        logger.info(
            "HTTPException %d at %s %s: %s",
            exc.status_code,
            request.method,
            request.url.path,
            exc.detail,
        )
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=exc.headers,
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    log_error_with_context(
        logger=logger,
        service=f"Unhandled Server Error {request.method} {request.url.path}",
        error=exc,
        req_data=str(request.query_params),
        exc=exc,
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Đã xảy ra lỗi máy chủ nội bộ. Vui lòng thử lại sau."},
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
        logger.error("Readiness check failed: Database unavailable (%s)", str(exc))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database unavailable",
        ) from exc
    return {"status": "ok", "database": "ready", "app": settings.app_name, "env": settings.app_env}
