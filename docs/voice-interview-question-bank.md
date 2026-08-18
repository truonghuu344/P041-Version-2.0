# Voice Interview — Nhật ký phát triển

**Thành viên 3** — Voice Interview, Question Bank & Evidence Scoring  
**Branch:** `feat/voice-interview-question-bank`  
**Thời gian:** 2026-08-13 → 2026-08-15

---

## 1. Research & thiết kế kiến trúc

### Pipeline 3 — Voice Interview

Nghiên cứu và chọn stack cho pipeline phỏng vấn voice real-time:

| Thành phần | Công nghệ | Lý do chọn |
|---|---|---|
| **STT** (Speech-to-Text) | Deepgram Nova-3 | Streaming WebSocket, hỗ trợ tiếng Việt, interim results, VAD |
| **LLM** (Conversation) | Gemini 3.5 Flash (primary) + Gemini 2.0 Flash (fallback) | Cả team dùng chung Gemini API key; `response_mime_type="application/json"` |
| **TTS** (Text-to-Speech) | gTTS (Google Translate TTS) | Miễn phí, hỗ trợ tiếng Việt tốt, ổn định |

### Thiết kế luồng phỏng vấn

```
User nói → Mic (WebSocket binary) → Deepgram Nova-3 STT
  → Transcript text → Gemini Flash LLM (JSON response)
  → Extract message → gTTS → Audio base64
  → WebSocket → Frontend playback
```

**Phase-based interview** (6 giai đoạn theo thứ tự nghiêm ngặt):

1. `greeting` — Chào hỏi, giới thiệu (1 lượt)
2. `self_intro` — Ứng viên tự giới thiệu (1 lượt)
3. `experience` — Hỏi kinh nghiệm, dự án, kỹ năng (tối đa 3 lượt)
4. `position_knowledge` — Hiểu biết về vị trí (1 lượt)
5. `company_knowledge` — Hiểu biết về công ty (1 lượt)
6. `closing` — Cảm ơn, nhận xét, kết thúc (1 lượt, `done=true`)

Server-side phase enforcement qua `MAX_TURNS_PER_PHASE` + `_next_phase()` — client không thể bỏ qua hoặc quay ngược phase.

### Giao thức WebSocket

```
ws://localhost:8000/api/v1/ws/interview/{session_id}?token=<JWT>
```

| Message type | Hướng | Mô tả |
|---|---|---|
| `binary` | Client → Server | Audio chunk từ microphone |
| `transcript` | Server → Client | Partial/final transcript từ STT |
| `ai_message` | Server → Client | Câu hỏi phỏng vấn từ LLM |
| `audio` | Server → Client | TTS audio base64 (MP3) |
| `phase` | Server → Client | Phase hiện tại + label |
| `done` | Server → Client | Kết thúc phỏng vấn |
| `error` | Server → Client | Thông báo lỗi |

---

## 2. Implementation

### Backend — Các file đã tạo/sửa

| File | Mô tả |
|---|---|
| `backend/src/services/voice/voice_orchestrator.py` | Engine phỏng vấn: system prompt VI/EN, phase management, LLM call (Gemini + OpenAI fallback), `_extract_llm_response()` xử lý JSON |
| `backend/src/services/voice/tts_service.py` | TTS service dùng gTTS, async wrapper, base64 encode |
| `backend/src/services/voice/stt_service.py` | Deepgram Nova-3 STT streaming, VAD, interim/final transcript |
| `backend/src/services/voice/silence_handler.py` | Phát hiện im lặng kéo dài, tự động nhắc ứng viên |
| `backend/src/api/v1/ws_interview.py` | WebSocket endpoint, JWT auth, session lifecycle, audio routing |
| `backend/src/api/routes.py` | Đăng ký WebSocket router |
| `backend/requirements.txt` | Thêm `deepgram-sdk`, `openai`, `gTTS` |
| `backend/requirements-prod.txt` | Tương tự cho production |

### Frontend

| File | Mô tả |
|---|---|
| `frontend/app.js` | Interview room UI: mic/consent, WebSocket lifecycle, TTS playback, chat display, loading UX |
| `frontend/app/styles/interview.css` | Styling cho interview messages |

### Config

| File | Thay đổi |
|---|---|
| `docker-compose.yml` | Thêm CORS origins: `http://192.168.2.21:3001`, ports 3001/55215/57409/62879 |
| `backend/src/config.py` | Thêm config keys cho Deepgram, OpenAI |

---

## 3. Bug fixes & cải tiến

