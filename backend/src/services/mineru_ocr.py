"""MinerU Agent API adapter for private document uploads."""

from __future__ import annotations

import asyncio
import logging
from io import BytesIO
from pathlib import Path
from time import monotonic
from typing import Any
from uuid import uuid4
from zipfile import BadZipFile, ZipFile

import httpx

from src.config import get_settings

logger = logging.getLogger(__name__)


class MinerUError(ValueError):
    """A recoverable MinerU OCR failure suitable for the upload pipeline."""


def _api_message(payload: Any) -> str:
    if isinstance(payload, dict):
        return str(payload.get("msg") or payload.get("message") or "unknown MinerU error")
    return "invalid MinerU response"


async def extract_text_with_mineru(file_bytes: bytes, filename: str) -> str:
    """Upload one document to MinerU Agent and return its Markdown output.

    MinerU processing is enabled only through ``OCR_PROVIDER=mineru`` because
    the Agent API receives the original CV/JD via a signed upload URL.
    """
    settings = get_settings()
    if settings.mineru_api_token:
        return await _extract_text_with_precision_api(file_bytes, filename)
    if len(file_bytes) > settings.mineru_max_file_size_mb * 1024 * 1024:
        raise MinerUError(
            f"OCR_002: Tệp vượt giới hạn {settings.mineru_max_file_size_mb} MB của MinerU Agent."
        )
    base_url = settings.mineru_agent_base_url.rstrip("/")
    suffix = Path(filename).suffix.casefold()
    options = {
        "file_name": Path(filename).name,
        "language": settings.mineru_language,
        "enable_table": settings.mineru_enable_table,
        "enable_formula": settings.mineru_enable_formula,
        "is_ocr": suffix == ".pdf",
    }
    timeout = httpx.Timeout(settings.mineru_timeout_seconds)
    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            submit = await client.post(f"{base_url}/parse/file", json=options)
            submit.raise_for_status()
            submitted = submit.json()
            if submitted.get("code") != 0:
                raise MinerUError(f"MinerU từ chối tệp: {_api_message(submitted)}")
            task = submitted.get("data") or {}
            task_id, upload_url = task.get("task_id"), task.get("file_url")
            if not isinstance(task_id, str) or not isinstance(upload_url, str):
                raise MinerUError("MinerU không trả về task_id hoặc URL tải tệp hợp lệ.")

            upload = await client.put(upload_url, content=file_bytes)
            upload.raise_for_status()
            deadline = monotonic() + settings.mineru_poll_timeout_seconds
            while monotonic() < deadline:
                await asyncio.sleep(settings.mineru_poll_interval_seconds)
                response = await client.get(f"{base_url}/parse/{task_id}")
                response.raise_for_status()
                result = response.json()
                if result.get("code") != 0:
                    raise MinerUError(f"Không thể kiểm tra tác vụ MinerU: {_api_message(result)}")
                data = result.get("data") or {}
                state = data.get("state")
                if state == "done":
                    markdown_url = data.get("markdown_url")
                    if not isinstance(markdown_url, str):
                        raise MinerUError("MinerU hoàn tất nhưng không trả về Markdown.")
                    markdown = await client.get(markdown_url)
                    markdown.raise_for_status()
                    return markdown.text
                if state == "failed":
                    raise MinerUError(f"MinerU OCR thất bại: {data.get('err_msg') or 'unknown error'}")
                if state not in {"waiting-file", "uploading", "pending", "running"}:
                    raise MinerUError(f"MinerU trả về trạng thái không hợp lệ: {state!r}")
    except MinerUError:
        raise
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("MinerU OCR request failed: %s", exc)
        raise MinerUError(f"OCR_002: Không thể gọi MinerU ({type(exc).__name__}).") from exc
    raise MinerUError(f"OCR_002: MinerU quá thời gian chờ sau {settings.mineru_poll_timeout_seconds} giây.")


