from io import BytesIO
from types import SimpleNamespace
from zipfile import ZipFile

import httpx
import pytest

from src.services.mineru_ocr import extract_text_with_mineru


@pytest.mark.asyncio
async def test_mineru_upload_polls_and_downloads_markdown(monkeypatch):
    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append((request.method, str(request.url)))
        if request.url.path.endswith("/parse/file"):
            return httpx.Response(200, json={"code": 0, "data": {"task_id": "task-1", "file_url": "https://upload.test/file"}})
        if request.url.host == "upload.test":
            assert request.content == b"pdf-bytes"
            return httpx.Response(200)
        if request.url.path.endswith("/parse/task-1"):
            return httpx.Response(200, json={"code": 0, "data": {"state": "done", "markdown_url": "https://cdn.test/result.md"}})
        if request.url.host == "cdn.test":
            return httpx.Response(200, text="# Nguyen Van A\n\nPython")
        raise AssertionError(f"Unexpected request: {request.url}")

    class FakeAsyncClient(httpx.AsyncClient):
        def __init__(self, **kwargs):
            super().__init__(transport=httpx.MockTransport(handler), **kwargs)

    monkeypatch.setattr("src.services.mineru_ocr.httpx.AsyncClient", FakeAsyncClient)
    monkeypatch.setattr(
        "src.services.mineru_ocr.get_settings",
        lambda: SimpleNamespace(
            mineru_agent_base_url="https://mineru.test/api/v1/agent",
            mineru_api_token="",
            mineru_language="vi",
            mineru_enable_table=True,
            mineru_enable_formula=False,
            mineru_max_file_size_mb=10,
            mineru_timeout_seconds=5,
            mineru_poll_interval_seconds=0.001,
            mineru_poll_timeout_seconds=2,
        ),
    )

    assert await extract_text_with_mineru(b"pdf-bytes", "cv.pdf") == "# Nguyen Van A\n\nPython"
    assert [method for method, _ in calls] == ["POST", "PUT", "GET", "GET"]


@pytest.mark.asyncio
async def test_mineru_token_uses_precision_api_and_reads_markdown(monkeypatch):
    archive = BytesIO()
    with ZipFile(archive, "w") as bundle:
        bundle.writestr("output/full.md", "# Structured CV\n\nPython")

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers.get("authorization") == "Bearer test-token" or request.url.host != "mineru.test"
        if request.url.path.endswith("/file-urls/batch"):
            return httpx.Response(200, json={"code": 0, "data": {"batch_id": "batch-1", "file_urls": ["https://upload.test/file"]}})
        if request.url.host == "upload.test":
            return httpx.Response(200)
        if request.url.path.endswith("/extract-results/batch/batch-1"):
            return httpx.Response(200, json={"code": 0, "data": {"extract_result": [{"state": "done", "full_zip_url": "https://cdn.test/result.zip"}]}})
        if request.url.host == "cdn.test":
            return httpx.Response(200, content=archive.getvalue())
        raise AssertionError(f"Unexpected request: {request.url}")

    class FakeAsyncClient(httpx.AsyncClient):
        def __init__(self, **kwargs):
            super().__init__(transport=httpx.MockTransport(handler), **kwargs)

    monkeypatch.setattr("src.services.mineru_ocr.httpx.AsyncClient", FakeAsyncClient)
    monkeypatch.setattr(
        "src.services.mineru_ocr.get_settings",
        lambda: SimpleNamespace(
            mineru_api_token="test-token",
            mineru_precision_base_url="https://mineru.test/api/v4",
            mineru_model_version="vlm",
            mineru_language="vi",
            mineru_enable_table=True,
            mineru_enable_formula=False,
            mineru_timeout_seconds=5,
            mineru_poll_interval_seconds=0.001,
            mineru_poll_timeout_seconds=2,
        ),
    )

    assert await extract_text_with_mineru(b"pdf-bytes", "CV Nguyen Van A.pdf") == "# Structured CV\n\nPython"
