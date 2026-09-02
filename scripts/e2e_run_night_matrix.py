#!/usr/bin/env python3
"""Overnight scenario-matrix driver for scripts/e2e_voice_interview.py.

Runs the fixed 9-round matrix (star x3, disrupt x3, poor x3) against the
local docker backend, sleeping 90s between rounds (not before the first),
retrying a round on apparent Gemini-quota exhaustion (60s backoff, then a
second retry after 15min), and saving a
`docker compose logs backend --since <round-start>` excerpt (grepped for
Gemini failures / fallback mentions) alongside each round's transcript JSON
as a sibling `.log.txt` file.

Round numbering: sequential 1..9 across the whole matrix (round 1-3 = star,
4-6 = disrupt, 7-9 = poor). Output files:
  docs/report/transcripts/round_<1..9>_<scenario>.json
  docs/report/transcripts/round_<1..9>_<scenario>.log.txt
  docs/report/transcripts/_matrix_summary.json

No secrets are read/printed/written beyond what e2e_voice_interview.py
already handles.

Usage:
    python scripts/e2e_run_night_matrix.py
    python scripts/e2e_run_night_matrix.py --only star   # subset for reruns
"""

from __future__ import annotations

import argparse
import asyncio
import json
import re
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import e2e_voice_interview as e2e  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parent.parent
TRANSCRIPTS_DIR = REPO_ROOT / "docs" / "report" / "transcripts"

FULL_MATRIX = (
    [("star", i) for i in range(1, 4)]
    + [("disrupt", i) for i in range(1, 4)]
    + [("poor", i) for i in range(1, 4)]
)

QUOTA_HINTS = re.compile(r"(429|quota|rate.?limit|resource.?exhausted)", re.IGNORECASE)
SLEEP_BETWEEN_ROUNDS_S = 90
RETRY_BACKOFFS_S = [60, 15 * 60]


def _looks_quota_related(result: dict | None, exc: Exception | None) -> bool:
    if exc is not None and QUOTA_HINTS.search(str(exc)):
        return True
    if result is not None and QUOTA_HINTS.search(result.get("server_error") or ""):
        return True
    return False


def _docker_logs_since(since_iso: str) -> str:
    try:
        proc = subprocess.run(
            ["docker", "compose", "logs", "backend", "--since", since_iso],
            cwd=str(REPO_ROOT),
            capture_output=True,
            timeout=60,
        )
        # Decode explicitly as UTF-8 (Vietnamese log lines break the default
        # Windows console codepage, e.g. cp1258, when using text=True above).
        return proc.stdout.decode("utf-8", errors="replace") + proc.stderr.decode("utf-8", errors="replace")
    except Exception as exc:  # best-effort log capture only, never fatal
        return f"<log capture failed: {exc}>"


def _extract_gemini_excerpts(raw_logs: str) -> list[str]:
    out = []
    for ln in raw_logs.splitlines():
        low = ln.lower()
        if "gemini" in low and any(k in low for k in ("failed", "error", "finish_reason")):
            out.append(ln)
        elif "fallback" in low:
            out.append(ln)
    return out


async def _run_one(scenario: str, round_n: int) -> dict:
    return await e2e.run_e2e_interview(scenario=scenario, round_n=round_n)


