from typing import Any

from src.agents.gap_analysis_agent import gap_analysis_agent


async def perform_cv_jd_gap_analysis(
    cv_raw_text: str,
    cv_parsed_json: dict[str, Any],
    jd_title: str,
    jd_requirements: str,
    jd_parsed_json: dict[str, Any] | None = None,
    rubric: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Compatibility facade cho API: thực thi CV Gap Analysis Agent."""
    return await gap_analysis_agent.run(
        cv_raw_text=cv_raw_text,
        cv_parsed_json=cv_parsed_json,
        jd_title=jd_title,
        jd_requirements=jd_requirements,
        jd_parsed_json=jd_parsed_json,
        rubric=rubric,
    )
