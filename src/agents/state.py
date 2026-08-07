from __future__ import annotations

from typing import TypedDict, Optional, List, Dict, Any


class AgentState(TypedDict, total=False):
    """State schema cho LangGraph agent theo PRD P-041 (Section 6.2)."""

    user_id: str
    cv_raw_text: str
    cv_parsed_json: Dict[str, Any]
    selected_jd_id: str
    jd_text: str
    match_score: float
    gap_analysis_result: Dict[str, Any]
    optimized_cv_suggestions: List[Dict[str, Any]]
    interview_questions: List[str]
    current_question_index: int
    chat_history: List[Dict[str, Any]]
    star_scores: Dict[str, float]
    final_report: Dict[str, Any]
    query: str
    response: str
    analysis: str
    error: str
    metadata: Dict[str, Any]
