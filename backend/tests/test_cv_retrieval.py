from types import SimpleNamespace

from src.services.cv_retrieval import build_cv_retrieval_text


def test_cv_retrieval_text_uses_career_facts_without_pii_or_raw_cv():
    snapshot = SimpleNamespace(
        raw_text="Nguyen Van A | nguyenvana@example.com | 0901234567 | 123 Main Street",
        profile_json={
            "full_name": "Nguyen Van A",
            "email": "nguyenvana@example.com",
            "phone": "0901234567",
            "address": "123 Main Street",
            "gender": "male",
            "photo_url": "https://example.test/photo.png",
            "target_role": "Backend Engineer",
            "skills": ["Python", "FastAPI", "PostgreSQL", "Docker", "Python"],
            "experience": [
                {
                    "role": "Backend Developer",
                    "duration": "2 years",
                    "description": "Built backend APIs with FastAPI",
                }
            ],
            "projects": [
                {
                    "name": "Career Assistant",
                    "technologies": "REST API, authentication, RAG",
                }
            ],
            "domain": "Software Engineering",
        },
    )

    text = build_cv_retrieval_text(snapshot)

    assert "Role:\nBackend Engineer" in text
    assert "Skills:\nPython, FastAPI, PostgreSQL, Docker" in text
    assert "Experience:\nBackend Developer — 2 years — Built backend APIs with FastAPI" in text
    assert "Projects:\nCareer Assistant — REST API, authentication, RAG" in text
    assert "Domain:\nSoftware Engineering" in text
    for pii in ("Nguyen Van A", "example.com", "0901234567", "123 Main", "male", "photo.png"):
        assert pii not in text


def test_cv_retrieval_text_never_falls_back_to_raw_text():
    snapshot = SimpleNamespace(
        raw_text="Senior AI Engineer | secret@example.com | 0909999999",
        profile_json={"skills": ["Python"]},
    )

    assert build_cv_retrieval_text(snapshot) == "Skills:\nPython"
