from sqlalchemy import select

from src.core.security import get_password_hash
from src.db.models import CV, JobDescription, User
from tests.conftest import TestingSessionLocal


async def register_and_login(
    client,
    *,
    email: str,
    password: str = "Password123!",
    full_name: str = "Test User",
    role: str = "student",
) -> tuple[dict, dict[str, str]]:
    register_response = await client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": password,
            "full_name": full_name,
            "role": role,
        },
    )
    assert register_response.status_code == 201, register_response.text

    login_response = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert login_response.status_code == 200, login_response.text
    body = login_response.json()
    return body["user"], {"Authorization": f"Bearer {body['access_token']}"}


async def create_admin(
    client,
    *,
    email: str = "admin@example.com",
    password: str = "Admin123!",
) -> tuple[dict, dict[str, str]]:
    async with TestingSessionLocal() as session:
        admin = User(
            email=email,
            hashed_password=get_password_hash(password),
            full_name="System Administrator",
            role="admin",
        )
        session.add(admin)
        await session.commit()

    login_response = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert login_response.status_code == 200, login_response.text
    body = login_response.json()
    return body["user"], {"Authorization": f"Bearer {body['access_token']}"}


async def create_counselor(
    client,
    *,
    email: str,
    password: str = "Password123!",
    full_name: str = "Test Counselor",
) -> tuple[dict, dict[str, str]]:
    """Counselors cannot self-register publicly anymore — provision like Admin does."""
    async with TestingSessionLocal() as session:
        counselor = User(
            email=email.lower(),
            hashed_password=get_password_hash(password),
            full_name=full_name,
            role="counselor",
        )
        session.add(counselor)
        await session.commit()

    login_response = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert login_response.status_code == 200, login_response.text
    body = login_response.json()
    return body["user"], {"Authorization": f"Bearer {body['access_token']}"}


async def create_enterprise(
    client,
    *,
    email: str,
    password: str = "Password123!",
    full_name: str = "Test Enterprise",
) -> tuple[dict, dict[str, str]]:
    """Enterprise accounts are retired — the recruiting party is now a Counselor."""
    return await create_counselor(client, email=email, password=password, full_name=full_name)


async def insert_cv(
    *,
    email: str,
    title: str = "Backend CV",
    raw_text: str = "Python FastAPI REST API teamwork",
    parsed_json: dict | None = None,
    file_path: str | None = None,
) -> CV:
    async with TestingSessionLocal() as session:
        user = (
            await session.execute(select(User).where(User.email == email.lower()))
        ).scalar_one()
        cv = CV(
            user_id=user.id,
            title=title,
            raw_text=raw_text,
            parsed_json=parsed_json or {"skills": ["Python", "FastAPI"]},
            file_path=file_path,
        )
        session.add(cv)
        await session.commit()
        await session.refresh(cv)
        session.expunge(cv)
        return cv


async def insert_jd(
    *,
    title: str = "Backend Developer",
    requirements_text: str = "Yêu cầu Python, FastAPI, PostgreSQL và Docker.",
    owner_email: str | None = None,
    is_system: bool = False,
) -> JobDescription:
    async with TestingSessionLocal() as session:
        owner_id = None
        if owner_email:
            owner = (
                await session.execute(select(User).where(User.email == owner_email.lower()))
            ).scalar_one()
            owner_id = owner.id
        jd = JobDescription(
            title=title,
            company="Test Company",
            location="Hà Nội",
            requirements_text=requirements_text,
            is_system=is_system,
            created_by_user_id=owner_id,
        )
        session.add(jd)
        await session.commit()
        await session.refresh(jd)
        session.expunge(jd)
        return jd
