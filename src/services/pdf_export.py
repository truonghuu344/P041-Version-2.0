from html import escape
from io import BytesIO
from pathlib import Path
from typing import Any

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer


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
    """Tạo PDF CV phía server; dữ liệu chỉ lấy từ CV và gợi ý đã được người dùng duyệt."""
    font = _font_name()
    palette = {
        "classic": colors.HexColor("#1f2937"),
        "modern": colors.HexColor("#2563eb"),
        "compact": colors.HexColor("#0f766e"),
    }
    accent = palette.get(template_name, palette["classic"])
    buffer = BytesIO()
    document = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=18 * mm,
        leftMargin=18 * mm,
        topMargin=16 * mm,
        bottomMargin=16 * mm,
        title=title,
    )
    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="CVTitle",
            parent=styles["Title"],
            fontName=font,
            fontSize=20,
            textColor=accent,
            alignment=TA_CENTER,
            spaceAfter=8,
        )
    )
    styles.add(
        ParagraphStyle(
            name="CVHeading",
            parent=styles["Heading2"],
            fontName=font,
            fontSize=11,
            textColor=accent,
            spaceBefore=8,
            spaceAfter=4,
        )
    )
    styles.add(
        ParagraphStyle(
            name="CVBody",
            parent=styles["BodyText"],
            fontName=font,
            fontSize=9.5,
            leading=13,
            textColor=colors.HexColor("#111827"),
        )
    )

    story = [Paragraph(_text(title), styles["CVTitle"])]
    personal = parsed.get("personal_info") or {}
    contact = " · ".join(_text(value) for value in personal.values() if value)
    if contact:
        story.extend([Paragraph(contact, styles["CVBody"]), Spacer(1, 4)])

    sections = (
        ("TÓM TẮT", parsed.get("summary") or ""),
        ("KỸ NĂNG", ", ".join(parsed.get("skills") or [])),
        ("KINH NGHIỆM", parsed.get("experience") or []),
        ("DỰ ÁN", parsed.get("projects") or []),
        ("HỌC VẤN", parsed.get("education") or []),
    )
    for heading, value in sections:
        if not value:
            continue
        story.append(Paragraph(heading, styles["CVHeading"]))
        items = value if isinstance(value, list) else [value]
        for item in items:
            if isinstance(item, dict):
                line = " — ".join(_text(part) for part in item.values() if part)
            else:
                line = _text(item)
            if line:
                story.append(Paragraph(f"• {line}", styles["CVBody"]))

    if accepted_suggestions:
        story.append(Paragraph("NỘI DUNG TỐI ƯU ĐÃ XÁC NHẬN", styles["CVHeading"]))
        for suggestion in accepted_suggestions:
            story.append(Paragraph(f"• {_text(suggestion)}", styles["CVBody"]))

    document.build(story)
    return buffer.getvalue()
