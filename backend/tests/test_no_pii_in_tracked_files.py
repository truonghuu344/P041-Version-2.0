"""Chặn dữ liệu cá nhân thật lọt vào file được git theo dõi.

Đã xảy ra thật: một tài liệu bằng chứng test nhắc tên file CV, mà bản thân tên
file nhúng họ tên và số điện thoại thật của một ứng viên. Nó nằm trong repo
suốt 49 commit trước khi bị phát hiện. Xoá ở commit mới không gỡ được khỏi lịch
sử, nên chặn từ đầu rẻ hơn nhiều lần.

Test quét theo mẫu HẸP và cụ thể thay vì đoán mò "cái gì trông giống PII" —
mẫu rộng sẽ bắt nhầm mã hash, ngày tháng, số đo và nhanh chóng bị vô hiệu hoá.
"""

from __future__ import annotations

import re
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]

# Tên file CV/hồ sơ nhúng chuỗi số dài — dạng đã thực sự lọt vào repo.
CV_FILENAME_WITH_DIGITS = re.compile(
    r"\b(?:CV|Resume|HoSo)[_-][A-Za-z]+[_-]\d{9,11}\b",
    re.IGNORECASE,
)

# Số điện thoại Việt Nam viết dạng quốc tế, đứng độc lập.
VN_PHONE_INTL = re.compile(r"(?<![\w.])\+84\d{9}(?![\w.])")

PATTERNS = {
    "tên file CV nhúng số điện thoại": CV_FILENAME_WITH_DIGITS,
    "số điện thoại VN dạng +84": VN_PHONE_INTL,
}

# Chỉ quét file văn bản người viết. Bỏ qua lockfile, dữ liệu cào về và tài sản
# nhị phân — chúng đầy chuỗi số dài hợp lệ.
SCAN_SUFFIXES = {".md", ".py", ".ts", ".tsx", ".js", ".jsx", ".json", ".yml", ".yaml", ".txt"}
SKIP_PREFIXES = (
    "data/jds/",
    "frontend/package-lock.json",
    "backend/rendercv/",
)


def _tracked_files() -> list[str]:
    try:
        out = subprocess.run(
            ["git", "ls-files"],
            cwd=ROOT, capture_output=True, text=True, timeout=60, check=True,
        ).stdout
    except (OSError, subprocess.SubprocessError):
        pytest.skip("không chạy được git ls-files")
    return [line for line in out.splitlines() if line]


def test_khong_co_pii_trong_file_git_theo_doi():
    hits: list[str] = []
    for rel in _tracked_files():
        if rel.startswith(SKIP_PREFIXES) or Path(rel).suffix.lower() not in SCAN_SUFFIXES:
            continue
        path = ROOT / rel
        try:
            text = path.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        for label, pattern in PATTERNS.items():
            for m in pattern.finditer(text):
                line_no = text.count("\n", 0, m.start()) + 1
                # KHÔNG in giá trị khớp — báo cáo lỗi cũng là nơi PII rò ra.
                hits.append(f"{rel}:{line_no} — {label}")

    assert not hits, (
        "Phát hiện dữ liệu cá nhân trong file được git theo dõi. Xoá trước khi "
        "commit: một khi đã đẩy lên, gỡ khỏi lịch sử phải viết lại history và "
        "nhờ GitHub Support xoá cache.\n  " + "\n  ".join(hits)
    )
