"""Rút thuật ngữ kỹ thuật từ CV/JD để mớm cho STT.

Đo trên bộ thử: bật `custom_vocabulary` đưa WER từ 3.39% về 0%, sửa đúng các
ca như "CI/CD" bị nghe thành "CICD" và "OAuth2" mất mất số 2. Transcript sai
thuật ngữ kéo theo chấm STAR sai, nên đây là bước đáng làm.

Heuristic: chỉ nhận token ASCII có DẤU HIỆU CHÍNH TẢ ĐẶC BIỆT — chữ hoa giữa
từ, chữ số, hoặc dấu bên trong. Đó đúng là đặc điểm của những từ STT hay nghe
sai ("CI/CD", "OAuth2", "FastAPI", "PostgreSQL").

Lọc "ASCII thuần" một mình là KHÔNG đủ: rất nhiều âm tiết tiếng Việt không
dấu cũng thuần ASCII ("kinh", "khai", "ba"), nhồi chúng vào từ điển chỉ làm
loãng. Ngược lại, từ tiếng Anh thường viết thường như "backend" bị bỏ qua —
chấp nhận được, vì STT vốn đã nghe đúng chúng.

Không dùng LLM: việc này phải rẻ và tất định.
"""

from __future__ import annotations

import re

# Giới hạn mềm. Chưa xác minh trần thật của Gemini `custom_vocabulary`;
# giữ ở mức vừa phải để prompt không phình và tránh chạm giới hạn chưa biết.
MAX_KEYTERMS = 100

_SPLIT_RE = re.compile(r"[\s,;:()\[\]{}<>\"'`|!?…]+")

# Từ tiếng Anh phổ biến lọt vào CV/JD tiếng Việt nhưng không phải thuật ngữ.
_STOPWORDS = frozenset({
    "a", "an", "and", "are", "as", "at", "be", "but", "by", "can", "for",
    "from", "has", "have", "in", "is", "it", "of", "on", "or", "our", "the",
    "to", "up", "us", "we", "will", "with", "you", "your", "not", "all",
    "any", "more", "most", "such", "than", "that", "them", "then", "these",
    "this", "those", "using", "used", "use", "via", "who", "why", "how",
    "new", "good", "well", "also", "may", "must", "should", "would",
})

# Âm tiết tiếng Việt KHÔNG DẤU cũng là ASCII thuần, nên lọt lưới khi đứng đầu
# câu và bị viết hoa ("Kinh nghiệm...", "Cong viec..."). Danh sách này chỉ cần
# phủ các âm tiết hay mở đầu câu trong CV/JD, không cần đầy đủ.
_VI_STOPWORDS = frozenset({
    "ba", "bao", "bon", "cac", "cam", "can", "cao", "cho", "chu", "chung",
    "co", "con", "cong", "cua", "da", "dai", "dang", "danh", "de", "di",
    "do", "doi", "don", "dung", "em", "gia", "giai", "hai", "han", "hanh",
    "hoa", "hoc", "hon", "hop", "khai", "khi", "kho", "khong", "kinh",
    "lam", "lien", "long", "luc", "minh", "mot", "nam", "nen", "ngay",
    "nghi", "nguoi", "nhan", "nhieu", "nhu", "noi", "phan", "phi", "qua",
    "quan", "ra", "rat", "sao", "sau", "sinh", "tam", "tao", "tap", "tat",
    "thanh", "theo", "thi", "thoi", "tien", "tinh", "toan", "tot", "trong",
    "truoc", "tu", "va", "van", "vao", "vi", "viec", "voi", "vua", "xay",
    "yeu",
})


def _clean(token: str) -> str:
    """Bỏ dấu câu bám ở hai đầu nhưng giữ ký tự có nghĩa bên trong (CI/CD, Node.js, C++)."""
    return token.strip(".,-–—/\\*_")


_INNER_MARKS = frozenset("/.+#-_")


def _is_distinctive(token: str) -> bool:
    """Có dấu hiệu chính tả khiến STT dễ nghe sai không?"""
    if any(ch.isdigit() for ch in token):
        return True
    if any(ch in _INNER_MARKS for ch in token[1:-1]):
        return True
    # Chữ hoa ở bất kỳ đâu: bắt cả "Python" lẫn "FastAPI", "PostgreSQL".
    return any(ch.isupper() for ch in token)


def _is_keyterm(token: str) -> bool:
    if len(token) < 2 or len(token) > 30:
        return False
    if not token.isascii():
        return False  # từ tiếng Việt có dấu tự loại ra ở đây
    if not any(ch.isalpha() for ch in token):
        return False  # số thuần, không phải thuật ngữ
    if token[0].isdigit():
        return False
    lowered = token.lower()
    if lowered in _STOPWORDS or lowered in _VI_STOPWORDS:
        return False
    return _is_distinctive(token)


def extract_keyterms(*texts: str | None, limit: int = MAX_KEYTERMS) -> list[str]:
    """Trả về danh sách thuật ngữ đã khử trùng lặp, giữ nguyên thứ tự xuất hiện.

    Khử trùng lặp không phân biệt hoa thường nhưng giữ lại dạng viết đầu tiên
    gặp được, vì `custom_vocabulary` cần đúng dạng ("FastAPI", không phải "fastapi").
    """
    seen: dict[str, str] = {}
    for text in texts:
        if not text:
            continue
        for raw in _SPLIT_RE.split(text):
            token = _clean(raw)
            if not _is_keyterm(token):
                continue
            key = token.lower()
            if key not in seen:
                seen[key] = token
                if len(seen) >= limit:
                    return list(seen.values())
    return list(seen.values())
