from __future__ import annotations

import time

FILLER_WORDS = frozenset({"ờ", "um", "uh", "à", "ừ", "hmm", "erm", "uhm", "ơ"})

NUDGE_MESSAGES = {
    "vi": {
        "gentle": "Bạn cứ từ từ suy nghĩ, không vội đâu.",
        "prompt": "Bạn có muốn tôi nhắc lại câu hỏi không?",
        "skip": "Không sao, chúng ta sẽ chuyển sang câu hỏi tiếp theo nhé.",
        "filler": "Bạn cứ bình tĩnh, suy nghĩ rồi trả lời nhé.",
        "short": "Bạn có thể nói rõ hơn một chút không?",
    },
    "en": {
        "gentle": "Take your time, no rush.",
        "prompt": "Would you like me to repeat the question?",
        "skip": "No worries, let's move on to the next question.",
        "filler": "Take a moment to gather your thoughts.",
        "short": "Could you elaborate a bit more?",
    },
}

SILENCE_THRESHOLDS = {
    "gentle": 15,
    "prompt": 30,
    "skip": 60,
}
FILLER_THRESHOLD = 3
SHORT_ANSWER_WORDS = 10
MAX_ANSWER_SECONDS = 180


class SilenceHandler:
    """Detects silence, filler words, and short/long answers."""

    def __init__(self, language: str = "vi") -> None:
        self.language = language if language in NUDGE_MESSAGES else "vi"
        self._last_speech_at: float | None = None
        self._filler_streak = 0
        self._recording_start: float | None = None

    def on_speech_start(self) -> None:
        self._last_speech_at = time.monotonic()
        self._recording_start = time.monotonic()
        self._filler_streak = 0

    def on_transcript(self, text: str) -> str | None:
        """Process a transcript fragment and return a nudge key if needed."""
        self._last_speech_at = time.monotonic()
        words = text.strip().split()
        if len(words) <= 2 and all(w.lower() in FILLER_WORDS for w in words):
            self._filler_streak += 1
            if self._filler_streak >= FILLER_THRESHOLD:
                self._filler_streak = 0
                return "filler"
        else:
            self._filler_streak = 0
        return None

    def check_silence(self) -> str | None:
        """Poll for silence. Returns nudge key or None."""
        if self._last_speech_at is None:
            return None
        elapsed = time.monotonic() - self._last_speech_at
        if elapsed >= SILENCE_THRESHOLDS["skip"]:
            return "skip"
        if elapsed >= SILENCE_THRESHOLDS["prompt"]:
            return "prompt"
        if elapsed >= SILENCE_THRESHOLDS["gentle"]:
            return "gentle"
        return None

    def check_answer_length(self, full_text: str) -> str | None:
        word_count = len(full_text.strip().split())
        if word_count < SHORT_ANSWER_WORDS:
            return "short"
        if self._recording_start and (time.monotonic() - self._recording_start) > MAX_ANSWER_SECONDS:
            return "long"
        return None

    def get_message(self, nudge_key: str) -> str:
        return NUDGE_MESSAGES[self.language].get(nudge_key, "")

    def reset(self) -> None:
        self._last_speech_at = None
        self._filler_streak = 0
        self._recording_start = None
