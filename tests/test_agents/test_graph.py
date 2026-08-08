from types import SimpleNamespace

import pytest

from src.agents.gap_analysis_agent import gap_analysis_agent
from src.agents.graph import agent
from src.agents.interview_agent import interview_agent


@pytest.mark.asyncio
async def test_agent_basic_flow():
    result = await agent.ainvoke({"query": "Hello"})
    assert "response" in result


@pytest.mark.asyncio
async def test_agent_state_structure():
    result = await agent.ainvoke({"query": "Test query"})
    assert isinstance(result, dict)
    assert "query" in result


@pytest.fixture
def disable_llm(monkeypatch):
    fallback_settings = SimpleNamespace(openai_api_key="", model_name="gpt-4o-mini")
    monkeypatch.setattr("src.agents.nodes.gap_analysis_nodes.get_settings", lambda: fallback_settings)
    monkeypatch.setattr("src.agents.nodes.interview_nodes.get_settings", lambda: fallback_settings)


@pytest.mark.asyncio
async def test_gap_analysis_agent_uses_cv_evidence_and_blocks_missing_skills(disable_llm):
    cv_text = "Tôi phát triển REST API bằng Python và FastAPI cho đồ án tốt nghiệp."
    result = await gap_analysis_agent.run(
        cv_raw_text=cv_text,
        cv_parsed_json={"skills": ["Python", "FastAPI"]},
        jd_title="Backend Developer",
        jd_requirements="Yêu cầu Python, FastAPI, Docker và PostgreSQL.",
    )

    assert result["integrity_guardrail"] == "passed"
    assert set(result["hard_skills_matching"]) == {"Python", "FastAPI"}
    assert set(result["hard_skills_missing"]) == {"Docker", "PostgreSQL"}
    assert 0 <= result["match_score"] <= 100
    assert result["executive_summary"]
    assert {item["gap"] for item in result["priority_actions"]} >= {"Docker", "PostgreSQL"}
    assert {item["skill"] for item in result["learning_recommendations"]} == {"Docker", "PostgreSQL"}
    assert result["certification_recommendations"]
    assert result["project_recommendations"]
    assert result["project_recommendations"][0]["status"] == "recommended_not_completed"
    assert result["project_recommendations"][0]["cv_bullet_template"].startswith("Sau khi hoàn thành:")
    assert result["cv_section_recommendations"]
    for suggestion in result["suggestions"]:
        assert suggestion["original_text"].casefold() in cv_text.casefold()
        assert "docker" not in suggestion["suggested_improvement"].casefold()
        assert "postgresql" not in suggestion["suggested_improvement"].casefold()


@pytest.mark.asyncio
async def test_interview_agent_complete_workflow(disable_llm):
    questions = await interview_agent.start(
        cv_text="Đã xây dựng API bằng Python và làm việc nhóm trong đồ án.",
        jd_title="Backend Developer",
        jd_requirements="Yêu cầu Python, FastAPI và kỹ năng làm việc nhóm.",
        num_questions=5,
    )
    assert len(questions) == 5
    assert len(set(questions)) == 5

    evaluation = await interview_agent.evaluate(
        question_text=questions[1],
        user_answer="Tôi làm một dự án.",
        cv_text="Đã xây dựng API bằng Python.",
    )
    assert evaluation["needs_followup"] is True
    assert evaluation["follow_up_question"]
    assert set(evaluation["star_score"]) == {"situation", "task", "action", "result"}

    report = await interview_agent.report(
        jd_title="Backend Developer",
        qa_history=[
            {"question": questions[0], "answer": "A", "score": evaluation["star_score"]},
            {
                "question": questions[1],
                "answer": "B",
                "score": {"situation": 80, "task": 70, "action": 90, "result": 60},
            },
        ],
    )
    expected_total = round((sum(evaluation["star_score"].values()) + 300) / 8, 2)
    assert report["total_score"] == expected_total
    assert report["strengths"]
    assert report["improvements"]