### Bug 1: Hiển thị `{` hoặc `{"message":` thay vì nội dung AI

**Triệu chứng:** Chat bubble hiển thị raw JSON thay vì text message.

**Nguyên nhân gốc:** LLM trả JSON nhưng hàm parse cũ (`_parse_llm_json`) fallback về raw content khi key "message" không có hoặc JSON malformed/double-encoded/truncated.

**Fix:** Viết lại hoàn toàn thành `_extract_llm_response()` xử lý 8 edge cases:
1. JSON bình thường `{"message": "...", "phase": "...", "done": false}`
2. Alt keys (`"text"`, `"response"` thay vì `"message"`)
3. JSON bị cắt (`{"message":`)
4. Double-encoded JSON (`"{\\"message\\": \\"Hi\\"}"`)
5. JSON trong markdown code fence
6. Tiếng Việt có dấu
7. Không có key message
8. Plain text (không phải JSON)

**Frontend side:** Thêm JSON auto-parse ở `ai_message` handler + dùng `textContent` thay `innerHTML` để chống XSS.

### Bug 2: TTS không phát audio tiếng Việt

**Triệu chứng:** "No audio was received" — edge_tts v7.2.8 fail với text tiếng Việt có dấu dài hơn ~8 ký tự.

**Fix:** Thay edge_tts bằng gTTS (Google Translate TTS). Test thành công: 132KB audio cho câu chào đầy đủ tiếng Việt.

### Bug 3: Loading UX khi bắt đầu phỏng vấn

**Triệu chứng:** Sau khi bấm "Bắt đầu phỏng vấn", không có feedback gì cho user trong khi LLM đang xử lý.

**Fix:** 
- Hiển thị ngay "Chuẩn bị vào phòng phỏng vấn..." khi click
- Sau 5 giây nếu LLM chưa trả lời → đổi thành "Bạn đợi mình chút nha..."
- Clear timer khi nhận response hoặc error

### Bug 4: Nút "Tiếp tục phiên đang lưu" gây nhầm lẫn

**Fix:** Xóa hoàn toàn logic detect ongoing session + resume button. Mỗi lần vào interview room là session mới.

### Bug 5: Microphone bị chặn trên network URL

**Triệu chứng:** `http://192.168.2.21:3001` không cho phép `getUserMedia()`.

**Nguyên nhân:** Browser yêu cầu secure context (HTTPS hoặc localhost) cho mic access.

**Workaround:** Chrome flag `chrome://flags/#unsafely-treat-insecure-origin-as-secure` + thêm CORS entry cho IP network.

### Code quality (commit cuối)

- Sắp xếp import theo ABC trong `routes.py`
- Xóa import `User` không dùng trong `ws_interview.py`
- `typing.Callable` → `collections.abc.Callable` (chuẩn Python 3.12)
- `asyncio.TimeoutError` → `TimeoutError` (Python 3.11+)
- Bỏ f-string prefix thừa

---

## 4. Test & xác nhận

| Test | Kết quả |
|---|---|
| `_extract_llm_response()` — 8 edge cases | 8/8 OK |
| TTS tiếng Việt (gTTS) — câu dài có dấu | OK, 132KB audio |
| WebSocket connect + greeting flow | OK |
| Phase progression greeting → closing | OK |
| Frontend chat display (no raw JSON) | OK |
| Loading UX timing (0s + 5s fallback) | OK |
| CORS từ network IP | OK |

---

## 5. Commits

| Hash | Ngày | Mô tả |
|---|---|---|
| `56423c1` | 2026-08-15 | `upload feat/interview` — toàn bộ voice interview backend + frontend (15 files) |
| `a164f63` | 2026-08-15 | `style(backend): cleanup imports and lint warnings` — code quality (4 files) |

---

## 6. Việc cần làm tiếp (backlog)

- [ ] Question Bank: tạo migration/model, import CLI, seed 100+ câu hỏi approved
- [ ] Evidence scoring: LLM trả coverage/evidence, deterministic score commit
- [ ] Interview report: topic/criterion scores, evidence-highlighting transcript
- [ ] Benchmark: STT (WER/CER), evidence precision/recall, score MAE
- [ ] E2E test: mock STT/TTS/WebSocket, safety tests (injection, silence, code-switch)
- [ ] Provider-agnostic STT/TTS adapters (hiện hardcode Deepgram + gTTS)
- [ ] Audio waveform visualization trên frontend
- [ ] Reconnect logic khi WebSocket bị ngắt
