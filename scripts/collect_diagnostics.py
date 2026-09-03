"""Gom toàn bộ dấu vết của một buổi test voice vào MỘT file để gửi đi phân tích.

Chạy SAU KHI đã test xong trên trình duyệt:

    $env:PYTHONPATH="backend"; .venv\\Scripts\\python.exe scripts/collect_diagnostics.py

Kết quả: logs/diagnostic-<timestamp>.md

Gom bốn thứ:
  1. Cấu hình đang chạy — model nào, key nào có/thiếu (CHỈ báo có hay không)
  2. Các phiên phỏng vấn trong database — hỏi gì, trả lời gì, điểm STAR
  3. Log backend — từ logs/backend.log và/hoặc `docker compose logs`
  4. Môi trường — cổng nào mở, chạy native hay Docker

File này để gửi cho người khác đọc, nên mọi chuỗi giống API key đều bị che
trước khi ghi. Nhưng nội dung câu trả lời phỏng vấn thì được giữ nguyên —
xem qua trước khi gửi nếu đó là dữ liệu thật của người khác.
"""

from __future__ import annotations

import contextlib
import io
import os
import re
import socket
import subprocess
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOG_DIR = Path(os.getenv("LOG_DIR") or (ROOT / "logs"))

# Che mọi thứ trông giống bí mật. Thà che nhầm còn hơn để lọt.
REDACTIONS = [
    (re.compile(r"sk_[A-Za-z0-9]{16,}"), "sk_[ĐÃ CHE]"),
    (re.compile(r"AIza[A-Za-z0-9_\-]{16,}"), "AIza[ĐÃ CHE]"),
    (re.compile(r"(?i)(bearer\s+)[A-Za-z0-9._\-]{16,}"), r"\1[ĐÃ CHE]"),
    (re.compile(r"(?i)((?:api[_-]?key|token|secret|password)\s*[=:]\s*)\S{8,}"), r"\1[ĐÃ CHE]"),
    (re.compile(r"eyJ[A-Za-z0-9._\-]{20,}"), "eyJ[ĐÃ CHE JWT]"),
]


def redact(text: str) -> str:
    for pattern, replacement in REDACTIONS:
        text = pattern.sub(replacement, text)
    return text


def section(title: str, body: str) -> str:
    return f"\n## {title}\n\n{body.rstrip()}\n"


