from __future__ import annotations

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from src.agents.career_assistant_agent import career_assistant_agent
from src.config import Settings
from src.db.database import Base
from src.db.models import User
from src.services.assistant_rag import (
    AssistantRAGService,
    RetrievedChunk,
    chunk_cv_sections,
    chunk_jd_sections,
)


@pytest.fixture
async def db_session():
    engine = create_async_engine("sqlite+aiosqlite://")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session
    await engine.dispose()


def test_chunk_cv_sections():
    parsed_cv = {
        "summary": "Kỹ sư phần mềm 3 năm kinh nghiệm với đam mê về AI và hệ thống phân tán.",
        "skills": ["Python", "FastAPI", "PostgreSQL", "Docker", "LangChain"],
        "experience": [
            {
                "company": "Công ty ABC",
                "role": "Senior Backend Developer",
                "duration": "2023 - 2026",
                "description": "Xây dựng microservices RESTful API phục vụ 50.000 users.",
            }
        ],
        "projects": [
            {
                "name": "Hệ thống Tuyển dụng AI",
                "technologies": ["Python", "pgvector", "Next.js"],
                "description": "Triển khai RAG pipeline tìm kiếm ứng viên tương thích.",
            }
        ],
        "education": [
            {
                "school": "Đại học Bách Khoa",
                "degree": "Kỹ sư Khoa học Máy tính",
                "gpa": "3.6/4.0",
            }
        ],
    }

    chunks = chunk_cv_sections(title="CV Nguyễn Văn A", raw_text=None, parsed_json=parsed_cv)
    section_names = [c.section_name for c in chunks]

    assert "summary" in section_names
    assert "skills" in section_names
    assert "experience" in section_names
    assert "projects" in section_names
    assert "education" in section_names
    assert len(chunks) == 5
    assert "Senior Backend Developer" in [c.content for c in chunks if c.section_name == "experience"][0]


def test_chunk_jd_sections():
    normalized_jd = {
        "overview": "Tuyển dụng vị trí Senior AI Engineer phát triển hệ thống RAG và LLM.",
        "responsibilities": ["Thiết kế pipeline vector search", "Tối ưu hóa mô hình nhúng embedding"],
        "must_have": ["3+ năm kinh nghiệm Python", "Thành thạo PyTorch và vector databases"],
        "nice_to_have": ["Hiểu biết về LangGraph và LangChain"],
        "salary_min": "30.000.000 VND",
        "salary_max": "50.000.000 VND",
        "benefits": ["Thưởng KPI tháng 13", "MacBook Pro M3", "Bảo hiểm sức khỏe Premium"],
    }

    chunks = chunk_jd_sections(
        title="Senior AI Engineer",
        company="TechCorp",
        requirements_text=None,
        normalized_json=normalized_jd,
    )
    section_names = [c.section_name for c in chunks]

    assert "overview" in section_names
    assert "responsibilities" in section_names
    assert "must_have" in section_names
    assert "nice_to_have" in section_names
    assert "benefits" in section_names
    assert len(chunks) == 5


def test_evaluate_cascading_decision_factual():
    rag_service = AssistantRAGService(
        settings=Settings(
            vector_embedding_provider="hashing",
            vector_dimensions=256,
        )
    )
    chunks = [
        RetrievedChunk(
            id="1",
            source_id="cv-1",
            source_type="cv",
            source_title="CV Nguyễn Văn A",
            section_name="skills",
            content="Kỹ năng chuyên môn (CV Nguyễn Văn A): Python, FastAPI, Docker, pgvector",
            score=0.88,
        )
    ]

    # Câu hỏi dữ kiện -> Tier 2 (Extractive)
    decision, direct_answer = rag_service.evaluate_cascading_decision(
        query="Trong CV tôi có kỹ năng Docker không?",
        retrieved_chunks=chunks,
    )

    assert decision == "tier2_extractive"
    assert direct_answer is not None
    assert "Docker" in direct_answer
    assert "CV Nguyễn Văn A" in direct_answer


def test_evaluate_cascading_decision_reasoning():
    rag_service = AssistantRAGService(
        settings=Settings(
            vector_embedding_provider="hashing",
            vector_dimensions=256,
        )
    )
    chunks = [
        RetrievedChunk(
            id="1",
            source_id="cv-1",
            source_type="cv",
            source_title="CV Nguyễn Văn A",
            section_name="skills",
            content="Kỹ năng: Python, FastAPI",
            score=0.85,
        )
    ]

    # Câu hỏi cần tư vấn / so sánh -> Tier 3 (Generative LLM)
    decision, direct_answer = rag_service.evaluate_cascading_decision(
        query="Hãy so sánh kỹ năng của tôi và tư vấn lộ trình học tập tiếp theo",
        retrieved_chunks=chunks,
    )

    assert decision == "tier3_generative"
    assert direct_answer is None


