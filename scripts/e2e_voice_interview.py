#!/usr/bin/env python3
"""E2E scenario runner for the voice mock-interview pipeline.

Plays the role of a candidate against the *real* backend API + WebSocket
endpoint — no mic, no browser, pure text/JSON traffic:

  1. Register (or, if already registered tonight, log in) a synthetic test
     account.
  2. Create a synthetic CV via the real CV creation API.
  3. Pick an existing JD via the real JD listing API.
  4. Start a voice interview session (POST /api/v1/interviews/start,
     mode="voice").
  5. Open the real WebSocket endpoint (/api/v1/ws/interview/{session_id})
     and exchange `ai_message` / `submit_answer` frames until
     `session_complete`, a per-turn timeout (120s) or a per-round timeout
     (15 min) — whichever happens first.
  6. Track a handful of running assertions per turn (never hard-crash on a
     failed assertion, just record it).
  7. Fetch the STAR report and write the full transcript + assertion
     results to docs/report/transcripts/round_<n>_<scenario>.json.

Answer sources are pluggable (a plain list, or a {scenario: [..]} mapping,
passed either as a Python object to run_e2e_interview() or as a JSON file
via --answers-file) so future scenarios (star / disrupt / poor answers)
can reuse this runner without touching this file.

No secrets are ever printed to stdout/stderr or written into the
transcript JSON. The generated test-account password lives only in
scripts/.e2e_test_creds.local (not tracked by git).

Standalone usage:
    python scripts/e2e_voice_interview.py --scenario smoke --round 0
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import secrets
import string
import sys
import time
from collections import defaultdict
from pathlib import Path
from typing import Any, Callable

import httpx
import websockets

# ---------------------------------------------------------------------------
# Constants / configuration
# ---------------------------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parent.parent
CREDS_FILE = Path(__file__).resolve().parent / ".e2e_test_creds.local"
TRANSCRIPTS_DIR = REPO_ROOT / "docs" / "report" / "transcripts"

API_PREFIX = "/api/v1"
DEFAULT_BACKEND_HTTP = os.environ.get("E2E_BACKEND_HTTP", "http://localhost:8000")
DEFAULT_BACKEND_WS = os.environ.get("E2E_BACKEND_WS", "ws://localhost:8000")

# Note: "*.local"/"*.test" TLDs are rejected by email-validator (IANA
# special-use domain check) even with deliverability checks disabled, so we
# use example.com (RFC 2606 reserved documentation domain — never a real
# mailbox) as the synthetic test address instead.
TEST_EMAIL = "e2e_night_bot@example.com"
TEST_FULL_NAME = "E2E Night Bot"

# Must mirror PHASES in backend/src/services/voice/voice_orchestrator.py.
# Danh sách lệch sẽ khiến assertion b_phase_is_valid báo FAIL hàng loạt dù
# backend chạy đúng (đã xảy ra ở round 20: 17/22 lượt bị báo sai chỉ vì file
# này còn giữ tên phase cũ). Test
# tests/test_voice_orchestrator.py::test_e2e_harness_phase_list_is_in_sync
# giữ hai danh sách khớp nhau.
PHASES = [
    "greeting",
    "self_intro",
    "experience_deepdive",
    "skills_assessment",
    "role_alignment",
    "candidate_qa",
    "admin_logistics",
    "closing",
]

PER_TURN_TIMEOUT_S = 120
PER_ROUND_TIMEOUT_S = 15 * 60

# Simple, honest STAR-ish answers for a smoke pass. Entirely synthetic —
# no real person's data (fake CNTT student, Python/Django profile).
DEFAULT_SMOKE_ANSWERS: list[str] = [
    "Chào bạn, mình đã sẵn sàng bắt đầu buổi phỏng vấn rồi ạ.",
    "Mình tên là Bot Test Nguyen, hiện là sinh viên năm cuối ngành Công nghệ "
    "thông tin. Mình tập trung vào backend với Python và Django, đã làm vài "
    "đồ án ở trường và một kỳ thực tập ngắn tại một công ty phần mềm.",
    "Trong kỳ thực tập, mục tiêu (Situation/Task) là xây dựng module quản lý "
    "đơn hàng cho một hệ thống bán hàng nội bộ. Mình (Action) đã thiết kế "
    "REST API bằng Django REST Framework, viết unit test và tối ưu truy vấn "
    "PostgreSQL. Kết quả (Result) là thời gian phản hồi API giảm khoảng 30% "
    "so với bản đầu tiên.",
    "Về kỹ năng, mình thành thạo Python, Django, REST API, PostgreSQL, Git; "
    "mình cũng có hiểu biết cơ bản về Docker và quy trình CI/CD.",
    "Mình tìm hiểu vị trí này cần người có nền tảng backend Python vững, "
    "quen làm việc với cơ sở dữ liệu quan hệ và quy trình CI/CD — mình nghĩ "
    "kinh nghiệm đồ án và thực tập của mình khá phù hợp với các yêu cầu đó.",
    "Mình biết công ty đang phát triển sản phẩm công nghệ phục vụ thị "
    "trường trong nước và có văn hóa chú trọng học hỏi liên tục, đó là điều "
    "mình thấy phù hợp với định hướng phát triển của bản thân.",
    "Cảm ơn bạn rất nhiều vì buổi phỏng vấn hôm nay, mình rất mong sớm nhận "
    "được phản hồi ạ.",
]

SCENARIO_ANSWERS: dict[str, list[str]] = {
    "smoke": DEFAULT_SMOKE_ANSWERS,
}

# ---------------------------------------------------------------------------
# Scenario answer banks for the overnight star / disrupt / poor matrix.
# All entirely synthetic (fake CNTT student, Python/Django profile) — no
# real person's data. Keyed by `phase` (not turn index) since real phase
# progression can merge/skip questions depending on answer quality.
# ---------------------------------------------------------------------------

STAR_ANSWERS_VI: dict[str, str] = {
    "greeting": "Chào bạn, mình đã sẵn sàng bắt đầu buổi phỏng vấn rồi ạ.",
    "self_intro": (
        "Tôi là Nguyễn Minh Quân, sinh viên năm cuối ngành Công nghệ thông tin. "
        "Trong dự án tốt nghiệp tôi xây hệ thống quản lý dữ liệu bằng Python, tự học "
        "Django, thiết kế database, triển khai API, hệ thống chạy ổn định được thầy "
        "đánh giá cao."
    ),
    "experience": (
        "Trong kỳ thực tập tại một công ty phần mềm, nhiệm vụ của tôi là xây dựng "
        "module quản lý đơn hàng cho hệ thống bán hàng nội bộ. Tôi đã thiết kế REST "
        "API bằng Django REST Framework, viết unit test đầy đủ, và tối ưu truy vấn "
        "PostgreSQL bằng cách thêm index và giảm N+1 query. Kết quả là thời gian phản "
        "hồi API giảm khoảng 30%, được mentor đánh giá là hoàn thành sớm hơn kế hoạch "
        "một tuần."
    ),
    "skills": (
        "Tôi thành thạo Python và Django ở mức có thể tự xây dựng REST API hoàn "
        "chỉnh, từ authentication, serializer đến tối ưu truy vấn PostgreSQL. Tôi "
        "cũng dùng Git hàng ngày để quản lý version, và có kinh nghiệm cơ bản đóng "
        "gói ứng dụng bằng Docker để triển khai."
    ),
    "position_knowledge": (
        "Tôi tìm hiểu vị trí này cần người có nền tảng backend Python vững, quen làm "
        "việc với cơ sở dữ liệu quan hệ, viết API RESTful và tham gia quy trình "
        "CI/CD. Tôi nghĩ kinh nghiệm đồ án tốt nghiệp và kỳ thực tập của mình khá sát "
        "với các yêu cầu đó, đặc biệt là phần thiết kế API và tối ưu database."
    ),
    "company_knowledge": (
        "Tôi biết công ty đang phát triển sản phẩm công nghệ phục vụ thị trường "
        "trong nước, có văn hóa chú trọng học hỏi liên tục và khuyến khích nhân viên "
        "chủ động đề xuất cải tiến quy trình. Tôi thấy điều đó phù hợp với định "
        "hướng phát triển bản thân của mình."
    ),
    "closing": (
        "Cảm ơn bạn rất nhiều vì buổi phỏng vấn hôm nay, mình rất mong sớm nhận "
        "được phản hồi ạ."
    ),
}

# Deflecting / off-topic non-answers, cycled per new phase encountered (not
# a real answer to whatever question is currently being asked).
DISRUPT_OFFTOPIC_VI: list[str] = [
    "Ơ, câu hỏi này là gì vậy bạn?",
    "Bạn có nghe tôi nói không đấy?",
    "Xin lỗi bạn nhắc lại giúp mình được không, mình không rõ ý bạn muốn hỏi gì.",
]

# Shorter but genuine answers, sent only *after* the off-topic deflection for
# that phase has already been sent once.
DISRUPT_REAL_ANSWERS_VI: dict[str, str] = {
    "greeting": "Rồi ạ, mình sẵn sàng bắt đầu.",
    "self_intro": "Mình là sinh viên CNTT năm cuối, chuyên backend Python và Django.",
    "experience": (
        "Mình từng thực tập backend, xây API quản lý đơn hàng bằng Django, giảm "
        "được thời gian phản hồi khoảng 30%."
    ),
    "skills": "Mình thạo Python, Django, REST API, PostgreSQL và Git.",
    "position_knowledge": (
        "Vị trí này cần nền tảng backend Python vững và quen CI/CD, mình nghĩ mình "
        "khá phù hợp."
    ),
    "company_knowledge": "Công ty tập trung sản phẩm công nghệ trong nước và đề cao học hỏi liên tục.",
    "closing": "Cảm ơn bạn đã dành thời gian phỏng vấn mình hôm nay.",
}

POOR_ANSWERS_VI: list[str] = [
    "Em không biết ạ.",
    "Em chưa hiểu câu hỏi lắm.",
    "Em không rõ lắm ạ.",
]

AnswerSource = Callable[[int, str, str], str]


class PhaseKeyedAnswerSource:
    """Answers keyed by `phase`, degrading to a generic filler for unknown
    phases (e.g. if the backend ever returns a phase name not in PHASES)."""

    def __init__(self, bank: dict[str, str], default: str = "Dạ vâng ạ.") -> None:
        self._bank = bank
        self._default = default

    def __call__(self, turn_index: int, phase: str, ai_text: str) -> str:  # noqa: ARG002
        return self._bank.get(phase, self._default)


class PoorAnswerSource:
    """Cycles through a fixed pool of non-committal / low-effort answers,
    regardless of phase or question content."""

    def __init__(self, pool: list[str]) -> None:
        self._pool = pool

    def __call__(self, turn_index: int, phase: str, ai_text: str) -> str:  # noqa: ARG002
        return self._pool[turn_index % len(self._pool)]


class DisruptAnswerSource:
    """The first time a given `phase` is seen, sends an off-topic deflection.
    Every subsequent turn within that same phase sends a real (short but
    genuine) answer.

    Exposes `.last_kind` ("offtopic" | "real") and `.last_phase` after each
    call so the caller can assert the bot did NOT advance phase off the back
    of an off-topic non-answer (only 1 off-topic message per phase is used,
    deliberately staying under every entry in the backend's
    MAX_TURNS_PER_PHASE escape-valve threshold, so any premature advance
    observed is attributable to the LLM/fallback logic, not the escape
    valve).
    """

    def __init__(self, offtopic_pool: list[str], real_bank: dict[str, str]) -> None:
        self._offtopic_pool = offtopic_pool
        self._real_bank = real_bank
        self._offtopic_used_for: set[str] = set()
        self._offtopic_i = 0
        self.last_kind: str | None = None
        self.last_phase: str | None = None

    def __call__(self, turn_index: int, phase: str, ai_text: str) -> str:  # noqa: ARG002
        self.last_phase = phase
        if phase not in self._offtopic_used_for:
            self._offtopic_used_for.add(phase)
            self.last_kind = "offtopic"
            text = self._offtopic_pool[self._offtopic_i % len(self._offtopic_pool)]
            self._offtopic_i += 1
            return text
        self.last_kind = "real"
        return self._real_bank.get(phase, "Dạ, mình xin trả lời câu hỏi ạ.")


# ---------------------------------------------------------------------------
# Credentials (never printed, never committed)
# ---------------------------------------------------------------------------


def _generate_password(length: int = 24) -> str:
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*()-_=+"
    return "".join(secrets.choice(alphabet) for _ in range(length))


def _load_or_create_creds() -> dict[str, str]:
    """Reuse tonight's generated password if this script already ran once,
    otherwise mint a new random one. Never logged/printed."""
    if CREDS_FILE.exists():
        try:
            data = json.loads(CREDS_FILE.read_text(encoding="utf-8"))
            if data.get("email") == TEST_EMAIL and data.get("password"):
                return data
        except (json.JSONDecodeError, OSError):
            pass

    data = {"email": TEST_EMAIL, "password": _generate_password()}
    CREDS_FILE.write_text(json.dumps(data), encoding="utf-8")
    try:
        os.chmod(CREDS_FILE, 0o600)
    except OSError:
        pass  # best-effort on platforms without POSIX perms (e.g. Windows)
    return data


# ---------------------------------------------------------------------------
# Assertion bookkeeping
# ---------------------------------------------------------------------------


class AssertionTracker:
    """Records pass/fail per criterion per turn without ever raising."""

    def __init__(self) -> None:
        self._records: dict[str, list[dict[str, Any]]] = defaultdict(list)

    def record(self, criterion: str, turn: int, passed: bool, detail: str = "") -> None:
        self._records[criterion].append({"turn": turn, "passed": bool(passed), "detail": detail})

    def summary(self) -> dict[str, Any]:
        out: dict[str, Any] = {}
        overall_ok = True
        for criterion, entries in self._records.items():
            all_passed = all(e["passed"] for e in entries)
            overall_ok = overall_ok and all_passed
            out[criterion] = {
                "all_passed": all_passed,
                "total_checks": len(entries),
                "failed_checks": [e for e in entries if not e["passed"]],
            }
        out["overall_ok"] = overall_ok
        return out

    def as_dict(self) -> dict[str, list[dict[str, Any]]]:
        return dict(self._records)


# ---------------------------------------------------------------------------
# Answer source plumbing
# ---------------------------------------------------------------------------


def make_answer_source(
    scenario: str,
    answers: list[str] | dict[str, list[str]] | None,
) -> AnswerSource:
    """Build a callable(turn_index, phase, ai_text) -> answer_text.

    `answers` (explicit override) may be:
      - None: fall back to the built-in scenario logic below.
      - list[str]: used directly as a turn-indexed answer pool for any
        scenario name.
      - dict[str, list[str]]: looked up by `scenario`, then used as a
        turn-indexed pool.
    An explicit `answers` argument always takes precedence over the built-in
    scenario banks (kept for ad-hoc / backwards-compatible CLI usage).

    When `answers` is None, scenario dispatches to:
      - "star": PhaseKeyedAnswerSource over STAR_ANSWERS_VI (rich, full
        STAR-style answers).
      - "disrupt": DisruptAnswerSource (1 off-topic deflection per phase,
        then a real short answer).
      - "poor": PoorAnswerSource cycling through low-effort non-answers.
      - anything else (e.g. "smoke"): the legacy turn-indexed SCENARIO_ANSWERS
        pool, degrading to the last answer if the conversation runs longer
        than the pool (so a run degrades gracefully instead of crashing).
    """
    if answers is not None:
        if isinstance(answers, dict):
            pool = answers.get(scenario) or next(iter(answers.values()), DEFAULT_SMOKE_ANSWERS)
        elif isinstance(answers, list):
            pool = answers
        else:
            raise TypeError(f"Unsupported answers type: {type(answers)!r}")
        if not pool:
            pool = DEFAULT_SMOKE_ANSWERS

        def _source(turn_index: int, phase: str, ai_text: str) -> str:  # noqa: ARG001
            if turn_index < len(pool):
                return pool[turn_index]
            return pool[-1]

        return _source

    if scenario == "star":
        return PhaseKeyedAnswerSource(STAR_ANSWERS_VI)
    if scenario == "disrupt":
        return DisruptAnswerSource(DISRUPT_OFFTOPIC_VI, DISRUPT_REAL_ANSWERS_VI)
    if scenario == "poor":
        return PoorAnswerSource(POOR_ANSWERS_VI)

    pool = SCENARIO_ANSWERS.get(scenario, DEFAULT_SMOKE_ANSWERS)

    def _source(turn_index: int, phase: str, ai_text: str) -> str:  # noqa: ARG001
        if turn_index < len(pool):
            return pool[turn_index]
        return pool[-1]

    return _source


# ---------------------------------------------------------------------------
# HTTP setup steps (real API calls)
# ---------------------------------------------------------------------------


async def _ensure_account(client: httpx.AsyncClient) -> tuple[str, str]:
    """Register the synthetic bot account, or log in if it already exists
    (e.g. a prior run tonight already created it). Returns (email, jwt)."""
    creds = _load_or_create_creds()
    email, password = creds["email"], creds["password"]

    login_resp = await client.post(f"{API_PREFIX}/auth/login", json={"email": email, "password": password})
    if login_resp.status_code == 200:
        return email, login_resp.json()["access_token"]

    reg_resp = await client.post(
        f"{API_PREFIX}/auth/register",
        json={"email": email, "password": password, "full_name": TEST_FULL_NAME, "role": "student"},
    )
    if reg_resp.status_code not in (200, 201):
        raise RuntimeError(
            f"Registration failed with status {reg_resp.status_code}. The account may already "
            "exist server-side under a password not recorded locally (creds file missing/stale). "
            f"Response body (no secrets): {reg_resp.text[:300]!r}"
        )

    login_resp2 = await client.post(f"{API_PREFIX}/auth/login", json={"email": email, "password": password})
    login_resp2.raise_for_status()
    return email, login_resp2.json()["access_token"]


def _synthetic_cv_payload() -> dict[str, Any]:
    """Entirely synthetic CNTT student profile — Python/Django skills.
    No real person's data."""
    return {
        "title": "CV E2E Bot - Backend Developer (Synthetic)",
        "template_name": "classic",
        "personal_info": {
            "full_name": TEST_FULL_NAME,
            "email": TEST_EMAIL,
            "phone": "0900000000",
            "location": "Ha Noi, Viet Nam",
        },
        "summary": (
            "Sinh vien nam cuoi nganh Cong nghe thong tin (du lieu tong hop cho "
            "kiem thu tu dong), tap trung phat trien backend voi Python va Django."
        ),
        "education": [
            {
                "description": (
                    "Dai hoc Tong Hop Ky Thuat (du lieu tong hop) - Ky su CNTT - "
                    "2022-2026 - GPA 3.4/4.0"
                ),
            },
        ],
        "experience": [
            {
                "description": (
                    "Backend Intern - Cong Ty Phan Mem Tong Hop (du lieu tong hop) - "
                    "06/2025-09/2025 - Xay dung module quan ly don hang bang Django "
                    "REST Framework, giam thoi gian phan hoi API ~30%."
                ),
            },
        ],
        "skills": ["Python", "Django", "REST API", "PostgreSQL", "Git", "Docker (co ban)"],
        "projects": [
            {
                "description": (
                    "He thong quan ly thu vien (do an mon hoc, du lieu tong hop) - "
                    "Django + PostgreSQL, trien khai bang Docker Compose."
                ),
            },
        ],
    }


