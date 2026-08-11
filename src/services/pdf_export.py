from html import escape
from io import BytesIO
from pathlib import Path
from typing import Any

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import HRFlowable, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def _font_name() -> str:
    candidates = (
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
        Path("C:/Windows/Fonts/arial.ttf"),
    )
    for path in candidates:
        if path.exists():
            pdfmetrics.registerFont(TTFont("CareerUnicode", str(path)))
            return "CareerUnicode"
    return "Helvetica"


def _text(value: Any) -> str:
    return escape(str(value or "").strip()).replace("\n", "<br/>")


def build_cv_pdf(
    *,
    title: str,
    parsed: dict[str, Any],
    accepted_suggestions: list[str],
    template_name: str,
) -> bytes:
    """Tạo PDF CV phía server với 3 Template cấu trúc khác nhau (modern, classic, compact/creative)."""
    font = _font_name()
    buffer = BytesIO()

    styles = getSampleStyleSheet()

    if template_name == "modern":
        # ===== TEMPLATE 1: MODERN TWO-COLUMN LAYOUT =====
        accent = colors.HexColor("#2563eb")
        sidebar_bg = colors.HexColor("#f8fafc")

        document = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=12 * mm,
            leftMargin=12 * mm,
            topMargin=12 * mm,
            bottomMargin=12 * mm,
            title=title,
        )

        left_heading = ParagraphStyle(
            name="ModLeftHeading",
            fontName=font,
            fontSize=11,
            leading=14,
            textColor=accent,
            spaceBefore=8,
            spaceAfter=4,
        )
        right_heading = ParagraphStyle(
            name="ModRightHeading",
            fontName=font,
            fontSize=12,
            leading=15,
            textColor=accent,
            spaceBefore=10,
            spaceAfter=4,
        )
        body_style = ParagraphStyle(
            name="ModBody",
            fontName=font,
            fontSize=9,
            leading=12,
            textColor=colors.HexColor("#1e293b"),
        )
        title_style = ParagraphStyle(
            name="ModTitle",
            fontName=font,
            fontSize=18,
            leading=22,
            textColor=accent,
            spaceAfter=6,
        )

        # Left Sidebar Flowables
        left_flowables = []
        personal = parsed.get("personal_info") or {}
        full_name = personal.get("full_name") or title
        left_flowables.append(Paragraph(f"<b>{_text(full_name)}</b>", left_heading))
        for key in ("email", "phone", "location", "linkedin", "website"):
            if personal.get(key):
                left_flowables.append(Paragraph(f"• {_text(personal[key])}", body_style))

        skills = parsed.get("skills") or []
        if skills:
            left_flowables.append(Spacer(1, 8))
            left_flowables.append(Paragraph("KỸ NĂNG", left_heading))
            for skill in skills:
                left_flowables.append(Paragraph(f"▪ {_text(skill)}", body_style))

        education = parsed.get("education") or []
        if education:
            left_flowables.append(Spacer(1, 8))
            left_flowables.append(Paragraph("HỌC VẤN", left_heading))
            for edu in education:
                if isinstance(edu, dict):
                    line = " — ".join(_text(v) for v in edu.values() if v)
                else:
                    line = _text(edu)
                left_flowables.append(Paragraph(f"• {line}", body_style))

        # Right Main Content Flowables
        right_flowables = [Paragraph(_text(title), title_style)]
        if parsed.get("summary"):
            right_flowables.append(Paragraph("TÓM TẮT THỰC THI", right_heading))
            right_flowables.append(Paragraph(_text(parsed["summary"]), body_style))

        experience = parsed.get("experience") or []
        if experience:
            right_flowables.append(Paragraph("KINH NGHIỆM LÀM VIỆC", right_heading))
            for item in experience:
                line = " — ".join(_text(v) for v in item.values() if v) if isinstance(item, dict) else _text(item)
                right_flowables.append(Paragraph(f"• {line}", body_style))

        projects = parsed.get("projects") or []
        if projects:
            right_flowables.append(Paragraph("DỰ ÁN NỔI BẬT", right_heading))
            for item in projects:
                line = " — ".join(_text(v) for v in item.values() if v) if isinstance(item, dict) else _text(item)
                right_flowables.append(Paragraph(f"• {line}", body_style))

        if accepted_suggestions:
            right_flowables.append(Paragraph("NỘI DUNG TỐI ƯU ĐÃ XÁC NHẬN", right_heading))
            for sug in accepted_suggestions:
                right_flowables.append(Paragraph(f"✓ {_text(sug)}", body_style))

        # Build 2-Column Table
        col_widths = [65 * mm, 118 * mm]
        layout_table = Table(
            [[left_flowables, right_flowables]],
            colWidths=col_widths,
        )
        layout_table.setStyle(
            TableStyle([
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BACKGROUND", (0, 0), (0, 0), sidebar_bg),
                ("PADDING", (0, 0), (0, 0), 8),
                ("LINERIGHT", (0, 0), (0, 0), 1, colors.HexColor("#e2e8f0")),
            ])
        )
        document.build([layout_table])

    elif template_name in ("compact", "creative"):
        # ===== TEMPLATE 3: TECH MINIMALIST / CREATIVE TIMELINE =====
        accent = colors.HexColor("#0d9488")
        dark_header_bg = colors.HexColor("#0f172a")

        document = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=14 * mm,
            leftMargin=14 * mm,
            topMargin=14 * mm,
            bottomMargin=14 * mm,
            title=title,
        )

        title_style = ParagraphStyle(
            name="CreativeTitle",
            fontName=font,
            fontSize=18,
            leading=22,
            textColor=colors.white,
            alignment=TA_LEFT,
        )
        contact_style = ParagraphStyle(
            name="CreativeContact",
            fontName=font,
            fontSize=9,
            leading=12,
            textColor=colors.HexColor("#94a3b8"),
            alignment=TA_LEFT,
        )
        heading_style = ParagraphStyle(
            name="CreativeHeading",
            fontName=font,
            fontSize=11,
            leading=14,
            textColor=accent,
            spaceBefore=10,
            spaceAfter=4,
        )
        body_style = ParagraphStyle(
            name="CreativeBody",
            fontName=font,
            fontSize=9,
            leading=13,
            textColor=colors.HexColor("#1e293b"),
        )

        story = []
        personal = parsed.get("personal_info") or {}
        contact_parts = [_text(val) for val in personal.values() if val]
        header_table = Table(
            [[
                Paragraph(f"<b>{_text(title)}</b>", title_style),
                Paragraph(" | ".join(contact_parts[:3]), contact_style),
            ]],
            colWidths=[110 * mm, 72 * mm],
        )
        header_table.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), dark_header_bg),
                ("PADDING", (0, 0), (-1, -1), 10),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ])
        )
        story.extend([header_table, Spacer(1, 10)])

        sections = (
            ("🚀 MỤC TIÊU NGHỀ NGHIỆP", parsed.get("summary") or ""),
            ("⚡ KỸ NĂNG CÔNG NGHIỆP", ", ".join(parsed.get("skills") or [])),
            ("🛠️ DỰ ÁN & SẢN PHẨM", parsed.get("projects") or []),
            ("💼 KINH NGHIỆM LÀM VIỆC", parsed.get("experience") or []),
            ("🎓 HỌC VẤN & BẰNG CẤP", parsed.get("education") or []),
        )
        for heading, value in sections:
            if not value:
                continue
            story.append(Paragraph(heading, heading_style))
            story.append(HRFlowable(width="100%", thickness=1, color=accent, spaceBefore=2, spaceAfter=6))
            items = value if isinstance(value, list) else [value]
            for item in items:
                line = " — ".join(_text(part) for part in item.values() if part) if isinstance(item, dict) else _text(item)
                if line:
                    story.append(Paragraph(f"▪ {line}", body_style))

        if accepted_suggestions:
            story.append(Paragraph("✦ NỘI DUNG ATS ĐÃ TỐI ƯU", heading_style))
            story.append(HRFlowable(width="100%", thickness=1, color=accent, spaceBefore=2, spaceAfter=6))
            for suggestion in accepted_suggestions:
                story.append(Paragraph(f"✓ {_text(suggestion)}", body_style))

        document.build(story)

    else:
        # ===== TEMPLATE 2: CLASSIC ATS SINGLE-COLUMN (DEFAULT) =====
        accent = colors.HexColor("#1f2937")
        document = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=18 * mm,
            leftMargin=18 * mm,
            topMargin=16 * mm,
            bottomMargin=16 * mm,
            title=title,
        )

        title_style = ParagraphStyle(
            name="ClassicTitle",
            parent=styles["Title"],
            fontName=font,
            fontSize=20,
            textColor=accent,
            alignment=TA_CENTER,
            spaceAfter=4,
        )
        heading_style = ParagraphStyle(
            name="ClassicHeading",
            parent=styles["Heading2"],
            fontName=font,
            fontSize=11,
            textColor=accent,
            spaceBefore=10,
            spaceAfter=4,
        )
        body_style = ParagraphStyle(
            name="ClassicBody",
            parent=styles["BodyText"],
            fontName=font,
            fontSize=9.5,
            leading=13,
            textColor=colors.HexColor("#111827"),
        )

        story = [Paragraph(_text(title), title_style)]
        personal = parsed.get("personal_info") or {}
        contact = " · ".join(_text(value) for value in personal.values() if value)
        if contact:
            story.extend([Paragraph(contact, body_style), Spacer(1, 4)])

        sections = (
            ("TÓM TẮT THỰC THI", parsed.get("summary") or ""),
            ("KỸ NĂNG CHUYÊN MÔN", ", ".join(parsed.get("skills") or [])),
            ("KINH NGHIỆM LÀM VIỆC", parsed.get("experience") or []),
            ("DỰ ÁN NỔI BẬT", parsed.get("projects") or []),
            ("HỌC VẤN & BẰNG CẤP", parsed.get("education") or []),
        )
        for heading, value in sections:
            if not value:
                continue
            story.append(Paragraph(heading, heading_style))
            story.append(HRFlowable(width="100%", thickness=0.8, color=colors.HexColor("#9ca3af"), spaceBefore=2, spaceAfter=4))
            items = value if isinstance(value, list) else [value]
            for item in items:
                line = " — ".join(_text(part) for part in item.values() if part) if isinstance(item, dict) else _text(item)
                if line:
                    story.append(Paragraph(f"• {line}", body_style))

        if accepted_suggestions:
            story.append(Paragraph("NỘI DUNG TỐI ƯU ĐÃ XÁC NHẬN", heading_style))
            story.append(HRFlowable(width="100%", thickness=0.8, color=colors.HexColor("#9ca3af"), spaceBefore=2, spaceAfter=4))
            for suggestion in accepted_suggestions:
                story.append(Paragraph(f"• {_text(suggestion)}", body_style))

        document.build(story)

    return buffer.getvalue()
