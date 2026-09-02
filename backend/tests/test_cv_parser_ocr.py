import pytest

from src.services.cv_parser import extract_text_from_document


@pytest.mark.asyncio
async def test_document_extraction_uses_mineru_only(monkeypatch):
    calls = []

    async def fake_mineru(content: bytes, filename: str) -> str:
        calls.append((content, filename))
        return "Nguyen Van A\nPython"

    monkeypatch.setattr("src.services.mineru_ocr.extract_text_with_mineru", fake_mineru)
    assert await extract_text_from_document(b"pdf", "cv.pdf") == "Nguyen Van A\nPython"
    assert calls == [(b"pdf", "cv.pdf")]


@pytest.mark.asyncio
async def test_document_extraction_rejects_unsupported_file_type():
    with pytest.raises(ValueError, match="UPLOAD_002"):
        await extract_text_from_document(b"text", "cv.txt")


@pytest.mark.asyncio
async def test_document_extraction_gemini_fallback(monkeypatch):
    async def fake_mineru_fail(content: bytes, filename: str) -> str:
        raise ValueError("MinerU unreachable")

    async def fake_gemini(content: bytes, filename: str, content_type: str = "") -> str:
        return "Gemini OCR Extracted Text\nReact, TypeScript"

    monkeypatch.setattr("src.services.mineru_ocr.extract_text_with_mineru", fake_mineru_fail)
    monkeypatch.setattr("src.services.gemini_ocr.extract_text_with_gemini", fake_gemini)

    text = await extract_text_from_document(b"image_bytes", "job_jd.png")
    assert "Gemini OCR Extracted Text" in text
    assert "React" in text