async def _ensure_cv(client: httpx.AsyncClient, token: str) -> str:
    headers = {"Authorization": f"Bearer {token}"}
    resp = await client.post(f"{API_PREFIX}/cvs/manual", json=_synthetic_cv_payload(), headers=headers)
    resp.raise_for_status()
    return resp.json()["id"]


async def _pick_jd(client: httpx.AsyncClient, token: str) -> str:
    headers = {"Authorization": f"Bearer {token}"}
    resp = await client.get(f"{API_PREFIX}/jds", headers=headers)
    resp.raise_for_status()
    jds = resp.json()
    if not jds:
        raise RuntimeError(
            "GET /api/v1/jds returned no JDs and the interview-start endpoint "
            "(InterviewStartRequest) does not accept inline JD text — nothing to "
            "attach the session to."
        )
    return jds[0]["id"]


async def _start_interview(
    client: httpx.AsyncClient,
    token: str,
    cv_id: str,
    jd_id: str,
    language: str = "vi",
) -> str:
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "cv_id": cv_id,
        "jd_id": jd_id,
        "total_questions": 5,
        "language": language,
        "mode": "voice",
    }
    resp = await client.post(f"{API_PREFIX}/interviews/start", json=payload, headers=headers)
    resp.raise_for_status()
    return resp.json()["session_id"]


