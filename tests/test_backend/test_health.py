from fastapi.testclient import TestClient

from src.backend.main import app


def test_health_endpoint_reports_backend_ready() -> None:
    response = TestClient(app).get("/health")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["service"] == "backend"
    assert payload["environment"] in {"development", "production", "test"}


def test_openapi_documentation_is_available() -> None:
    client = TestClient(app)

    assert client.get("/docs").status_code == 200
    assert client.get("/openapi.json").status_code == 200
