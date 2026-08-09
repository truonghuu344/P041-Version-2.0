from pathlib import Path

from pydantic import SecretStr

from src.backend.config import Settings


def test_settings_have_safe_development_defaults() -> None:
    settings = Settings(_env_file=None)

    assert settings.app_name == "Career Assistant Backend"
    assert settings.app_env == "development"
    assert settings.app_port == 8000
    assert settings.cors_origin_list == [
        "http://localhost:3000",
        "http://localhost:8080",
    ]
    assert settings.chroma_persist_dir == Path("data/chroma")
    assert isinstance(settings.secret_key, SecretStr)
    assert "development-only-change-me" not in repr(settings.secret_key)


def test_settings_load_backend_environment_file(tmp_path: Path) -> None:
    env_file = tmp_path / ".env"
    env_file.write_text(
        "\n".join(
            [
                "APP_ENV=test",
                "APP_PORT=8123",
                "SECRET_KEY=test-secret-value",
                "CORS_ORIGINS=https://app.example.com, https://admin.example.com",
                "GOOGLE_OAUTH_CLIENT_ID=test-client.apps.googleusercontent.com",
                "GEMINI_API_KEY=test-gemini-key",
                "CHROMA_PERSIST_DIR=./tmp/chroma",
            ]
        ),
        encoding="utf-8",
    )

    settings = Settings(_env_file=env_file)

    assert settings.app_env == "test"
    assert settings.app_port == 8123
    assert settings.secret_key.get_secret_value() == "test-secret-value"
    assert settings.cors_origin_list == [
        "https://app.example.com",
        "https://admin.example.com",
    ]
    assert settings.google_oauth_client_id == "test-client.apps.googleusercontent.com"
    assert settings.gemini_api_key.get_secret_value() == "test-gemini-key"
    assert settings.chroma_persist_dir == Path("tmp/chroma")


def test_settings_normalize_postgresql_url_for_async_sqlalchemy() -> None:
    settings = Settings(
        _env_file=None,
        database_url="postgresql://user:password@localhost:5432/app",
    )

    assert settings.database_url == (
        "postgresql+asyncpg://user:password@localhost:5432/app"
    )
