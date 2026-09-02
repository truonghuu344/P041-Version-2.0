import pytest

VALID_CV = """cv:
  name: Nguyen Van A
  email: nguyenvana@example.com
  sections:
    summary:
      - Backend engineer
"""


@pytest.mark.asyncio
async def test_rendercv_validate_and_themes(client) -> None:
    validation = await client.post(
        "/api/v1/rendercv/validate", json={"cv_yaml": VALID_CV}
    )
    assert validation.status_code == 200
    assert validation.json() == {"valid": True}

    themes = await client.get("/api/v1/rendercv/themes")
    assert themes.status_code == 200
    assert any(theme["name"] == "classic" for theme in themes.json())


@pytest.mark.asyncio
async def test_rendercv_validation_returns_structured_errors(client) -> None:
    response = await client.post(
        "/api/v1/rendercv/validate", json={"cv_yaml": "cv:\n  sections: ["}
    )
    assert response.status_code == 422
    assert response.json()["detail"]["errors"]


@pytest.mark.asyncio
async def test_rendercv_render_returns_pdf(client) -> None:
    response = await client.post(
        "/api/v1/rendercv/render", json={"cv_yaml": VALID_CV}
    )
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.content.startswith(b"%PDF")
