from __future__ import annotations

from src.db.models import CV, CVVariant, CVVariantClaim, CVVariantRevision, JobDescription
from tests.conftest import TestingSessionLocal
from tests.helpers import register_and_login


async def _seed_cv_jd(client, email: str = "variant-owner@example.com"):
    user, headers = await register_and_login(client, email=email)
    cv_response = await client.post(
        "/api/v1/cvs/manual",
        headers=headers,
        json={
            "title": "Backend CV source",
            "template_name": "classic",
            "personal_info": {"full_name": "Evidence Owner", "email": email},
            "summary": "Backend developer using Python",
            "skills": ["Python", "REST API"],
            "experience": [{"role": "Intern", "description": "Built REST API using Python for internal tools"}],
            "projects": [{"description": "Created a Python task manager"}],
            "education": [{"description": "Computer Science student"}],
        },
    )
    assert cv_response.status_code == 201, cv_response.text
    async with TestingSessionLocal() as session:
        jd = JobDescription(
            title="Backend Developer",
            requirements_text="Required Python and REST API. Docker is preferred.",
            normalized_json={"language": "en"},
            is_system=True,
            is_published=True,
        )
        session.add(jd)
        await session.commit()
        await session.refresh(jd)
        jd_id = jd.id
    return user, headers, cv_response.json()["id"], jd_id


