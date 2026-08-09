"""
Fixtures và mock builders dùng chung cho tất cả E2E Workflow tests.

Pattern: Fixture chaining — mỗi fixture gọi fixture của step trước,
đảm bảo state (cv_id, suggestion_id, session_id) nhất quán xuyên suốt.

Cấu trúc fixture chain:
  e2e_client
      └── uploaded_cv          (step 1: upload)
              └── analyzed_cv  (step 2: analyze — nhận cv_id từ uploaded_cv)
                      └── started_session  (step 3: start interview)
"""

import io
import uuid
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from src.main import app


# ─── HTTP Client ──────────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def e2e_client():
    """Async HTTP client cho E2E tests (dùng ASGI transport, không cần server thật)."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


# ─── Mock Builders ────────────────────────────────────────────────────────────

def build_mock_upload(cv_id: str | None = None) -> dict:
    """Tạo mock response cho POST /api/v1/cv/upload."""
    _cv_id = cv_id or str(uuid.uuid4())
    return {
        "cv_id": _cv_id,
        "sections": {
            "education": [
                {
                    "institution": "Đại học Bách Khoa TP.HCM",
                    "degree": "Kỹ sư CNTT",
                    "year": "2022-2026",
                }
            ],
            "skills": ["Python", "FastAPI", "PostgreSQL", "Git", "Docker"],
            "experience": [
                {
                    "company": "FPT Software",
                    "role": "Backend Intern",
                    "duration": "3 tháng",
                    "description": "Phát triển REST API với FastAPI, làm việc với PostgreSQL",
                }
            ],
            "projects": [
                {
                    "name": "Student Management System",
                    "tech": ["Python", "FastAPI", "PostgreSQL"],
                    "description": "Hệ thống quản lý sinh viên 200 users",
                }
            ],
        },
        "raw_text": "Nguyen Van A - Backend Intern...",
        "parse_confidence": 0.94,
    }


def build_mock_analyze(cv_id: str, suggestion_ids: list[str] | None = None) -> dict:
    """Tạo mock response cho POST /api/v1/cv/analyze."""
    _sug_ids = suggestion_ids or [str(uuid.uuid4()), str(uuid.uuid4())]
    return {
        "match_score": 72.5,
        "gap_analysis": {
            "matched_skills": ["Python", "FastAPI", "Git"],
            "missing_hard_skills": ["AWS", "Kubernetes"],
            "missing_soft_skills": [],
            "missing_keywords": ["microservices", "CI/CD"],
        },
        "suggestions": [
            {
                "suggestion_id": _sug_ids[0],
                "type": "rephrase",
                "original": "Phát triển REST API với FastAPI",
                "suggested": (
                    "Thiết kế và phát triển RESTful API với FastAPI, "
                    "tối ưu query PostgreSQL giảm response time"
                ),
                "source_field": "experience[0].description",
            },
            {
                "suggestion_id": _sug_ids[1],
                "type": "rephrase",
                "original": "Hệ thống quản lý sinh viên 200 users",
                "suggested": (
                    "Xây dựng Student Management System phục vụ 200+ users "
                    "với JWT authentication và CRUD operations đầy đủ"
                ),
                "source_field": "projects[0].description",
            },
        ],
    }


def build_mock_accept(suggestion_id: str) -> dict:
    """Tạo mock response cho POST /api/v1/cv/suggestions/{id}/accept."""
    return {"status": "accepted", "suggestion_id": suggestion_id}


def build_mock_reject(suggestion_id: str) -> dict:
    """Tạo mock response cho POST /api/v1/cv/suggestions/{id}/reject."""
    return {"status": "rejected", "suggestion_id": suggestion_id}


def build_mock_export(cv_id: str) -> dict:
    """Tạo mock response cho GET /api/v1/cv/{cv_id}/export."""
    return {
        "cv_id": cv_id,
        "download_url": f"/api/v1/cv/{cv_id}/download",
        "format": "pdf",
        "applied_suggestions_count": 1,
    }


def build_mock_session_start(cv_id: str, jd_id: str, session_id: str | None = None) -> dict:
    """Tạo mock response cho POST /api/v1/interview/start."""
    _session_id = session_id or str(uuid.uuid4())
    return {
        "session_id": _session_id,
        "cv_id": cv_id,
        "jd_id": jd_id,
        "status": "active",
        "total_questions": 6,
        "current_question_index": 0,
        "current_question": (
            "Hãy kể về một dự án backend bạn đã làm. "
            "Bạn gặp thách thức kỹ thuật nào và giải quyết ra sao?"
        ),
    }


def build_mock_answer_next(session_id: str, question_index: int) -> dict:
    """Tạo mock response cho POST /api/v1/interview/{session_id}/answer — câu tiếp theo."""
    return {
        "session_id": session_id,
        "current_question_index": question_index,
        "current_question": (
            f"Câu hỏi {question_index + 1}: "
            "Bạn đã từng làm việc nhóm trong dự án lớn chưa?"
        ),
        "is_follow_up": False,
        "status": "active",
    }


def build_mock_answer_followup(session_id: str) -> dict:
    """Tạo mock response khi câu trả lời ngắn → trigger follow-up."""
    return {
        "session_id": session_id,
        "current_question_index": 0,  # Giữ nguyên index
        "current_question": "Bạn có thể mô tả cụ thể hơn về kết quả đạt được không?",
        "is_follow_up": True,
        "status": "active",
    }


def build_mock_session_complete(session_id: str) -> dict:
    """Tạo mock response khi answer xong câu cuối → session completed."""
    return {
        "session_id": session_id,
        "status": "completed",
        "message": "Phỏng vấn kết thúc. Xem báo cáo STAR của bạn.",
    }


def build_mock_star_report(session_id: str, cv_id: str) -> dict:
    """Tạo mock response cho GET /api/v1/interview/{session_id}/report."""
    return {
        "session_id": session_id,
        "cv_id": cv_id,
        "total_score": 74,
        "star_scores": {
            "situation": 82,
            "task": 78,
            "action": 70,
            "result": 65,
        },
        "strengths": [
            "Mô tả tình huống cụ thể và có bối cảnh rõ ràng",
            "Nêu rõ nhiệm vụ và trách nhiệm cá nhân",
        ],
        "improvements": [
            "Phần Result cần định lượng hơn (thêm số liệu, %)",
            "Action nên trình bày rõ lý do chọn giải pháp đó",
        ],
        "sample_answers": [
            {
                "question": "Kể về dự án backend của bạn",
                "guidance": (
                    "Dùng cấu trúc: Tình huống [dự án X, team N người] → "
                    "Nhiệm vụ [tôi phụ trách Y] → "
                    "Hành động [tôi đã làm Z vì lý do W] → "
                    "Kết quả [đạt được A, đo bằng B]"
                ),
            }
        ],
    }


# ─── Step Fixtures (Fixture Chaining) ────────────────────────────────────────

@pytest_asyncio.fixture
async def uploaded_cv(e2e_client):
    """
    Fixture Step 1: Thực hiện upload CV.

    Trả về dict: {"cv_id": str, "sections": dict, "parse_confidence": float}

    NOTE: patch "src.api.routes" nơi handler thực sự xử lý file upload,
    vì src.services.cv_parser chưa tồn tại trong MVP hiện tại.
    """
    mock_result = build_mock_upload()

    with patch(
        "src.agents.graph.agent.ainvoke",
        new_callable=AsyncMock,
        return_value=mock_result,
    ):
        pdf_bytes = b"%PDF-1.4\n" + b"0" * (512 * 1024)  # 0.5MB fake PDF
        response = await e2e_client.post(
            "/api/v1/cv/upload",
            files={"file": ("my_cv.pdf", io.BytesIO(pdf_bytes), "application/pdf")},
        )

    assert response.status_code == 200, (
        f"[uploaded_cv fixture] Upload thất bại: {response.status_code} — {response.text}\n"
        "NOTE: Endpoint /api/v1/cv/upload cần được implement trong routes.py"
    )
    data = response.json()
    assert "cv_id" in data
    return data


@pytest_asyncio.fixture
async def analyzed_cv(e2e_client, uploaded_cv):
    """
    Fixture Step 2: Analyze CV vừa upload với JD mẫu.

    Depends on: uploaded_cv
    Trả về dict: {"cv_id": str, "match_score": float, "suggestions": list, "gap_analysis": dict}
    """
    cv_id = uploaded_cv["cv_id"]
    suggestion_ids = [str(uuid.uuid4()), str(uuid.uuid4())]
    mock_result = build_mock_analyze(cv_id, suggestion_ids)

    jd_text = (
        "Backend Developer\n"
        "Yêu cầu: Python, FastAPI, REST API, Git\n"
        "Cộng: Docker, AWS, Kubernetes, CI/CD"
    )

    with patch(
        "src.agents.graph.agent.ainvoke",
        new_callable=AsyncMock,
        return_value=mock_result,
    ):
        response = await e2e_client.post(
            "/api/v1/cv/analyze",
            json={"cv_id": cv_id, "jd_text": jd_text},
        )

    assert response.status_code == 200, (
        f"[analyzed_cv fixture] Analyze thất bại: {response.status_code} — {response.text}\n"
        "NOTE: Endpoint /api/v1/cv/analyze cần được implement trong routes.py"
    )
    data = response.json()
    data["cv_id"] = cv_id  # Đính kèm cv_id để fixture sau dùng
    return data


@pytest_asyncio.fixture
async def started_session(e2e_client, analyzed_cv):
    """
    Fixture Step 3: Start interview session sau khi đã có cv_id.

    Depends on: analyzed_cv (which depends on uploaded_cv)
    Trả về dict: {"session_id": str, "cv_id": str, "total_questions": int, ...}
    """
    cv_id = analyzed_cv["cv_id"]
    jd_id = str(uuid.uuid4())  # MVP: jd_id là UUID placeholder
    session_id = str(uuid.uuid4())

    mock_result = build_mock_session_start(cv_id, jd_id, session_id)

    with patch(
        "src.agents.graph.agent.ainvoke",
        new_callable=AsyncMock,
        return_value=mock_result,
    ):
        response = await e2e_client.post(
            "/api/v1/interview/start",
            json={"cv_id": cv_id, "jd_id": jd_id},
        )

    assert response.status_code == 200, (
        f"[started_session fixture] Start interview thất bại: {response.status_code}\n"
        "NOTE: Endpoint /api/v1/interview/start cần được implement trong routes.py"
    )
    data = response.json()
    data["cv_id"] = cv_id  # Đính kèm để fixture sau dùng
    return data

