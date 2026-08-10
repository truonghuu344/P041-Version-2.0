import json
import os
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
LOG_HOOK = REPO_ROOT / "scripts" / "log_hook.py"
SUBMIT_LOG = REPO_ROOT / "scripts" / "submit_log.py"
HOOK_CONFIG = REPO_ROOT / ".codex" / "hooks.json"


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


def read_entries(log_dir: Path) -> list[dict]:
    log_file = log_dir / "session.jsonl"
    return [json.loads(line) for line in log_file.read_text(encoding="utf-8").splitlines()]


def test_codex_hook_config_has_cross_platform_command_handlers():
    config = json.loads(HOOK_CONFIG.read_text(encoding="utf-8"))

    assert set(config["hooks"]) == {"UserPromptSubmit"}
    for event_groups in config["hooks"].values():
        for event_group in event_groups:
            for handler in event_group["hooks"]:
                assert handler["type"] == "command"
                assert "git rev-parse --show-toplevel" in handler["command"]
                assert "git rev-parse --show-toplevel" in handler["commandWindows"]


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
