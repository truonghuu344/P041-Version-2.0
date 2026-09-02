"""Career Assistant API endpoints backed by the vendored RenderCV engine."""

import asyncio
from typing import Any

from fastapi import APIRouter, HTTPException, Response, status
from pydantic import BaseModel, ConfigDict, Field

from rendercv.exception import RenderCVUserError, RenderCVUserValidationError
from src.services.rendercv_service import (
    RenderCVDocuments,
    list_rendercv_themes,
    render_rendercv_pdf,
    validate_rendercv_documents,
)

router = APIRouter(prefix="/rendercv", tags=["RenderCV"])
RENDER_TIMEOUT_SECONDS = 30.0


class RenderCVDocumentsRequest(BaseModel):
    """RenderCV's CV YAML and optional design, locale, and settings overlays."""

    model_config = ConfigDict(extra="forbid")

    cv_yaml: str = Field(min_length=1)
    design_yaml: str = ""
    locale_yaml: str = ""
    settings_yaml: str = ""

    def to_documents(self) -> RenderCVDocuments:
        """Convert the API model to the service model."""
        return RenderCVDocuments(**self.model_dump())


def rendercv_error_detail(error: Exception) -> list[dict[str, Any]]:
    """Convert RenderCV domain errors to a stable API error contract."""
    if isinstance(error, RenderCVUserValidationError):
        return [
            {
                "location": (
                    ".".join(item.schema_location) if item.schema_location else None
                ),
                "message": item.message,
                "yaml_source": item.yaml_source,
                "yaml_line": item.yaml_location[0][0] if item.yaml_location else None,
            }
            for item in error.validation_errors
        ]
    message = getattr(error, "message", None) or str(error) or "Invalid input."
    return [
        {
            "location": None,
            "message": message,
            "yaml_source": "main_yaml_file",
            "yaml_line": None,
        }
    ]


@router.post("/validate")
async def validate_rendercv(request: RenderCVDocumentsRequest) -> dict[str, bool]:
    """Validate RenderCV YAML without producing output files."""
    try:
        await asyncio.to_thread(validate_rendercv_documents, request.to_documents())
    except (RenderCVUserError, RenderCVUserValidationError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"errors": rendercv_error_detail(exc)},
        ) from exc
    return {"valid": True}


@router.post("/render")
async def render_rendercv(request: RenderCVDocumentsRequest) -> Response:
    """Render RenderCV YAML to a PDF using a bounded worker timeout."""
    try:
        pdf = await asyncio.wait_for(
            asyncio.to_thread(render_rendercv_pdf, request.to_documents()),
            timeout=RENDER_TIMEOUT_SECONDS,
        )
    except TimeoutError as exc:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="RenderCV PDF rendering timed out.",
        ) from exc
    except (RenderCVUserError, RenderCVUserValidationError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"errors": rendercv_error_detail(exc)},
        ) from exc
    return Response(content=pdf, media_type="application/pdf")


@router.get("/themes")
async def get_rendercv_themes() -> list[dict[str, Any]]:
    """List the themes supported by the integrated RenderCV engine."""
    return await asyncio.to_thread(list_rendercv_themes)
