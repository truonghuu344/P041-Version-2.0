from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api.routes import router
from src.config import get_settings
from src.db.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    print(f"Starting {settings.app_name} in {settings.app_env} mode...")
    # Tự động tạo bảng DB khi startup
    await init_db()
    yield
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
    CORSMiddleware,
    allow_origins=origins if origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api/v1")


@app.get("/health", tags=["System"])
async def health():
    return {"status": "ok", "app": settings.app_name, "env": settings.app_env}
