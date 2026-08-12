#!/usr/bin/env python3
"""
Personal Claude Code work journal — independent of .ai-log (BTC's grading log).
Reads hook JSON from stdin, appends one line to .claude/memory/YYYY-MM-DD.md.
Fully local, no network calls. Never blocks: any error exits silently.
"""
import json
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MEMORY_DIR = ROOT / ".claude" / "memory"
MAX_PROMPT_CHARS = 3000
MAX_COMMAND_CHARS = 300


def build_line(data: dict, now: datetime) -> str | None:
    event = data.get("hook_event_name", "")
    ts = now.strftime("%H:%M:%S")

    if event == "UserPromptSubmit":
        prompt = data.get("prompt", "").strip()
        if not prompt:
            return None
        if len(prompt) > MAX_PROMPT_CHARS:
            prompt = prompt[:MAX_PROMPT_CHARS] + "…"
        return f"- `{ts}` [prompt] {prompt}"

    if event == "PostToolUse":
        tool_name = data.get("tool_name", "")
        tool_input = data.get("tool_input") or {}
        if tool_name in ("Edit", "Write"):
            path = tool_input.get("file_path", "")
            if not path:
                return None
            return f"- `{ts}` [{tool_name}] {path}"
        if tool_name == "Bash":
            command = tool_input.get("command", "").strip().replace("\n", " ")
            if not command:
                return None
            if len(command) > MAX_COMMAND_CHARS:
                command = command[:MAX_COMMAND_CHARS] + "…"
            return f"- `{ts}` [Bash] {command}"

    return None


def main():
    raw = sys.stdin.buffer.read().decode("utf-8", errors="replace").strip()
    if not raw:
        return
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return

    now = datetime.now()
    line = build_line(data, now)
    if not line:
        return

    MEMORY_DIR.mkdir(parents=True, exist_ok=True)
    day_file = MEMORY_DIR / f"{now:%Y-%m-%d}.md"
    is_new = not day_file.exists()
    with open(day_file, "a", encoding="utf-8") as f:
        if is_new:
            f.write(f"# Nhat ky lam viec - {now:%Y-%m-%d}\n\n")
        f.write(line + "\n")


if __name__ == "__main__":
    try:
        main()
    except Exception:
        pass
