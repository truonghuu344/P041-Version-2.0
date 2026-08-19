import re
from copy import deepcopy
from html import escape
from io import BytesIO
from pathlib import Path
from typing import Any

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Flowable, HRFlowable, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


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


def _format_desc_bullets(desc: str) -> list[str]:
    """Tách đoạn văn bản mô tả hoặc học vấn thành các bullet point rõ ràng."""
    desc = str(desc or "").strip()
    if not desc:
        return []
    raw_lines = [line.strip() for line in desc.split("\n") if line.strip()]
    bullets: list[str] = []
    for line in raw_lines:
        sub_parts = re.split(
            r"(?<=[0-9.]|\))\s+(?=(?:Relevant Coursework|Coursework|Honors|Awards|Thesis|Key Courses|Core Modules|GPA|Cumulative GPA):)",
            line,
            flags=re.IGNORECASE,
        )
        for part in sub_parts:
            p = part.strip().rstrip(".")
            if p:
                if p.startswith("•") or p.startswith("-"):
                    bullets.append(f"• {_text(p.lstrip('•- '))}")
                else:
                    bullets.append(f"• {_text(p)}")
    return bullets


def _item_text(item: Any, title_color: str = "#0f172a") -> str:
    if isinstance(item, str):
        return _text(item)
    if not isinstance(item, dict):
        return _text(str(item))

    title = str(item.get("title") or item.get("name") or item.get("position") or item.get("degree") or item.get("school") or item.get("company") or "").strip()
    subtitle = str(item.get("company") or item.get("organization") or item.get("school") or item.get("role") or "").strip()
    period = str(item.get("period") or item.get("time") or item.get("date") or "").strip()
    desc = str(item.get("description") or item.get("summary") or item.get("details") or "").strip()
    bullets = item.get("bullets")

    lines: list[str] = []

    # Dòng 1: Tiêu đề in đậm nổi bật
    if title:
        lines.append(f"<font color='{title_color}'><b>{_text(title)}</b></font>")

    # Dòng 2: Cơ quan / Trường học (in nghiêng) + Thời gian
    sub_parts = []
    if subtitle and subtitle.lower() != title.lower():
        sub_parts.append(f"<i>{_text(subtitle)}</i>")
    if period:
        sub_parts.append(f"<font color='#64748b' size='8'>({_text(period)})</font>")
    if sub_parts:
        lines.append(" · ".join(sub_parts))

    # Dòng 3+: Danh sách bullet points
    if bullets and isinstance(bullets, list) and len(bullets) > 0:
        for b in bullets:
            b_str = str(b).strip()
            if b_str:
                lines.append(f"• {_text(b_str.lstrip('•- '))}")
    elif desc:
        desc_bullets = _format_desc_bullets(desc)
        lines.extend(desc_bullets)

    if lines:
        return "<br/>".join(lines)

    # Fallback cho generic dictionary
    seen = set()
    parts = []
    for k, v in item.items():
        if k.startswith("_") or not v:
            continue
        v_str = str(v).strip()
        if v_str and v_str not in seen:
            seen.add(v_str)
            parts.append(_text(v_str))
    return " · ".join(parts)


class _AvatarPlaceholder(Flowable):
    def __init__(self, size: float, accent: colors.Color) -> None:
        super().__init__()
        self.width = size
        self.height = size
        self.accent = accent

    def draw(self) -> None:
        canvas = self.canv
        canvas.saveState()
        canvas.setFillColor(colors.white)
        canvas.circle(self.width / 2, self.height / 2, self.width / 2, fill=1, stroke=0)
        canvas.setFillColor(self.accent)
        canvas.circle(self.width / 2, self.height * 0.62, self.width * 0.15, fill=1, stroke=0)
        canvas.roundRect(
            self.width * 0.22,
            self.height * 0.18,
            self.width * 0.56,
            self.height * 0.25,
            self.width * 0.12,
            fill=1,
            stroke=0,
        )
        canvas.restoreState()


