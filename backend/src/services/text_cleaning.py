"""Làm sạch văn bản JD/CV trích xuất từ PDF, DOCX và OCR.

Mục tiêu: dữ liệu đầu vào cho parser phải sạch trước khi trích xuất,
không bịa thêm nội dung. Mọi hàm ở đây chỉ sửa lỗi hiển thị (ký tự lỗi,
thiếu dấu ở từ khóa phổ biến) chứ không sinh câu chữ mới.
"""

from __future__ import annotations

import re
import unicodedata
from typing import Any

# Ký tự thay thế do decode sai (mojibake) xuất hiện dày đặc trong dữ liệu
# crawl/OCR. Chúng không mang thông tin nên xoá an toàn.
_REPLACEMENT_CHARS = re.compile(r"[\ufffd\u25a1]")

# Chuỗi mojibake UTF-8 đọc nhầm là Windows-1252 thường gặp trên bản tin VN.
_MOJIBAKE_MAP: tuple[tuple[str, str], ...] = (
    ("Ã¢â‚¬â€œ", "–"),
    ("Ã¢â‚¬â€", "—"),
    ("Ã¢â‚¬Ëœ", "'"),
    ("Ã¢â‚¬Ëœ", "'"),
    ("Ã¢â‚¬Å“", '"'),
    ("Ã¢â‚¬Â", '"'),
    ("Ã¢â‚¬", ""),
    ("ÃƒÂ", "à"),
    ("Ã‚", ""),
    ("â€™", "'"),
    ("â€˜", "'"),
    ("â€œ", '"'),
    ("â€\x9d", '"'),
    ("â€“", "–"),
    ("â€”", "—"),
    ("â€¢", "•"),
    ("Â ", " "),
)

# Từ khoá/headline JD tiếng Việt bị OCR mất dấu. Chỉ thay thế theo cụm
# nguyên từ, hai chiều có dấu/không dấu đều nhận diện được khi parse.
_DIACRITIC_PHRASES: tuple[tuple[str, str], ...] = (
    ("tuyen dung", "Tuyển dụng"),
    ("cong ty", "Công ty"),
    ("vi tri", "Vị trí"),
    ("mo ta cong viec", "Mô tả công việc"),
    ("trach nhiem", "Trách nhiệm"),
    ("nhiem vu", "Nhiệm vụ"),
    ("yeu cau cong viec", "Yêu cầu công việc"),
    ("yeu cau ung vien", "Yêu cầu ứng viên"),
    ("yeu cau", "Yêu cầu"),
    ("ky nang bat buoc", "Kỹ năng bắt buộc"),
    ("ky nang can co", "Kỹ năng cần có"),
    ("ky nang", "Kỹ năng"),
    ("quyen loi", "Quyền lợi"),
    ("che do dai ngo", "Chế độ đãi ngộ"),
    ("dai ngo", "Đãi ngộ"),
    ("han nop ho so", "Hạn nộp hồ sơ"),
    ("han nop", "Hạn nộp"),
    ("ho so", "hồ sơ"),
    ("kinh nghiem", "Kinh nghiệm"),
    ("hoc van", "Học vấn"),
    ("tot nghiep", "tốt nghiệp"),
    ("dia diem", "Địa điểm"),
    ("muc luong", "Mức lương"),
    ("luong", "lương"),
    ("so luong", "Số lượng"),
    ("lien he", "Liên hệ"),
    ("ung vien", "ứng viên"),
    ("cong viec", "công việc"),
    ("phat trien", "phát triển"),
    ("xay dung", "xây dựng"),
    ("thiet ke", "thiết kế"),
    ("toi uu", "tối ưu"),
    ("thanh thao", "Thành thạo"),
    ("lam viec", "làm việc"),
)

