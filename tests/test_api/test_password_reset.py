from src.api.v1 import auth as auth_api


async def test_password_reset_uses_one_time_otp_and_updates_password(client, monkeypatch):
    await client.post(
        "/api/v1/auth/register",
        json={
            "email": "reset@example.com",
            "password": "OldPassword123!",
            "full_name": "Reset User",
        },
    )

    sent: dict[str, str] = {}

    async def fake_send_password_reset_otp(*, recipient: str, otp: str) -> None:
        sent["recipient"] = recipient
        sent["otp"] = otp

    monkeypatch.setattr(auth_api.settings, "smtp_username", "sender@example.com")
    monkeypatch.setattr(auth_api.settings, "smtp_password", "app-password")
    monkeypatch.setattr(auth_api, "send_password_reset_otp", fake_send_password_reset_otp)

    request = await client.post("/api/v1/auth/password-reset/request", json={"email": "RESET@example.com"})
    assert request.status_code == 200
    assert sent["recipient"] == "reset@example.com"
    assert len(sent["otp"]) == 6

    confirm = await client.post(
        "/api/v1/auth/password-reset/confirm",
        json={"email": "reset@example.com", "otp": sent["otp"], "new_password": "NewPassword123!"},
    )
    assert confirm.status_code == 200

    old_login = await client.post("/api/v1/auth/login", json={"email": "reset@example.com", "password": "OldPassword123!"})
    assert old_login.status_code == 401
    new_login = await client.post("/api/v1/auth/login", json={"email": "reset@example.com", "password": "NewPassword123!"})
    assert new_login.status_code == 200

    reuse = await client.post(
        "/api/v1/auth/password-reset/confirm",
        json={"email": "reset@example.com", "otp": sent["otp"], "new_password": "AnotherPassword123!"},
    )
    assert reuse.status_code == 400
