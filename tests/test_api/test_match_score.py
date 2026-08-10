"""
T1-007 → T1-012: Tests cho Match Score & Gap Analysis endpoint
API Contract: POST /api/v1/cv/analyze

Expected request:
{
  "cv_id": "uuid",
  "jd_text": "..."   # JD từ user paste hoặc từ thư viện
}

Expected response:
{
  "match_score": 72.5,             # %
  "gap_analysis": {
    "matched_skills": ["Python", "FastAPI"],
    "missing_hard_skills": ["Kubernetes", "AWS"],
    "missing_soft_skills": ["leadership"],
    "missing_keywords": ["microservices", "CI/CD"],
    "matching_details": {...}
  },
  "suggestions": [
    {
      "suggestion_id": "uuid",
      "type": "rephrase",
      "original": "...",
      "suggested": "...",
      "source_field": "experience[0].description"
    }
  ]
}
"""

import uuid
from unittest.mock import AsyncMock, patch

import pytest


# ─── Fixtures & Mocks ─────────────────────────────────────────────────────────

SAMPLE_CV_ID = str(uuid.uuid4())

SAMPLE_JD_INTERN = """
Junior Backend Developer - Intern

Yêu cầu:
- Biết Python, FastAPI hoặc Django
- Hiểu về REST API và HTTP
- Có kinh nghiệm làm việc với Git
- Cộng: biết Docker, AWS cơ bản

Mô tả:
- Phát triển API service cho hệ thống e-commerce
- Viết unit test với pytest
- Tham gia code review
"""

SAMPLE_JD_SENIOR = """
Senior Data Engineer

Yêu cầu:
- 3+ năm kinh nghiệm với Spark, Hadoop
- Thành thạo Python và Scala
- Kinh nghiệm với Kubernetes, Docker
- Biết thiết kế Data Pipeline (Airflow, Prefect)
- Leadership, mentoring junior
"""

MOCK_ANALYZE_RESULT_GOOD_MATCH = {
    "match_score": 78.5,
    "gap_analysis": {
        "matched_skills": ["Python", "FastAPI", "Git", "REST API"],
        "missing_hard_skills": ["Docker", "AWS"],
        "missing_soft_skills": [],
        "missing_keywords": ["microservices", "unit testing"],
        "matching_details": {
            "hard_skills_match": 0.80,
            "soft_skills_match": 0.90,
            "keyword_match": 0.65,
        },
    },
    "suggestions": [
        {
            "suggestion_id": str(uuid.uuid4()),
            "type": "rephrase",
            "original": "Phát triển REST API với FastAPI",
            "suggested": "Phát triển và tối ưu hóa REST API với FastAPI, tích hợp với hệ thống e-commerce",
            "source_field": "experience[0].description",
        }
    ],
}

MOCK_ANALYZE_RESULT_LOW_MATCH = {
    "match_score": 15.0,
    "gap_analysis": {
        "matched_skills": ["Python"],
        "missing_hard_skills": ["Spark", "Hadoop", "Scala", "Kubernetes", "Airflow"],
        "missing_soft_skills": ["leadership", "mentoring"],
        "missing_keywords": ["data pipeline", "data engineering", "ETL"],
        "matching_details": {
            "hard_skills_match": 0.10,
            "soft_skills_match": 0.05,
            "keyword_match": 0.08,
        },
    },
    "suggestions": [],
}


# ─── T1-007: Match Score hợp lệ → nằm trong [0, 100] ────────────────────────

@pytest.mark.asyncio
async def test_match_score_valid_range(client):
    """T1-007: CV + JD hợp lệ → match_score phải trong khoảng [0, 100]."""
    with patch(
        "src.agents.graph.agent.ainvoke",
        new_callable=AsyncMock,
        return_value=MOCK_ANALYZE_RESULT_GOOD_MATCH,
    ):
        response = await client.post(
            "/api/v1/cv/analyze",
            json={"cv_id": SAMPLE_CV_ID, "jd_text": SAMPLE_JD_INTERN},
        )

    assert response.status_code == 200
    data = response.json()
    assert "match_score" in data, "Response phải có match_score"
    score = data["match_score"]
    assert 0 <= score <= 100, f"match_score={score} nằm ngoài [0, 100]"


# ─── T1-008: Gap Analysis trả về đủ 4 nhóm ───────────────────────────────────

@pytest.mark.asyncio
async def test_gap_analysis_structure(client):
    """T1-008: Gap Analysis phải có đủ matched_skills, missing_hard_skills,
    missing_soft_skills, missing_keywords (AC F-03).
    """
    with patch(
        "src.agents.graph.agent.ainvoke",
        new_callable=AsyncMock,
        return_value=MOCK_ANALYZE_RESULT_GOOD_MATCH,
    ):
        response = await client.post(
            "/api/v1/cv/analyze",
            json={"cv_id": SAMPLE_CV_ID, "jd_text": SAMPLE_JD_INTERN},
        )

    assert response.status_code == 200
    data = response.json()

    gap = data.get("gap_analysis", {})
    assert "matched_skills" in gap, "Thiếu matched_skills"
    assert "missing_hard_skills" in gap, "Thiếu missing_hard_skills"
    assert "missing_soft_skills" in gap, "Thiếu missing_soft_skills"
    assert "missing_keywords" in gap, "Thiếu missing_keywords"
    assert isinstance(gap["matched_skills"], list), "matched_skills phải là list"