def _run(cmd: list[str], timeout: int = 30) -> str | None:
    try:
        done = subprocess.run(
            cmd, capture_output=True, text=True, timeout=timeout,
            encoding="utf-8", errors="replace", check=False,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    return (done.stdout or "") + (done.stderr or "")


def collect_config() -> str:
    try:
        from src.config import get_settings

        s = get_settings()
    except Exception as exc:  # noqa: BLE001 - báo lỗi rồi đi tiếp, không dừng cả báo cáo
        return f"Không đọc được cấu hình: {type(exc).__name__}: {exc}"

    def present(value: str) -> str:
        return f"có ({len(value)} ký tự)" if value else "**THIẾU**"

    rows = [
        ("GEMINI_API_KEY", present(s.google_genai_api_key)),
        ("ELEVENLABS_API_KEY", present(s.elevenlabs_api_key)),
        ("MINERU_API_TOKEN", present(s.mineru_api_token)),
        ("gemini_stt_model", s.gemini_stt_model),
        ("voice_llm_model", s.voice_llm_model),
        ("voice_llm_fallback_model", s.voice_llm_fallback_model),
        ("elevenlabs_model", s.elevenlabs_model),
        ("elevenlabs_voice_id_female", s.elevenlabs_voice_id_female),
        ("storage_provider", s.storage_provider),
        ("malware_scan_mode", s.malware_scan_mode),
        ("app_env", s.app_env),
        ("log_level", s.log_level),
    ]
    lines = ["| Thiết lập | Giá trị |", "|---|---|"]
    lines += [f"| `{k}` | {v} |" for k, v in rows]
    return "\n".join(lines)


def collect_sessions(limit: int) -> str:
    """Chạy lại inspect_interviews và bắt đầu ra, để không nhân đôi logic truy vấn."""
    script = ROOT / "scripts" / "inspect_interviews.py"
    if not script.exists():
        return "Không tìm thấy scripts/inspect_interviews.py"

    import asyncio
    import importlib.util

    spec = importlib.util.spec_from_file_location("_inspect", script)
    if spec is None or spec.loader is None:
        return "Không nạp được inspect_interviews.py"
    module = importlib.util.module_from_spec(spec)

    buffer = io.StringIO()
    saved_argv = sys.argv
    try:
        spec.loader.exec_module(module)
        sys.argv = ["inspect_interviews", "--limit", str(limit), "--full"]
        with contextlib.redirect_stdout(buffer):
            asyncio.run(module.main())
    except Exception as exc:  # noqa: BLE001
        return (
            f"Không đọc được phiên phỏng vấn: {type(exc).__name__}: {exc}\n\n"
            "Thường là do Postgres chưa chạy — thử `docker compose up -d db`."
        )
    finally:
        sys.argv = saved_argv

    output = buffer.getvalue().strip()
    return f"```\n{output}\n```" if output else "Không có phiên nào."


def collect_backend_log(lines: int) -> str:
    parts: list[str] = []

    log_file = LOG_DIR / "backend.log"
    if log_file.exists():
        try:
            tail = log_file.read_text(encoding="utf-8", errors="replace").splitlines()[-lines:]
            parts.append(
                f"### Từ `{log_file}` ({lines} dòng cuối)\n\n```\n" + "\n".join(tail) + "\n```"
            )
        except OSError as exc:
            parts.append(f"Không đọc được {log_file}: {exc}")
    else:
        parts.append(
            f"Chưa có `{log_file}`. Backend chạy native cần khởi động lại một lần "
            "để bật ghi log ra file."
        )

    docker = _run(["docker", "compose", "logs", "--tail", str(lines), "backend"])
    if docker and "error during connect" not in docker.lower():
        parts.append(f"### Từ `docker compose logs backend`\n\n```\n{docker.strip()}\n```")

    return "\n\n".join(parts)


def collect_environment() -> str:
    lines = ["| Mục | Trạng thái |", "|---|---|"]
    for name, port in (("PostgreSQL", 5432), ("Backend", 8000), ("Frontend", 3000)):
        sock = socket.socket()
        sock.settimeout(1)
        try:
            sock.connect(("127.0.0.1", port))
            state = "đang chạy"
        except OSError:
            state = "không phản hồi"
        finally:
            sock.close()
        lines.append(f"| {name} (:{port}) | {state} |")

    containers = _run(["docker", "ps", "--format", "{{.Names}} ({{.Status}})"])
    if containers and "error during connect" not in containers.lower():
        running = ", ".join(x for x in containers.strip().splitlines() if x) or "(không có)"
    else:
        running = "Docker không chạy hoặc không truy cập được"
    lines.append(f"| Container | {running} |")
    lines.append(f"| Python | {sys.version.split()[0]} |")
    return "\n".join(lines)


def main() -> int:
    limit = 5
    log_lines = 400
    if "--limit" in sys.argv:
        limit = int(sys.argv[sys.argv.index("--limit") + 1])

    stamp = datetime.now().astimezone().strftime("%Y%m%d-%H%M%S")
    print("Đang gom dữ liệu chẩn đoán...")

    report = f"# Chẩn đoán phiên phỏng vấn voice — {stamp}\n"
    for title, body in (
        ("Cấu hình", collect_config()),
        ("Môi trường", collect_environment()),
        (f"Phiên phỏng vấn ({limit} gần nhất)", collect_sessions(limit)),
        ("Log backend", collect_backend_log(log_lines)),
    ):
        print(f"  - {title}")
        report += section(title, body)

    report += section(
        "Ghi chú",
        "Các chuỗi giống API key đã được che tự động. Nội dung câu trả lời phỏng vấn "
        "được giữ nguyên — xem qua trước khi gửi nếu là dữ liệu thật của người khác.",
    )

    try:
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        out = LOG_DIR / f"diagnostic-{stamp}.md"
        out.write_text(redact(report), encoding="utf-8")
    except OSError as exc:
        print(f"Không ghi được file: {exc}", file=sys.stderr)
        return 1

    print(f"\nXong: {out}")
    print("Gửi file này để được phân tích.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
