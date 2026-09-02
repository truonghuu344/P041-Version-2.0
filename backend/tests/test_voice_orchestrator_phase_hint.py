"""
Regression tests: phase hint PHAI toi duoc Gemini.

Boi canh bug (xac nhan truc tiep trong source truoc khi fix):
`VoiceInterviewOrchestrator._call_llm()` append phase hint dong
(`_build_phase_hint()`) vao cuoi danh sach messages duoi dang
`{"role": "system", ...}`. Nhung `_try_gemini()` lai `continue` bo qua MOI
message co role == "system" khi dung `gemini_contents`, va chi truyen
`self._system_prompt` (prompt tinh) vao `GenerateContentConfig.system_instruction`.

Hau qua: phase hint -- thu DUY NHAT mang state dong `current_phase` va quy tac
"chi advance phase khi ung vien DA THUC SU tra loi" toi model -- bi drop im lang,
khong bao gio roi khoi process.

Cac test duoi day chay HOAN TOAN OFFLINE: `google.genai` duoc stub qua
`sys.modules` (package that cung khong duoc cai trong venv), khong co request
mang nao. Du lieu CV/JD la synthetic.
"""

from __future__ import annotations

import sys
import types as pytypes
from typing import Any

import pytest

from src.services.voice.voice_orchestrator import VoiceInterviewOrchestrator

# Cac doan chuoi lay tu `_build_phase_hint()` (tieng Viet, co dau).
HINT_PREFIX_VI = '[Giai đoạn hiện tại: '
HINT_ANSWERED_RULE_VI = "ĐÃ TRẢ LỜI ĐÚNG"
HINT_HOLD_RULE_VI = "GIỮ NGUYÊN phase hiện tại"


# ─── Stub google.genai (offline) ────────────────────────────────────────────


class _FakeContent:
    def __init__(self, role: str, parts: list[Any]) -> None:
        self.role = role
        self.parts = parts


class _FakePart:
    def __init__(self, text: str) -> None:
        self.text = text


class _FakeGenerateContentConfig:
    def __init__(self, **kwargs: Any) -> None:
        self.kwargs = kwargs


class _FakeThinkingConfig:
    def __init__(self, **kwargs: Any) -> None:
        self.kwargs = kwargs


class _FakeResponse:
    def __init__(self, text: str | None) -> None:
        self.text = text
        self.candidates: list[Any] = []
        self.prompt_feedback = None


class _RecordingModels:
    """Ghi lai moi lan goi generate_content de assert payload gui len Gemini."""

    def __init__(self, replies: list[str | None]) -> None:
        self.replies = list(replies)
        self.calls: list[dict[str, Any]] = []

    def generate_content(self, *, model: str, contents: Any, config: Any) -> _FakeResponse:
        self.calls.append({"model": model, "contents": contents, "config": config})
        reply = self.replies.pop(0) if self.replies else None
        return _FakeResponse(reply)


class _FakeClient:
    def __init__(self, models: _RecordingModels) -> None:
        self.models = models


def _install_fake_genai(
    monkeypatch: pytest.MonkeyPatch, replies: list[str | None],
) -> _RecordingModels:
    """Cai `google.genai` gia vao sys.modules; tra ve recorder de assert."""
    recorder = _RecordingModels(replies)

    fake_types = pytypes.ModuleType("google.genai.types")
    fake_types.Content = _FakeContent
    fake_types.Part = _FakePart
    fake_types.GenerateContentConfig = _FakeGenerateContentConfig
    fake_types.ThinkingConfig = _FakeThinkingConfig

    fake_genai = pytypes.ModuleType("google.genai")
    fake_genai.types = fake_types
    fake_genai.Client = lambda api_key: _FakeClient(recorder)

    # `google` la namespace package dung chung (google.auth, google.protobuf...).
    # Giu module goc neu da duoc import, chi gan them attribute `genai` --
    # monkeypatch hoan nguyen tat ca sau moi test.
    google_pkg = sys.modules.get("google") or pytypes.ModuleType("google")
    monkeypatch.setitem(sys.modules, "google", google_pkg)
    monkeypatch.setattr(google_pkg, "genai", fake_genai, raising=False)
    monkeypatch.setitem(sys.modules, "google.genai", fake_genai)
    monkeypatch.setitem(sys.modules, "google.genai.types", fake_types)
    return recorder


