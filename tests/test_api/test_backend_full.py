import pytest


@pytest.mark.asyncio
async def test_health_check(client):
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_auth_and_jds_flow(client):
    # 1. Register Student
    register_res = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "student1@vinuni.edu.vn",
            "password": "Password123!",
            "full_name": "Nguyễn Văn A",
            "role": "student",
        },
    )
    assert register_res.status_code == 201
    user_data = register_res.json()
    assert user_data["email"] == "student1@vinuni.edu.vn"

    # 2. Login
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"email": "student1@vinuni.edu.vn", "password": "Password123!"},
    )
    assert login_res.status_code == 200
    token_data = login_res.json()
    token = token_data["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 3. Get /auth/me
    me_res = await client.get("/api/v1/auth/me", headers=headers)
    assert me_res.status_code == 200
    assert me_res.json()["full_name"] == "Nguyễn Văn A"

    # 4. List System JDs
    jds_res = await client.get("/api/v1/jds", headers=headers)
    assert jds_res.status_code == 200
    jds = jds_res.json()
    assert len(jds) >= 1

    # 5. Create Custom JD
    custom_jd_res = await client.post(
        "/api/v1/jds/custom",
        json={
            "title": "Backend AI Developer",
            "company": "VinUni AI Lab",
            "location": "Hà Nội",
            "requirements_text": "Yêu cầu kiến thức về Python, FastAPI, PostgreSQL, LangGraph và Docker.",
        },
        headers=headers,
    )
    assert custom_jd_res.status_code == 201
    assert custom_jd_res.json()["title"] == "Backend AI Developer"