async def test_mode_a_variant_is_versioned_validated_published_and_source_immutable(client):
    user, headers, cv_id, jd_id = await _seed_cv_jd(client)
    payload = {
        "mode": "HAS_CV",
        "cv_id": cv_id,
        "jd_id": jd_id,
        "template_name": "classic",
        "title": "Backend CV tailored",
    }
    created = await client.post(
        "/api/v2/cv-variants",
        headers={**headers, "Idempotency-Key": "mode-a-create-1"},
        json=payload,
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["status"] == "DRAFT"
    assert body["source_cv_snapshot_id"]
    assert body["target_jd_snapshot_id"]
    assert body["revision_no"] == 1
    assert body["retention_until"]
    assert body["ai_metadata"]["prompt_version"] == "cv-variant-optimize-v1"

    repeated = await client.post(
        "/api/v2/cv-variants",
        headers={**headers, "Idempotency-Key": "mode-a-create-1"},
        json=payload,
    )
    assert repeated.status_code == 201
    assert repeated.json()["id"] == body["id"]

    suggestions = body["content"].get("_suggestions") or []
    if suggestions:
        decided = await client.put(
            f"/api/v2/cv-variants/{body['id']}/suggestions/{suggestions[0]['id']}",
            headers=headers,
            json={"decision": "accept"},
        )
        assert decided.status_code == 200, decided.text
        assert decided.json()["revision_no"] == 2

    validated = await client.post(f"/api/v2/cv-variants/{body['id']}/validate", headers=headers)
    assert validated.status_code == 200, validated.text
    validation = validated.json()
    assert validation["passed"] is True, validation
    assert [item["name"] for item in validation["validators"]] == [
        "schema",
        "atomic_claim",
        "entailment",
        "numeric_date",
        "jd_leakage",
        "protected_content",
        "render_layout",
    ]
    assert validation["claims_supported"] == validation["claims_total"]
    assert 1 <= validation["render"]["pages"] <= 2

    published = await client.post(f"/api/v2/cv-variants/{body['id']}/publish", headers=headers)
    assert published.status_code == 200, published.text
    assert len(published.json()["checksum"]) == 64
    exported = await client.get(f"/api/v2/cv-variants/{body['id']}/export", headers=headers)
    assert exported.status_code == 200
    assert exported.content.startswith(b"%PDF")
    assert exported.headers["x-content-sha256"] == published.json()["checksum"]
    history = await client.get(f"/api/v2/cv-variants?cv_id={cv_id}", headers=headers)
    assert history.status_code == 200
    assert history.json()["total"] == 1
    assert history.json()["items"][0]["id"] == body["id"]

    async with TestingSessionLocal() as session:
        source = await session.get(CV, cv_id)
        assert source is not None
        assert source.parsed_json["experience"][0]["description"] == "Built REST API using Python for internal tools"
        variant = await session.get(CVVariant, body["id"])
        assert variant.status == "PUBLISHED"
        assert await session.scalar(
            __import__("sqlalchemy").select(__import__("sqlalchemy").func.count(CVVariantClaim.id)).where(
                CVVariantClaim.variant_id == body["id"]
            )
        ) > 0
        assert await session.scalar(
            __import__("sqlalchemy").select(__import__("sqlalchemy").func.count(CVVariantRevision.id)).where(
                CVVariantRevision.variant_id == body["id"]
            )
        ) >= 1

    other_user, other_headers = await register_and_login(client, email="variant-other@example.com")
    assert other_user["id"] != user["id"]
    forbidden = await client.get(f"/api/v2/cv-variants/{body['id']}", headers=other_headers)
    assert forbidden.status_code == 404
    assert forbidden.json()["code"] == "CV_VARIANT_NOT_FOUND"


async def test_mode_b_confirmation_autosave_publish_block_and_recovery(client):
    _user, headers, _cv_id, jd_id = await _seed_cv_jd(client, "variant-mode-b@example.com")
    content = {
        "personal_info": {"full_name": "New Candidate", "email": "variant-mode-b@example.com"},
        "summary": "Backend learner using Python",
        "skills": ["Python"],
        "experience": [],
        "projects": [{"description": "Created a Python learning project"}],
        "education": [{"description": "Computer Science student"}],
        "certifications": [],
    }
    created = await client.post(
        "/api/v2/cv-variants",
        headers={**headers, "Idempotency-Key": "mode-b-create-1"},
        json={
            "mode": "NO_CV",
            "jd_id": jd_id,
            "template_name": "modern",
            "title": "First guided CV",
            "content": content,
            "candidate_evidence_confirmed": True,
        },
    )
    assert created.status_code == 201, created.text
    variant = created.json()
    assert variant["source_cv_snapshot_id"]

    edited_content = dict(variant["content"])
    edited_content["summary"] = "Backend learner using Python with AWS Cloud Practitioner"
    autosaved = await client.patch(
        f"/api/v2/cv-variants/{variant['id']}",
        headers=headers,
        json={"content": edited_content, "change_summary": "Thêm fact cần xác nhận"},
    )
    assert autosaved.status_code == 200
    blocked = await client.post(f"/api/v2/cv-variants/{variant['id']}/validate", headers=headers)
    assert blocked.status_code == 200
    assert blocked.json()["passed"] is False
    assert any(item["errors"] for item in blocked.json()["validators"] if not item["passed"])
    invalid_preview = await client.get(f"/api/v2/cv-variants/{variant['id']}/export?preview=true", headers=headers)
    assert invalid_preview.status_code == 200
    assert invalid_preview.content.startswith(b"%PDF")
    publish_blocked = await client.post(f"/api/v2/cv-variants/{variant['id']}/publish", headers=headers)
    assert publish_blocked.status_code == 422
    assert publish_blocked.json()["code"] == "CV_VARIANT_PUBLISH_BLOCKED"

    recovered = await client.patch(
        f"/api/v2/cv-variants/{variant['id']}",
        headers=headers,
        json={
            "content": edited_content,
            "confirmed_claims": [edited_content["summary"]],
            "change_summary": "Người dùng xác nhận fact mới",
        },
    )
    assert recovered.status_code == 200
    validated = await client.post(f"/api/v2/cv-variants/{variant['id']}/validate", headers=headers)
    assert validated.status_code == 200
    assert validated.json()["passed"] is True, validated.text
    preview = await client.get(f"/api/v2/cv-variants/{variant['id']}/export?preview=true", headers=headers)
    assert preview.status_code == 200
    assert preview.content.startswith(b"%PDF")
    published = await client.post(f"/api/v2/cv-variants/{variant['id']}/publish", headers=headers)
    assert published.status_code == 200, published.text
    exported = await client.get(f"/api/v2/cv-variants/{variant['id']}/export", headers=headers)
    assert exported.status_code == 200
    assert exported.content.startswith(b"%PDF")

    immutable = await client.patch(
        f"/api/v2/cv-variants/{variant['id']}",
        headers=headers,
        json={"content": edited_content},
    )
    assert immutable.status_code == 409

    deleted = await client.delete(f"/api/v2/cv-variants/{variant['id']}", headers=headers)
    assert deleted.status_code == 204
    missing = await client.get(f"/api/v2/cv-variants/{variant['id']}", headers=headers)
    assert missing.status_code == 404