def _stub_settings(monkeypatch: pytest.MonkeyPatch) -> None:
    """Ep `_call_llm` di vao nhanh Gemini (can api key khac rong)."""
    monkeypatch.setattr(
        "src.services.voice.voice_orchestrator.get_settings",
        lambda: pytypes.SimpleNamespace(
            google_genai_api_key="test-key-not-a-real-secret",
            voice_llm_model="fake-primary-model",
            voice_llm_fallback_model="fake-fallback-model",
        ),
    )


def _make_orchestrator(language: str = "vi") -> VoiceInterviewOrchestrator:
    return VoiceInterviewOrchestrator(
        cv_text="Sinh vien nam 4 nganh CNTT, ky nang Python, FastAPI, PostgreSQL.",
        jd_title="Backend Developer Intern",
        jd_requirements="Yeu cau: Python, FastAPI, REST API, Git.",
        language=language,
    )


def _valid_reply(phase: str) -> str:
    return '{"message": "Cau hoi tiep theo?", "phase": "' + phase + '", "done": false}'


def _system_instruction(call: dict[str, Any]) -> str:
    return call["config"].kwargs["system_instruction"]


# ─── Test ───────────────────────────────────────────────────────────────────


class TestPhaseHintReachesModel:
    async def test_phase_hint_present_in_system_instruction_vi(self, monkeypatch):
        """Bug chinh: phase hint phai co mat trong payload gui len Gemini."""
        recorder = _install_fake_genai(monkeypatch, [_valid_reply("greeting")])
        _stub_settings(monkeypatch)
        orchestrator = _make_orchestrator("vi")
        expected_hint = orchestrator._build_phase_hint()

        await orchestrator.start()

        assert len(recorder.calls) == 1
        instruction = _system_instruction(recorder.calls[0])
        assert expected_hint in instruction, (
            "Phase hint bi drop truoc khi toi model -- model khong biet "
            f"current_phase. Duoi system_instruction nhan duoc:\n{instruction[-400:]}"
        )

    async def test_phase_hint_present_in_system_instruction_en(self, monkeypatch):
        recorder = _install_fake_genai(monkeypatch, [_valid_reply("greeting")])
        _stub_settings(monkeypatch)
        orchestrator = _make_orchestrator("en")
        expected_hint = orchestrator._build_phase_hint()

        await orchestrator.start()

        instruction = _system_instruction(recorder.calls[0])
        assert expected_hint in instruction
        assert 'Current phase: "greeting"' in instruction

    async def test_hint_tracks_current_phase_not_a_stale_constant(self, monkeypatch):
        """Hint phai phan anh dung `current_phase` tai thoi diem goi -- neu khong,
        fix chi la 'nhet them mot chuoi tinh bat ky' vao prompt."""
        recorder = _install_fake_genai(monkeypatch, [_valid_reply("skills")])
        _stub_settings(monkeypatch)
        orchestrator = _make_orchestrator("vi")
        orchestrator.current_phase = "skills"

        await orchestrator.next_turn("Toi thanh thao Python va FastAPI.")

        instruction = _system_instruction(recorder.calls[0])
        assert HINT_PREFIX_VI + '"skills"' in instruction
        assert HINT_PREFIX_VI + '"greeting"' not in instruction

    async def test_advance_rule_text_reaches_model(self, monkeypatch):
        """Quy tac 'chi advance phase khi ung vien DA tra loi' nam trong hint --
        day la noi dung nghiep vu quan trong nhat tung bi mat."""
        recorder = _install_fake_genai(monkeypatch, [_valid_reply("greeting")])
        _stub_settings(monkeypatch)
        orchestrator = _make_orchestrator("vi")

        await orchestrator.start()

        instruction = _system_instruction(recorder.calls[0])
        assert HINT_ANSWERED_RULE_VI in instruction
        assert HINT_HOLD_RULE_VI in instruction

    async def test_static_system_prompt_still_reaches_model(self, monkeypatch):
        """Regression guard: gom phase hint vao khong duoc lam mat prompt goc
        (CV / JD / quy tac phong van)."""
        recorder = _install_fake_genai(monkeypatch, [_valid_reply("greeting")])
        _stub_settings(monkeypatch)
        orchestrator = _make_orchestrator("vi")

        await orchestrator.start()

        instruction = _system_instruction(recorder.calls[0])
        assert orchestrator._system_prompt in instruction
        assert "Backend Developer Intern" in instruction
        assert instruction.startswith(orchestrator._system_prompt), (
            "System prompt tinh phai dung dau; phase hint la phan bo sung phia sau."
        )

    async def test_hint_is_appended_after_the_static_prompt(self, monkeypatch):
        recorder = _install_fake_genai(monkeypatch, [_valid_reply("greeting")])
        _stub_settings(monkeypatch)
        orchestrator = _make_orchestrator("vi")
        hint = orchestrator._build_phase_hint()

        await orchestrator.start()

        instruction = _system_instruction(recorder.calls[0])
        assert instruction.index(hint) > instruction.index(orchestrator._system_prompt)

    async def test_no_system_text_leaks_into_conversation_contents(self, monkeypatch):
        """`contents` chi duoc chua luot hoi thoai that (user/model). Neu phase
        hint lot vao day duoi role 'user', model co the hieu nham day la loi
        ung vien noi va doc nguyen van ra qua TTS."""
        recorder = _install_fake_genai(monkeypatch, [_valid_reply("greeting")])
        _stub_settings(monkeypatch)
        orchestrator = _make_orchestrator("vi")
        hint = orchestrator._build_phase_hint()

        await orchestrator.start()

        contents = recorder.calls[0]["contents"]
        assert contents, "contents khong duoc rong"
        assert {c.role for c in contents} <= {"user", "model"}
        for content in contents:
            for part in content.parts:
                assert hint not in part.text
                assert orchestrator._system_prompt not in part.text

    async def test_fallback_model_call_also_receives_the_hint(self, monkeypatch):
        """Khi model chinh fail, lan goi model fallback cung phai mang hint."""
        recorder = _install_fake_genai(monkeypatch, [None, _valid_reply("greeting")])
        _stub_settings(monkeypatch)
        orchestrator = _make_orchestrator("vi")
        hint = orchestrator._build_phase_hint()

        await orchestrator.start()

        assert len(recorder.calls) == 2
        assert recorder.calls[0]["model"] == "fake-primary-model"
        assert recorder.calls[1]["model"] == "fake-fallback-model"
        for call in recorder.calls:
            assert hint in _system_instruction(call)

    async def test_hint_updates_across_turns(self, monkeypatch):
        """Qua nhieu luot, moi lan goi phai mang hint cua phase tai luot do.

        Chuyen phase duoc dieu khien bang chinh `phase` trong reply cua model,
        KHONG dua vao viec tieu het ngan sach `MAX_TURNS_PER_PHASE`: gia tri do
        la tham so tuning, khac nhau giua cac nhanh (greeting = 1 hay 2), va
        khong lien quan gi den dieu test nay khang dinh.
        """
        recorder = _install_fake_genai(
            monkeypatch,
            [
                _valid_reply("greeting"),
                _valid_reply("self_intro"),
                _valid_reply("self_intro"),
            ],
        )
        _stub_settings(monkeypatch)
        orchestrator = _make_orchestrator("vi")

        await orchestrator.start()
        assert HINT_PREFIX_VI + '"greeting"' in _system_instruction(recorder.calls[0])

        # Luot 2: hint duoc dung TRUOC khi xu ly reply -> van la "greeting";
        # reply mang phase "self_intro" nen sau luot nay orchestrator moi doi.
        await orchestrator.next_turn("Da, toi san sang roi.")
        assert HINT_PREFIX_VI + '"greeting"' in _system_instruction(recorder.calls[1])
        assert orchestrator.current_phase == "self_intro"

        # Luot 3: hint phai phan anh phase moi.
        await orchestrator.next_turn("Toi ten A, sinh vien nam 4 nganh CNTT.")
        assert HINT_PREFIX_VI + '"self_intro"' in _system_instruction(recorder.calls[2])
