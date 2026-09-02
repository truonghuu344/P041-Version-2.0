from src.services.cv_jd_matching import _is_non_requirement, _sentences
from src.services.cv_jd_pipeline import _evidence_supports_requirement


def test_structured_requirement_cleanup_removes_markdown_and_splits_escaped_bullets():
    text = r"## III. \- Required: Use an AI coding tool ### 2. \- Work Saturday morning"
    fragments = _sentences(text)

    assert len(fragments) == 2
    assert all("\\-" not in fragment for fragment in fragments)
    assert all("###" not in fragment and "##" not in fragment for fragment in fragments)
    assert all("III." not in fragment for fragment in fragments)
    assert _is_non_requirement("## III.")
    assert _is_non_requirement("### 2.")


def test_unrelated_project_title_and_contact_data_are_not_technical_evidence():
    requirement = {"normalized_value": "AI coding tool"}

    assert not _evidence_supports_requirement(
        requirement, {"text": "IVORA - Online Wedding Invitation Platform", "source_section": "projects[0]"}
    )
    assert not _evidence_supports_requirement(
        requirement, {"text": "Email: ai.candidate@example.com | 0912345678", "source_section": "header"}
    )
    assert _evidence_supports_requirement(
        requirement, {"text": "Used an AI coding tool to review pull requests.", "source_section": "projects[0]"}
    )
