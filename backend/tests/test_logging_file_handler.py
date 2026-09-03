"""Log phải ghi được ra file, không chỉ ra console.

Chạy native thì log chỉ hiện trên terminal rồi mất, nên sau khi một phiên phỏng
vấn kết thúc là không còn gì để chẩn đoán. Đây chính là lý do bốn lỗi câm của
luồng voice tồn tại lâu mà không ai thấy.

`scripts/collect_diagnostics.py` đọc trực tiếp `logs/backend.log`; thiếu handler
này là báo cáo chẩn đoán mất một phần tư dữ liệu.
"""

from __future__ import annotations

import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path

import pytest

# pyrefly: ignore [missing-import]
from src.core.logging_config import setup_logging


@pytest.fixture
def isolated_root_logger():
    """setup_logging() sửa root logger toàn cục — phải trả nguyên trạng."""
    root = logging.getLogger()
    saved_handlers = root.handlers[:]
    saved_level = root.level
    root.handlers.clear()
    yield root
    for handler in root.handlers:
        handler.close()
    root.handlers[:] = saved_handlers
    root.setLevel(saved_level)


@pytest.fixture
def log_dir(tmp_path, monkeypatch) -> Path:
    target = tmp_path / "logs"
    monkeypatch.setenv("LOG_DIR", str(target))
    return target


def _file_handlers(root: logging.Logger) -> list[RotatingFileHandler]:
    return [h for h in root.handlers if isinstance(h, RotatingFileHandler)]


def test_creates_log_file_and_writes_to_it(isolated_root_logger, log_dir):
    setup_logging("development", "INFO")

    log_file = log_dir / "backend.log"
    assert log_file.exists(), "phải tạo logs/backend.log"

    logging.getLogger("test.voice").info("Gemini Live STT started")
    for handler in isolated_root_logger.handlers:
        handler.flush()

    assert "Gemini Live STT started" in log_file.read_text(encoding="utf-8")


def test_console_handler_is_kept(isolated_root_logger, log_dir):
    """Thêm file handler không được làm mất log trên terminal."""
    setup_logging("development", "INFO")

    stream_only = [
        h
        for h in isolated_root_logger.handlers
        if isinstance(h, logging.StreamHandler)
        and not isinstance(h, RotatingFileHandler)
    ]
    assert stream_only, "console handler phải còn"
    assert len(_file_handlers(isolated_root_logger)) == 1


def test_repeated_calls_do_not_stack_handlers(isolated_root_logger, log_dir):
    """uvicorn --reload nạp lại module; gắn trùng là log bị nhân đôi."""
    setup_logging("development", "INFO")
    setup_logging("development", "INFO")
    setup_logging("production", "WARNING")

    assert len(_file_handlers(isolated_root_logger)) == 1


def test_file_output_has_no_ansi_color_codes(isolated_root_logger, log_dir):
    """File dùng formatter phẳng: mã màu làm rác và cản việc đọc lại log."""
    setup_logging("development", "INFO")  # development bật màu cho console

    logging.getLogger("test.color").warning("cảnh báo có dấu tiếng Việt")
    for handler in isolated_root_logger.handlers:
        handler.flush()

    content = (log_dir / "backend.log").read_text(encoding="utf-8")
    assert "\x1b[" not in content, "không được có mã màu ANSI trong file"
    assert "cảnh báo có dấu tiếng Việt" in content, "phải ghi đúng UTF-8"


def test_rotation_is_bounded(isolated_root_logger, log_dir):
    """Không được để file log phình vô hạn trên máy dev."""
    setup_logging("development", "INFO")

    handler = _file_handlers(isolated_root_logger)[0]
    assert handler.maxBytes > 0
    assert handler.backupCount > 0


def test_unwritable_directory_degrades_to_console(isolated_root_logger, monkeypatch, tmp_path):
    """Dựng logging hỏng KHÔNG được làm chết ứng dụng."""
    blocker = tmp_path / "blocked"
    blocker.write_text("đây là file, không phải thư mục", encoding="utf-8")
    monkeypatch.setenv("LOG_DIR", str(blocker / "logs"))

    setup_logging("development", "INFO")  # không được ném exception

    assert _file_handlers(isolated_root_logger) == []
    assert isolated_root_logger.handlers, "vẫn phải còn console handler"
