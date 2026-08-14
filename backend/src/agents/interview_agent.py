from __future__ import annotations

from typing import Any

from langgraph.graph import END, StateGraph

from src.agents.nodes.interview_nodes import (
    evaluate_answer_node,
    generate_questions_node,
    generate_report_node,
    guard_questions_node,
    validate_interview_input,
)
from src.agents.state import InterviewAgentState


def _route_operation(state: InterviewAgentState) -> str:
    if state.get("error"):
        return END
    return {
        "start": "generate_questions",
        "evaluate": "evaluate_answer",
        "report": "generate_report",
    }[state["operation"]]


def build_interview_graph():
    graph = StateGraph(InterviewAgentState)
    graph.add_node("validate_input", validate_interview_input)
    graph.add_node("generate_questions", generate_questions_node)
    graph.add_node("guard_questions", guard_questions_node)
    graph.add_node("evaluate_answer", evaluate_answer_node)
    graph.add_node("generate_report", generate_report_node)
    graph.set_entry_point("validate_input")
    graph.add_conditional_edges("validate_input", _route_operation)
    graph.add_edge("generate_questions", "guard_questions")
    graph.add_edge("guard_questions", END)
    graph.add_edge("evaluate_answer", END)
    graph.add_edge("generate_report", END)
    return graph.compile()


class InterviewAgent:
    """Agent điều phối tạo câu hỏi, follow-up và báo cáo STAR."""

    def __init__(self) -> None:
        self.graph = build_interview_graph()

    async def _invoke(self, payload: InterviewAgentState) -> InterviewAgentState:
        state = await self.graph.ainvoke(payload)
        if state.get("error"):
            raise ValueError(state["error"])
        return state

    async def start(self, *, cv_text: str, jd_title: str, jd_requirements: str, num_questions: int) -> list[str]:
        state = await self._invoke(
            {
                "operation": "start",
                "cv_text": cv_text,
                "jd_title": jd_title,
                "jd_requirements": jd_requirements,
                "num_questions": num_questions,
            }
        )
        return state["interview_questions"]

    async def evaluate(self, *, question_text: str, user_answer: str, cv_text: str) -> dict[str, Any]:
        state = await self._invoke(
            {
                "operation": "evaluate",
                "question_text": question_text,
                "user_answer": user_answer,
                "cv_text": cv_text,
            }
        )
        return state["answer_evaluation"]

    async def report(self, *, qa_history: list[dict[str, Any]], jd_title: str) -> dict[str, Any]:
        state = await self._invoke(
            {
                "operation": "report",
                "qa_history": qa_history,
                "jd_title": jd_title,
            }
        )
        return state["final_report"]


interview_agent = InterviewAgent()
