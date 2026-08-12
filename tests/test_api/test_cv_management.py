from types import SimpleNamespace

import pytest

from tests.helpers import insert_cv, register_and_login


@pytest.mark.asyncio
async def test_cv_endpoints_require_authentication(client):
    assert (await client.get("/api/v1/cvs")).status_code == 401
    assert (
        await client.post(
            "/api/v1/cvs/upload",
            files={"file": ("cv.pdf", b"content", "application/pdf")},
        )
    ).status_code == 401


@pytest.mark.asyncio
async def test_upload_rejects_unsupported_extension(client):
    _user, headers = await register_and_login(client, email="invalid-extension@example.com")

    response = await client.post(
        "/api/v1/cvs/upload",
        headers=headers,
        files={"file": ("malware.exe", b"not-a-cv", "application/octet-stream")},
    )
    assert response.status_code == 400
    assert "PDF" in response.json()["detail"]


@pytest.mark.asyncio
async def test_upload_rejects_file_larger_than_ten_megabytes(client):
    _user, headers = await register_and_login(client, email="large-cv@example.com")

    response = await client.post(
        "/api/v1/cvs/upload",
        headers=headers,
        files={"file": ("large.pdf", b"x" * (10 * 1024 * 1024 + 1), "application/pdf")},
    )
    assert response.status_code == 400
    assert "10 MB" in response.json()["detail"]


@pytest.mark.asyncio
async def test_upload_returns_422_when_document_cannot_be_parsed(client, monkeypatch):
    _user, headers = await register_and_login(client, email="broken-pdf@example.com")

    def fail_extraction(_content):
        raise ValueError("PDF bị hỏng")

    monkeypatch.setattr("src.api.v1.cvs.extract_text_from_pdf", fail_extraction)
    response = await client.post(
        "/api/v1/cvs/upload",
        headers=headers,
        files={"file": ("broken.pdf", b"broken", "application/pdf")},
    )
    assert response.status_code == 422
    assert response.json()["detail"] == "PDF bị hỏng"


@pytest.mark.asyncio
async def test_upload_list_and_detail_cv_success(client, tmp_path, monkeypatch):
    user, headers = await register_and_login(client, email="upload-success@example.com")
    monkeypatch.setattr("src.api.v1.cvs.UPLOAD_DIR", str(tmp_path))
    monkeypatch.setattr(
        "src.api.v1.cvs.extract_text_from_pdf",
        lambda _content: "NGUYEN VAN A\nPython FastAPI",
    )

    async def fake_parse(raw_text, *, use_llm):
        assert "Python" in raw_text
        assert use_llm is False
        return {"personal_info": {"full_name": "NGUYEN VAN A"}, "skills": ["Python", "FastAPI"]}

    monkeypatch.setattr("src.api.v1.cvs.parse_cv_to_structured_json", fake_parse)

    upload = await client.post(
        "/api/v1/cvs/upload",
        headers=headers,
        data={"title": "CV Backend 2026", "use_llm": "false"},
        files={"file": ("resume.pdf", b"valid-pdf", "application/pdf")},
    )
    assert upload.status_code == 201, upload.text
    body = upload.json()
    assert body["user_id"] == user["id"]
    assert body["title"] == "CV Backend 2026"
    assert body["parsed_json"]["skills"] == ["Python", "FastAPI"]
    assert tmp_path.joinpath(body["file_path"].split("\\")[-1].split("/")[-1]).exists()

    listing = await client.get("/api/v1/cvs", headers=headers)
    detail = await client.get(f"/api/v1/cvs/{body['id']}", headers=headers)
    assert listing.status_code == 200
    assert [item["id"] for item in listing.json()] == [body["id"]]
    assert detail.status_code == 200
    assert detail.json()["raw_text"] == "NGUYEN VAN A\nPython FastAPI"


@pytest.mark.asyncio
async def test_users_cannot_read_delete_or_reanalyze_each_others_cv(client, monkeypatch):
    await register_and_login(client, email="cv-owner@example.com")
    _other, other_headers = await register_and_login(client, email="cv-attacker@example.com")
    cv = await insert_cv(email="cv-owner@example.com")

    async def should_not_run(*_args, **_kwargs):
        raise AssertionError("Parser must not run for an unauthorized CV")

    monkeypatch.setattr("src.api.v1.cvs.parse_cv_to_structured_json", should_not_run)

    assert (await client.get(f"/api/v1/cvs/{cv.id}", headers=other_headers)).status_code == 404
    assert (await client.delete(f"/api/v1/cvs/{cv.id}", headers=other_headers)).status_code == 404
    assert (
        await client.post(f"/api/v1/cvs/{cv.id}/analyze", headers=other_headers)
    ).status_code == 404


@pytest.mark.asyncio
async def test_bulk_delete_does_not_delete_foreign_cv(client, tmp_path, monkeypatch):
    await register_and_login(client, email="bulk-owner@example.com")
    _other, other_headers = await register_and_login(client, email="bulk-other@example.com")
    foreign_file = tmp_path / "foreign.pdf"
    foreign_file.write_bytes(b"cv")
    foreign_cv = await insert_cv(email="bulk-owner@example.com", file_path=str(foreign_file))
    monkeypatch.setattr("src.api.v1.cvs.UPLOAD_DIR", str(tmp_path))

    response = await client.post(
        "/api/v1/cvs/bulk-delete",
        headers=other_headers,
        json={"cv_ids": [foreign_cv.id]},
    )
    assert response.status_code == 404
    assert foreign_file.exists()


@pytest.mark.asyncio
async def test_bulk_delete_validates_non_empty_selection(client):
    _user, headers = await register_and_login(client, email="bulk-empty@example.com")
    response = await client.post(
        "/api/v1/cvs/bulk-delete",
        headers=headers,
        json={"cv_ids": []},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_cv_agent_status_never_exposes_api_key(client, monkeypatch):
    _user, headers = await register_and_login(client, email="cv-status@example.com")
    monkeypatch.setattr(
        "src.api.v1.cvs.get_settings",
        lambda: SimpleNamespace(
            google_genai_api_key="super-secret-key",
            model_name="gemini-test",
            cv_parser_mode="gemini",
        ),
    )

    response = await client.get("/api/v1/cvs/agent/status", headers=headers)
    assert response.status_code == 200
    assert response.json()["configured"] is True
    assert response.json()["model"] == "gemini-test"
    assert "super-secret-key" not in response.text
