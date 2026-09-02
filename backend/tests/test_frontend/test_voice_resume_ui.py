"""Static contract tests cho nút "Tiếp Tục" của phiên phỏng vấn giọng nói.

Trước đây nút này gắn `data-session-id` vào HTML nhưng handler lại vứt đi và chỉ
gọi `switchView('interview')`, nên ứng viên rơi vào màn hình setup trống và phải
tạo một phiên hoàn toàn mới. Phiên cũ nằm lại DB với status "ongoing" mãi mãi.
"""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
APP_JS = (ROOT / "frontend" / "app.js").read_text(encoding="utf-8")

RESUME_HANDLER = """    const resumeBtn = event.target.closest('.resume-interview-btn');
    if (resumeBtn) {
      resumeInterviewSession(resumeBtn.dataset.sessionId);
      return;
    }"""


def test_resume_button_passes_session_id_to_a_real_handler():
    assert RESUME_HANDLER in APP_JS, (
        "Handler nút Tiếp Tục phải đọc data-session-id và gọi resumeInterviewSession."
    )
    assert "function resumeInterviewSession(sessionId)" in APP_JS


def test_resume_reconnects_voice_session_over_websocket():
    handler_start = APP_JS.index("function resumeInterviewSession(sessionId)")
    handler_body = APP_JS[handler_start : handler_start + 1400]

    # Phiên voice nối thẳng qua WebSocket, không đi qua luồng hỏi–đáp văn bản.
    assert "startVoiceSession(sessionId" in handler_body
    assert "session.mode !== 'voice'" in handler_body
    assert "pageSessionId = sessionId" in handler_body


def test_client_absorbs_replayed_history_from_backend():
    assert "case 'history':" in APP_JS
    assert "(msg.pairs || []).forEach(pair => {" in APP_JS


def test_final_transcript_escapes_user_answers():
    """Bản ghi cuối phiên chứa câu trả lời của người dùng nên phải escape."""
    assert "${escapeHtml(entry.text)}" in APP_JS
    assert "<p>${entry.text}</p>" not in APP_JS