def _markdown_from_precision_zip(payload: bytes) -> str:
    """Read only full.md from MinerU's result archive without writing it to disk."""
    try:
        with ZipFile(BytesIO(payload)) as archive:
            markdown_name = next((name for name in archive.namelist() if name.casefold().endswith("full.md")), None)
            if markdown_name is None:
                raise MinerUError("MinerU Precision không trả về tệp full.md.")
            return archive.read(markdown_name).decode("utf-8-sig")
    except MinerUError:
        raise
    except (BadZipFile, UnicodeDecodeError, KeyError) as exc:
        raise MinerUError("MinerU Precision trả về gói kết quả không hợp lệ.") from exc


async def _extract_text_with_precision_api(file_bytes: bytes, filename: str) -> str:
    """Use authenticated MinerU Precision v4 upload and batch-result APIs."""
    settings = get_settings()
    base_url = settings.mineru_precision_base_url.rstrip("/")
    headers = {"Authorization": f"Bearer {settings.mineru_api_token}"}
    # MinerU only accepts a restricted character set for data_id. Do not reuse
    # a user-supplied filename, which can contain spaces, accents or symbols.
    data_id = f"career-assistant-{uuid4().hex}"
    suffix = Path(filename).suffix.casefold()
    body = {
        "files": [{"name": Path(filename).name, "data_id": data_id, "is_ocr": suffix == ".pdf"}],
        "model_version": settings.mineru_model_version,
        "language": settings.mineru_language,
        "enable_table": settings.mineru_enable_table,
        "enable_formula": settings.mineru_enable_formula,
    }
    timeout = httpx.Timeout(settings.mineru_timeout_seconds)
    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            submitted = await client.post(f"{base_url}/file-urls/batch", headers=headers, json=body)
            submitted.raise_for_status()
            response = submitted.json()
            if response.get("code") != 0:
                raise MinerUError(f"MinerU Precision từ chối tệp: {_api_message(response)}")
            data = response.get("data") or {}
            batch_id, urls = data.get("batch_id"), data.get("file_urls")
            if not isinstance(batch_id, str) or not isinstance(urls, list) or not urls or not isinstance(urls[0], str):
                raise MinerUError("MinerU Precision không trả về URL tải tệp hợp lệ.")
            uploaded = await client.put(urls[0], content=file_bytes)
            uploaded.raise_for_status()

            deadline = monotonic() + settings.mineru_poll_timeout_seconds
            while monotonic() < deadline:
                await asyncio.sleep(settings.mineru_poll_interval_seconds)
                status = await client.get(f"{base_url}/extract-results/batch/{batch_id}", headers=headers)
                status.raise_for_status()
                result = status.json()
                if result.get("code") != 0:
                    raise MinerUError(f"Không thể kiểm tra tác vụ MinerU Precision: {_api_message(result)}")
                tasks = (result.get("data") or {}).get("extract_result") or []
                task = next((item for item in tasks if item.get("data_id") == data_id), tasks[0] if tasks else {})
                state = task.get("state")
                if state == "done":
                    zip_url = task.get("full_zip_url")
                    if not isinstance(zip_url, str):
                        raise MinerUError("MinerU Precision hoàn tất nhưng không trả về gói kết quả.")
                    archive = await client.get(zip_url)
                    archive.raise_for_status()
                    return _markdown_from_precision_zip(archive.content)
                if state == "failed":
                    raise MinerUError(f"MinerU Precision thất bại: {task.get('err_msg') or 'unknown error'}")
                if state not in {"waiting-file", "pending", "running", "converting"}:
                    raise MinerUError(f"MinerU Precision trả về trạng thái không hợp lệ: {state!r}")
    except MinerUError:
        raise
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("MinerU Precision request failed: %s", exc)
        raise MinerUError(f"OCR_002: Không thể gọi MinerU Precision ({type(exc).__name__}).") from exc
    raise MinerUError(f"OCR_002: MinerU Precision quá thời gian chờ sau {settings.mineru_poll_timeout_seconds} giây.")
