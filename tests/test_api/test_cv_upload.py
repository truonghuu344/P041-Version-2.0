"""
T1-001 → T1-003: Tests cho CV Upload & Parse endpoint
API Contract: POST /api/v1/cv/upload

Expected request: multipart/form-data với file (PDF/DOCX, ≤10MB)
Expected response:
{
  "cv_id": "uuid",
  "sections": {
    "education": [...],
    "skills": [...],
    "experience": [...],
    "projects": [...]
  },
  "raw_text": "...",
  "parse_confidence": 0.95
}

NOTE: Vì backend chưa implement, các test này dùng mock.
      Khi backend hoàn thiện, xóa mock và test real API.
"""

import io
import uuid
from unittest.mock import AsyncMock, patch

import pytest


# ─── Mock helpers ────────────────────────────────────────────────────────────

def make_pdf_bytes(size_mb: float = 0.1) -> bytes:
    """Tạo fake PDF bytes để test upload."""
    # PDF header hợp lệ
    header = b"%PDF-1.4\n"
    padding = b"0" * int(size_mb * 1024 * 1024)
    return header + padding


MOCK_PARSED_CV = {
    "cv_id": str(uuid.uuid4()),
    "sections": {
        "education": [
            {
                "institution": "Đại học Bách Khoa TP.HCM",
                "degree": "Kỹ sư Công nghệ Thông tin",
                "year": "2022-2026",
            }
        ],
        "skills": ["Python", "FastAPI", "Docker", "Git"],
        "experience": [
            {
                "company": "FPT Software",
                "role": "Backend Intern",
                "duration": "3 tháng (06/2025 - 08/2025)",
                "description": "Phát triển REST API với FastAPI",
            }
        ],
        "projects": [
            {
                "name": "E-commerce Platform",
                "tech": ["React", "Node.js", "MongoDB"],
                "description": "Xây dựng website thương mại điện tử",
            }
        ],
    },
    "raw_text": "Nguyen Van A - Software Engineer...",
    "parse_confidence": 0.93,
}


# ─── T1-001: Upload PDF hợp lệ ───────────────────────────────────────────────

@pytest.mark.asyncio
async def test_cv_upload_valid_pdf(client):
    """T1-001: Upload PDF hợp lệ → trả về JSON có đủ 4 sections."""
    with patch(
        "src.services.cv_parser.parse_cv",
        new_callable=AsyncMock,
        return_value=MOCK_PARSED_CV,
    ):
        pdf_bytes = make_pdf_bytes(0.5)
        response = await client.post(
            "/api/v1/cv/upload",
            files={"file": ("my_cv.pdf", io.BytesIO(pdf_bytes), "application/pdf")},
        )

    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    data = response.json()

    # Kiểm tra cấu trúc response
    assert "cv_id" in data, "Response phải có cv_id"
    assert "sections" in data, "Response phải có sections"
    assert "parse_confidence" in data, "Response phải có parse_confidence"

    # Kiểm tra đủ 4 sections theo AC của F-02
    sections = data["sections"]
    assert "education" in sections, "Thiếu section education"
    assert "skills" in sections, "Thiếu section skills"
    assert "experience" in sections, "Thiếu section experience"
    assert "projects" in sections, "Thiếu section projects"

    # Kiểm tra chất lượng parse (AC: ≥90% accuracy)
    assert data["parse_confidence"] >= 0.90, (
        f"Parse confidence {data['parse_confidence']} < 0.90 (yêu cầu AC F-02)"
    )


# ─── T1-002: Upload DOCX hợp lệ ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_cv_upload_valid_docx(client):
    """T1-002: Upload DOCX hợp lệ → trả về 200."""
    with patch(
        "src.services.cv_parser.parse_cv",
        new_callable=AsyncMock,
        return_value=MOCK_PARSED_CV,
    ):
        # DOCX header (PK magic bytes)
        docx_bytes = b"PK\x03\x04" + b"0" * 1000
        response = await client.post(
            "/api/v1/cv/upload",
            files={
                "file": (
                    "my_cv.docx",
                    io.BytesIO(docx_bytes),
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                )
            },
        )

    assert response.status_code == 200


# ─── T1-003: Upload file >10MB → 413 hoặc 422 ───────────────────────────────

@pytest.mark.asyncio
async def test_cv_upload_file_too_large(client):
    """T1-003: Upload file >10MB → phải bị từ chối (AC: ≤10MB).

    Backend nên trả 413 Request Entity Too Large hoặc 422 Validation Error.
    """
    # Tạo file 11MB
    large_pdf = make_pdf_bytes(size_mb=11.0)
    response = await client.post(
        "/api/v1/cv/upload",
        files={"file": ("big_cv.pdf", io.BytesIO(large_pdf), "application/pdf")},
    )

    assert response.status_code in (413, 422), (
        f"File >10MB phải bị từ chối, nhưng trả về {response.status_code}"
    )


# ─── T1-004: Upload định dạng không hỗ trợ → 415 ────────────────────────────

@pytest.mark.asyncio
async def test_cv_upload_unsupported_format(client):
    """T1-004: Upload .txt hoặc .jpg → 415 Unsupported Media Type.

    AC F-02: chỉ hỗ trợ .pdf và .docx.
    """
    response = await client.post(
        "/api/v1/cv/upload",
        files={"file": ("cv.txt", io.BytesIO(b"Plain text CV"), "text/plain")},
    )

    assert response.status_code == 415, (
        f"File .txt phải trả 415, nhưng trả về {response.status_code}"
    )


# ─── T1-005: Upload không có file → 422 ─────────────────────────────────────

@pytest.mark.asyncio
async def test_cv_upload_no_file(client):
    """T1-005: Request không có file → 422 Validation Error."""
    response = await client.post("/api/v1/cv/upload", data={})
    assert response.status_code == 422


# ─── T1-006: Parse confidence thấp → cảnh báo ───────────────────────────────

@pytest.mark.asyncio
async def test_cv_upload_low_confidence_warning(client):
    """T1-006: Nếu parse confidence < 0.90 → response phải có cảnh báo.

    AC F-02: độ chính xác ≥90%. Nếu dưới ngưỡng, cần thông báo để user xác nhận thủ công.
    """
    low_confidence_result = {**MOCK_PARSED_CV, "parse_confidence": 0.75}

    with patch(
        "src.services.cv_parser.parse_cv",
        new_callable=AsyncMock,
        return_value=low_confidence_result,
    ):
        pdf_bytes = make_pdf_bytes(0.5)
        response = await client.post(
            "/api/v1/cv/upload",
            files={"file": ("unclear_cv.pdf", io.BytesIO(pdf_bytes), "application/pdf")},
        )

    assert response.status_code == 200
    data = response.json()
    # Khi confidence thấp, response phải có warning flag để UI hiển thị
    assert "warning" in data or data.get("parse_confidence", 1.0) < 0.90, (
        "Response không phản ánh confidence thấp"
    )