def _write_json(path: Path, data: dict | list) -> None:
    TRANSCRIPTS_DIR.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def run_round_with_retry(scenario: str, seq_round_n: int) -> dict:
    attempt = 0
    while True:
        start_dt = datetime.now(timezone.utc)
        start_iso = start_dt.strftime("%Y-%m-%dT%H:%M:%S")
        exc: Exception | None = None
        result: dict | None = None
        try:
            result = asyncio.run(_run_one(scenario, seq_round_n))
        except Exception as e:  # setup-level failure (auth/CV/JD/session/WS connect)
            exc = e

        quota_like = _looks_quota_related(result, exc)

        if quota_like and attempt < len(RETRY_BACKOFFS_S):
            wait_s = RETRY_BACKOFFS_S[attempt]
            print(
                f"[{scenario} r{seq_round_n}] quota-like failure "
                f"({exc if exc else result.get('server_error')!r}), waiting {wait_s}s then "
                f"retrying SAME round (attempt {attempt + 1}/{len(RETRY_BACKOFFS_S)})...",
                file=sys.stderr,
            )
            attempt += 1
            time.sleep(wait_s)
            continue

        # Past this point we are not retrying further; capture logs for this
        # (possibly final) attempt regardless of outcome.
        raw_logs = _docker_logs_since(start_iso)
        gemini_excerpts = _extract_gemini_excerpts(raw_logs)
        out_path = TRANSCRIPTS_DIR / f"round_{seq_round_n}_{scenario}.json"

        if exc is not None and not quota_like:
            result = {
                "scenario": scenario,
                "round": seq_round_n,
                "session_complete": False,
                "reached_closing": False,
                "assertions_summary": {"overall_ok": False},
                "server_error": f"setup failure (non-quota): {exc}",
            }
            _write_json(out_path, result)
        elif exc is not None and quota_like:
            # Retries exhausted and we never even got a usable result object.
            result = {
                "scenario": scenario,
                "round": seq_round_n,
                "session_complete": False,
                "reached_closing": False,
                "assertions_summary": {"overall_ok": False},
                "status": "BLOCKED-QUOTA",
                "server_error": f"quota-like failure, retries exhausted: {exc}",
            }
            _write_json(out_path, result)
        elif quota_like:
            # We do have a real result (round ran, possibly hit a quota-like
            # WS error mid-round or in fallback mode) but retries are
            # exhausted -> tag status, keep full content, re-persist.
            result["status"] = "BLOCKED-QUOTA"
            _write_json(out_path, result)
        # else: normal path, run_e2e_interview() already wrote the file.

        log_path = TRANSCRIPTS_DIR / f"round_{seq_round_n}_{scenario}.log.txt"
        log_path.write_text(
            f"# docker compose logs backend --since {start_iso}\n"
            f"# {len(gemini_excerpts)} Gemini/fallback-related line(s) extracted below "
            f"(full raw log not persisted here).\n\n" + "\n".join(gemini_excerpts) + "\n",
            encoding="utf-8",
        )

        result["_gemini_log_excerpt_count"] = len(gemini_excerpts)
        result["round_start_utc"] = start_iso
        result.setdefault("_output_path", str(out_path))
        return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--only",
        choices=["star", "disrupt", "poor"],
        default=None,
        help="Run only one scenario's 3 rounds (still uses that scenario's normal 1-3 "
        "sub-round numbers, useful for isolated re-runs after a BLOCKED-QUOTA round).",
    )
    args = parser.parse_args()

    matrix = FULL_MATRIX if args.only is None else [(s, r) for s, r in FULL_MATRIX if s == args.only]

    all_ok = True
    matrix_summary = []
    for i, (scenario, sc_round) in enumerate(matrix):
        seq = FULL_MATRIX.index((scenario, sc_round)) + 1
        if i > 0:
            print(f"Sleeping {SLEEP_BETWEEN_ROUNDS_S}s before next round...", file=sys.stderr)
            time.sleep(SLEEP_BETWEEN_ROUNDS_S)
        print(f"=== Round {seq}/9: scenario={scenario} sub-round={sc_round} ===", file=sys.stderr)
        result = run_round_with_retry(scenario, seq)
        ok = result.get("assertions_summary", {}).get("overall_ok")
        status = result.get("status", "OK" if ok else "FAIL")
        entry = {
            "seq": seq,
            "scenario": scenario,
            "status": status,
            "overall_ok": ok,
            "output_path": result.get("_output_path"),
        }
        matrix_summary.append(entry)
        all_ok = all_ok and bool(ok)
        print(json.dumps(entry, ensure_ascii=False), file=sys.stderr)

    summary_path = TRANSCRIPTS_DIR / "_matrix_summary.json"
    # Merge with any pre-existing summary (e.g. partial run / --only rerun).
    existing: list[dict] = []
    if summary_path.exists():
        try:
            existing = json.loads(summary_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            existing = []
    by_seq = {e["seq"]: e for e in existing}
    for e in matrix_summary:
        by_seq[e["seq"]] = e
    merged = [by_seq[k] for k in sorted(by_seq)]
    _write_json(summary_path, merged)

    print(json.dumps(merged, ensure_ascii=False, indent=2))
    return 0 if all_ok else 1


if __name__ == "__main__":
    sys.exit(main())