class _SkillChips(Flowable):
    def __init__(self, skills: list[str], font: str, accent: colors.Color) -> None:
        super().__init__()
        self.skills = [str(skill).strip() for skill in skills if str(skill).strip()]
        self.font = font
        self.accent = accent
        self._positions: list[tuple[float, float, float, str]] = []

    def wrap(self, avail_width: float, _avail_height: float) -> tuple[float, float]:
        font_size = 8
        chip_height = 18
        gap = 6
        x = 0.0
        y = 0.0
        self._positions = []
        for label in self.skills:
            width = min(avail_width, pdfmetrics.stringWidth(label, self.font, font_size) + 18)
            if x and x + width > avail_width:
                x = 0
                y += chip_height + gap
            self._positions.append((x, y, width, label))
            x += width + gap
        self.width = avail_width
        self.height = y + chip_height if self._positions else 0
        return self.width, self.height

    def draw(self) -> None:
        canvas = self.canv
        canvas.saveState()
        canvas.setFont(self.font, 8)
        for x, y_from_top, width, label in self._positions:
            y = self.height - y_from_top - 18
            canvas.setFillColor(colors.HexColor("#ccfbf1"))
            canvas.setStrokeColor(colors.HexColor("#5eead4"))
            canvas.roundRect(x, y, width, 18, 9, fill=1, stroke=1)
            canvas.setFillColor(self.accent)
            canvas.drawCentredString(x + width / 2, y + 5.2, label)
        canvas.restoreState()


