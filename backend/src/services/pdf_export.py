import re
from copy import deepcopy
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


def _item_text(item: Any) -> str:
    if isinstance(item, dict):
        return " - ".join(_text(value) for value in item.values() if value)
    return _text(item)


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
    accepted_suggestions: list[str],
    template_name: str,
) -> bytes:
    """Tạo PDF CV phía server với 3 Template cấu trúc khác nhau (modern, classic, compact/creative)."""
    font = _font_name()
    buffer = BytesIO()

    styles = getSampleStyleSheet()

    if template_name == "modern":
        # ===== TEMPLATE 1: MODERN TWO-COLUMN TECH LAYOUT =====
        accent = colors.HexColor("#2563eb")
        sidebar_bg = colors.HexColor("#e0f2fe")

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
            textColor=colors.HexColor("#0369a1"),
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

        left_flowables = []
        personal = parsed.get("personal_info") or {}
        full_name = personal.get("full_name") or title
        left_flowables.extend(
            [
                Table([[_AvatarPlaceholder(28 * mm, colors.HexColor("#0284c7"))]], hAlign="CENTER"),
                Spacer(1, 8),
                Paragraph("THÔNG TIN", left_heading),
            ]
        )
        for key in ("email", "phone", "location", "linkedin", "website"):
            if personal.get(key):
                left_flowables.append(Paragraph(f"- {_text(personal[key])}", body_style))

        skills = parsed.get("skills") or []
        if skills:
            left_flowables.append(Spacer(1, 8))
            left_flowables.append(Paragraph("KỸ NĂNG", left_heading))
            for skill in skills:
                left_flowables.append(Paragraph(f"- {_text(skill)}", body_style))

        education = parsed.get("education") or []
        if education:
            left_flowables.append(Spacer(1, 8))
            left_flowables.append(Paragraph("HỌC VẤN", left_heading))
            for edu in education:
                if isinstance(edu, dict):
                    line = " - ".join(_text(v) for v in edu.values() if v)
                else:
                    line = _text(edu)
                left_flowables.append(Paragraph(f"- {line}", body_style))

        right_flowables = [
            Paragraph(_text(full_name), title_style),
            Paragraph(_text(parsed.get("headline") or title), body_style),
            HRFlowable(width="100%", thickness=2, color=accent, spaceBefore=7, spaceAfter=8),
        ]
        if parsed.get("summary"):
            right_flowables.append(Paragraph("MỤC TIÊU NGHỀ NGHIỆP", right_heading))
            right_flowables.append(Paragraph(_text(parsed["summary"]), body_style))

        experience = parsed.get("experience") or []
        if experience:
            right_flowables.append(Paragraph("KINH NGHIỆM LÀM VIỆC", right_heading))
            for item in experience:
                line = _item_text(item)
                right_flowables.append(Paragraph(f"- {line}", body_style))

        projects = parsed.get("projects") or []
        if projects:
            right_flowables.append(Paragraph("DỰ ÁN NỔI BẬT", right_heading))
            for item in projects:
                line = _item_text(item)
                right_flowables.append(Paragraph(f"- {line}", body_style))

        if accepted_suggestions:
            right_flowables.append(Paragraph("NỘI DUNG TỐI ƯU ĐÃ XÁC NHẬN", right_heading))
            for sug in accepted_suggestions:
                right_flowables.append(Paragraph(f"- {_text(sug)}", body_style))

        col_widths = [65 * mm, 118 * mm]
        layout_table = Table(
            [[left_flowables, right_flowables]],
            colWidths=col_widths,
        )
        layout_table.setStyle(
            TableStyle([
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BACKGROUND", (0, 0), (0, 0), sidebar_bg),
                ("LEFTPADDING", (0, 0), (0, 0), 12),
                ("RIGHTPADDING", (0, 0), (0, 0), 12),
                ("TOPPADDING", (0, 0), (0, 0), 14),
                ("BOTTOMPADDING", (0, 0), (0, 0), 14),
                ("LEFTPADDING", (1, 0), (1, 0), 12),
                ("RIGHTPADDING", (1, 0), (1, 0), 8),
                ("TOPPADDING", (1, 0), (1, 0), 14),
                ("BOTTOMPADDING", (1, 0), (1, 0), 14),
                ("LINERIGHT", (0, 0), (0, 0), 1, colors.HexColor("#e2e8f0")),
            ])
        )
        document.build([layout_table])

    elif template_name == "elegant":
        # ===== TEMPLATE 2: TOPCV SIGNATURE EMERALD PRO =====
        accent = colors.HexColor("#059669")
        sidebar_bg = colors.HexColor("#ecfdf5")

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
            name="EleLeftHeading",
            fontName=font,
            fontSize=11,
            leading=14,
            textColor=colors.HexColor("#047857"),
            spaceBefore=8,
            spaceAfter=4,
        )
        right_heading = ParagraphStyle(
            name="EleRightHeading",
            fontName=font,
            fontSize=12,
            leading=15,
            textColor=accent,
            spaceBefore=10,
            spaceAfter=4,
        )
        body_style = ParagraphStyle(
            name="EleBody",
            fontName=font,
            fontSize=9,
            leading=12.5,
            textColor=colors.HexColor("#1e293b"),
        )
        title_style = ParagraphStyle(
            name="EleTitle",
            fontName=font,
            fontSize=19,
            leading=23,
            textColor=accent,
            spaceAfter=5,
        )

        left_flowables = []
        personal = parsed.get("personal_info") or {}
        full_name = personal.get("full_name") or title
        left_flowables.extend(
            [
                Table([[_AvatarPlaceholder(28 * mm, colors.HexColor("#059669"))]], hAlign="CENTER"),
                Spacer(1, 8),
                Paragraph("LIÊN HỆ", left_heading),
            ]
        )
        for key in ("email", "phone", "location", "linkedin", "website"):
            if personal.get(key):
                left_flowables.append(Paragraph(f"• {_text(personal[key])}", body_style))

        skills = parsed.get("skills") or []
        if skills:
            left_flowables.append(Spacer(1, 8))
            left_flowables.append(Paragraph("KỸ NĂNG NỔI BẬT", left_heading))
            for skill in skills:
                left_flowables.append(Paragraph(f"✓ {_text(skill)}", body_style))

        education = parsed.get("education") or []
        if education:
            left_flowables.append(Spacer(1, 8))
            left_flowables.append(Paragraph("HỌC VẤN", left_heading))
            for edu in education:
                if isinstance(edu, dict):
                    line = " - ".join(_text(v) for v in edu.values() if v)
                else:
                    line = _text(edu)
                left_flowables.append(Paragraph(f"• {line}", body_style))

        right_flowables = [
            Paragraph(_text(full_name), title_style),
            Paragraph(_text(parsed.get("headline") or title), body_style),
            HRFlowable(width="100%", thickness=2, color=accent, spaceBefore=6, spaceAfter=8),
        ]
        if parsed.get("summary"):
            right_flowables.append(Paragraph("MỤC TIÊU NGHỀ NGHIỆP", right_heading))
            right_flowables.append(Paragraph(_text(parsed["summary"]), body_style))

        experience = parsed.get("experience") or []
        if experience:
            right_flowables.append(Paragraph("KINH NGHIỆM LÀM VIỆC", right_heading))
            for item in experience:
                line = _item_text(item)
                right_flowables.append(Paragraph(f"• {line}", body_style))

        projects = parsed.get("projects") or []
        if projects:
            right_flowables.append(Paragraph("DỰ ÁN NỔI BẬT", right_heading))
            for item in projects:
                line = _item_text(item)
                right_flowables.append(Paragraph(f"• {line}", body_style))

        if accepted_suggestions:
            right_flowables.append(Paragraph("NỘI DUNG TỐI ƯU ĐÃ XÁC NHẬN", right_heading))
            for sug in accepted_suggestions:
                right_flowables.append(Paragraph(f"• {_text(sug)}", body_style))

        col_widths = [65 * mm, 118 * mm]
        layout_table = Table(
            [[left_flowables, right_flowables]],
            colWidths=col_widths,
        )
        layout_table.setStyle(
            TableStyle([
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BACKGROUND", (0, 0), (0, 0), sidebar_bg),
                ("LEFTPADDING", (0, 0), (0, 0), 12),
                ("RIGHTPADDING", (0, 0), (0, 0), 12),
                ("TOPPADDING", (0, 0), (0, 0), 14),
                ("BOTTOMPADDING", (0, 0), (0, 0), 14),
                ("LEFTPADDING", (1, 0), (1, 0), 12),
                ("RIGHTPADDING", (1, 0), (1, 0), 8),
                ("TOPPADDING", (1, 0), (1, 0), 14),
                ("BOTTOMPADDING", (1, 0), (1, 0), 14),
                ("LINERIGHT", (0, 0), (0, 0), 1, colors.HexColor("#a7f3d0")),
            ])
        )
        document.build([layout_table])

    elif template_name == "creative":
        # ===== TEMPLATE 3: CREATIVE DARK HEADER & TIMELINE =====
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
        full_name = personal.get("full_name") or title
        contact_parts = [_text(val) for val in personal.values() if val]
        header_table = Table(
            [[
                [
                    Paragraph(f"<b>{_text(full_name)}</b>", title_style),
                    Paragraph(_text(parsed.get("headline") or title), contact_style),
                ],
                Paragraph(" | ".join(contact_parts[1:4]), contact_style),
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
        story.extend([header_table, Spacer(1, 8)])

        summary = parsed.get("summary") or ""
        if summary:
            story.extend(
                [
                    Paragraph("MỤC TIÊU NGHỀ NGHIỆP", heading_style),
                    HRFlowable(width="100%", thickness=1.2, color=accent, spaceBefore=2, spaceAfter=6),
                    Paragraph(_text(summary), body_style),
                ]
            )

        skills = parsed.get("skills") or []
        if skills:
            story.extend(
                [
                    Paragraph("KỸ NĂNG CÔNG NGHỆ", heading_style),
                    HRFlowable(width="100%", thickness=1.2, color=accent, spaceBefore=2, spaceAfter=7),
                    _SkillChips(skills, font, accent),
                    Spacer(1, 3),
                ]
            )

        timeline_sections = (
            ("KINH NGHIỆM LÀM VIỆC", parsed.get("experience") or []),
            ("DỰ ÁN & SẢN PHẨM", parsed.get("projects") or []),
            ("HỌC VẤN & BẰNG CẤP", parsed.get("education") or []),
        )
        for heading, items in timeline_sections:
            if not items:
                continue
            story.extend(
                [
                    Paragraph(heading, heading_style),
                    HRFlowable(width="100%", thickness=1.2, color=accent, spaceBefore=2, spaceAfter=5),
                    _timeline_table(items, body_style, accent),
                ]
            )

        if accepted_suggestions:
            story.append(Paragraph("NỘI DUNG ATS ĐÃ TỐI ƯU", heading_style))
            story.append(HRFlowable(width="100%", thickness=1, color=accent, spaceBefore=2, spaceAfter=6))
            for suggestion in accepted_suggestions:
                story.append(Paragraph(f"- {_text(suggestion)}", body_style))

        document.build(story)

    elif template_name == "compact":
        # ===== TEMPLATE 4: COMPACT 1-PAGE EXECUTIVE =====
        accent = colors.HexColor("#334155")
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

        personal = parsed.get("personal_info") or {}
        full_name = personal.get("full_name") or title
        contact = " | ".join(
            _text(value)
            for key, value in personal.items()
            if key != "full_name" and value
        )
        story = [
            Paragraph(f"<b>{_text(full_name)}</b>", title_style),
            Paragraph(contact, contact_style),
            HRFlowable(width="100%", thickness=1, color=accent, spaceBefore=4, spaceAfter=5),
        ]

        if parsed.get("summary"):
            story.append(Paragraph("TÓM TẮT NGHỀ NGHIỆP", heading_style))
            story.append(Paragraph(_text(parsed["summary"]), body_style))

        if parsed.get("skills"):
            story.append(Paragraph("KỸ NĂNG CHÍNH", heading_style))
            story.append(Paragraph(", ".join(parsed.get("skills") or []), body_style))

        sections = (
            ("KINH NGHIỆM", parsed.get("experience") or []),
            ("DỰ ÁN TIÊU BIỂU", parsed.get("projects") or []),
            ("HỌC VẤN & BẰNG CẤP", parsed.get("education") or []),
        )
        for heading, items in sections:
            if not items:
                continue
            story.append(Paragraph(heading, heading_style))
            for item in items:
                line = _item_text(item)
                if line:
                    story.append(Paragraph(f"• {line}", body_style))

        if accepted_suggestions:
            story.append(Paragraph("TỐI ƯU ATS", heading_style))
            for suggestion in accepted_suggestions:
                story.append(Paragraph(f"• {_text(suggestion)}", body_style))

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
        header_meta_style = ParagraphStyle(
            name="ClassicHeaderMeta",
            parent=body_style,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#475569"),
        )

        personal = parsed.get("personal_info") or {}
        full_name = personal.get("full_name") or title
        story = [Paragraph(_text(full_name), title_style)]
        headline = parsed.get("headline") or title
        if headline and headline != full_name:
            story.append(Paragraph(_text(headline), header_meta_style))
        contact = " | ".join(
            _text(value)
            for key, value in personal.items()
            if key != "full_name" and value
        )
        if contact:
            story.extend([Paragraph(contact, header_meta_style), Spacer(1, 4)])

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
                line = _item_text(item)
                if line:
                    story.append(Paragraph(f"- {line}", body_style))

        if accepted_suggestions:
            story.append(Paragraph("NỘI DUNG TỐI ƯU ĐÃ XÁC NHẬN", heading_style))
            story.append(HRFlowable(width="100%", thickness=0.8, color=colors.HexColor("#9ca3af"), spaceBefore=2, spaceAfter=4))
            for suggestion in accepted_suggestions:
                story.append(Paragraph(f"- {_text(suggestion)}", body_style))

        document.build(story)

    return buffer.getvalue()
