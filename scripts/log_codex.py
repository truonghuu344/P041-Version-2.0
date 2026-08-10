#!/usr/bin/env python3
"""Recover Codex user prompts from local session transcripts.

Codex lifecycle hooks remain the fast path. This scanner is a pre-push safety
net for Codex builds that start and complete UserPromptSubmit hooks without
forwarding a usable stdin payload to the command handler.
"""

import argparse
import json
import os
import subprocess
import sys
from datetime import UTC, datetime, timedelta, timezone
from pathlib import Path

VN_TZ = timezone(timedelta(hours=7))
REPO_ROOT = Path(__file__).resolve().parent.parent

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


def git(*args: str) -> str:
    try:
        return subprocess.check_output(["git", *args], cwd=REPO_ROOT, text=True, stderr=subprocess.DEVNULL).strip()
    except (OSError, subprocess.SubprocessError):
        return ""


def normalize_path(value: str) -> str:
    return value.strip().lower().replace("/", "\\").rstrip("\\")


def matches_repo(session_cwd: str, repo_root: Path) -> bool:
    cwd = normalize_path(session_cwd)
    root = normalize_path(str(repo_root))
    return bool(cwd and root and (cwd == root or cwd.startswith(root + "\\")))


def parse_timestamp(value: str) -> datetime | None:
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (AttributeError, ValueError):
        return None


def transcript_roots() -> list[Path]:
    codex_home = Path(os.environ.get("CODEX_HOME", Path.home() / ".codex"))
    return [path for path in (codex_home / "sessions", codex_home / "archived_sessions") if path.exists()]


def iter_transcripts() -> list[Path]:
    files: list[Path] = []
    for root in transcript_roots():
        files.extend(root.rglob("*.jsonl"))
    return sorted(files)


def extract_prompts(transcript: Path, repo_root: Path, cutoff: datetime | None) -> list[dict[str, str]]:
    session_id = ""
    model = ""
    repo_matches = False
    prompts: list[dict[str, str]] = []

    try:
        lines = transcript.read_text(encoding="utf-8").splitlines()
    except OSError:
        return prompts

    for line in lines:
        try:
            item = json.loads(line)
        except json.JSONDecodeError:
            continue

        payload = item.get("payload") or {}
        if item.get("type") == "session_meta":
            session_id = payload.get("id") or payload.get("session_id") or transcript.stem
            thread_source = payload.get("thread_source")
            is_user_thread = thread_source in (None, "user")
            repo_matches = is_user_thread and matches_repo(payload.get("cwd", ""), repo_root)
            continue

        if not repo_matches:
            continue

        if item.get("type") == "turn_context" and isinstance(payload.get("model"), str):
            model = payload["model"]
            continue

        if item.get("type") != "event_msg" or payload.get("type") != "user_message":
            continue

        prompt = payload.get("message", "")
        if not isinstance(prompt, str) or not prompt.strip():
            continue

        timestamp = item.get("timestamp", "")
        timestamp_dt = parse_timestamp(timestamp)
        if cutoff and timestamp_dt and timestamp_dt < cutoff:
            continue

        client_id = payload.get("client_id") or f"line-{len(prompts)}"
        prompts.append(
            {
                "entry_id": f"codex-{session_id}-{client_id}",
                "session_id": session_id,
                "timestamp": timestamp,
                "model": model,
                "prompt": prompt.strip(),
            }
        )

    return prompts


def logged_entry_ids(log_dir: Path) -> set[str]:
    ids: set[str] = set()
    candidates = [log_dir / "session.jsonl", *sorted((log_dir / "archive").glob("*.jsonl"))]
    for candidate in candidates:
        if not candidate.exists():
            continue
        try:
            lines = candidate.read_text(encoding="utf-8-sig").splitlines()
        except OSError:
            continue
        for line in lines:
            try:
                entry_id = json.loads(line).get("entry_id")
            except json.JSONDecodeError:
                continue
            if entry_id:
                ids.add(entry_id)
    return ids


def build_entry(prompt: dict[str, str]) -> dict[str, str]:
    timestamp = parse_timestamp(prompt["timestamp"])
    ts = (timestamp or datetime.now(VN_TZ)).astimezone(VN_TZ).isoformat()
    origin = git("remote", "get-url", "origin")
    repo = origin.rstrip("/").split("/")[-1].removesuffix(".git") or REPO_ROOT.name
    return {
        "ts": ts,
        "tool": "codex",
        "event": "UserPromptSubmit",
        "entry_id": prompt["entry_id"],
        "session_id": prompt["session_id"],
        "model": prompt["model"],
        "repo": repo,
        "branch": git("rev-parse", "--abbrev-ref", "HEAD"),
        "commit": git("rev-parse", "--short", "HEAD"),
        "student": git("config", "user.email"),
        "prompt": prompt["prompt"][:1000],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Recover Codex prompts from transcripts")
    parser.add_argument("--auto", action="store_true", help="Scan recent sessions")
    parser.add_argument("--hours", type=int, default=24)
    parser.add_argument("--all", action="store_true", help="Ignore the time window")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    cutoff = None if args.all else datetime.now(UTC) - timedelta(hours=args.hours)
    log_dir = Path(os.environ.get("AI_LOG_DIR", ".ai-log"))
    if not log_dir.is_absolute():
        log_dir = REPO_ROOT / log_dir
    known_ids = logged_entry_ids(log_dir)

    entries: list[dict[str, str]] = []
    for transcript in iter_transcripts():
        for prompt in extract_prompts(transcript, REPO_ROOT, cutoff):
            if prompt["entry_id"] in known_ids:
                continue
            entries.append(build_entry(prompt))
            known_ids.add(prompt["entry_id"])

    if not entries:
        print("[codex-log] No new Codex prompts found.", file=sys.stderr)
        return

    if args.dry_run:
        print(f"[codex-log] DRY RUN: would log {len(entries)} prompt(s).")
        return

    log_dir.mkdir(parents=True, exist_ok=True)
    with (log_dir / "session.jsonl").open("a", encoding="utf-8") as handle:
        for entry in entries:
            handle.write(json.dumps(entry, ensure_ascii=False) + "\n")
    print(f"[codex-log] Logged {len(entries)} prompt(s) from Codex transcripts.", file=sys.stderr)


if __name__ == "__main__":
    main()
