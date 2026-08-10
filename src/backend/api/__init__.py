"""HTTP API package."""

from src.backend.api.auth import router as auth_router

__all__ = ["auth_router"]