async def _fetch_report(client: httpx.AsyncClient, token: str, session_id: str) -> tuple[int, Any]:
    headers = {"Authorization": f"Bearer {token}"}
    resp = await client.get(f"{API_PREFIX}/interviews/{session_id}/report", headers=headers)
    try:
        body = resp.json()
    except ValueError:
        body = resp.text
    return resp.status_code, body


# ---------------------------------------------------------------------------
# WebSocket helpers
# ---------------------------------------------------------------------------


async def _recv_json_until(
    ws: Any,
    want_types: set[str],
    deadline: float,
    misc_log: list[dict[str, Any]],
) -> dict[str, Any]:
    """Receive frames until one whose `type` is in want_types, or timeout."""
    while True:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise TimeoutError("Timed out waiting for one of: " + ", ".join(sorted(want_types)))
        raw = await asyncio.wait_for(ws.recv(), timeout=remaining)
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            misc_log.append({"ts": time.time(), "raw_non_json": raw[:300]})
            continue
        if data.get("type") in want_types:
            return data
        misc_log.append({"ts": time.time(), "type": data.get("type"), "payload_keys": list(data.keys())})


# ---------------------------------------------------------------------------
# Main orchestration
# ---------------------------------------------------------------------------


async def run_e2e_interview(
    scenario: str = "smoke",
    round_n: int = 0,
    answers: list[str] | dict[str, list[str]] | None = None,
    backend_http: str = DEFAULT_BACKEND_HTTP,
    backend_ws: str = DEFAULT_BACKEND_WS,
    language: str = "vi",
) -> dict[str, Any]:
    """Run one full E2E voice-interview round and write the transcript JSON.

    Returns a summary dict (also embedded in the transcript file). Never
    raises for interview-level failures (assertion failures, timeouts) —
    those are recorded. It *can* raise for setup failures (auth/CV/JD/
    session creation) since without those nothing meaningful can run; the
    caller (or CLI __main__) is responsible for reporting that.
    """
    answer_source = make_answer_source(scenario, answers)
    tracker = AssertionTracker()
    transcript: list[dict[str, Any]] = []
    misc_log: list[dict[str, Any]] = []

    started_at = time.time()
    session_id: str | None = None
    cv_id: str | None = None
    jd_id: str | None = None
    session_complete = False
    reached_closing = False
    error_message: str | None = None
    report_status: int | None = None
    report_body: Any = None

    async with httpx.AsyncClient(base_url=backend_http, timeout=30.0) as client:
        email, token = await _ensure_account(client)
        cv_id = await _ensure_cv(client, token)
        jd_id = await _pick_jd(client, token)
        session_id = await _start_interview(client, token, cv_id, jd_id, language=language)

        ws_url = f"{backend_ws}{API_PREFIX}/ws/interview/{session_id}?token={token}"
        round_deadline = time.monotonic() + PER_ROUND_TIMEOUT_S
        seen_texts: set[str] = set()
        seen_phase_max_idx = -1
        turn_idx = 0
        # For scenario "disrupt": {"phase": <phase we answered off-topic>}
        # set right after sending an off-topic deflection, consumed on the
        # *next* ai_message to assert the bot did not advance phase off the
        # back of that non-answer.
        pending_disrupt_check: dict[str, str] | None = None

        try:
            async with websockets.connect(ws_url, open_timeout=30) as ws:
                turn_deadline = min(round_deadline, time.monotonic() + PER_TURN_TIMEOUT_S)
                msg = await _recv_json_until(ws, {"ai_message", "session_complete", "error"}, turn_deadline, misc_log)

                while True:
                    if msg["type"] == "error":
                        error_message = msg.get("message", "")
                        transcript.append({"turn": turn_idx, "direction": "server_error", "text": error_message, "ts": time.time()})
                        break

                    if msg["type"] == "session_complete":
                        session_complete = True
                        break

                    # msg["type"] == "ai_message"
                    text = msg.get("text", "") or ""
                    phase = msg.get("phase", "") or ""
                    transcript.append({"turn": turn_idx, "direction": "ai", "text": text, "phase": phase, "ts": time.time()})

                    # (f, "disrupt" scenario only) the previous turn sent an
                    # off-topic non-answer for `phase` -> the bot must still
                    # be on that same phase now (re-prompting), not advanced.
                    if pending_disrupt_check is not None:
                        expected_phase = pending_disrupt_check["phase"]
                        no_premature_advance = phase == expected_phase
                        tracker.record(
                            "f_disrupt_no_premature_advance",
                            turn_idx,
                            no_premature_advance,
                            detail=(
                                f"off_topic_answered_phase={expected_phase} "
                                f"next_ai_message_phase={phase}"
                            ),
                        )
                        pending_disrupt_check = None

                    # (a) no leaking raw JSON / markdown code fences in the message text
                    leak = ("```" in text) or text.strip().startswith("{") or ('"message"' in text)
                    tracker.record("a_no_json_leak", turn_idx, not leak, detail="" if not leak else text[:200])

                    # (b) phase is one of the 7 valid values and never regresses
                    valid_phase = phase in PHASES
                    tracker.record("b_phase_is_valid", turn_idx, valid_phase, detail=phase)
                    if valid_phase:
                        phase_idx = PHASES.index(phase)
                        no_regression = seen_phase_max_idx == -1 or phase_idx >= seen_phase_max_idx
                        tracker.record(
                            "b_no_phase_regression",
                            turn_idx,
                            no_regression,
                            detail=f"phase={phase} idx={phase_idx} max_seen_idx={seen_phase_max_idx}",
                        )
                        seen_phase_max_idx = max(seen_phase_max_idx, phase_idx)
                        if phase == "closing":
                            reached_closing = True

                    # (c) no two ai_message texts are byte-identical within the session
                    is_dup = text in seen_texts
                    tracker.record("c_no_duplicate_ai_text", turn_idx, not is_dup, detail="" if not is_dup else text[:200])
                    seen_texts.add(text)

                    answer = answer_source(turn_idx, phase, text)
                    if scenario == "disrupt" and getattr(answer_source, "last_kind", None) == "offtopic":
                        pending_disrupt_check = {"phase": phase}
                    transcript.append({"turn": turn_idx, "direction": "user", "text": answer, "ts": time.time()})
                    await ws.send(json.dumps({"type": "submit_answer", "text": answer}, ensure_ascii=False))
                    turn_idx += 1

                    if time.monotonic() >= round_deadline:
                        tracker.record("d_reaches_closing_and_complete", turn_idx, False, detail="round timeout before next ai_message")
                        break

                    turn_deadline = min(round_deadline, time.monotonic() + PER_TURN_TIMEOUT_S)
                    try:
                        msg = await _recv_json_until(ws, {"ai_message", "session_complete", "error"}, turn_deadline, misc_log)
                    except TimeoutError:
                        tracker.record("d_reaches_closing_and_complete", turn_idx, False, detail="per-turn timeout waiting for next ai_message")
                        break
        except (OSError, websockets.exceptions.WebSocketException) as exc:
            error_message = f"WebSocket connection error: {exc}"
            misc_log.append({"ts": time.time(), "ws_connect_error": str(exc)})

        # (d) session actually reaches closing phase + session_complete before timeout
        tracker.record(
            "d_reaches_closing_and_complete",
            turn_idx,
            reached_closing and session_complete,
            detail=f"reached_closing={reached_closing} session_complete={session_complete}",
        )

        # (g, "poor" scenario only) explicit alias for the scenario-specific
        # ask: does the bot still walk through all 7 phases to
        # closing/session_complete instead of ending the session early when
        # every answer is a non-committal "I don't know"? Same underlying
        # signal as (d), recorded under its own name for report clarity.
        if scenario == "poor":
            tracker.record(
                "g_poor_no_early_end",
                turn_idx,
                reached_closing and session_complete,
                detail=f"reached_closing={reached_closing} session_complete={session_complete}",
            )

        # (e) report endpoint returns 200 with content; greeting excluded from
        # scored Q&A if the report shape exposes that (it currently doesn't —
        # InterviewReportOut only exposes aggregate star_scores, not per-question
        # entries, so that sub-check is marked not_applicable).
        if session_complete and session_id:
            report_status, report_body = await _fetch_report(client, token, session_id)
            report_ok = report_status == 200 and bool(report_body)
            tracker.record("e_report_200_with_content", turn_idx, report_ok, detail=f"status={report_status}")

            greeting_text = next((t["text"] for t in transcript if t.get("direction") == "ai" and t.get("phase") == "greeting"), None)
            qa_entries = report_body.get("qa") or report_body.get("questions") if isinstance(report_body, dict) else None
            if qa_entries and greeting_text:
                greeting_present = any(entry.get("question") == greeting_text or entry.get("text") == greeting_text for entry in qa_entries)
                tracker.record("e_greeting_excluded_from_scored_qa", turn_idx, not greeting_present, detail="checked against exposed qa entries")
            else:
                tracker.record(
                    "e_greeting_excluded_from_scored_qa",
                    turn_idx,
                    True,
                    detail="not_applicable: InterviewReportOut does not expose per-question Q&A entries",
                )
        else:
            tracker.record("e_report_200_with_content", turn_idx, False, detail="session never completed; report not fetched")
            tracker.record("e_greeting_excluded_from_scored_qa", turn_idx, False, detail="session never completed; report not fetched")

    ended_at = time.time()
    assertions_summary = tracker.summary()

    result = {
        "scenario": scenario,
        "round": round_n,
        "backend_http": backend_http,
        "backend_ws": backend_ws,
        "session_id": session_id,
        "cv_id": cv_id,
        "jd_id": jd_id,
        "language": language,
        "started_at": started_at,
        "ended_at": ended_at,
        "duration_s": round(ended_at - started_at, 2),
        "account_email": email,
        "turn_count": turn_idx,
        "reached_closing": reached_closing,
        "session_complete": session_complete,
        "server_error": error_message,
        "report_status": report_status,
        "report_body": report_body,
        "assertions_summary": assertions_summary,
        "assertions_detail": tracker.as_dict(),
        "transcript": transcript,
        "misc_log": misc_log,
        # Explicitly never populated: password, token, cookie, Authorization header.
    }

    TRANSCRIPTS_DIR.mkdir(parents=True, exist_ok=True)
    out_path = TRANSCRIPTS_DIR / f"round_{round_n}_{scenario}.json"
    out_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    result["_output_path"] = str(out_path)
    return result


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--scenario", default="smoke", help="Scenario name (default: smoke)")
    parser.add_argument("--round", type=int, default=0, help="Round number, used in the output filename (default: 0)")
    parser.add_argument("--backend-http", default=DEFAULT_BACKEND_HTTP, help="Base HTTP URL of the backend")
    parser.add_argument("--backend-ws", default=DEFAULT_BACKEND_WS, help="Base WS URL of the backend")
    parser.add_argument("--language", default="vi", choices=["vi", "en", "bilingual"], help="Interview language")
    parser.add_argument(
        "--answers-file",
        default=None,
        help="Optional JSON file with either a list[str] of answers or a {scenario: list[str]} mapping",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)

    answers: list[str] | dict[str, list[str]] | None = None
    if args.answers_file:
        answers = json.loads(Path(args.answers_file).read_text(encoding="utf-8"))

    result = asyncio.run(
        run_e2e_interview(
            scenario=args.scenario,
            round_n=args.round,
            answers=answers,
            backend_http=args.backend_http,
            backend_ws=args.backend_ws,
            language=args.language,
        )
    )

    summary = {
        "scenario": result["scenario"],
        "round": result["round"],
        "session_id": result["session_id"],
        "session_complete": result["session_complete"],
        "reached_closing": result["reached_closing"],
        "turn_count": result["turn_count"],
        "duration_s": result["duration_s"],
        "overall_ok": result["assertions_summary"].get("overall_ok"),
        "output_path": result["_output_path"],
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0 if summary["overall_ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
