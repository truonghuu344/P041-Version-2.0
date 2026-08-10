"""HTTP API package."""

from src.backend.api.admin import router as admin_router
from src.backend.api.assistant import router as assistant_router
from src.backend.api.auth import router as auth_router

__all__ = ["admin_router", "assistant_router", "auth_router"]
