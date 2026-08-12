from __future__ import annotations

from typing import Any, Literal, TypedDict


class AgentState(TypedDict, total=False):
    """State schema cho LangGraph agent theo PRD P-041 (Section 6.2)."""

    user_id: str
    cv_raw_text: str
    cv_parsed_json: dict[str, Any]
    selected_jd_id: str
    jd_text: str
    match_score: float
    gap_analysis_result: dict[str, Any]
    optimized_cv_suggestions: list[dict[str, Any]]
    interview_questions: list[str]
    current_question_index: int
    chat_history: list[dict[str, Any]]
    star_scores: dict[str, float]
    final_report: dict[str, Any]
    query: str
    response: str
    analysis: str
    error: str
    metadata: dict[str, Any]


class GapAnalysisState(TypedDict, total=False):
    """State của CV Gap Analysis Agent."""

    cv_raw_text: str
    cv_parsed_json: dict[str, Any]
    jd_title: str
    jd_requirements: str
    evidence: dict[str, Any]
    draft_result: dict[str, Any]
    gap_analysis_result: dict[str, Any]
    error: str


class InterviewAgentState(TypedDict, total=False):
    """State dùng chung cho các workflow của Mock Interview Agent."""

    operation: Literal["start", "evaluate", "report"]
    cv_text: str
    jd_title: str
    jd_requirements: str
    num_questions: int
    question_text: str
    user_answer: str
    qa_history: list[dict[str, Any]]
    interview_questions: list[str]
    answer_evaluation: dict[str, Any]
    final_report: dict[str, Any]
    error: str


class CVParserAgentState(TypedDict, total=False):
    """State của CV Parsing Agent theo luồng AI_PARSE trong User Flow."""

    cv_raw_text: str
    local_extraction: dict[str, Any]
    llm_extraction: dict[str, Any]
    verified_extraction: dict[str, Any]
    final_result: dict[str, Any]
    llm_requested: bool
    llm_called: bool
    llm_succeeded: bool
    llm_error: str
    provider: str
    model: str
    trace: list[dict[str, Any]]
    started_at: float
    error: str


class CareerAssistantState(TypedDict, total=False):
    """State cho trợ lý nghề nghiệp hội thoại chạy bằng Gemini."""

    message: str
    history: list[dict[str, str]]
    user_context: dict[str, Any]
    intent: str
    suggested_actions: list[dict[str, str]]
    weather_context: dict[str, Any]
    datetime_context: dict[str, Any]
    tools_used: list[str]
    response: str
    provider: str
    model: str
    llm_succeeded: bool
    error: str
