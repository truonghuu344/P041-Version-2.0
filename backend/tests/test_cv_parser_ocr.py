from io import BytesIO

import pymupdf
import pytest
from pypdf import PdfWriter

from src.services.cv_parser import extract_text_from_pdf, extract_text_from_scanned_pdf


@pytest.mark.asyncio
async def test_scanned_pdf_renders_and_ocrs_every_page(monkeypatch):
    document = pymupdf.open()
    document.new_page()
    document.new_page()
    payload = document.tobytes()
    document.close()
    calls = []

    async def fake_ocr(content: bytes, mime_type: str) -> str:
        calls.append((content, mime_type))
        return f"OCR content from page {len(calls)}"

    monkeypatch.setattr("src.services.cv_parser.extract_text_from_image", fake_ocr)
    text = await extract_text_from_scanned_pdf(payload)
    assert len(calls) == 2
    assert all(mime == "image/png" for _, mime in calls)
    assert "[PAGE 1]\nOCR content from page 1" in text
    assert "[PAGE 2]\nOCR content from page 2" in text


def test_password_protected_pdf_has_specific_error_code():
    writer = PdfWriter()
    writer.add_blank_page(width=100, height=100)
    writer.encrypt("secret")
    output = BytesIO()
    writer.write(output)
    with pytest.raises(ValueError, match="PARSER_003"):
        extract_text_from_pdf(output.getvalue())
