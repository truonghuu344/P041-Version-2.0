from __future__ import annotations

import asyncio
import logging
import socket
import struct
from pathlib import Path

from src.config import get_settings

logger = logging.getLogger(__name__)

MAGIC_HEADERS = {
    ".pdf": (b"%PDF",),
    ".docx": (b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08"),
    ".jpg": (b"\xff\xd8\xff",),
    ".jpeg": (b"\xff\xd8\xff",),
    ".png": (b"\x89PNG\r\n\x1a\n",),
    ".webp": (b"RIFF",),
}


class FileSecurityError(ValueError):
    pass


def validate_file_signature(filename: str, content: bytes) -> None:
    suffix = Path(filename).suffix.casefold()
    expected = MAGIC_HEADERS.get(suffix)
    if expected and not any(content.startswith(header) or (suffix == ".pdf" and b"%PDF" in content[:1024]) for header in expected):
        raise FileSecurityError("UPLOAD_002: Nội dung file không khớp với phần mở rộng.")
    if content.startswith(b"MZ"):
        raise FileSecurityError("UPLOAD_002: Tệp thực thi không được phép tải lên.")


def _local_signature_scan(content: bytes) -> None:
    upper = content.upper()
    # Standard harmless antivirus test signature and common executable/script markers.
    if b"EICAR-STANDARD-ANTIVIRUS-TEST-FILE" in upper:
        raise FileSecurityError("UPLOAD_003: Malware signature detected (EICAR).")
    if b"<SCRIPT" in upper and b"JAVASCRIPT:" in upper:
        raise FileSecurityError("UPLOAD_003: Nội dung script nguy hiểm được phát hiện.")


def _clamav_scan(content: bytes, host: str, port: int, timeout: float) -> None:
    with socket.create_connection((host, port), timeout=timeout) as sock:
        sock.sendall(b"zINSTREAM\0")
        for offset in range(0, len(content), 64 * 1024):
            chunk = content[offset : offset + 64 * 1024]
            sock.sendall(struct.pack(">I", len(chunk)))
            sock.sendall(chunk)
        sock.sendall(struct.pack(">I", 0))
        response = sock.recv(4096).decode("utf-8", errors="replace")
    if "FOUND" in response:
        signature = response.split(":", 1)[-1].replace("FOUND", "").strip(" \0")
        raise FileSecurityError(f"UPLOAD_003: Malware detected ({signature}).")
    if "OK" not in response:
        raise RuntimeError(f"ClamAV returned an invalid response: {response[:200]}")


async def scan_uploaded_file(filename: str, content: bytes) -> None:
    settings = get_settings()
    validate_file_signature(filename, content)
    _local_signature_scan(content)
    if settings.malware_scan_mode == "disabled" or (
        settings.malware_scan_mode == "auto" and settings.app_env != "production"
    ):
        return
    try:
        await asyncio.to_thread(
            _clamav_scan,
            content,
            settings.clamav_host,
            settings.clamav_port,
            settings.clamav_timeout_seconds,
        )
    except FileSecurityError:
        raise
    except Exception as exc:
        if settings.malware_scan_mode == "required":
            raise FileSecurityError("UPLOAD_004: Malware scanner không khả dụng.") from exc
        logger.warning("ClamAV unavailable; local signature scan was used: %s", exc)
