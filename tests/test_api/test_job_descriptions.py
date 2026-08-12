import pytest

from tests.helpers import insert_jd, register_and_login


@pytest.mark.asyncio
async def test_student_can_select_enterprise_jd_from_data_catalog(client):
    _user, headers = await register_and_login(client, email="catalog-jd@example.com")
    catalog = await client.get("/api/v1/jobs?limit=1", headers=headers)
    assert catalog.status_code == 200
    source_job = catalog.json()["jobs"][0]

    selected = await client.post(
        f"/api/v1/jds/catalog/{source_job['source_id']}/select",
        headers=headers,
    )
    assert selected.status_code == 200, selected.text
    body = selected.json()
    assert body["title"] == source_job["title"]
    assert body["company"] == source_job["company"]
    assert body["normalized_json"]["source"] == "data/jds"
    assert body["normalized_json"]["source_id"] == source_job["source_id"]

    selected_again = await client.post(
        f"/api/v1/jds/catalog/{source_job['source_id']}/select",
        headers=headers,
    )
    assert selected_again.status_code == 200
    assert selected_again.json()["id"] == body["id"]


@pytest.mark.asyncio
async def test_jd_list_seeds_system_records_and_includes_users_custom_jd(client):
    _user, headers = await register_and_login(client, email="jd-owner@example.com")
    custom = await client.post(
        "/api/v1/jds/custom",
        headers=headers,
        json={
            "title": "Platform Engineer",
            "company": "Example Co",
            "location": "Đà Nẵng",
            "requirements_text": "Yêu cầu Python, Docker, Kubernetes và kỹ năng giao tiếp.",
        },
    )
    assert custom.status_code == 201

    response = await client.get("/api/v1/jds", headers=headers)
    assert response.status_code == 200
    records = response.json()
    assert sum(item["is_system"] for item in records) >= 2
    assert custom.json()["id"] in {item["id"] for item in records}


@pytest.mark.asyncio
async def test_custom_jd_uses_safe_defaults(client):
    _user, headers = await register_and_login(client, email="jd-defaults@example.com")
    response = await client.post(
        "/api/v1/jds/custom",
        headers=headers,
        json={
            "title": "Data Engineer",
            "requirements_text": "Yêu cầu Python, SQL và kinh nghiệm xây dựng data pipeline.",
        },
    )
    assert response.status_code == 201
    assert response.json()["company"] == "Cá nhân / Công ty ngoài"
    assert response.json()["location"] == "Chưa xác định"
    assert response.json()["is_system"] is False


@pytest.mark.asyncio
async def test_custom_jd_validation_rejects_short_content(client):
    _user, headers = await register_and_login(client, email="jd-invalid@example.com")
    response = await client.post(
        "/api/v1/jds/custom",
        headers=headers,
        json={"title": "X", "requirements_text": "short"},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_jd_upload_rejects_unsupported_file(client):
    _user, headers = await register_and_login(client, email="jd-upload-invalid@example.com")
    response = await client.post(
        "/api/v1/jds/upload",
        headers=headers,
        files={"file": ("job.exe", b"not a job description", "application/octet-stream")},
    )
    assert response.status_code == 400
    assert "PDF, DOCX hoặc TXT" in response.json()["detail"]


@pytest.mark.asyncio
async def test_user_cannot_list_or_read_another_users_private_jd(client):
    await register_and_login(client, email="private-jd-owner@example.com")
    _other, other_headers = await register_and_login(client, email="private-jd-other@example.com")
    private_jd = await insert_jd(owner_email="private-jd-owner@example.com")

    listing = await client.get("/api/v1/jds", headers=other_headers)
    assert private_jd.id not in {item["id"] for item in listing.json()}

    detail = await client.get(f"/api/v1/jds/{private_jd.id}", headers=other_headers)
    assert detail.status_code == 404


@pytest.mark.asyncio
async def test_every_user_can_read_system_jd(client):
    _user, headers = await register_and_login(client, email="system-jd-reader@example.com")
    system_jd = await insert_jd(is_system=True)

    response = await client.get(f"/api/v1/jds/{system_jd.id}", headers=headers)
    assert response.status_code == 200
    assert response.json()["is_system"] is True