def _timeline_table(items: list[Any], body_style: ParagraphStyle, accent: colors.Color) -> Table:
    rows = [
        [Paragraph("●", body_style), Paragraph(_item_text(item), body_style)]
        for item in items
        if _item_text(item)
    ]
    table = Table(rows, colWidths=[8 * mm, 164 * mm], hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TEXTCOLOR", (0, 0), (0, -1), accent),
                ("LINEBEFORE", (0, 0), (0, -1), 1.4, accent),
                ("LEFTPADDING", (0, 0), (0, -1), 0),
                ("RIGHTPADDING", (0, 0), (0, -1), 4),
                ("LEFTPADDING", (1, 0), (1, -1), 5),
                ("RIGHTPADDING", (1, 0), (1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    return table


def apply_accepted_rewrites(
    parsed: dict[str, Any], replacements: list[tuple[str, str]]
) -> tuple[dict[str, Any], list[str]]:
    """Apply approved before/after pairs to an export copy; the stored CV remains immutable."""
    exported = deepcopy(parsed)
    applied = [False] * len(replacements)

    def rewrite(value: Any) -> Any:
        if isinstance(value, dict):
            return {key: rewrite(item) for key, item in value.items()}
        if isinstance(value, list):
            return [rewrite(item) for item in value]
        if not isinstance(value, str):
            return value
        result = value
        for index, (original, optimized) in enumerate(replacements):
            if not original or not optimized:
                continue
            updated, count = re.subn(re.escape(original), lambda _: optimized, result, flags=re.IGNORECASE)
            if count:
                result = updated
                applied[index] = True
        return result

    exported = rewrite(exported)
    unmatched = [optimized for index, (_, optimized) in enumerate(replacements) if not applied[index]]
    return exported, unmatched


def build_cv_pdf(
    *,
    title: str,
    parsed: dict[str, Any],
    accepted_suggestions: list[str] | None = None,
    template_name: str = "classic",
) -> bytes:
    """Tạo PDF CV phía server với 5 Template chuẩn ATS."""
    font = _font_name()
    buffer = BytesIO()

    personal = parsed.get("personal_info") or {}
    full_name = personal.get("full_name") or title
    clean_headline = str(parsed.get("headline") or "")
    if clean_headline.startswith("CV ") or "tối ưu theo" in clean_headline:
        clean_headline = ""

    if template_name == "modern":
        # ===== TEMPLATE 1: MODERN TECH PRO (2-COLUMN TEAL/BLUE) =====
        accent = colors.HexColor("#0284c7")
        sidebar_bg = colors.HexColor("#f0f9ff")

        document = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=10 * mm,
            leftMargin=10 * mm,
            topMargin=10 * mm,
            bottomMargin=10 * mm,
            title=title,
        )

        left_heading = ParagraphStyle(
            name="ModLeftHeading",
            fontName=font,
            fontSize=10,
            leading=13,
            textColor=accent,
            spaceBefore=6,
            spaceAfter=3,
        )
        right_heading = ParagraphStyle(
            name="ModRightHeading",
            fontName=font,
            fontSize=11,
            leading=14,
            textColor=accent,
            spaceBefore=8,
            spaceAfter=3,
        )
        body_style = ParagraphStyle(
            name="ModBody",
            fontName=font,
            fontSize=8.5,
            leading=11.5,
            textColor=colors.HexColor("#1e293b"),
        )
        title_style = ParagraphStyle(
            name="ModTitle",
            fontName=font,
            fontSize=17,
            leading=21,
            textColor=accent,
            spaceAfter=3,
        )

        left_flowables = [
            Table([[_AvatarPlaceholder(24 * mm, accent)]], hAlign="CENTER"),
            Spacer(1, 4),
            Paragraph("CONTACT", left_heading),
        ]
        for key in ("email", "phone", "location", "linkedin", "github", "website"):
            if personal.get(key):
                left_flowables.append(Paragraph(f"• {_text(personal[key])}", body_style))

        skills = parsed.get("skills") or []
        if skills:
            left_flowables.append(Spacer(1, 4))
            left_flowables.append(Paragraph("CORE SKILLS", left_heading))
            for i in range(0, min(14, len(skills)), 2):
                chunk = skills[i:i+2]
                left_flowables.append(Paragraph(" · ".join(f"<b>{_text(s)}</b>" for s in chunk), body_style))

        education = parsed.get("education") or []
        if education:
            left_flowables.append(Spacer(1, 4))
            left_flowables.append(Paragraph("EDUCATION", left_heading))
            for edu in education:
                left_flowables.append(Paragraph(_item_text(edu, title_color="#0284c7"), body_style))
                left_flowables.append(Spacer(1, 2))

        certifications = parsed.get("certifications") or []
        if certifications:
            left_flowables.append(Spacer(1, 4))
            left_flowables.append(Paragraph("CERTIFICATIONS", left_heading))
            for cert in certifications:
                left_flowables.append(Paragraph(_item_text(cert, title_color="#0284c7"), body_style))
                left_flowables.append(Spacer(1, 2))

        right_flowables = [
            Paragraph(f"<b>{_text(full_name)}</b>", title_style),
        ]
        if clean_headline:
            right_flowables.append(Paragraph(_text(clean_headline), body_style))
        right_flowables.append(HRFlowable(width="100%", thickness=1.5, color=accent, spaceBefore=4, spaceAfter=6))

        if parsed.get("summary"):
            right_flowables.append(Paragraph("PROFESSIONAL SUMMARY", right_heading))
            right_flowables.append(Paragraph(_text(parsed["summary"]), body_style))

        experience = parsed.get("experience") or []
        if experience:
            right_flowables.append(Paragraph("WORK EXPERIENCE", right_heading))
            for item in experience:
                right_flowables.append(Paragraph(_item_text(item, title_color="#0f172a"), body_style))
                right_flowables.append(Spacer(1, 2))

        projects = parsed.get("projects") or []
        if projects:
            right_flowables.append(Paragraph("FEATURED PROJECTS", right_heading))
            for item in projects:
                right_flowables.append(Paragraph(_item_text(item, title_color="#0f172a"), body_style))
                right_flowables.append(Spacer(1, 2))

        col_widths = [60 * mm, 126 * mm]
        layout_table = Table(
            [[left_flowables, right_flowables]],
            colWidths=col_widths,
        )
        layout_table.setStyle(
            TableStyle([
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BACKGROUND", (0, 0), (0, 0), sidebar_bg),
                ("LEFTPADDING", (0, 0), (0, 0), 8),
                ("RIGHTPADDING", (0, 0), (0, 0), 8),
                ("TOPPADDING", (0, 0), (0, 0), 8),
                ("BOTTOMPADDING", (0, 0), (0, 0), 8),
                ("LEFTPADDING", (1, 0), (1, 0), 10),
                ("RIGHTPADDING", (1, 0), (1, 0), 6),
                ("TOPPADDING", (1, 0), (1, 0), 8),
                ("BOTTOMPADDING", (1, 0), (1, 0), 8),
                ("LINERIGHT", (0, 0), (0, 0), 1, colors.HexColor("#bae6fd")),
            ])
        )
        document.build([layout_table])

    elif template_name == "elegant":
        # ===== TEMPLATE 5: ELEGANT EXECUTIVE (DEEP NAVY #1e3a8a & WARM GOLD #b45309) =====
        navy_accent = colors.HexColor("#1e3a8a")
        gold_accent = colors.HexColor("#b45309")
        sidebar_bg = colors.HexColor("#f8fafc")

        document = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=10 * mm,
            leftMargin=10 * mm,
            topMargin=10 * mm,
            bottomMargin=10 * mm,
            title=title,
        )

        title_style = ParagraphStyle(
            name="EleBannerTitle",
            fontName=font,
            fontSize=18,
            leading=22,
            textColor=colors.white,
            alignment=TA_LEFT,
        )
        banner_contact_style = ParagraphStyle(
            name="EleBannerContact",
            fontName=font,
            fontSize=8.5,
            leading=11.5,
            textColor=colors.HexColor("#fef3c7"),
            alignment=TA_LEFT,
        )
        left_heading = ParagraphStyle(
            name="EleLeftHeading",
            fontName=font,
            fontSize=10,
            leading=13,
            textColor=gold_accent,
            spaceBefore=6,
            spaceAfter=3,
        )
        right_heading = ParagraphStyle(
            name="EleRightHeading",
            fontName=font,
            fontSize=11,
            leading=14,
            textColor=navy_accent,
            spaceBefore=8,
            spaceAfter=3,
        )
        body_style = ParagraphStyle(
            name="EleBody",
            fontName=font,
            fontSize=8.5,
            leading=11.5,
            textColor=colors.HexColor("#1e293b"),
        )

        # Header Navy Banner with Gold divider
        contact_parts = []
        for key in ("email", "phone", "location", "linkedin", "github", "website"):
            if personal.get(key):
                contact_parts.append(_text(personal[key]))

        banner_content = [
            Paragraph(f"<b>{_text(full_name).upper()}</b>", title_style),
        ]
        if clean_headline:
            banner_content.append(Paragraph(_text(clean_headline), banner_contact_style))

        header_table = Table(
            [[
                banner_content,
                Paragraph(" | ".join(contact_parts[:3]), banner_contact_style),
            ]],
            colWidths=[110 * mm, 76 * mm],
        )
        header_table.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), navy_accent),
                ("PADDING", (0, 0), (-1, -1), 8),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ])
        )

        # Left Column: Skills, Education, Certifications
        left_flowables = [
            Spacer(1, 2),
            Paragraph("CORE SKILLS", left_heading),
            HRFlowable(width="100%", thickness=1, color=gold_accent, spaceBefore=1, spaceAfter=4),
        ]
        skills = parsed.get("skills") or []
        if skills:
            for i in range(0, min(14, len(skills)), 2):
                chunk = skills[i:i+2]
                left_flowables.append(Paragraph(" · ".join(f"<b>{_text(s)}</b>" for s in chunk), body_style))

        education = parsed.get("education") or []
        if education:
            left_flowables.append(Spacer(1, 4))
            left_flowables.append(Paragraph("EDUCATION", left_heading))
            left_flowables.append(HRFlowable(width="100%", thickness=1, color=gold_accent, spaceBefore=1, spaceAfter=4))
            for edu in education:
                left_flowables.append(Paragraph(_item_text(edu, title_color="#1e3a8a"), body_style))
                left_flowables.append(Spacer(1, 2))

        certifications = parsed.get("certifications") or []
        if certifications:
            left_flowables.append(Spacer(1, 4))
            left_flowables.append(Paragraph("CERTIFICATIONS", left_heading))
            left_flowables.append(HRFlowable(width="100%", thickness=1, color=gold_accent, spaceBefore=1, spaceAfter=4))
            for cert in certifications:
                left_flowables.append(Paragraph(_item_text(cert, title_color="#1e3a8a"), body_style))
                left_flowables.append(Spacer(1, 2))

        # Right Column: Summary, Experience, Projects
        right_flowables = []
        if parsed.get("summary"):
            right_flowables.append(Paragraph("PROFESSIONAL SUMMARY", right_heading))
            right_flowables.append(HRFlowable(width="100%", thickness=1, color=gold_accent, spaceBefore=1, spaceAfter=4))
            right_flowables.append(Paragraph(_text(parsed["summary"]), body_style))

        experience = parsed.get("experience") or []
        if experience:
            right_flowables.append(Paragraph("WORK EXPERIENCE", right_heading))
            right_flowables.append(HRFlowable(width="100%", thickness=1, color=gold_accent, spaceBefore=1, spaceAfter=4))
            for item in experience:
                right_flowables.append(Paragraph(_item_text(item, title_color="#1e3a8a"), body_style))
                right_flowables.append(Spacer(1, 2))

        projects = parsed.get("projects") or []
        if projects:
            right_flowables.append(Paragraph("FEATURED PROJECTS", right_heading))
            right_flowables.append(HRFlowable(width="100%", thickness=1, color=gold_accent, spaceBefore=1, spaceAfter=4))
            for item in projects:
                right_flowables.append(Paragraph(_item_text(item, title_color="#1e3a8a"), body_style))
                right_flowables.append(Spacer(1, 2))

        col_widths = [62 * mm, 124 * mm]
        layout_table = Table(
            [[left_flowables, right_flowables]],
            colWidths=col_widths,
        )
        layout_table.setStyle(
            TableStyle([
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BACKGROUND", (0, 0), (0, 0), sidebar_bg),
                ("LEFTPADDING", (0, 0), (0, 0), 8),
                ("RIGHTPADDING", (0, 0), (0, 0), 8),
                ("TOPPADDING", (0, 0), (0, 0), 6),
                ("BOTTOMPADDING", (0, 0), (0, 0), 6),
                ("LEFTPADDING", (1, 0), (1, 0), 10),
                ("RIGHTPADDING", (1, 0), (1, 0), 6),
                ("TOPPADDING", (1, 0), (1, 0), 6),
                ("BOTTOMPADDING", (1, 0), (1, 0), 6),
                ("LINERIGHT", (0, 0), (0, 0), 1, colors.HexColor("#fde68a")),
            ])
        )

        document.build([header_table, Spacer(1, 4), layout_table])

    elif template_name == "creative":
        # ===== TEMPLATE 3: CREATIVE DARK HEADER & TIMELINE =====
        accent = colors.HexColor("#0d9488")
        dark_header_bg = colors.HexColor("#0f172a")

        document = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=14 * mm,
            leftMargin=14 * mm,
            topMargin=12 * mm,
            bottomMargin=12 * mm,
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
            fontSize=8.5,
            leading=11.5,
            textColor=colors.HexColor("#94a3b8"),
            alignment=TA_LEFT,
        )
        heading_style = ParagraphStyle(
            name="CreativeHeading",
            fontName=font,
            fontSize=10.5,
            leading=13.5,
            textColor=accent,
            spaceBefore=8,
            spaceAfter=3,
        )
        body_style = ParagraphStyle(
            name="CreativeBody",
            fontName=font,
            fontSize=8.5,
            leading=12,
            textColor=colors.HexColor("#1e293b"),
        )

        contact_parts = []
        for key in ("email", "phone", "location", "linkedin", "github", "website"):
            if personal.get(key):
                contact_parts.append(_text(personal[key]))

        header_content = [
            Paragraph(f"<b>{_text(full_name)}</b>", title_style),
        ]
        if clean_headline:
            header_content.append(Paragraph(_text(clean_headline), contact_style))

        header_table = Table(
            [[
                header_content,
                Paragraph(" | ".join(contact_parts[:3]), contact_style),
            ]],
            colWidths=[110 * mm, 72 * mm],
        )
        header_table.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), dark_header_bg),
                ("PADDING", (0, 0), (-1, -1), 8),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ])
        )
        story = [header_table, Spacer(1, 6)]

        if parsed.get("summary"):
            story.extend([
                Paragraph("PROFESSIONAL SUMMARY", heading_style),
                HRFlowable(width="100%", thickness=1, color=accent, spaceBefore=1, spaceAfter=4),
                Paragraph(_text(parsed["summary"]), body_style),
            ])

        skills = parsed.get("skills") or []
        if skills:
            story.extend([
                Paragraph("TECHNICAL SKILLS", heading_style),
                HRFlowable(width="100%", thickness=1, color=accent, spaceBefore=1, spaceAfter=4),
                Paragraph(" • ".join(_text(s) for s in skills), body_style),
                Spacer(1, 2),
            ])

        projects = parsed.get("projects") or []
        if projects:
            story.extend([
                Paragraph("FEATURED PROJECTS", heading_style),
                HRFlowable(width="100%", thickness=1, color=accent, spaceBefore=1, spaceAfter=4),
                _timeline_table(projects, body_style, accent),
            ])

        experience = parsed.get("experience") or []
        if experience:
            story.extend([
                Paragraph("WORK EXPERIENCE", heading_style),
                HRFlowable(width="100%", thickness=1, color=accent, spaceBefore=1, spaceAfter=4),
                _timeline_table(experience, body_style, accent),
            ])

        education = parsed.get("education") or []
        if education:
            story.extend([
                Paragraph("EDUCATION", heading_style),
                HRFlowable(width="100%", thickness=1, color=accent, spaceBefore=1, spaceAfter=4),
                _timeline_table(education, body_style, accent),
            ])

        certifications = parsed.get("certifications") or []
        if certifications:
            story.extend([
                Paragraph("CERTIFICATIONS & ACTIVITIES", heading_style),
                HRFlowable(width="100%", thickness=1, color=accent, spaceBefore=1, spaceAfter=4),
                _timeline_table(certifications, body_style, accent),
            ])

        document.build(story)

    elif template_name == "compact":
        # ===== TEMPLATE 4: MINIMALIST COMPACT (1-PAGE EXECUTIVE) =====
        accent = colors.HexColor("#334155")
        document = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=12 * mm,
            leftMargin=12 * mm,
            topMargin=10 * mm,
            bottomMargin=10 * mm,
            title=title,
        )

        title_style = ParagraphStyle(
            name="CompactTitle",
            fontName=font,
            fontSize=16,
            leading=19,
            textColor=accent,
            alignment=TA_LEFT,
            spaceAfter=2,
        )
        heading_style = ParagraphStyle(
            name="CompactHeading",
            fontName=font,
            fontSize=10,
            leading=12,
            textColor=accent,
            spaceBefore=6,
            spaceAfter=2,
        )
        body_style = ParagraphStyle(
            name="CompactBody",
            fontName=font,
            fontSize=8.5,
            leading=11.5,
            textColor=colors.HexColor("#1e293b"),
        )
        contact_style = ParagraphStyle(
            name="CompactContact",
            fontName=font,
            fontSize=8.5,
            leading=11.5,
            textColor=colors.HexColor("#64748b"),
        )

        contact_parts = []
        for key in ("email", "phone", "location", "linkedin", "github", "website"):
            if personal.get(key):
                contact_parts.append(_text(personal[key]))

        story = [
            Paragraph(f"<b>{_text(full_name).upper()}</b>", title_style),
            Paragraph(" | ".join(contact_parts), contact_style),
            HRFlowable(width="100%", thickness=1, color=accent, spaceBefore=3, spaceAfter=4),
        ]

        if parsed.get("summary"):
            story.append(Paragraph("<b>SUMMARY</b>", heading_style))
            story.append(Paragraph(_text(parsed["summary"]), body_style))

        skills = parsed.get("skills") or []
        if skills:
            story.append(Paragraph("<b>SKILLS</b>", heading_style))
            story.append(Paragraph(" • ".join(_text(s) for s in skills), body_style))

        projects = parsed.get("projects") or []
        if projects:
            story.append(Paragraph("<b>PROJECTS</b>", heading_style))
            for item in projects:
                story.append(Paragraph(_item_text(item, title_color="#334155"), body_style))
                story.append(Spacer(1, 1.5))

        experience = parsed.get("experience") or []
        if experience:
            story.append(Paragraph("<b>EXPERIENCE</b>", heading_style))
            for item in experience:
                story.append(Paragraph(_item_text(item, title_color="#334155"), body_style))
                story.append(Spacer(1, 1.5))

        education = parsed.get("education") or []
        if education:
            story.append(Paragraph("<b>EDUCATION</b>", heading_style))
            for edu in education:
                story.append(Paragraph(_item_text(edu, title_color="#334155"), body_style))
                story.append(Spacer(1, 1.5))

        certifications = parsed.get("certifications") or []
        if certifications:
            story.append(Paragraph("<b>CERTIFICATIONS</b>", heading_style))
            for cert in certifications:
                story.append(Paragraph(_item_text(cert, title_color="#334155"), body_style))
                story.append(Spacer(1, 1.5))

        document.build(story)

    else:
        # ===== TEMPLATE 5: CLASSIC HARVARD ATS (1-COLUMN ATS 100%) =====
        accent = colors.HexColor("#0f172a")
        document = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=14 * mm,
            leftMargin=14 * mm,
            topMargin=12 * mm,
            bottomMargin=12 * mm,
            title=title,
        )

        name_style = ParagraphStyle(
            name="HarvardName",
            fontName=font,
            fontSize=18,
            leading=22,
            alignment=TA_CENTER,
            textColor=accent,
            spaceAfter=2,
        )
        contact_style = ParagraphStyle(
            name="HarvardContact",
            fontName=font,
            fontSize=8.5,
            leading=11.5,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#475569"),
            spaceAfter=5,
        )
        heading_style = ParagraphStyle(
            name="HarvardHeading",
            fontName=font,
            fontSize=10.5,
            leading=13.5,
            textColor=accent,
            spaceBefore=7,
            spaceAfter=2,
        )
        body_style = ParagraphStyle(
            name="HarvardBody",
            fontName=font,
            fontSize=8.5,
            leading=12,
            textColor=colors.HexColor("#1e293b"),
        )

        flowables = [
            Paragraph(f"<b>{_text(full_name).upper()}</b>", name_style),
        ]

        contact_parts = []
        for key in ("email", "phone", "location", "linkedin", "github", "website"):
            if personal.get(key):
                contact_parts.append(_text(personal[key]))
        if contact_parts:
            flowables.append(Paragraph(" • ".join(contact_parts), contact_style))

        flowables.append(HRFlowable(width="100%", thickness=1, color=accent, spaceBefore=2, spaceAfter=6))

        if parsed.get("summary"):
            flowables.append(Paragraph("<b>PROFESSIONAL SUMMARY</b>", heading_style))
            flowables.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#94a3b8"), spaceBefore=1, spaceAfter=3))
            flowables.append(Paragraph(_text(parsed["summary"]), body_style))

        education = parsed.get("education") or []
        if education:
            flowables.append(Paragraph("<b>EDUCATION</b>", heading_style))
            flowables.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#94a3b8"), spaceBefore=1, spaceAfter=3))
            for edu in education:
                flowables.append(Paragraph(_item_text(edu, title_color="#0f172a"), body_style))
                flowables.append(Spacer(1, 2))

        skills = parsed.get("skills") or []
        if skills:
            flowables.append(Paragraph("<b>TECHNICAL SKILLS</b>", heading_style))
            flowables.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#94a3b8"), spaceBefore=1, spaceAfter=3))
            flowables.append(Paragraph(" • ".join(_text(s) for s in skills), body_style))

        projects = parsed.get("projects") or []
        if projects:
            flowables.append(Paragraph("<b>FEATURED PROJECTS</b>", heading_style))
            flowables.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#94a3b8"), spaceBefore=1, spaceAfter=3))
            for item in projects:
                flowables.append(Paragraph(_item_text(item, title_color="#0f172a"), body_style))
                flowables.append(Spacer(1, 2))

        experience = parsed.get("experience") or []
        if experience:
            flowables.append(Paragraph("<b>WORK EXPERIENCE</b>", heading_style))
            flowables.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#94a3b8"), spaceBefore=1, spaceAfter=3))
            for item in experience:
                flowables.append(Paragraph(_item_text(item, title_color="#0f172a"), body_style))
                flowables.append(Spacer(1, 2))

        certifications = parsed.get("certifications") or []
        if certifications:
            flowables.append(Paragraph("<b>CERTIFICATIONS & ACTIVITIES</b>", heading_style))
            flowables.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#94a3b8"), spaceBefore=1, spaceAfter=3))
            for cert in certifications:
                flowables.append(Paragraph(_item_text(cert, title_color="#0f172a"), body_style))
                flowables.append(Spacer(1, 2))

        document.build(flowables)

    return buffer.getvalue()
