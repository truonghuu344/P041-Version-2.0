import re
from copy import deepcopy
from html import escape
from io import BytesIO
from pathlib import Path
from typing import Any

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Flowable, HRFlowable, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from src.services.cv_normalization import normalize_cv_data


def _font_name() -> str:
    candidates = (
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
        Path("C:/Windows/Fonts/arial.ttf"),
        Path("C:/Windows/Fonts/segoeui.ttf"),
    )
    for path in candidates:
        if path.exists():
            pdfmetrics.registerFont(TTFont("CareerUnicode", str(path)))
            return "CareerUnicode"
    return "Helvetica"


def _text(value: Any) -> str:
    return escape(str(value or "").strip()).replace("\n", "<br/>")


def _format_desc_bullets(desc: str) -> list[str]:
    """Tách đoạn văn bản mô tả hoặc học vấn thành các bullet point rõ ràng từng câu."""
    desc = str(desc or "").strip()
    if not desc:
        return []

    raw_lines = [line.strip() for line in desc.split("\n") if line.strip()]
    bullets: list[str] = []
    for line in raw_lines:
        if line.startswith("•") or line.startswith("-") or line.startswith("*"):
            cleaned = line.lstrip("•-* \t").strip()
            if cleaned:
                bullets.append(cleaned)
            continue

        sub_parts = re.split(
            r"(?<=[0-9.]|\))\s+(?=(?:Relevant Coursework|Coursework|Honors|Awards|Thesis|Key Courses|Core Modules|GPA|Cumulative GPA):)",
            line,
            flags=re.IGNORECASE,
        )
        for part in sub_parts:
            sentences = [
                s.strip()
                for s in re.split(r"(?<=[.!?])\s+(?=[A-Z0-9\u00C0-\u024F\u1EA0-\u1EF9])", part)
                if s.strip()
            ]
            if len(sentences) > 1:
                for s in sentences:
                    cleaned = s.lstrip("•-* \t").strip()
                    if cleaned:
                        bullets.append(cleaned)
            else:
                cleaned = part.lstrip("•-* \t").strip()
                if cleaned:
                    bullets.append(cleaned)
    return bullets


class _InitialsAvatar(Flowable):
    """Vẽ avatar dạng huy hiệu monogram chữ cái đầu chuyên nghiệp."""

    def __init__(self, size: float, name: str, bg_color: colors.Color, font: str) -> None:
        super().__init__()
        self.width = size
        self.height = size
        self.bg_color = bg_color
        self.font = font
        words = [w for w in (name or "").strip().split() if w]
        if len(words) >= 2:
            self.initials = (words[0][0] + words[-1][0]).upper()
        elif len(words) == 1:
            self.initials = words[0][:2].upper()
        else:
            self.initials = "CV"

    def draw(self) -> None:
        canvas = self.canv
        canvas.saveState()
        canvas.setFillColor(self.bg_color)
        canvas.circle(self.width / 2, self.height / 2, self.width / 2, fill=1, stroke=0)
        canvas.setFillColor(colors.white)
        canvas.setFont(self.font, self.width * 0.38)
        canvas.drawCentredString(self.width / 2, self.height * 0.36, self.initials)
        canvas.restoreState()


class _SkillChips(Flowable):
    """Vẽ huy hiệu kỹ năng dạng pills đẹp mắt chuẩn ATS."""

    def __init__(
        self,
        skills: list[str],
        font: str,
        accent: colors.Color,
        bg_color: colors.Color,
        border_color: colors.Color,
    ) -> None:
        super().__init__()
        self.skills = [str(skill).strip() for skill in skills if str(skill).strip()]
        self.font = font
        self.accent = accent
        self.bg_color = bg_color
        self.border_color = border_color
        self._positions: list[tuple[float, float, float, str]] = []

    def wrap(self, avail_width: float, _avail_height: float) -> tuple[float, float]:
        font_size = 7.5
        chip_height = 15
        gap_x = 5
        gap_y = 5
        x = 0.0
        y = 0.0
        self._positions = []
        for label in self.skills:
            width = min(avail_width, pdfmetrics.stringWidth(label, self.font, font_size) + 12)
            if x and x + width > avail_width:
                x = 0
                y += chip_height + gap_y
            self._positions.append((x, y, width, label))
            x += width + gap_x
        self.width = avail_width
        self.height = y + chip_height if self._positions else 0
        return self.width, self.height

    def draw(self) -> None:
        canvas = self.canv
        canvas.saveState()
        canvas.setFont(self.font, 7.5)
        for x, y_from_top, width, label in self._positions:
            y = self.height - y_from_top - 15
            canvas.setFillColor(self.bg_color)
            canvas.setStrokeColor(self.border_color)
            canvas.setLineWidth(0.8)
            canvas.roundRect(x, y, width, 15, 3.5, fill=1, stroke=1)
            canvas.setFillColor(self.accent)
            canvas.drawCentredString(x + width / 2, y + 4.2, label)
        canvas.restoreState()


