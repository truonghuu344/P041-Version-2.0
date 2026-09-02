import logging

import pytest
from httpx import AsyncClient

from src.core.logging_config import mask_sensitive_data
from src.core.security import create_access_token


def test_sensitive_data_masking():
    # 1. Test dictionary masking
    sensitive_dict = {
        "email": "student@example.com",
        "password": "SuperSecretPassword123!",
        "access_token": "eyJh...jwt...",
        "api_key": "AIzaSySecretKey",
        "nested": {
            "secret": "very-secret",
            "normal_field": "public_value",
        },
    }
    masked = mask_sensitive_data(sensitive_dict)
    assert masked["email"] == "student@example.com"
    assert masked["password"] == "******"
    assert masked["access_token"] == "******"
    assert masked["api_key"] == "******"
    assert masked["nested"]["secret"] == "******"
    assert masked["nested"]["normal_field"] == "public_value"

    # 2. Test string bearer & db url masking
    raw_str = "Authorization: Bearer my-secret-jwt-token-12345"
    assert "my-secret-jwt-token-12345" not in mask_sensitive_data(raw_str)

    db_str = "postgresql+asyncpg://admin_user:my_secret_pass@localhost:5432/my_db"
    masked_db = mask_sensitive_data(db_str)
    assert "my_secret_pass" not in masked_db
    assert "admin_user:******@localhost:5432/my_db" in masked_db


@pytest.mark.asyncio
async def test_request_logging_middleware_and_status(client: AsyncClient, caplog):
    # Test request logging on public endpoint
    with caplog.at_level(logging.INFO):
        res = await client.get("/health")
        assert res.status_code == 200

    # Test request logging on authenticated endpoint
    token = create_access_token(data={"sub": "user-123", "email": "test@univ.edu.vn", "role": "counselor"})
    with caplog.at_level(logging.INFO):
        res = await client.get("/api/v1/counselor/profile", headers={"Authorization": f"Bearer {token}"})
        # Check logs contain method, status, and duration format
        log_records = [rec.message for rec in caplog.records if "api.request" in rec.name]
        assert any("GET | /api/v1/counselor/profile" in msg for msg in log_records)