# ─── T1-009: Suggestions có suggestion_id và source_field ────────────────────

@pytest.mark.asyncio
async def test_suggestions_have_required_fields(client):
    """T1-009: Mỗi suggestion phải có suggestion_id, type, original, suggested, source_field.

    Cần suggestion_id để User có thể Accept/Reject từng gợi ý (AC F-04).
    """
    with patch(
        "src.agents.graph.agent.ainvoke",
        new_callable=AsyncMock,
        return_value=MOCK_ANALYZE_RESULT_GOOD_MATCH,
    ):
        response = await client.post(
            "/api/v1/cv/analyze",
            json={"cv_id": SAMPLE_CV_ID, "jd_text": SAMPLE_JD_INTERN},
        )

    data = response.json()
    suggestions = data.get("suggestions", [])
    assert len(suggestions) > 0, "Nên có ít nhất 1 suggestion cho CV match tốt"

    for s in suggestions:
        assert "suggestion_id" in s, "Thiếu suggestion_id (cần để Accept/Reject)"
        assert "original" in s, "Thiếu original text"
        assert "suggested" in s, "Thiếu suggested text"
        assert "source_field" in s, "Thiếu source_field (để biết chỉnh ở đâu)"


# ─── T1-010: CV rỗng / không tìm thấy cv_id → 404 ───────────────────────────

@pytest.mark.asyncio
async def test_analyze_with_unknown_cv_id(client):
    """T1-010: cv_id không tồn tại trong DB → 404 Not Found."""
    response = await client.post(
        "/api/v1/cv/analyze",
        json={"cv_id": str(uuid.uuid4()), "jd_text": SAMPLE_JD_INTERN},
    )
    assert response.status_code == 404, (
        f"cv_id không tồn tại phải trả 404, nhưng trả {response.status_code}"
    )


# ─── T1-011: JD rỗng → 422 ───────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_analyze_with_empty_jd(client):
    """T1-011: jd_text rỗng → 422 Validation Error."""
    response = await client.post(
        "/api/v1/cv/analyze",
        json={"cv_id": SAMPLE_CV_ID, "jd_text": ""},
    )
    assert response.status_code == 422


# ─── T1-012: Match Score thấp → suggestions có thể rỗng ─────────────────────

@pytest.mark.asyncio
async def test_low_match_score_few_suggestions(client):
    """T1-012: CV không phù hợp JD (score rất thấp) → trả match_score thấp,
    suggestions có thể rỗng (không bịa thêm gợi ý không có cơ sở).
    """
    with patch(
        "src.agents.graph.agent.ainvoke",
        new_callable=AsyncMock,
        return_value=MOCK_ANALYZE_RESULT_LOW_MATCH,
    ):
        response = await client.post(
            "/api/v1/cv/analyze",
            json={"cv_id": SAMPLE_CV_ID, "jd_text": SAMPLE_JD_SENIOR},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["match_score"] < 50, "Match score CV intern vs JD Senior phải thấp"
    # Không nên có suggestions bịa đặt khi khoảng cách quá lớn
    # (suggestions rỗng hoặc chỉ suggest học thêm, không ghi vào CV)
    assert isinstance(data.get("suggestions", []), list)


# ─── T1-013: Accept suggestion → applied_count tăng ─────────────────────────

@pytest.mark.asyncio
async def test_accept_suggestion(client):
    """T1-013: Accept một suggestion → endpoint xác nhận thành công.

    API Contract: POST /api/v1/cv/suggestions/{suggestion_id}/accept
    """
    suggestion_id = str(uuid.uuid4())
    with patch(
        "src.services.cv_service.accept_suggestion",
        new_callable=AsyncMock,
        return_value={"status": "accepted", "suggestion_id": suggestion_id},
    ):
        response = await client.post(
            f"/api/v1/cv/suggestions/{suggestion_id}/accept"
        )

    assert response.status_code == 200
    data = response.json()
    assert data.get("status") == "accepted"


# ─── T1-014: Reject suggestion → không apply ─────────────────────────────────

@pytest.mark.asyncio
async def test_reject_suggestion(client):
    """T1-014: Reject một suggestion → endpoint xác nhận thành công,
    suggestion không được áp dụng vào CV (AC F-04).
    """
    suggestion_id = str(uuid.uuid4())
    with patch(
        "src.services.cv_service.reject_suggestion",
        new_callable=AsyncMock,
        return_value={"status": "rejected", "suggestion_id": suggestion_id},
    ):
        response = await client.post(
            f"/api/v1/cv/suggestions/{suggestion_id}/reject"
        )

    assert response.status_code == 200
    data = response.json()
    assert data.get("status") == "rejected"
