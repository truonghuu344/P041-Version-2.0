"""Guardrail cho lớp làm sạch hiển thị job (title/metadata/section)."""

from __future__ import annotations

from src.services.text_cleaning import (
    derive_metadata_from_text,
    resolve_job_level,
    split_title_decorations,
    strip_redaction_markers,
)


class TestTitleCleaning:
    def test_bracket_level_and_paren_spacing(self):
        result = split_title_decorations("[Junior]Mobile Developer(Flutter)")
        assert result["title"] == "Mobile Developer (Flutter)"
        assert result["level"] == "junior"

    def test_glued_role_level_words_split(self):
        result = split_title_decorations("[LTH] FULL STACKDEVELOPERINTERN (.NET & Angular)")
        assert result["title"] == "FULL STACK DEVELOPER INTERN (.NET & Angular)"

    def test_company_prefix_removed(self):
        result = split_title_decorations("[VELA]AI ENGINEERINTERN (Smart Input / OCR)")
        assert result["title"] == "AI ENGINEER INTERN (Smart Input / OCR)"
        assert "[VELA]" not in result["title"]

    def test_urgent_tag_removed(self):
        result = split_title_decorations("[Urgent] 02 Junior Cloud Engineer (AWS/Azure)")
        assert result["title"] == "02 Junior Cloud Engineer (AWS/Azure)"
        assert result["level"] is None

    def test_vietnamese_intern_prefix(self):
        result = split_title_decorations("Thực Tập Sinh.NET Developer")
        assert result["title"] == "NET Developer"
        assert result["level"] == "intern"

    def test_plural_engineer_not_broken(self):
        result = split_title_decorations("Software Engineers wanted")
        assert result["title"] == "Software Engineers wanted"

    def test_plain_title_untouched(self):
        result = split_title_decorations("DevOps Engineer")
        assert result["title"] == "DevOps Engineer"


class TestRedactionMarkers:
    def test_protected_info_marker_removed(self):
        text = "Thời gian làm việc: Từ Thứ 2 đến Thứ 6 ([protected info])"
        cleaned = strip_redaction_markers(text)
        assert "protected" not in cleaned.casefold()
        assert "()" not in cleaned
        assert "Thứ 2 đến Thứ 6" in cleaned

    def test_email_marker_removed(self):
        cleaned = strip_redaction_markers("Gửi CV về [email protected] trước 30/09.")
        assert "email protected" not in cleaned
        assert "trước 30/09" in cleaned


class TestDeriveMetadata:
    def test_topcv_metadata_block(self):
        description = (
            "Giới thiệu công ty\n"
            "Thu nhập:\nUp To 17.000.000\n"
            "Loại hình:\nToàn thời gian\n"
            "Chức vụ:\nNhân viên\n"
            "Kinh nghiệm:\n0,5 năm\n"
            "Mô tả công việc:\n• Vận hành hệ thống"
        )
        meta = derive_metadata_from_text(description)
        assert meta["employment_type"] == "Full-time"
        assert meta["position_level"] == "Junior"
        assert meta["experience_years"] == 0.5
        assert meta["experience_level"] == "Fresher"

    def test_internal_word_not_read_as_intern(self):
        meta = derive_metadata_from_text(
            "Collaborate with other team members to define the internal processes."
        )
        assert "employment_type" not in meta
        assert "experience_level" not in meta

    def test_internship_label_detected(self):
        meta = derive_metadata_from_text("Loại hình:\nThực tập sinh\nChức vụ:\nThực tập sinh")
        assert meta["employment_type"] == "Internship"
        assert meta["position_level"] == "Intern"


class TestResolveLevel:
    def test_priority_title_first(self):
        level = resolve_job_level(
            title_level_hint="junior",
            position_level="Intern",
            experience_level="Fresher",
            current_level="Senior",
        )
        assert level == "Junior"

    def test_junk_current_value_falls_through(self):
        level = resolve_job_level(
            title_level_hint=None,
            position_level=None,
            experience_level=None,
            current_level="Not Specified",
        )
        assert level == "Chưa xác định"
