# Worklog — Team WinTop

> Ghi lại tất cả công việc đã làm theo ngày. Ai làm gì, kết quả gì.

---

## 2026-08-13

| Member | Task | Status | Output | Time |
|--------|------|--------|--------|------|
| Quân (TV3) | Fix STAR Score không sync lên Dashboard | ✅ Done | `app.js`: thêm `updateDashboardGaugeScores()` vào `loadPageSTARReport()` | 2h |
| Quân (TV3) | Fix "Tìm việc" trả 0 kết quả | ✅ Done | `job_rag.py`: fallback sang keyword catalog khi Qdrant trả 0 | 1h |
| Quân (TV3) | Research Voice Interview pipeline | ✅ Done | Chọn stack: Deepgram Nova-3 + Gemini Flash + edge_tts | 2h |

**Tổng kết ngày:** Fix 2 bug UI/API (dashboard sync, job search), bắt đầu research voice interview pipeline.

---

## 2026-08-14

| Member | Task | Status | Output | Time |
|--------|------|--------|--------|------|
| Quân (TV3) | Implement voice_orchestrator.py | ✅ Done | Phase-based interview engine, system prompt VI/EN, LLM call Gemini + OpenAI fallback | 4h |
| Quân (TV3) | Implement stt_service.py | ✅ Done | Deepgram Nova-3 STT streaming, VAD, interim/final transcript | 2h |
| Quân (TV3) | Implement tts_service.py (edge_tts) | ✅ Done | TTS service với edge_tts (sau đổi sang gTTS ngày 15) | 1h |
| Quân (TV3) | Implement ws_interview.py | ✅ Done | WebSocket endpoint, JWT auth, session lifecycle, audio routing | 3h |
| Quân (TV3) | Implement silence_handler.py | ✅ Done | Phát hiện im lặng, tự động nhắc ứng viên | 0.5h |

**Tổng kết ngày:** Implement xong toàn bộ backend voice interview. WebSocket endpoint hoạt động, LLM trả response theo phase.

---

## 2026-08-15

| Member | Task | Status | Output | Time |
|--------|------|--------|--------|------|
| Quân (TV3) | Frontend interview room (app.js) | ✅ Done | Mic permission, WebSocket lifecycle, TTS playback, chat display | 2h |
| Quân (TV3) | Fix bug hiển thị raw JSON `{` | ✅ Done | Viết lại `_extract_llm_response()` — 8 edge cases, 8/8 pass | 2h |
| Quân (TV3) | Fix TTS tiếng Việt (edge_tts → gTTS) | ✅ Done | Thay edge_tts bằng gTTS, update requirements.txt + requirements-prod.txt | 1h |
| Quân (TV3) | Thêm loading UX khi start interview | ✅ Done | "Chuẩn bị vào phòng phỏng vấn..." → 5s → "Bạn đợi mình chút nha..." | 0.5h |
| Quân (TV3) | Xóa nút "Tiếp tục phiên đang lưu" | ✅ Done | Xóa logic detect ongoing session + resume button | 0.5h |
| Quân (TV3) | CORS + Docker config | ✅ Done | Thêm network IP + ports vào docker-compose.yml CORS_ORIGINS | 0.5h |
| Quân (TV3) | Commit + push feat/voice-interview-question-bank | ✅ Done | `56423c1`, `a164f63`, `d62b581` — 3 commits | 0.5h |
| Quân (TV3) | Viết docs/voice-interview-question-bank.md | ✅ Done | Nhật ký research → implementation → bug fixes → test | 0.5h |

**Tổng kết ngày:** Fix 5 bugs, hoàn thiện frontend interview, push lên branch `feat/voice-interview-question-bank`. Voice interview MVP chạy end-to-end.

---

## 2026-08-16

| Member | Task | Status | Output | Time |
|--------|------|--------|--------|------|
| Quân (TV3) | Scan docs + README, kiểm tra đường dẫn | ✅ Done | 1 link hỏng (`docs/pipeline/Phrase_2/CV_JD.md`) — file chung, không thuộc scope TV3 | 0.5h |
| Quân (TV3) | Kiểm tra Dockerfile backend | ✅ Done | requirements-prod.txt đủ dependencies, Dockerfile OK | 0.5h |
| Quân (TV3) | Cập nhật JOURNAL.md + WORKLOG.md | ✅ Done | Ghi tiến độ Week 1 | 0.5h |

**Tổng kết ngày:** Kiểm tra docs, Dockerfile, cập nhật tiến độ dự án.

---

<!-- Format: copy block trên cho mỗi ngày làm việc -->
