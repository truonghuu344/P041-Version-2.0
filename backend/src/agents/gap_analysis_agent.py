from __future__ import annotations

from typing import Any

from langgraph.graph import END, StateGraph

from src.agents.nodes.gap_analysis_nodes import (
    draft_gap_analysis,
    enforce_gap_integrity,
    extract_gap_evidence,
    validate_gap_input,
)
from src.agents.state import GapAnalysisState


def _after_validation(state: GapAnalysisState) -> str:
    return END if state.get("error") else "extract_evidence"


def build_gap_analysis_graph():
    graph = StateGraph(GapAnalysisState)
    graph.add_node("validate_input", validate_gap_input)
    graph.add_node("extract_evidence", extract_gap_evidence)
    graph.add_node("draft_analysis", draft_gap_analysis)
    graph.add_node("integrity_guardrail", enforce_gap_integrity)
    graph.set_entry_point("validate_input")
    graph.add_conditional_edges("validate_input", _after_validation)
    graph.add_edge("extract_evidence", "draft_analysis")
    graph.add_edge("draft_analysis", "integrity_guardrail")
    graph.add_edge("integrity_guardrail", END)
    return graph.compile()


class GapAnalysisAgent:
    """Agent phân tích CV–JD và bảo vệ nguyên tắc anti-hallucination."""

    def __init__(self) -> None:
        self.graph = build_gap_analysis_graph()

    async def run(
        self,
        *,
        cv_raw_text: str,
        cv_parsed_json: dict[str, Any],
        jd_title: str,
        jd_requirements: str,
        jd_parsed_json: dict[str, Any] | None = None,
        rubric: dict[str, Any] | None = None,
        on_progress: Any = None,
    ) -> dict[str, Any]:
        state = await self.graph.ainvoke(
            {
                "cv_raw_text": cv_raw_text,
                "cv_parsed_json": cv_parsed_json,
                "jd_title": jd_title,
                "jd_requirements": jd_requirements,
                "jd_parsed_json": jd_parsed_json or {},
                "rubric": rubric or {},
                "on_progress": on_progress,
            }
        )
        if state.get("error"):
            raise ValueError(state["error"])
        return state["gap_analysis_result"]


gap_analysis_agent = GapAnalysisAgent()