# Địa danh: chỉ nhận dạng khi cả cụm đứng một mình để tránh đổi tên riêng lạ.
_LOCATION_PHRASES: tuple[tuple[str, str], ...] = (
    ("ha noi", "Hà Nội"),
    ("ho chi minh", "TP. Hồ Chí Minh"),
    ("tp hcm", "TP. Hồ Chí Minh"),
    ("da nang", "Đà Nẵng"),
    ("hai phong", "Hải Phòng"),
    ("can tho", "Cần Thơ"),
    ("binh duong", "Bình Dương"),
    ("quy nhon", "Quy Nhơn"),
    ("vung tau", "Vũng Tàu"),
    ("khanh hoa", "Khánh Hòa"),
)


def repair_mojibake(text: str) -> str:
    """Xoá ký tự lỗi và sửa lại các chuỗi encode sai phổ biến."""
    cleaned = _REPLACEMENT_CHARS.sub("", text or "")
    for bad, good in _MOJIBAKE_MAP:
        if bad in cleaned:
            cleaned = cleaned.replace(bad, good)
    return cleaned


def normalize_spaces(text: str) -> str:
    """Chuẩn hoá khoảng trắng nhưng giữ cấu trúc dòng."""
    lines = []
    for line in (text or "").splitlines():
        collapsed = re.sub(r"[ \t]{2,}", " ", line).strip()
        if collapsed:
            lines.append(collapsed)
    return "\n".join(lines)


def restore_diacritics(text: str) -> str:
    """Khôi phục dấu cho các cụm từ khóa/tiêu đề JD phổ biến bị OCR mất dấu.

    Chỉ áp dụng cho chuỗi thuần ASCII (chữ không dấu). Nếu dòng đã có dấu
    tiếng Việt thì giữ nguyên để không phá nội dung gốc.
    """
    result = text or ""
    for phrase, restored in (*_DIACRITIC_PHRASES, *_LOCATION_PHRASES):
        # Biên từ thoải mái (khoảng trắng/gạch đầu dòng) vì OCR hay dính dấu câu.
        pattern = rf"(?<![A-Za-zÀ-ỹ]){re.escape(phrase)}(?![A-Za-zÀ-ỹ])"
        result = re.sub(pattern, restored, result, flags=re.IGNORECASE)
    return result


