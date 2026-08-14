from types import SimpleNamespace

import pytest

from src.services.file_security import FileSecurityError, scan_uploaded_file, validate_file_signature


def test_file_magic_must_match_extension():
    with pytest.raises(FileSecurityError, match="UPLOAD_002"):
        validate_file_signature("resume.pdf", b"MZ executable")


@pytest.mark.asyncio
async def test_eicar_signature_is_rejected(monkeypatch):
    monkeypatch.setattr(
        "src.services.file_security.get_settings",
        lambda: SimpleNamespace(malware_scan_mode="disabled", app_env="test"),
    )
    with pytest.raises(FileSecurityError, match="UPLOAD_003"):
        await scan_uploaded_file(
            "resume.pdf",
            b"%PDF X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*",
        )


@pytest.mark.asyncio
async def test_required_scanner_fails_closed(monkeypatch):
    monkeypatch.setattr(
        "src.services.file_security.get_settings",
        lambda: SimpleNamespace(
            malware_scan_mode="required",
            app_env="production",
            clamav_host="127.0.0.1",
            clamav_port=1,
            clamav_timeout_seconds=1,
        ),
    )
    with pytest.raises(FileSecurityError, match="UPLOAD_004"):
        await scan_uploaded_file("resume.pdf", b"%PDF-safe")
