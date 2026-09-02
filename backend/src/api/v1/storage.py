from pathlib import Path

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import Response

from src.config import get_settings
from src.services.object_storage import get_bytes_async

router = APIRouter(prefix="/storage", tags=["Storage & Media"])

MIME_TYPES = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".gif": "image/gif",
    ".pdf": "application/pdf",
}


@router.get("/media/{file_path:path}")
async def get_stored_media(file_path: str):
    """Public media server for uploaded assets (logos, pictures)."""
    clean_path = file_path.lstrip("/").replace("\\", "/")
    if ".." in clean_path:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Đường dẫn không hợp lệ.")

    ext = Path(clean_path).suffix.lower()
    content_type = MIME_TYPES.get(ext, "application/octet-stream")

    settings = get_settings()
    location = (
        f"r2://{settings.s3_bucket}/{clean_path}"
        if settings.storage_provider != "local"
        else str(Path("data/uploads") / clean_path)
    )

    try:
        content = await get_bytes_async(location)
    except Exception:
        local_candidate = Path("data/uploads") / clean_path
        if local_candidate.is_file():
            content = local_candidate.read_bytes()
        else:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy tệp phương tiện.")

    return Response(
        content=content,
        media_type=content_type,
        headers={"Cache-Control": "public, max-age=86400"},
    )
