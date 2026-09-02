import pytest

from tests.helpers import create_counselor, insert_jd, register_and_login


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
    assert response.json()["error"]["code"] == "UPLOAD_002"


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


@pytest.mark.asyncio
async def test_jd_upload_image_and_extract_metadata(client, monkeypatch):
    async def fake_extract(content_bytes: bytes, filename: str, content_type: str = "") -> str:
        return (
            "Tuyển dụng Senior AI Engineer\n"
            "Phòng ban: AI & Data Research\n"
            "Mô tả công việc:\n"
            "- Nghiên cứu và huấn luyện mô hình LLM, Speech-to-Text\n"
            "- Xây dựng pipeline xử lý dữ liệu và đánh giá CV JD\n"
            "Yêu cầu công việc:\n"
            "- Thành thạo Python, PyTorch, FastAPI và Docker\n"
            "- Tối thiểu 3 năm kinh nghiệm trong lĩnh vực AI\n"
            "Quyền lợi:\n"
            "- Mức lương: 25.000.000 - 45.000.000 VND\n"
            "- Thưởng tháng 13 và bảo hiểm sức khỏe Bảo Việt"
        )

    monkeypatch.setattr("src.api.v1.jds.extract_text_from_document", fake_extract)

    valid_png = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
    _user, headers = await register_and_login(client, email="jd-image-uploader@example.com")
    response = await client.post(
        "/api/v1/jds/upload",
        headers=headers,
        files={"file": ("job_posting_photo.png", valid_png, "image/png")},
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert "AI Engineer" in body["title"]
    normalized = body["normalized_json"]
    assert normalized["department"] == "AI & Data Research"
    assert normalized["level"] == "Senior"
    assert "Python" in normalized["tags"]
    assert len(normalized["sections"]) == 5
    assert normalized["sections"][0]["type"] == "overview"
    assert normalized["sections"][1]["type"] == "responsibilities"
    assert normalized["sections"][2]["type"] == "must_have"
    assert normalized["sections"][4]["type"] == "benefits"
    assert normalized["salary_visibility"] == "Công khai"


@pytest.mark.asyncio
async def test_counselor_can_upload_list_and_publish_own_jd(client):
    _counselor, headers = await create_counselor(client, email="counselor-jd@example.com")
    response = await client.post(
        "/api/v1/jds/upload",
        headers=headers,
        files={
            "file": (
                "backend-engineer.txt",
                "Tuyển Backend Engineer. Yêu cầu Python, FastAPI, PostgreSQL, Docker và Git.",
                "text/plain",
            )
        },
    )
    assert response.status_code == 201, response.text
    uploaded = response.json()
    jd_id = uploaded["id"]
    assert uploaded["normalized_json"]["creator_role"] == "counselor"
    assert uploaded["normalized_json"]["creation_source"] == "counselor_upload"

    mine = await client.get("/api/v1/jds/mine", headers=headers)
    assert mine.status_code == 200, mine.text
    assert jd_id in {item["id"] for item in mine.json()}

    published = await client.patch(f"/api/v1/jds/{jd_id}/publish", headers=headers)
    assert published.status_code == 200, published.text
    assert published.json()["is_published"] is True


@pytest.mark.asyncio
async def test_counselor_jd_publish_e2e_student_visibility(client):
    """E2E flow: Counselor creates JD -> updates draft -> publishes -> Student sees in /jobs and /jds."""
    _counselor, counselor_headers = await create_counselor(client, email="counselor-flow@example.com")
    _student, student_headers = await register_and_login(client, email="student-flow@example.com")

    # 1. Counselor fetches partner organizations
    partners_res = await client.get("/api/v1/counselor/partners", headers=counselor_headers)
    assert partners_res.status_code == 200
    partners = partners_res.json()
    assert len(partners) >= 1
    partner = partners[0]

    # 2. Counselor creates a custom JD draft with partner ownership
    create_res = await client.post(
        "/api/v1/jds/custom",
        headers=counselor_headers,
        json={
            "title": "Senior AI Platform Engineer",
            "company": partner["name"],
            "location": "TP. Hồ Chí Minh",
            "requirements_text": "Yêu cầu: Python, PyTorch, LangChain, FastAPI, Docker và hệ thống phân tán.",
            "metadata": {
                "company_id": partner["id"],
                "company_name": partner["name"],
                "creator_role": "counselor",
                "department": "AI Innovation Hub",
                "level": "Senior",
                "employment_type": "Full-time",
                "work_model": "Hybrid",
                "tags": ["Python", "PyTorch", "LangChain", "FastAPI", "Docker"],
                "salary_min": "35.000.000",
                "salary_max": "55.000.000",
                "salary_currency": "VND",
                "salary_visibility": "Công khai",
                "deadline": "2026-11-30",
            },
        },
    )
    assert create_res.status_code == 201, create_res.text
    created_jd = create_res.json()
    jd_id = created_jd["id"]
    assert created_jd["is_published"] is False
    assert created_jd["company"] == partner["name"]
    assert created_jd["normalized_json"]["creator_role"] == "counselor"
    assert created_jd["normalized_json"]["company_id"] == partner["id"]

    # 3. Verify Student CANNOT see unpublished draft in /jobs, /jds or /jds/{id}
    jobs_res = await client.get("/api/v1/jobs", headers=student_headers)
    assert jobs_res.status_code == 200
    student_job_ids = {j["source_id"] for j in jobs_res.json()["jobs"]}
    assert jd_id not in student_job_ids

    jds_res = await client.get("/api/v1/jds", headers=student_headers)
    assert jds_res.status_code == 200
    student_jd_ids = {j["id"] for j in jds_res.json()}
    assert jd_id not in student_jd_ids

    detail_res = await client.get(f"/api/v1/jds/{jd_id}", headers=student_headers)
    assert detail_res.status_code == 404

    # 4. Counselor updates the draft with additional requirements
    update_res = await client.put(
        f"/api/v1/jds/{jd_id}",
        headers=counselor_headers,
        json={
            "title": "Lead AI Platform Engineer",
            "company": partner["name"],
            "location": "TP. Hồ Chí Minh",
            "requirements_text": "Yêu cầu: Python, PyTorch, LangChain, FastAPI, Docker, Kubernetes và MLOps.",
            "metadata": {
                "company_id": partner["id"],
                "company_name": partner["name"],
                "creator_role": "counselor",
                "department": "AI Innovation Hub",
                "level": "Lead",
                "employment_type": "Full-time",
                "work_model": "Hybrid",
                "tags": ["Python", "PyTorch", "LangChain", "FastAPI", "Docker", "Kubernetes", "MLOps"],
                "salary_min": "45.000.000",
                "salary_max": "70.000.000",
                "salary_currency": "VND",
                "salary_visibility": "Công khai",
                "deadline": "2026-12-31",
            },
        },
    )
    assert update_res.status_code == 200, update_res.text
    assert update_res.json()["title"] == "Lead AI Platform Engineer"

    # 5. Counselor publishes the JD
    publish_res = await client.patch(f"/api/v1/jds/{jd_id}/publish", headers=counselor_headers)
    assert publish_res.status_code == 200, publish_res.text
    assert publish_res.json()["is_published"] is True

    # 6. Student queries /jobs -> MUST find the published Counselor JD!
    student_jobs = await client.get("/api/v1/jobs", headers=student_headers)
    assert student_jobs.status_code == 200
    all_jobs = student_jobs.json()["jobs"]
    matched_job = next((j for j in all_jobs if j["source_id"] == jd_id), None)
    assert matched_job is not None, f"Counselor published JD {jd_id} not found in student /jobs search"
    assert matched_job["title"] == "Lead AI Platform Engineer"
    assert matched_job["company"] == partner["name"]
    assert "Python" in matched_job["skills"] or "Python" in matched_job.get("required_skills", [])
    assert matched_job["salary"] == "45.000.000 - 70.000.000 VND"

    # 7. Student queries /jds -> MUST include the published Counselor JD!
    student_jds = await client.get("/api/v1/jds", headers=student_headers)
    assert student_jds.status_code == 200
    all_jds = student_jds.json()
    matched_in_jds = next((j for j in all_jds if j["id"] == jd_id), None)
    assert matched_in_jds is not None, f"Counselor published JD {jd_id} not found in student /jds list"
    assert matched_in_jds["is_published"] is True

    # 8. Student queries /jds/{jd_id} -> MUST return 200 with full details!
    student_jd_detail = await client.get(f"/api/v1/jds/{jd_id}", headers=student_headers)
    assert student_jd_detail.status_code == 200
    detail_body = student_jd_detail.json()
    assert detail_body["title"] == "Lead AI Platform Engineer"
    assert detail_body["company"] == partner["name"]
    assert detail_body["normalized_json"]["creator_role"] == "counselor"

