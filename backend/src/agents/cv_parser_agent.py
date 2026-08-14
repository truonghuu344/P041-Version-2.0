from __future__ import annotations

from typing import Any

from langgraph.graph import END, StateGraph

from src.agents.nodes.cv_parser_nodes import (
    evidence_guardrail_node,
    finalize_cv_node,
    llm_structured_parse_node,
    local_evidence_node,
    validate_cv_node,
)
from src.agents.state import CVParserAgentState


def _after_validation(state: CVParserAgentState) -> str:
    return END if state.get("error") else "extract_local_evidence"


def build_cv_parser_graph():
    graph = StateGraph(CVParserAgentState)
    graph.add_node("validate_input", validate_cv_node)
    graph.add_node("extract_local_evidence", local_evidence_node)
    graph.add_node("llm_structured_parse", llm_structured_parse_node)
    graph.add_node("evidence_guardrail", evidence_guardrail_node)
    graph.add_node("ats_quality_gate", finalize_cv_node)
    graph.set_entry_point("validate_input")
    graph.add_conditional_edges("validate_input", _after_validation)
    graph.add_edge("extract_local_evidence", "llm_structured_parse")
    graph.add_edge("llm_structured_parse", "evidence_guardrail")
    graph.add_edge("evidence_guardrail", "ats_quality_gate")
    graph.add_edge("ats_quality_gate", END)
    return graph.compile()


class CVParserAgent:
    """LangGraph agent: Parse → LLM → Guardrail → ATS quality → HITL output."""

    def __init__(self) -> None:
        self.graph = build_cv_parser_graph()

    async def run(self, cv_raw_text: str, *, use_llm: bool | None = None) -> dict[str, Any]:
        initial_state: CVParserAgentState = {"cv_raw_text": cv_raw_text}
        if use_llm is not None:
            initial_state["llm_requested"] = use_llm
        state = await self.graph.ainvoke(initial_state)
        if state.get("error"):
            raise ValueError(state["error"])
        return state["final_result"]


cv_parser_agent = CVParserAgent()