def strip_contact_block(text: str) -> str:
    """Tách dòng liên hệ (email/phone/website) khỏi phần nội dung chính."""
    kept: list[str] = []
    for line in (text or "").splitlines():
        stripped = line.strip()
        if re.search(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", stripped):
            continue
        if re.search(r"(?:\+?84|0)[\s.()-]*\d(?:[\s.()-]*\d){7,9}", stripped):
            continue
        if re.search(r"(?:https?://|www\.)\S+", stripped, flags=re.IGNORECASE):
            continue
        kept.append(line)
    return "\n".join(kept)


def clean_jd_text(text: str) -> str:
    """Pipeline làm sạch chuẩn cho văn bản JD trước khi parse."""
    if not text:
        return ""
    cleaned = repair_mojibake(str(text))
    # 1. Strip HTML tags (convert <br>, <p>, <li> to newlines)
    cleaned = re.sub(r"<(?:br|/p|/li|/tr|/div)\s*/?>", "\n", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"<[^>]+>", " ", cleaned)
    # 2. Fix escaped characters like \-, \*, \_, \#, \[ \]
    cleaned = re.sub(r"\\([#\-_*\[\]\(\)])", r"\1", cleaned)
    # 3. Normalize bullet characters to standard hyphen
    cleaned = re.sub(r"(?m)^[ \t]*[•*+–—\u2022\u2023\u25e6\u2043\u2219]\s*", "- ", cleaned)
    # 4. Strip markdown headings (e.g. ## Yêu cầu -> Yêu cầu) but keep text
    cleaned = re.sub(r"(?m)^[ \t]*#{1,6}\s*", "", cleaned)
    # 5. Clean OCR numbering/bullet artifacts at line ends or orphans
    cleaned = re.sub(r"(?m)^\s*(?:[IVXLCDM]+|\d+)\.?\s*$", "", cleaned)
    # 6. Heal broken line wrapping (join mid-sentence newlines)
    cleaned = re.sub(r"(?<![.!?:;\-\n])\r?\n(?![ \t]*[\-\•\*\d.)A-ZĐ])", " ", cleaned)
    # 7. Normalize whitespace
    cleaned = re.sub(r"[ \t]+", " ", cleaned)
    cleaned = re.sub(r"\n\s*\n+", "\n\n", cleaned)
    return cleaned.strip()


# ── Lớp làm sạch dành cho HIỂN THỊ job trên UI ────────────────────────────

# Marker do pipeline crawl tự che thông tin liên hệ. Chúng không có giá trị
# hiển thị nên phải bỏ cùng dấu câu thừa quanh nó.
_REDACTION_TOKENS = (
    "[protected info]",
    "(protected info)",
    "{protected info}",
    "[email protected]",
    "[contact info]",
    "[phone number]",
)

# Nhãn cấp bậc xuất hiện dưới dạng tag đầu tiêu đề: [Junior], [HN]...
_TITLE_LEVEL_TAG = re.compile(
    r"^[\(\[]?\s*(internship|intern|fresher|junior|middle|mid[- ]level|senior|lead|manager)\s*[\]\):\-]?\s*",
    re.IGNORECASE,
)
_TITLE_LOCATION_TAG = re.compile(
    r"\s*[\(\[]\s*(hn|hcm|tp\.?\s*hcm|hà nội|hanoi|ho chi minh|đà nẵng|da nang|remote|hybrid|on[- ]?site)\s*[\]\)]\s*",
    re.IGNORECASE,
)
# Tag tiền tố còn lại: mã công ty [LTH]/[VELA] hoặc tag tuyển gấp [Urgent].
_TITLE_COMPANY_TAG = re.compile(
    r"^[\[\(]\s*(?:urgent|hỏa tốc|hoa toc|hot|new|[A-ZÀ-Ở-Ỹ0-9&\.]{2,7})\s*[\]\)]\s*",
    re.IGNORECASE,
)
# Từ khóa chức danh/cấp bậc bị dính liền vào chữ khác
# ("FULL STACKDEVELOPERINTERN" -> "FULL STACK DEVELOPER INTERN").
# Lookbehind không tiêu thụ ký tự nên chuỗi dính nhiều từ vẫn tách hết;
# lookahead cho phép kết thúc từ HOẶC một chữ hoa kế tiếp (chuỗi dính nhiều từ).
_GLUED_KEYWORD_SPLIT = re.compile(
    r"((?<=[A-Za-zÀ-ỹ])(?:internship|intern|fresher|junior|senior|middle|manager|lead|developer|engineer|tester)(?=\b|[A-ZÀ-Ở-Ỹ0-9]))",
    re.IGNORECASE,
)
# Tiền tố cấp bậc tiếng Việt đứng đầu tiêu đề ("Thực Tập Sinh.NET Developer").
_TITLE_VN_LEVEL_TAG = re.compile(
    r"^(?:ứng viên\s*)?(thực tập sinh|thực tập|thuc tap sinh|thuc tap|sinh viên|sinh vien)\s*[:.\-]?\s*",
    re.IGNORECASE,
)


def strip_redaction_markers(text: str) -> str:
    """Xoá marker che thông tin liên hệ và dấu câu mồ côi để lại."""
    result = text or ""
    for token in _REDACTION_TOKENS:
        if token in result.casefold():
            # Tìm token không phân biệt hoa thường rồi xoá cả cụm dấu kèm theo.
            pattern = re.escape(token).replace(r"\ ", r"\s+")
            result = re.sub(
                rf"\s*[,\.;:]*\s*{pattern}\s*[,\.;:]*\s*",
                " ",
                result,
                flags=re.IGNORECASE,
            )
    # Dọn ngoặc/ngoặc vuông rỗng sau khi xoá marker bên trong.
    result = re.sub(r"\(\s*\)", "", result)
    result = re.sub(r"\[\s*\]", "", result)
    return re.sub(r"\s{2,}", " ", result).strip()


def _fix_title_spacing(title: str) -> str:
    """Chèn khoảng trắng trước ngoặc, tách từ khóa dính liền và dọn khoảng trắng."""
    value = re.sub(r"\s+", " ", title or "").strip()
    value = _GLUED_KEYWORD_SPLIT.sub(r" \1", value)
    value = re.sub(r"\s+", " ", value)
    value = re.sub(r"([^\s\(])\(", r"\1 (", value)
    value = re.sub(r"\)(?=[A-Za-zÀ-ỹ0-9])", ") ", value)
    value = re.sub(r"\s+([,.;:])", r"\1", value)
    return value.strip(" -–—|,")


def split_title_decorations(title: str) -> dict[str, Any]:
    """Tách tag cấp bậc/địa điểm/công ty khỏi tiêu đề job và trả về gợi ý metadata.

    Ví dụ: ``[Junior]Mobile Developer(Flutter)`` ->
    ``{"title": "Mobile Developer (Flutter)", "level": "junior"}``
    """
    value = str(title or "").strip()
    level_hint: str | None = None
    location_hints: list[str] = []

    level_match = _TITLE_LEVEL_TAG.match(value)
    if level_match:
        level_hint = level_match.group(1).casefold()
        value = value[level_match.end() :]
    else:
        vn_level_match = _TITLE_VN_LEVEL_TAG.match(value)
        if vn_level_match:
            level_hint = "intern"
            value = value[vn_level_match.end() :]

    def _collect_location(match: re.Match[str]) -> str:
        token = match.group(1).casefold()
        location_hints.append(token)
        return " "

    value = _TITLE_LOCATION_TAG.sub(_collect_location, value)
    # Bỏ tag tiền tố dạng mã công ty / tuyên truyền ([LTH], [VELA], [Urgent]).
    for _ in range(2):
        stripped = _TITLE_COMPANY_TAG.sub("", value).strip()
        if stripped == value:
            break
        value = stripped
    value = _fix_title_spacing(value)
    if not value:
        value = str(title or "").strip()
    return {"title": value, "level": level_hint, "locations": location_hints}


def _fold_ascii(value: str) -> str:
    folded = unicodedata.normalize("NFD", value.casefold())
    folded = "".join(char for char in folded if unicodedata.category(char) != "Mn")
    return folded.replace("đ", "d")


_EMPLOYMENT_PATTERNS: tuple[tuple[tuple[str, ...], str], ...] = (
    (("toàn thời gian", "toan thoi gian", "full time", "full-time"), "Full-time"),
    (("bán thời gian", "ban thoi gian", "part time", "part-time"), "Part-time"),
    (("thực tập sinh", "thuc tap sinh", "thực tập", "thuc tap", "internship"), "Internship"),
    (("hợp đồng", "hop dong", "freelance", "cộng tác viên", "cong tac vien"), "Contract"),
)

_POSITION_TO_LEVEL: tuple[tuple[tuple[str, ...], str], ...] = (
    (("thực tập sinh", "thuc tap sinh", "thực tập", "thuc tap", "intern"), "Intern"),
    (("fresher",), "Fresher"),
    (("senior", "cao cấp", "cao cap"), "Senior"),
    (("trưởng nhóm", "truong nhom", "team lead"), "Lead"),
    (("quản lý", "quan ly", "manager"), "Manager"),
    (("nhân viên", "nhan vien", "employee", "chuyên viên", "chuyen vien"), "Junior"),
)


def _phrase_in(folded_text: str, phrase: str) -> bool:
    """Khớp cụm từ theo biên từ trên văn bản đã fold dấu."""
    needle = _fold_ascii(phrase)
    return bool(re.search(rf"(?<!\w){re.escape(needle)}(?!\w)", folded_text))


def derive_metadata_from_text(description: str) -> dict[str, Any]:
    """Đọc khối metadata đầu bản tin (Thu nhập/Loại hình/Chức vụ/Kinh nghiệm).

    Nhiều bản tin crawl có sẵn khối này; dùng nó thay vì hardcode để các
    trường hiển thị trung thực với nguồn.
    """
    head = "\n".join((description or "").splitlines()[:25])
    flat = re.sub(r"\s+", " ", _fold_ascii(head))

    result: dict[str, Any] = {}

    # 1. Hình thức làm việc — ưu tiên giá trị ngay sau nhãn "Loại hình:".
    employment_value = ""
    employment_label = re.search(
        r"loai hinh\s*:?\s*(.{0,40}?)(?=chuc vu|kinh nghiem|mo ta|$)", flat
    )
    if employment_label:
        employment_value = employment_label.group(1).strip()
    if employment_value:
        for keywords, label in _EMPLOYMENT_PATTERNS:
            if any(_phrase_in(employment_value, k) for k in keywords):
                result["employment_type"] = label
                break
    else:
        for keywords, label in _EMPLOYMENT_PATTERNS:
            if any(_phrase_in(flat, k) for k in keywords):
                result["employment_type"] = label
                break

    # 2. Chức vụ — map về cấp bậc chuẩn theo biên từ.
    position_label = re.search(
        r"chuc vu\s*:?\s*(.{0,40}?)(?=kinh nghiem|mo ta|loai hinh|$)", flat
    )
    if position_label:
        value = position_label.group(1).strip()
        for keywords, level in _POSITION_TO_LEVEL:
            if any(_phrase_in(value, k) for k in keywords):
                result["position_level"] = level
                break
        else:
            result["position_raw"] = value[:60]

    # 3. Kinh nghiệm — số năm khai trong bản tin.
    experience_label = re.search(
        r"kinh nghiem\s*:?\s*(\d[\d,.]*\s*(?:-|den|toi)\s*\d[\d,.]*|\d[\d,.]*)?\s*nam?",
        flat,
    )
    if experience_label and experience_label.group(1):
        numbers = [
            float(n.replace(",", "."))
            for n in re.findall(r"\d+(?:[.,]\d+)?", experience_label.group(1))
        ]
        if numbers:
            min_years = min(numbers)
            result["experience_years"] = min_years
            if min_years < 1:
                result.setdefault("experience_level", "Fresher")
            elif min_years <= 2:
                result.setdefault("experience_level", "Fresher")
            elif min_years <= 4:
                result.setdefault("experience_level", "Junior")
            elif min_years <= 6:
                result.setdefault("experience_level", "Middle")
            else:
                result.setdefault("experience_level", "Senior")

    return result


def resolve_job_level(
    *,
    title_level_hint: str | None,
    position_level: str | None,
    experience_level: str | None,
    current_level: str | None,
) -> str:
    """Chọn cấp bậc hiển thị theo độ tin cậy giảm dần của các nguồn."""
    junk_values = {"not specified", "not_specified", "n/a", "na", "none", "khong", ""}
    candidates = [
        title_level_hint,
        (position_level or "").casefold() or None,
        (experience_level or "").casefold() or None,
        None if (current_level or "").casefold().strip() in junk_values else (current_level or "").casefold(),
    ]
    for candidate in candidates:
        if candidate and candidate.casefold() not in junk_values:
            return candidate.strip().capitalize()
    return "Chưa xác định"


def heal_soft_wrapped_lines(text: str) -> list[str]:
    """Ghép lại các dòng bị xuống dòng giữa câu (wrap cứng của trang nguồn).

    Quy tắc: một dòng KHÔNG bắt đầu bằng bullet/ký hiệu danh sách sẽ được
    nối vào dòng trước nếu dòng trước không kết thúc bằng dấu kết câu.
    Các dòng bullet giữ nguyên ranh giới.
    """
    healed: list[str] = []
    for raw_line in (text or "").splitlines():
        line = raw_line.strip()
        if not line:
            continue
        starts_new_item = bool(re.match(r"^(?:[•●▪◦*\-–—]|\d+[.)])\s*", line)) or bool(
            re.match(r"^[A-ZÀ-Ở-Ỹ0-9\"'(]", line)
        )
        if healed and not starts_new_item:
            previous = healed[-1]
            previous_is_bullet = bool(re.match(r"^(?:[•●▪◦*\-–—]|\d+[.)])\s*", previous))
            if not previous_is_bullet and not re.search(r"[.!?:;]$", previous.rstrip()):
                # Hậu tố bị tách rời ("designer" + "s to ..."): nối trực tiếp.
                if re.match(r"^[a-zà-ỹ]{1,2}(\s|$)", line) and re.search(r"[a-zà-ỹ]$", previous):
                    healed[-1] = f"{previous}{line}"
                else:
                    healed[-1] = f"{previous} {line}".strip()
                continue
        healed.append(line)
    return healed


def clean_cv_text(text: str) -> str:
    """Pipeline làm sạch văn bản CV chuẩn trước khi chunking."""
    if not text:
        return ""
    cleaned = repair_mojibake(str(text))
    # 1. Strip HTML tags
    cleaned = re.sub(r"<(?:br|/p|/li|/tr|/div)\s*/?>", "\n", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"<[^>]+>", " ", cleaned)
    # 2. Fix escaped characters like \-, \*, \_, \#, \[ \]
    cleaned = re.sub(r"\\([#\-_*\[\]\(\)])", r"\1", cleaned)
    # 3. Normalize bullet characters to standard hyphen
    cleaned = re.sub(r"(?m)^[ \t]*[•*+–—\u2022\u2023\u25e6\u2043\u2219]\s*", "- ", cleaned)
    # 4. Strip markdown headings (e.g. ## Experience -> Experience)
    cleaned = re.sub(r"(?m)^[ \t]*#{1,6}\s*", "", cleaned)
    # 5. Clean OCR noise / orphan numbers
    cleaned = re.sub(r"(?m)^\s*(?:[IVXLCDM]+|\d+)\.?\s*$", "", cleaned)
    # 6. Normalize whitespace
    cleaned = re.sub(r"[ \t]+", " ", cleaned)
    cleaned = re.sub(r"\n\s*\n+", "\n\n", cleaned)
    return cleaned.strip()


def detect_cv_sections(text: str) -> dict[str, str]:
    """Detect canonical CV sections from text:
    summary, skills, work_experience, projects, education, certifications, languages, achievements.
    """
    sections: dict[str, str] = {}
    current_section = "summary"
    lines = (text or "").splitlines()
    buffer: list[str] = []

    header_patterns = [
        ("summary", r"^(?:professional summary|summary|objective|profile|tóm tắt|mục tiêu nghề nghiệp)\b"),
        ("skills", r"^(?:technical skills|skills|kỹ năng|chuyên môn|technologies|công nghệ)\b"),
        ("work_experience", r"^(?:work experience|experience|kinh nghiệm làm việc|kinh nghiệm|employment history)\b"),
        ("projects", r"^(?:featured projects|projects|dự án tiêu biểu|dự án|personal projects)\b"),
        ("education", r"^(?:education|học vấn|bằng cấp|trình độ học vấn|academic background)\b"),
        ("certifications", r"^(?:certifications|certificates|chứng chỉ|chứng chỉ chuyên môn)\b"),
        ("languages", r"^(?:languages|ngoại ngữ|ngôn ngữ)\b"),
        ("achievements", r"^(?:achievements|awards|giải thưởng|thành tích)\b"),
    ]

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        cleaned_header = re.sub(r"^[#\-\*•\d\.\s]+", "", stripped).strip().casefold()
        matched_section = None
        for sec_name, pat in header_patterns:
            if re.search(pat, cleaned_header, re.IGNORECASE):
                matched_section = sec_name
                break
        if matched_section:
            if buffer:
                sections[current_section] = "\n".join(buffer).strip()
                buffer = []
            current_section = matched_section
        else:
            buffer.append(stripped)

    if buffer:
        sections[current_section] = "\n".join(buffer).strip()
    return sections

