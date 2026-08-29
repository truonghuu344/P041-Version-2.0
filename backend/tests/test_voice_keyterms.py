"""Tests cho bộ rút thuật ngữ nạp vào STT.

Rút sai thì hoặc mất thuật ngữ cần mớm, hoặc nhồi rác vào `custom_vocabulary`
và làm loãng tác dụng. Cả hai đều hỏng âm thầm.
"""

from __future__ import annotations

# pyrefly: ignore [missing-import]
from src.services.voice.keyterms import MAX_KEYTERMS, extract_keyterms

CV = """
Tôi có ba năm kinh nghiệm làm backend với Python và FastAPI.
Dự án gần nhất dùng PostgreSQL, Redis và Docker để tối ưu truy vấn.
Tôi triển khai microservice trên Kubernetes, áp dụng CI/CD với GitHub Actions.
"""

JD = """
Yêu cầu: thành thạo Python, hiểu biết về OAuth2 và JWT.
Ưu tiên ứng viên từng làm việc với Node.js hoặc C++.
"""


def test_keeps_distinctive_technical_terms():
    terms = extract_keyterms(CV)
    for expected in ("Python", "FastAPI", "PostgreSQL", "Redis", "Docker",
                     "Kubernetes", "CI/CD", "GitHub", "Actions"):
        assert expected in terms, f"thiếu {expected}"


def test_drops_plain_lowercase_words_on_purpose():
    """Từ thường như "backend" bị bỏ có chủ đích: STT vốn đã nghe đúng chúng,
    nhồi vào từ điển chỉ làm loãng những từ thật sự dễ sai."""
    terms = extract_keyterms(CV)
    assert "backend" not in terms
    assert "microservice" not in terms


def test_drops_vietnamese_words():
    terms = extract_keyterms(CV)
    for vietnamese in ("kinh", "nghiệm", "Tôi", "dụng", "Dự"):
        assert vietnamese not in terms


def test_no_fragments_from_vietnamese_words():
    """Bẫy dễ mắc: regex ASCII cắt 'nghiệm' thành 'nghi'."""
    terms = extract_keyterms("Tôi có kinh nghiệm triển khai hệ thống.")
    assert terms == [], f"rút ra rác: {terms}"


def test_drops_capitalised_vietnamese_at_start_of_sentence():
    """Âm tiết không dấu viết hoa đầu câu vẫn là ASCII, phải chặn riêng."""
    terms = extract_keyterms("Kinh nghiệm nhiều. Cong viec on dinh. Khai thac he thong.")
    assert "Kinh" not in terms
    assert "Cong" not in terms
    assert "Khai" not in terms


def test_preserves_internal_punctuation():
    terms = extract_keyterms("Áp dụng CI/CD và Node.js cùng C++.")
    assert "CI/CD" in terms
    assert "Node.js" in terms
    assert "C++" in terms


def test_strips_trailing_punctuation():
    terms = extract_keyterms("Dùng Docker, Redis; và Python.")
    assert "Docker" in terms
    assert "Redis" in terms
    assert "Python" in terms


def test_keeps_terms_with_digits():
    terms = extract_keyterms("Hiểu biết về OAuth2, JWT và HTTP2.")
    assert "OAuth2" in terms
    assert "HTTP2" in terms


def test_drops_pure_numbers_and_stopwords():
    terms = extract_keyterms("Có 3 năm kinh nghiệm with the Python and Docker 2024.")
    assert "3" not in terms
    assert "2024" not in terms
    for stop in ("with", "the", "and"):
        assert stop not in [t.lower() for t in terms]
    assert "Python" in terms


def test_deduplicates_case_insensitively_keeping_first_spelling():
    """custom_vocabulary cần đúng dạng viết, nên giữ lần xuất hiện đầu."""
    terms = extract_keyterms("Dùng FastAPI. Sau đó fastapi và FASTAPI.")
    assert terms.count("FastAPI") == 1
    assert "fastapi" not in terms
    assert "FASTAPI" not in terms


def test_preserves_order_of_first_appearance():
    terms = extract_keyterms("Redis rồi Docker rồi Python.")
    assert terms == ["Redis", "Docker", "Python"]


def test_merges_multiple_sources_in_order():
    terms = extract_keyterms("Backend Developer", JD, CV)
    assert terms[0] == "Backend"
    assert "OAuth2" in terms
    assert "Kubernetes" in terms


def test_respects_limit():
    text = " ".join(f"Term{i}" for i in range(500))
    assert len(extract_keyterms(text)) == MAX_KEYTERMS
    assert len(extract_keyterms(text, limit=7)) == 7


def test_handles_empty_and_none_inputs():
    assert extract_keyterms() == []
    assert extract_keyterms(None, "", "   ") == []


def test_single_letters_are_dropped():
    terms = extract_keyterms("Ngôn ngữ R và C được dùng.")
    assert "R" not in terms
    assert "C" not in terms
