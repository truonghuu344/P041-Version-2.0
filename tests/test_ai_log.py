import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[1]
LOG_HOOK = REPO_ROOT / "scripts" / "log_hook.py"
SUBMIT_LOG = REPO_ROOT / "scripts" / "submit_log.py"
HOOK_CONFIG = REPO_ROOT / ".codex" / "hooks.json"
CODEX_WINDOWS_WRAPPER = REPO_ROOT / "scripts" / "codex_hook.ps1"


def run_hook(payload: dict, log_dir: Path, cwd: Path) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    env["AI_LOG_DIR"] = str(log_dir)
    return subprocess.run(
        [sys.executable, str(LOG_HOOK), "--tool=codex"],
        input=json.dumps(payload),
        cwd=cwd,
        env=env,
        text=True,
        capture_output=True,
        check=True,
    )


def run_hook_with_payload_file(
    payload: dict, payload_file: Path, log_dir: Path, cwd: Path
) -> subprocess.CompletedProcess[str]:
    payload_file.write_text(json.dumps(payload), encoding="utf-8")
    env = os.environ.copy()
    env["AI_LOG_DIR"] = str(log_dir)
    env["AI_HOOK_PAYLOAD_FILE"] = str(payload_file)
    return subprocess.run(
        [sys.executable, str(LOG_HOOK), "--tool=codex"],
        input="",
        cwd=cwd,
        env=env,
        text=True,
        capture_output=True,
        check=True,
    )


def read_entries(log_dir: Path) -> list[dict]:
    log_file = log_dir / "session.jsonl"
    return [json.loads(line) for line in log_file.read_text(encoding="utf-8").splitlines()]


def test_codex_hook_config_has_cross_platform_command_handlers():
    config = json.loads(HOOK_CONFIG.read_text(encoding="utf-8"))

    assert set(config) == {"description", "hooks"}
    assert set(config["hooks"]) == {"UserPromptSubmit"}
    for event_groups in config["hooks"].values():
        for event_group in event_groups:
            for handler in event_group["hooks"]:
                assert set(handler) == {
                    "type",
                    "command",
                    "commandWindows",
                    "timeout",
                    "statusMessage",
                }
                assert handler["type"] == "command"
                assert "git rev-parse --show-toplevel" in handler["command"]
                assert "git rev-parse --show-toplevel" in handler["commandWindows"]
                assert "log_hook.py" in handler["command"]
                assert "submit_log.py" not in handler["command"]
                assert "codex_hook.ps1" in handler["commandWindows"]


def test_codex_hook_logs_only_prompt_from_nested_directory(tmp_path: Path):
    log_dir = tmp_path / "logs"
    nested_cwd = REPO_ROOT / "src" / "backend"

    prompt_result = run_hook(
        {"hook_event_name": "UserPromptSubmit", "prompt": "Xin chào"},
        log_dir,
        nested_cwd,
    )
    tool_result = run_hook(
        {"hook_event_name": "PostToolUse", "tool_name": "shell_command"},
        log_dir,
        nested_cwd,
    )
    stop_result = run_hook(
        {"hook_event_name": "Stop"},
        log_dir,
        nested_cwd,
    )
    assert json.loads(prompt_result.stdout) == {"continue": True}
    assert tool_result.stdout == ""
    assert stop_result.stdout == ""
    entries = read_entries(log_dir)
    assert len(entries) == 1
    assert entries[0]["prompt"] == "Xin chào"


def test_codex_hook_reads_payload_preserved_by_windows_wrapper(tmp_path: Path):
    log_dir = tmp_path / "logs"
    payload_file = tmp_path / "payload.json"

    result = run_hook_with_payload_file(
        {
            "hook_event_name": "UserPromptSubmit",
            "prompt": "Prompt có dấu tiếng Việt",
            "model": "gpt-test",
        },
        payload_file,
        log_dir,
        REPO_ROOT,
    )

    assert json.loads(result.stdout) == {"continue": True}
    entries = read_entries(log_dir)
    assert entries[0]["prompt"] == "Prompt có dấu tiếng Việt"
    assert entries[0]["model"] == "gpt-test"


def test_codex_hook_reports_empty_payload_instead_of_silent_success(tmp_path: Path):
    env = os.environ.copy()
    env["AI_LOG_DIR"] = str(tmp_path / "logs")

    result = subprocess.run(
        [sys.executable, str(LOG_HOOK), "--tool=codex"],
        input="",
        cwd=REPO_ROOT,
        env=env,
        text=True,
        capture_output=True,
        check=True,
    )

    output = json.loads(result.stdout)
    assert output["continue"] is True
    assert "empty hook payload" in output["systemMessage"]


@pytest.mark.skipif(os.name != "nt", reason="PowerShell wrapper is Windows-only")
def test_codex_windows_wrapper_preserves_utf8_prompt(tmp_path: Path):
    log_dir = tmp_path / "logs"
    env = os.environ.copy()
    env["AI_LOG_DIR"] = str(log_dir)
    payload = {
        "hook_event_name": "UserPromptSubmit",
        "prompt": "Kiểm tra tiếng Việt từ Codex",
        "model": "gpt-test",
    }

    result = subprocess.run(
        [
            "powershell",
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            str(CODEX_WINDOWS_WRAPPER),
        ],
        input=json.dumps(payload, ensure_ascii=False),
        cwd=REPO_ROOT,
        env=env,
        encoding="utf-8",
        capture_output=True,
        check=True,
    )

    assert json.loads(result.stdout) == {"continue": True}
    assert read_entries(log_dir)[0]["prompt"] == payload["prompt"]


def test_submit_check_validates_without_sending_or_printing_key(tmp_path: Path):
    secret = "test-secret-that-must-not-be-printed"
    env = os.environ.copy()
    env.update(
        {
            "AI_LOG_SERVER": "https://example.invalid/api/ingest",
            "AI_LOG_API_KEY": secret,
            "AI_LOG_DIR": str(tmp_path),
        }
    )

    result = subprocess.run(
        [sys.executable, str(SUBMIT_LOG), "--check"],
        cwd=REPO_ROOT,
        env=env,
        text=True,
        capture_output=True,
        check=True,
    )

    assert "Configuration ready" in result.stdout
    assert secret not in result.stdout
    assert secret not in result.stderr