@pytest.mark.asyncio
async def test_rag_indexing_and_search_isolation(db_session: AsyncSession):
    rag_service = AssistantRAGService(
        settings=Settings(
            vector_embedding_provider="hashing",
            vector_dimensions=256,
        )
    )

    user_a = User(
        id="user-a-123",
        email="user_a@example.com",
        hashed_password="hash",
        full_name="User A",
        role="student",
    )
    user_b = User(
        id="user-b-456",
        email="user_b@example.com",
        hashed_password="hash",
        full_name="User B",
        role="student",
    )
    db_session.add_all([user_a, user_b])
    await db_session.commit()

    # Index CV for User A
    await rag_service.index_cv(
        session=db_session,
        user_id="user-a-123",
        cv_id="cv-a-1",
        title="CV Golang Developer",
        raw_text=None,
        parsed_json={
            "skills": ["Golang", "Kubernetes", "gRPC", "Microservices"],
            "summary": "Chuyên gia phát triển backend Golang.",
        },
    )

    # Index CV for User B
    await rag_service.index_cv(
        session=db_session,
        user_id="user-b-456",
        cv_id="cv-b-1",
        title="CV Flutter Mobile",
        raw_text=None,
        parsed_json={
            "skills": ["Flutter", "Dart", "iOS", "Android"],
            "summary": "Lập trình viên Mobile Flutter.",
        },
    )
    await db_session.commit()

    # User A search Golang -> Must find User A's CV
    results_a = await rag_service.search(
        session=db_session,
        user_id="user-a-123",
        query="Golang microservices",
        top_k=2,
    )
    assert len(results_a) > 0
    assert any("Golang" in r.content for r in results_a)
    assert all(r.source_id == "cv-a-1" for r in results_a)

    # User B search Golang -> Must NOT find User A's CV (Multi-tenancy isolation)
    results_b = await rag_service.search(
        session=db_session,
        user_id="user-b-456",
        query="Golang microservices",
        top_k=2,
    )
    assert not any("Golang" in r.content for r in results_b)


@pytest.mark.asyncio
async def test_rag_jd_indexing_and_deletion(db_session: AsyncSession):
    rag_service = AssistantRAGService(
        settings=Settings(
            vector_embedding_provider="hashing",
            vector_dimensions=256,
        )
    )

    user = User(
        id="recruiter-123",
        email="recruiter@example.com",
        hashed_password="hash",
        full_name="Recruiter",
        role="counselor",
    )
    db_session.add(user)
    await db_session.commit()

    # 1. Index JD
    count = await rag_service.index_jd(
        session=db_session,
        user_id="recruiter-123",
        jd_id="jd-test-1",
        title="Senior Python Engineer",
        company="Tech Company",
        requirements_text="Python, FastAPI, Postgres, Docker",
        normalized_json={
            "must_have": ["Python", "FastAPI"],
            "nice_to_have": ["Kubernetes", "LangGraph"],
            "benefits": ["Thưởng 13", "Bảo hiểm"],
        },
    )
    await db_session.commit()
    assert count > 0

    # 2. Search JD
    results = await rag_service.search(
        session=db_session,
        user_id="recruiter-123",
        query="Python FastAPI requirements",
        source_types=["jd"],
    )
    assert len(results) > 0
    assert any("Python" in r.content for r in results)

    # 3. Delete JD Embeddings
    deleted_count = await rag_service.delete_jd_embeddings(
        session=db_session,
        user_id="recruiter-123",
        jd_id="jd-test-1",
    )
    await db_session.commit()
    assert deleted_count == count

    # 4. Search again -> 0 results
    after_delete = await rag_service.search(
        session=db_session,
        user_id="recruiter-123",
        query="Python FastAPI requirements",
        source_types=["jd"],
    )
    assert len(after_delete) == 0


@pytest.mark.asyncio
async def test_agent_graph_with_tier2_extractive_rag():
    rag_chunks = [
        RetrievedChunk(
            id="1",
            source_id="cv-1",
            source_type="cv",
            source_title="CV Python Backend",
            section_name="skills",
            content="Kỹ năng chuyên môn: Python, FastAPI, Docker, PostgreSQL",
            score=0.92,
        )
    ]

    result = await career_assistant_agent.run(
        message="Trong CV của tôi có kỹ năng Docker không?",
        history=[],
        user_context={
            "full_name": "Nguyễn Văn A",
            "role": "student",
            "rag_context": rag_chunks,
            "_resources": {"rag_chunks": rag_chunks},
        },
    )

    assert result.get("rag_tier") == "tier2_extractive"
    assert result.get("llm_succeeded") is True
    assert "Docker" in result["response"]
    assert "CV Python Backend" in result["response"]
    assert "rag_retrieval" in result.get("tools_used", [])

    actions = result.get("suggested_actions", [])
    assert len(actions) > 0
    assert any(a.get("action_type") == "evidence" for a in actions)
    evidence_action = next(a for a in actions if a.get("action_type") == "evidence")
    assert len(evidence_action.get("sources", [])) > 0
    assert "CV Python Backend" in evidence_action["sources"][0]["title"]

