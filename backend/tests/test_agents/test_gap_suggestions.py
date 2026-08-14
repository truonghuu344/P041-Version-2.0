from src.agents.tools.career_tools import deterministic_cv_suggestions


def test_cv_optimization_uses_only_evidence_related_to_selected_jd():
    cv_text = """
truonghu344@gmail.com
facebook.com/truong.vuhuu.94
Xã Tây Phương, TP Hà Nội
Xây dựng REST API quản lý công việc bằng Python và FastAPI.
Thiết kế giao diện truyền thông bằng Figma.
"""

    suggestions = deterministic_cv_suggestions(cv_text, ["Python", "FastAPI"])

    assert len(suggestions) == 1
    assert suggestions[0]["original_text"] == "Xây dựng REST API quản lý công việc bằng Python và FastAPI."
    assert "Python" in suggestions[0]["reason"]
    assert "FastAPI" in suggestions[0]["reason"]
    rendered = " ".join(str(value) for suggestion in suggestions for value in suggestion.values())
    assert "@gmail.com" not in rendered
    assert "facebook.com" not in rendered
    assert "Tây Phương" not in rendered


def test_cv_optimization_returns_no_rewrite_without_selected_jd_evidence():
    cv_text = """
truonghu344@gmail.com
Xã Tây Phương, TP Hà Nội
Thiết kế giao diện truyền thông bằng Figma.
"""

    assert deterministic_cv_suggestions(cv_text, ["FastAPI", "Python"]) == []


def test_short_skill_names_require_standalone_matches():
    cv_text = "Quản lý hệ thống Gmail notifications cho nhóm vận hành."

    assert deterministic_cv_suggestions(cv_text, ["AI"]) == []
