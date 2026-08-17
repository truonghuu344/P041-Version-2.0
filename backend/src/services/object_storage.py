"""Private object storage abstraction for local disk and Cloudflare R2."""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path
from urllib.parse import urlparse

from src.config import get_settings

logger = logging.getLogger(__name__)


class ObjectStorageError(RuntimeError):
    """Raised when an object cannot be read, written, or removed safely."""


def _r2_client():
    settings = get_settings()
    required = {
        "S3_ENDPOINT_URL": settings.s3_endpoint_url,
        "S3_BUCKET": settings.s3_bucket,
        "S3_ACCESS_KEY_ID": settings.s3_access_key_id,
        "S3_SECRET_ACCESS_KEY": settings.s3_secret_access_key,
    }
    missing = [name for name, value in required.items() if not value]
    if missing:
        raise ObjectStorageError(f"R2 chưa được cấu hình: thiếu {', '.join(missing)}")
    try:
        import boto3
    except ImportError as exc:  # pragma: no cover - covered by deployment dependency
        raise ObjectStorageError("Thiếu dependency boto3 cho Cloudflare R2.") from exc
    return boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint_url,
        region_name=settings.s3_region,
        aws_access_key_id=settings.s3_access_key_id,
        aws_secret_access_key=settings.s3_secret_access_key,
    )


def _parse_r2_uri(location: str) -> tuple[str, str]:
    parsed = urlparse(location)
    if parsed.scheme != "r2" or not parsed.netloc or not parsed.path.lstrip("/"):
        raise ObjectStorageError("Đường dẫn object R2 không hợp lệ.")
    configured_bucket = get_settings().s3_bucket
    if configured_bucket and parsed.netloc != configured_bucket:
        raise ObjectStorageError("Object không thuộc bucket R2 đang cấu hình.")
    return parsed.netloc, parsed.path.lstrip("/")


def put_bytes(*, content: bytes, key: str, content_type: str, local_path: Path) -> str:
    """Write content and return a DB-safe location (path locally, r2 URI in production)."""
    settings = get_settings()
    if settings.storage_provider == "local":
        local_path.parent.mkdir(parents=True, exist_ok=True)
        local_path.write_bytes(content)
        return str(local_path)

    try:
        client = _r2_client()
        client.put_object(Bucket=settings.s3_bucket, Key=key, Body=content, ContentType=content_type)
    except ObjectStorageError:
        raise
    except Exception as exc:
        logger.exception("Không thể tải object lên R2: %s", key)
        raise ObjectStorageError("Không thể lưu file lên R2.") from exc
    return f"r2://{settings.s3_bucket}/{key}"


def get_bytes(location: str) -> bytes:
    if not location.startswith("r2://"):
        return Path(location).read_bytes()
    bucket, key = _parse_r2_uri(location)
    try:
        return _r2_client().get_object(Bucket=bucket, Key=key)["Body"].read()
    except ObjectStorageError:
        raise
    except Exception as exc:
        logger.exception("Không thể đọc object R2: %s", key)
        raise ObjectStorageError("Không thể đọc file từ R2.") from exc


def delete(location: str | None, *, local_root: Path | None = None) -> None:
    """Best-effort delete. Local files are constrained to the caller-owned root."""
    if not location:
        return
    if location.startswith("r2://"):
        try:
            bucket, key = _parse_r2_uri(location)
            _r2_client().delete_object(Bucket=bucket, Key=key)
        except Exception:
            logger.warning("Không thể xóa object storage: %s", location, exc_info=True)
        return

    try:
        path = Path(location).resolve()
        if local_root is None or local_root.resolve() not in path.parents:
            logger.warning("Bỏ qua file local nằm ngoài storage root: %s", path)
            return
        path.unlink(missing_ok=True)
    except OSError:
        logger.warning("Không thể xóa file local: %s", location, exc_info=True)


async def put_bytes_async(**kwargs) -> str:
    return await asyncio.to_thread(put_bytes, **kwargs)


async def get_bytes_async(location: str) -> bytes:
    return await asyncio.to_thread(get_bytes, location)


async def delete_async(location: str | None, *, local_root: Path | None = None) -> None:
    await asyncio.to_thread(delete, location, local_root=local_root)
