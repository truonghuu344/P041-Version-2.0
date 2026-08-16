# Weekly Journal — Team WinTop

> Ghi lại mỗi tuần: học được gì, khó khăn gì, quyết định gì, kế hoạch tiếp.

---

## Week 1: 2026-08-11 → 2026-08-17

### Mục tiêu tuần này
- [x] Research pipeline Voice Interview (STT/LLM/TTS)
- [x] Implement MVP voice interview end-to-end
- [x] Fix các bug phát sinh khi test live
- [ ] Bắt đầu Question Bank model/migration

### Đã hoàn thành

**Thành viên 3 — Voice Interview:**
- Hoàn thành pipeline voice interview MVP: Deepgram Nova-3 (STT) → Gemini Flash + GPT fallback (LLM) → gTTS (TTS)
- WebSocket endpoint `/api/v1/ws/interview/{session_id}` với JWT auth
- Phase-based interview engine (6 giai đoạn: greeting → self_intro → experience → position_knowledge → company_knowledge → closing)
- System prompt VI/EN cho LLM, phase enforcement server-side, fallback responses
- Frontend interview room: mic permission, WebSocket lifecycle, TTS audio playback, chat display
- Fix 5 bugs: JSON display (`{` / `{"message":`), TTS tiếng Việt, loading UX, resume button, CORS network
- Push branch `feat/voice-interview-question-bank`

### Khó khăn & Giải pháp
| Khó khăn | Giải pháp | Kết quả |
|----------|-----------|---------|
| LLM trả JSON nhưng frontend hiển thị raw `{` hoặc `{"message":` | Viết lại `_extract_llm_response()` xử lý 8 edge cases (truncated, double-encode, fenced, alt keys...) + frontend JSON auto-parse | 8/8 test cases pass, không còn hiện raw JSON |
| edge_tts fail với tiếng Việt có dấu (text > 8 ký tự) | Thay edge_tts bằng gTTS (Google Translate TTS) | Audio OK, 132KB cho câu chào đầy đủ |
| Microphone bị chặn khi truy cập qua IP network (`http://192.168.2.21:3001`) | Browser yêu cầu secure context; dùng Chrome flag `unsafely-treat-insecure-origin-as-secure` | Mic hoạt động trên network URL |
| LLM response chậm, user không biết đang xử lý | Thêm loading UX: "Chuẩn bị vào phòng phỏng vấn..." → 5s → "Bạn đợi mình chút nha..." | UX mượt, user biết hệ thống đang load |

### Bài học
- edge_tts không đáng tin cho tiếng Việt production — gTTS ổn định hơn nhiều dù chất lượng giọng không bằng
- LLM output không bao giờ 100% đúng format — phải có nhiều tầng fallback khi parse JSON
- Browser security context (HTTPS) là bắt buộc cho mic access trên network — cần lên kế hoạch HTTPS sớm nếu test trên thiết bị khác
- `textContent` thay `innerHTML` vừa chống XSS vừa tránh render HTML/JSON lỗi

### Kế hoạch tuần sau
- [ ] Tạo migration/model cho Question Bank, Knowledge Base
- [ ] Seed 100+ câu hỏi approved với rubric
- [ ] Interview report UI (scores, evidence, strengths/gaps)
- [ ] Provider-agnostic STT/TTS adapters
- [ ] Unit/API/WS test suite
- [ ] Waveform visualization, reconnect logic

---

<!-- Tiếp tục copy block trên cho Week 2, 3, 4, 5, 6 -->
