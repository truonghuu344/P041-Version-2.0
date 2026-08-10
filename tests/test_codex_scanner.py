import json
import os
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
SCANNER = REPO_ROOT / "scripts" / "log_codex.py"


def write_transcript(path: Path, cwd: Path, thread_source: str = "user") -> None:
    path.parent.mkdir(parents=True)
    records = [
        {
            "timestamp": "2026-08-10T03:13:41Z",
            "type": "session_meta",
            "payload": {
                "id": "session-1",
                "cwd": str(cwd),
                "thread_source": thread_source,
            },
        },
        {
            "timestamp": "2026-08-10T03:13:41Z",
            "type": "turn_context",
            "payload": {"model": "gpt-test"},
        },
        {
            "timestamp": "2026-08-10T03:13:42Z",
            "type": "event_msg",
            "payload": {
                "type": "user_message",
                "client_id": "client-1",
                "message": "Prompt testing tiếng Việt",
            },
        },
    ]
    path.write_text(
        "\n".join(json.dumps(record, ensure_ascii=False) for record in records),
        encoding="utf-8",
    )


def run_scanner(codex_home: Path, log_dir: Path) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    env["CODEX_HOME"] = str(codex_home)
    env["AI_LOG_DIR"] = str(log_dir)
    return subprocess.run(
        [sys.executable, str(SCANNER), "--all"],
        cwd=REPO_ROOT,
        env=env,
        text=True,
        encoding="utf-8",
        capture_output=True,
        check=True,
    )


def test_codex_scanner_recovers_prompt_and_deduplicates(tmp_path: Path) -> None:
    codex_home = tmp_path / "codex"
    log_dir = tmp_path / "logs"
    write_transcript(codex_home / "sessions" / "rollout.jsonl", REPO_ROOT)

    first = run_scanner(codex_home, log_dir)
    second = run_scanner(codex_home, log_dir)

    entries = [json.loads(line) for line in (log_dir / "session.jsonl").read_text(encoding="utf-8").splitlines()]
    assert "Logged 1 prompt" in first.stderr
    assert "No new Codex prompts" in second.stderr
    assert len(entries) == 1
    assert entries[0]["prompt"] == "Prompt testing tiếng Việt"
    assert entries[0]["model"] == "gpt-test"
    assert entries[0]["entry_id"] == "codex-session-1-client-1"


def test_codex_scanner_ignores_other_repositories(tmp_path: Path) -> None:
    codex_home = tmp_path / "codex"
    log_dir = tmp_path / "logs"
    write_transcript(codex_home / "sessions" / "rollout.jsonl", tmp_path / "other")

    result = run_scanner(codex_home, log_dir)

    assert "No new Codex prompts" in result.stderr
    assert not (log_dir / "session.jsonl").exists()


def test_codex_scanner_ignores_subagent_transcripts(tmp_path: Path) -> None:
    codex_home = tmp_path / "codex"
    log_dir = tmp_path / "logs"
    write_transcript(
        codex_home / "sessions" / "rollout.jsonl",
        REPO_ROOT,
        thread_source="subagent",
    )

    result = run_scanner(codex_home, log_dir)

    assert "No new Codex prompts" in result.stderr
    assert not (log_dir / "session.jsonl").exists()