def _render_section_entries(
    items: list[Any],
    *,
    font: str,
    title_color: str = "#0f172a",
    bullet_color: str = "#0d9488",
    font_size: float = 8.5,
    title_size: float = 9.5,
    left_indent: float = 12,
    hanging_indent: float = -8,
    timeline_marker: str | None = None,
) -> list[Flowable]:
    """Tạo flowable cho từng mục với tiêu đề rõ ràng và bullet point có hanging indent chuẩn."""
    flowables: list[Flowable] = []

    header_style = ParagraphStyle(
        name=f"EntHead_{title_color.replace('#', '')}_{title_size}",
        fontName=font,
        fontSize=title_size,
        leading=title_size * 1.25,
        textColor=colors.HexColor(title_color),
        spaceBefore=2,
        spaceAfter=1,
    )
    subtitle_style = ParagraphStyle(
        name=f"EntSub_{font_size}",
        fontName=font,
        fontSize=font_size,
        leading=font_size * 1.25,
        textColor=colors.HexColor("#475569"),
        spaceBefore=0,
        spaceAfter=1.5,
    )
    bullet_style = ParagraphStyle(
        name=f"EntBul_{font_size}_{int(left_indent)}",
        fontName=font,
        fontSize=font_size,
        leading=font_size * 1.35,
        leftIndent=left_indent,
        firstLineIndent=hanging_indent,
        textColor=colors.HexColor("#1e293b"),
        spaceBefore=0.8,
        spaceAfter=1.2,
    )

    for item in items:
        if isinstance(item, str):
            text_str = str(item).strip()
            if text_str:
                bullets = _format_desc_bullets(text_str)
                for b in bullets:
                    flowables.append(
                        Paragraph(
                            f"<font color='{bullet_color}'>•</font> {_text(b)}",
                            bullet_style,
                        )
                    )
            continue
        if not isinstance(item, dict):
            continue

        title = str(
            item.get("role")
            or item.get("position")
            or item.get("title")
            or item.get("degree")
            or item.get("name")
            or item.get("school")
            or item.get("company")
            or ""
        ).strip()

        subtitle = str(
            item.get("company")
            or item.get("organization")
            or item.get("school")
            or item.get("university")
            or item.get("institution")
            or item.get("issuer")
            or item.get("authority")
            or item.get("role")
            or ""
        ).strip()

        period = str(
            item.get("duration")
            or item.get("period")
            or item.get("time")
            or item.get("date")
            or item.get("year")
            or ""
        ).strip()
        if not period and (item.get("start_date") or item.get("end_date")):
            period = " - ".join(str(item.get(key)).strip() for key in ("start_date", "end_date") if item.get(key))

        desc = str(item.get("description") or item.get("summary") or item.get("details") or "").strip()
        raw_bullets = item.get("bullets") or []

        # 1. Header dòng tiêu đề (Title)
        marker_str = f"<font color='{bullet_color}'>{timeline_marker}</font> " if timeline_marker else ""
        if title:
            flowables.append(Paragraph(f"{marker_str}<b>{_text(title)}</b>", header_style))

        # 2. Subtitle (Tên công ty / Cơ quan + Thời gian)
        sub_parts = []
        if subtitle and subtitle.lower() != title.lower():
            sub_parts.append(f"<i>{_text(subtitle)}</i>")
        if period:
            sub_parts.append(f"<font color='#64748b' size='{font_size - 0.5}'>({_text(period)})</font>")
        if sub_parts:
            flowables.append(Paragraph(" · ".join(sub_parts), subtitle_style))

        # 3. Bullet points từng câu có lùi đầu dòng chuẩn ATS
        bullets: list[str] = []
        if raw_bullets and isinstance(raw_bullets, list):
            for b in raw_bullets:
                b_str = str(b).strip()
                if b_str:
                    bullets.extend(_format_desc_bullets(b_str))
        elif desc:
            bullets = _format_desc_bullets(desc)

        for b in bullets:
            b_clean = b.lstrip("•-* \t").strip()
            if b_clean:
                flowables.append(
                    Paragraph(
                        f"<font color='{bullet_color}'>•</font> {_text(b_clean)}",
                        bullet_style,
                    )
                )

        flowables.append(Spacer(1, 2.5))

    return flowables


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
    """Tạo PDF CV phía server với 5 Template bám sát trực quan thiết kế."""
    parsed = normalize_cv_data(parsed, title=title)
    font = _font_name()
    buffer = BytesIO()

    personal = parsed.get("personal_info") or {}
    full_name = personal.get("full_name") or title
    clean_headline = str(parsed.get("headline") or "")
    if clean_headline.startswith("CV ") or "tối ưu theo" in clean_headline:
        clean_headline = ""

    norm_template = str(template_name or "classic").strip().lower()

    if norm_template == "modern":
        # =========================================================================
        # TEMPLATE 1: MODERN TECH PRO (2-COLUMN TEAL & CLEAN SIDEBAR)
        # =========================================================================
        teal_accent = colors.HexColor("#0d9488")
        dark_teal = colors.HexColor("#0f766e")
        sidebar_bg = colors.HexColor("#f0fdfa")
        sidebar_border = colors.HexColor("#ccfbf1")

        document = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=8 * mm,
            leftMargin=8 * mm,
            topMargin=8 * mm,
            bottomMargin=8 * mm,
            title=title,
        )

        sidebar_heading = ParagraphStyle(
            name="ModSideHead",
            fontName=font,
            fontSize=9.5,
            leading=12.5,
            textColor=dark_teal,
            spaceBefore=6,
            spaceAfter=3,
        )
        main_heading = ParagraphStyle(
            name="ModMainHead",
            fontName=font,
            fontSize=11,
            leading=14,
            textColor=dark_teal,
            spaceBefore=7,
            spaceAfter=2,
        )
        body_style = ParagraphStyle(
            name="ModBody",
            fontName=font,
            fontSize=8.5,
            leading=11.8,
            textColor=colors.HexColor("#1e293b"),
        )
        sidebar_body = ParagraphStyle(
            name="ModSideBody",
            fontName=font,
            fontSize=8,
            leading=11,
            textColor=colors.HexColor("#334155"),
        )
        title_style = ParagraphStyle(
            name="ModTitle",
            fontName=font,
            fontSize=17,
            leading=21,
            textColor=dark_teal,
            spaceAfter=2,
        )
        headline_style = ParagraphStyle(
            name="ModHeadline",
            fontName=font,
            fontSize=9.5,
            leading=12.5,
            textColor=colors.HexColor("#64748b"),
            spaceAfter=4,
        )

        left_flowables = [
            Table([[_InitialsAvatar(24 * mm, full_name, dark_teal, font)]], hAlign="CENTER"),
            Spacer(1, 4),
            Paragraph("<b>THÔNG TIN LIÊN HỆ</b>", sidebar_heading),
            HRFlowable(width="100%", thickness=1, color=sidebar_border, spaceBefore=1, spaceAfter=4),
        ]
        for key in ("email", "phone", "location", "linkedin", "github", "website"):
            if personal.get(key):
                left_flowables.append(Paragraph(f"• {_text(personal[key])}", sidebar_body))

        skills = parsed.get("skills") or []
        if skills:
            left_flowables.append(Spacer(1, 5))
            left_flowables.append(Paragraph("<b>KỸ NĂNG CỐT LÕI</b>", sidebar_heading))
            left_flowables.append(HRFlowable(width="100%", thickness=1, color=sidebar_border, spaceBefore=1, spaceAfter=4))
            left_flowables.append(
                _SkillChips(
                    skills[:14],
                    font,
                    dark_teal,
                    colors.HexColor("#ccfbf1"),
                    colors.HexColor("#99f6e4"),
                )
            )

        education = parsed.get("education") or []
        if education:
            left_flowables.append(Spacer(1, 5))
            left_flowables.append(Paragraph("<b>HỌC VẤN</b>", sidebar_heading))
            left_flowables.append(HRFlowable(width="100%", thickness=1, color=sidebar_border, spaceBefore=1, spaceAfter=4))
            left_flowables.extend(
                _render_section_entries(
                    education,
                    font=font,
                    title_color="#0f766e",
                    bullet_color="#0d9488",
                    font_size=8,
                    title_size=8.5,
                    left_indent=8,
                    hanging_indent=-6,
                )
            )

        certifications = parsed.get("certifications") or []
        if certifications:
            left_flowables.append(Spacer(1, 5))
            left_flowables.append(Paragraph("<b>CHỨNG CHỈ & GIẢI THƯỞNG</b>", sidebar_heading))
            left_flowables.append(HRFlowable(width="100%", thickness=1, color=sidebar_border, spaceBefore=1, spaceAfter=4))
            left_flowables.extend(
                _render_section_entries(
                    certifications,
                    font=font,
                    title_color="#0f766e",
                    bullet_color="#0d9488",
                    font_size=8,
                    title_size=8.5,
                    left_indent=8,
                    hanging_indent=-6,
                )
            )

        right_flowables = [
            Paragraph(f"<b>{_text(full_name).upper()}</b>", title_style),
        ]
        if clean_headline:
            right_flowables.append(Paragraph(_text(clean_headline), headline_style))
        right_flowables.append(HRFlowable(width="100%", thickness=1.5, color=teal_accent, spaceBefore=2, spaceAfter=5))

        if parsed.get("summary"):
            right_flowables.append(Paragraph("<b>TÓM TẮT CHUYÊN MÔN</b>", main_heading))
            right_flowables.append(Paragraph(_text(parsed["summary"]), body_style))
            right_flowables.append(Spacer(1, 2))

        experience = parsed.get("experience") or []
        if experience:
            right_flowables.append(Paragraph("<b>KINH NGHIỆM LÀM VIỆC</b>", main_heading))
            right_flowables.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#e2e8f0"), spaceBefore=1, spaceAfter=3))
            right_flowables.extend(
                _render_section_entries(
                    experience,
                    font=font,
                    title_color="#0f172a",
                    bullet_color="#0d9488",
                    font_size=8.5,
                    title_size=9.5,
                    left_indent=10,
                    hanging_indent=-7,
                )
            )

        projects = parsed.get("projects") or []
        if projects:
            right_flowables.append(Paragraph("<b>DỰ ÁN TIÊU BIỂU</b>", main_heading))
            right_flowables.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#e2e8f0"), spaceBefore=1, spaceAfter=3))
            right_flowables.extend(
                _render_section_entries(
                    projects,
                    font=font,
                    title_color="#0f172a",
                    bullet_color="#0d9488",
                    font_size=8.5,
                    title_size=9.5,
                    left_indent=10,
                    hanging_indent=-7,
                )
            )

        col_widths = [62 * mm, 130 * mm]
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
                ("LINERIGHT", (0, 0), (0, 0), 1, sidebar_border),
            ])
        )
        document.build([layout_table])

    elif norm_template == "creative":
        # =========================================================================
        # TEMPLATE 2: CREATIVE DARK TIMELINE (DARK BANNER & INTEGRATED TIMELINE)
        # =========================================================================
        dark_header_bg = colors.HexColor("#0f172a")
        teal_accent = colors.HexColor("#0d9488")

        document = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=10 * mm,
            leftMargin=10 * mm,
            topMargin=10 * mm,
            bottomMargin=10 * mm,
            title=title,
        )

        banner_title_style = ParagraphStyle(
            name="CreBannerTitle",
            fontName=font,
            fontSize=17,
            leading=21,
            textColor=colors.white,
            alignment=TA_LEFT,
        )
        banner_contact_style = ParagraphStyle(
            name="CreBannerContact",
            fontName=font,
            fontSize=8,
            leading=11.5,
            textColor=colors.HexColor("#cbd5e1"),
            alignment=TA_RIGHT,
        )
        heading_style = ParagraphStyle(
            name="CreHeading",
            fontName=font,
            fontSize=10.5,
            leading=13.5,
            textColor=teal_accent,
            spaceBefore=7,
            spaceAfter=2,
        )
        body_style = ParagraphStyle(
            name="CreBody",
            fontName=font,
            fontSize=8.5,
            leading=11.8,
            textColor=colors.HexColor("#1e293b"),
        )

        contact_parts = []
        for key in ("email", "phone", "location", "linkedin", "github", "website"):
            if personal.get(key):
                contact_parts.append(_text(personal[key]))

        banner_left = [Paragraph(f"<b>{_text(full_name).upper()}</b>", banner_title_style)]
        if clean_headline:
            banner_left.append(Paragraph(f"<font color='#5eead4'>{_text(clean_headline)}</font>", body_style))

        banner_right = [Paragraph("<br/>".join(contact_parts[:3]), banner_contact_style)]

        header_table = Table(
            [[banner_left, banner_right]],
            colWidths=[114 * mm, 76 * mm],
        )
        header_table.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), dark_header_bg),
                ("PADDING", (0, 0), (-1, -1), 9),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ])
        )

        story = [header_table, Spacer(1, 4)]

        if parsed.get("summary"):
            story.extend([
                Paragraph("<b>TÓM TẮT NĂNG LỰC</b>", heading_style),
                HRFlowable(width="100%", thickness=1, color=teal_accent, spaceBefore=1, spaceAfter=4),
                Paragraph(_text(parsed["summary"]), body_style),
                Spacer(1, 2),
            ])

        skills = parsed.get("skills") or []
        if skills:
            story.extend([
                Paragraph("<b>KỸ NĂNG CHUYÊN MÔN</b>", heading_style),
                HRFlowable(width="100%", thickness=1, color=teal_accent, spaceBefore=1, spaceAfter=4),
                _SkillChips(
                    skills[:18],
                    font,
                    colors.HexColor("#0f766e"),
                    colors.HexColor("#f0fdfa"),
                    colors.HexColor("#99f6e4"),
                ),
                Spacer(1, 4),
            ])

        experience = parsed.get("experience") or []
        if experience:
            story.append(Paragraph("<b>KINH NGHIỆM LÀM VIỆC</b>", heading_style))
            story.append(HRFlowable(width="100%", thickness=1, color=teal_accent, spaceBefore=1, spaceAfter=4))
            story.extend(
                _render_section_entries(
                    experience,
                    font=font,
                    title_color="#0f172a",
                    bullet_color="#0d9488",
                    font_size=8.5,
                    title_size=9.5,
                    left_indent=12,
                    hanging_indent=-8,
                    timeline_marker="●",
                )
            )

        projects = parsed.get("projects") or []
        if projects:
            story.append(Paragraph("<b>DỰ ÁN TIÊU BIỂU</b>", heading_style))
            story.append(HRFlowable(width="100%", thickness=1, color=teal_accent, spaceBefore=1, spaceAfter=4))
            story.extend(
                _render_section_entries(
                    projects,
                    font=font,
                    title_color="#0f172a",
                    bullet_color="#0d9488",
                    font_size=8.5,
                    title_size=9.5,
                    left_indent=12,
                    hanging_indent=-8,
                    timeline_marker="●",
                )
            )

        education = parsed.get("education") or []
        if education:
            story.append(Paragraph("<b>HỌC VẤN & BẰNG CẤP</b>", heading_style))
            story.append(HRFlowable(width="100%", thickness=1, color=teal_accent, spaceBefore=1, spaceAfter=4))
            story.extend(
                _render_section_entries(
                    education,
                    font=font,
                    title_color="#0f172a",
                    bullet_color="#0d9488",
                    font_size=8.5,
                    title_size=9.5,
                    left_indent=12,
                    hanging_indent=-8,
                    timeline_marker="●",
                )
            )

        certifications = parsed.get("certifications") or []
        if certifications:
            story.append(Paragraph("<b>CHỨNG CHỈ & HOẠT ĐỘNG</b>", heading_style))
            story.append(HRFlowable(width="100%", thickness=1, color=teal_accent, spaceBefore=1, spaceAfter=4))
            story.extend(
                _render_section_entries(
                    certifications,
                    font=font,
                    title_color="#0f172a",
                    bullet_color="#0d9488",
                    font_size=8.5,
                    title_size=9.5,
                    left_indent=12,
                    hanging_indent=-8,
                    timeline_marker="●",
                )
            )

        document.build(story)

    elif norm_template == "elegant":
        # =========================================================================
        # TEMPLATE 3: ELEGANT EXECUTIVE (DEEP NAVY & WARM GOLD DIVIDERS)
        # =========================================================================
        navy_accent = colors.HexColor("#1e3a8a")
        gold_accent = colors.HexColor("#b45309")
        sidebar_bg = colors.HexColor("#f8fafc")

        document = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=8 * mm,
            leftMargin=8 * mm,
            topMargin=8 * mm,
            bottomMargin=8 * mm,
            title=title,
        )

        title_style = ParagraphStyle(
            name="EleBannerTitle",
            fontName=font,
            fontSize=17,
            leading=21,
            textColor=colors.white,
            alignment=TA_LEFT,
        )
        banner_contact_style = ParagraphStyle(
            name="EleBannerContact",
            fontName=font,
            fontSize=8,
            leading=11,
            textColor=colors.HexColor("#fef3c7"),
            alignment=TA_RIGHT,
        )
        left_heading = ParagraphStyle(
            name="EleLeftHeading",
            fontName=font,
            fontSize=9.5,
            leading=12.5,
            textColor=gold_accent,
            spaceBefore=6,
            spaceAfter=2,
        )
        right_heading = ParagraphStyle(
            name="EleRightHeading",
            fontName=font,
            fontSize=11,
            leading=14,
            textColor=navy_accent,
            spaceBefore=7,
            spaceAfter=2,
        )
        body_style = ParagraphStyle(
            name="EleBody",
            fontName=font,
            fontSize=8.5,
            leading=11.8,
            textColor=colors.HexColor("#1e293b"),
        )
        sidebar_body = ParagraphStyle(
            name="EleSideBody",
            fontName=font,
            fontSize=8,
            leading=11,
            textColor=colors.HexColor("#334155"),
        )

        contact_parts = []
        for key in ("email", "phone", "location", "linkedin", "github", "website"):
            if personal.get(key):
                contact_parts.append(_text(personal[key]))

        banner_left = [Paragraph(f"<b>{_text(full_name).upper()}</b>", title_style)]
        if clean_headline:
            banner_left.append(Paragraph(_text(clean_headline), banner_contact_style))

        header_table = Table(
            [[banner_left, Paragraph("<br/>".join(contact_parts[:3]), banner_contact_style)]],
            colWidths=[116 * mm, 76 * mm],
        )
        header_table.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), navy_accent),
                ("PADDING", (0, 0), (-1, -1), 9),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ])
        )

        left_flowables = [
            Spacer(1, 2),
            Paragraph("<b>KỸ NĂNG NỀN TẢNG</b>", left_heading),
            HRFlowable(width="100%", thickness=1, color=gold_accent, spaceBefore=1, spaceAfter=4),
        ]
        skills = parsed.get("skills") or []
        if skills:
            left_flowables.append(
                _SkillChips(
                    skills[:14],
                    font,
                    navy_accent,
                    colors.HexColor("#f1f5f9"),
                    colors.HexColor("#cbd5e1"),
                )
            )

        education = parsed.get("education") or []
        if education:
            left_flowables.append(Spacer(1, 5))
            left_flowables.append(Paragraph("<b>HỌC VẤN & BẰNG CẤP</b>", left_heading))
            left_flowables.append(HRFlowable(width="100%", thickness=1, color=gold_accent, spaceBefore=1, spaceAfter=4))
            left_flowables.extend(
                _render_section_entries(
                    education,
                    font=font,
                    title_color="#1e3a8a",
                    bullet_color="#b45309",
                    font_size=8,
                    title_size=8.5,
                    left_indent=8,
                    hanging_indent=-6,
                )
            )

        certifications = parsed.get("certifications") or []
        if certifications:
            left_flowables.append(Spacer(1, 5))
            left_flowables.append(Paragraph("<b>CHỨNG CHỈ & DANH HIỆU</b>", left_heading))
            left_flowables.append(HRFlowable(width="100%", thickness=1, color=gold_accent, spaceBefore=1, spaceAfter=4))
            left_flowables.extend(
                _render_section_entries(
                    certifications,
                    font=font,
                    title_color="#1e3a8a",
                    bullet_color="#b45309",
                    font_size=8,
                    title_size=8.5,
                    left_indent=8,
                    hanging_indent=-6,
                )
            )

        right_flowables = []
        if parsed.get("summary"):
            right_flowables.append(Paragraph("<b>TỔNG QUAN NĂNG LỰC</b>", right_heading))
            right_flowables.append(HRFlowable(width="100%", thickness=1, color=gold_accent, spaceBefore=1, spaceAfter=4))
            right_flowables.append(Paragraph(_text(parsed["summary"]), body_style))
            right_flowables.append(Spacer(1, 2))

        experience = parsed.get("experience") or []
        if experience:
            right_flowables.append(Paragraph("<b>KINH NGHIỆM LÀM VIỆC</b>", right_heading))
            right_flowables.append(HRFlowable(width="100%", thickness=1, color=gold_accent, spaceBefore=1, spaceAfter=4))
            right_flowables.extend(
                _render_section_entries(
                    experience,
                    font=font,
                    title_color="#1e3a8a",
                    bullet_color="#b45309",
                    font_size=8.5,
                    title_size=9.5,
                    left_indent=10,
                    hanging_indent=-7,
                )
            )

        projects = parsed.get("projects") or []
        if projects:
            right_flowables.append(Paragraph("<b>DỰ ÁN THỰC CHIẾN</b>", right_heading))
            right_flowables.append(HRFlowable(width="100%", thickness=1, color=gold_accent, spaceBefore=1, spaceAfter=4))
            right_flowables.extend(
                _render_section_entries(
                    projects,
                    font=font,
                    title_color="#1e3a8a",
                    bullet_color="#b45309",
                    font_size=8.5,
                    title_size=9.5,
                    left_indent=10,
                    hanging_indent=-7,
                )
            )

        col_widths = [62 * mm, 130 * mm]
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

    elif norm_template == "compact":
        # =========================================================================
        # TEMPLATE 4: MINIMALIST COMPACT (1-PAGE ULTRA-CLEAN ATS)
        # =========================================================================
        slate_accent = colors.HexColor("#334155")
        document = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=10 * mm,
            leftMargin=10 * mm,
            topMargin=8 * mm,
            bottomMargin=8 * mm,
            title=title,
        )

        title_style = ParagraphStyle(
            name="CompactTitle",
            fontName=font,
            fontSize=16,
            leading=19,
            textColor=slate_accent,
            alignment=TA_LEFT,
            spaceAfter=2,
        )
        heading_style = ParagraphStyle(
            name="CompactHeading",
            fontName=font,
            fontSize=9.5,
            leading=12,
            textColor=slate_accent,
            spaceBefore=5,
            spaceAfter=2,
        )
        body_style = ParagraphStyle(
            name="CompactBody",
            fontName=font,
            fontSize=8,
            leading=11,
            textColor=colors.HexColor("#1e293b"),
        )
        contact_style = ParagraphStyle(
            name="CompactContact",
            fontName=font,
            fontSize=8,
            leading=11,
            textColor=colors.HexColor("#64748b"),
        )

        contact_parts = []
        for key in ("email", "phone", "location", "linkedin", "github", "website"):
            if personal.get(key):
                contact_parts.append(_text(personal[key]))

        story = [
            Paragraph(f"<b>{_text(full_name).upper()}</b>", title_style),
            Paragraph(" | ".join(contact_parts), contact_style),
            HRFlowable(width="100%", thickness=1, color=slate_accent, spaceBefore=2, spaceAfter=4),
        ]

        if parsed.get("summary"):
            story.append(Paragraph("<b>TÓM TẮT BẢN THÂN</b>", heading_style))
            story.append(Paragraph(_text(parsed["summary"]), body_style))

        skills = parsed.get("skills") or []
        if skills:
            story.append(Paragraph("<b>KỸ NĂNG CHUYÊN MÔN</b>", heading_style))
            story.append(Paragraph(" • ".join(_text(s) for s in skills), body_style))

        experience = parsed.get("experience") or []
        if experience:
            story.append(Paragraph("<b>KINH NGHIỆM LÀM VIỆC</b>", heading_style))
            story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#cbd5e1"), spaceBefore=1, spaceAfter=3))
            story.extend(
                _render_section_entries(
                    experience,
                    font=font,
                    title_color="#334155",
                    bullet_color="#334155",
                    font_size=8,
                    title_size=8.5,
                    left_indent=8,
                    hanging_indent=-6,
                )
            )

        projects = parsed.get("projects") or []
        if projects:
            story.append(Paragraph("<b>DỰ ÁN TIÊU BIỂU</b>", heading_style))
            story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#cbd5e1"), spaceBefore=1, spaceAfter=3))
            story.extend(
                _render_section_entries(
                    projects,
                    font=font,
                    title_color="#334155",
                    bullet_color="#334155",
                    font_size=8,
                    title_size=8.5,
                    left_indent=8,
                    hanging_indent=-6,
                )
            )

        education = parsed.get("education") or []
        if education:
            story.append(Paragraph("<b>HỌC VẤN</b>", heading_style))
            story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#cbd5e1"), spaceBefore=1, spaceAfter=3))
            story.extend(
                _render_section_entries(
                    education,
                    font=font,
                    title_color="#334155",
                    bullet_color="#334155",
                    font_size=8,
                    title_size=8.5,
                    left_indent=8,
                    hanging_indent=-6,
                )
            )

        certifications = parsed.get("certifications") or []
        if certifications:
            story.append(Paragraph("<b>CHỨNG CHỈ & HOẠT ĐỘNG</b>", heading_style))
            story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#cbd5e1"), spaceBefore=1, spaceAfter=3))
            story.extend(
                _render_section_entries(
                    certifications,
                    font=font,
                    title_color="#334155",
                    bullet_color="#334155",
                    font_size=8,
                    title_size=8.5,
                    left_indent=8,
                    hanging_indent=-6,
                )
            )

        document.build(story)

    else:
        # =========================================================================
        # TEMPLATE 5: CLASSIC HARVARD ATS (1-COLUMN ATS 100% STANDARD)
        # =========================================================================
        accent = colors.HexColor("#0f172a")
        document = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=12 * mm,
            leftMargin=12 * mm,
            topMargin=10 * mm,
            bottomMargin=10 * mm,
            title=title,
        )

        name_style = ParagraphStyle(
            name="HarvardName",
            fontName=font,
            fontSize=17,
            leading=21,
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
            spaceAfter=4,
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
        if clean_headline:
            flowables.append(Paragraph(f"<font color='#475569'><b>{_text(clean_headline)}</b></font>", contact_style))

        contact_parts = []
        for key in ("email", "phone", "location", "linkedin", "github", "website"):
            if personal.get(key):
                contact_parts.append(_text(personal[key]))
        if contact_parts:
            flowables.append(Paragraph(" • ".join(contact_parts), contact_style))

        flowables.append(HRFlowable(width="100%", thickness=1.2, color=accent, spaceBefore=2, spaceAfter=5))

        if parsed.get("summary"):
            flowables.append(Paragraph("<b>PROFESSIONAL SUMMARY</b>", heading_style))
            flowables.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#94a3b8"), spaceBefore=1, spaceAfter=3))
            flowables.append(Paragraph(_text(parsed["summary"]), body_style))

        skills = parsed.get("skills") or []
        if skills:
            flowables.append(Paragraph("<b>TECHNICAL SKILLS</b>", heading_style))
            flowables.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#94a3b8"), spaceBefore=1, spaceAfter=3))
            flowables.append(Paragraph(" • ".join(_text(s) for s in skills), body_style))

        experience = parsed.get("experience") or []
        if experience:
            flowables.append(Paragraph("<b>WORK EXPERIENCE</b>", heading_style))
            flowables.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#94a3b8"), spaceBefore=1, spaceAfter=3))
            flowables.extend(
                _render_section_entries(
                    experience,
                    font=font,
                    title_color="#0f172a",
                    bullet_color="#0f172a",
                    font_size=8.5,
                    title_size=9.5,
                    left_indent=10,
                    hanging_indent=-7,
                )
            )

        projects = parsed.get("projects") or []
        if projects:
            flowables.append(Paragraph("<b>FEATURED PROJECTS</b>", heading_style))
            flowables.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#94a3b8"), spaceBefore=1, spaceAfter=3))
            flowables.extend(
                _render_section_entries(
                    projects,
                    font=font,
                    title_color="#0f172a",
                    bullet_color="#0f172a",
                    font_size=8.5,
                    title_size=9.5,
                    left_indent=10,
                    hanging_indent=-7,
                )
            )

        education = parsed.get("education") or []
        if education:
            flowables.append(Paragraph("<b>EDUCATION</b>", heading_style))
            flowables.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#94a3b8"), spaceBefore=1, spaceAfter=3))
            flowables.extend(
                _render_section_entries(
                    education,
                    font=font,
                    title_color="#0f172a",
                    bullet_color="#0f172a",
                    font_size=8.5,
                    title_size=9.5,
                    left_indent=10,
                    hanging_indent=-7,
                )
            )

        certifications = parsed.get("certifications") or []
        if certifications:
            flowables.append(Paragraph("<b>CERTIFICATIONS & ACTIVITIES</b>", heading_style))
            flowables.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#94a3b8"), spaceBefore=1, spaceAfter=3))
            flowables.extend(
                _render_section_entries(
                    certifications,
                    font=font,
                    title_color="#0f172a",
                    bullet_color="#0f172a",
                    font_size=8.5,
                    title_size=9.5,
                    left_indent=10,
                    hanging_indent=-7,
                )
            )

        document.build(flowables)

    return buffer.getvalue()


