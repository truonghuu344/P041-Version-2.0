# Chạy localhost — Windows / PowerShell

Toàn bộ lệnh dưới đây viết cho **PowerShell 5.1**. Lưu ý: PowerShell 5.1 **không hỗ trợ `&&`** — mỗi lệnh chạy riêng một dòng, hoặc nối bằng `;`.

Kiến trúc khi chạy local:

| Thành phần | Chạy ở đâu | Cổng |
|---|---|---|
| PostgreSQL | Docker | 5432 |
| Backend FastAPI | **native trong `.venv`** | 8000 |
| Frontend Next.js | native `npm run dev` | 3000 |

Backend chạy native chứ không chạy Docker, vì `docker-compose.yml` **không mount `backend/src`** — sửa một dòng Python là phải build lại cả image. Native có `--reload` nên sửa xong áp dụng ngay.

---

## 1. Chuẩn bị (chỉ làm một lần)

### 1.1 File `.env`

```powershell
Copy-Item .env.example .env
```

Mở `.env` và điền tối thiểu ba khoá sau. Không có chúng thì tính năng tương ứng chết:

| Biến | Thiếu thì sao | Lấy ở đâu |
|---|---|---|
| `GEMINI_API_KEY` | Phỏng vấn chỉ đọc câu hỏi soạn sẵn, và **không nghe được** (STT cũng dùng key này) | Google AI Studio |
| `MINERU_API_TOKEN` | Không upload được CV | https://mineru.net/apiManage/token |
| `ELEVENLABS_API_KEY` | Vẫn chạy, nhưng rơi về giọng máy gTTS | https://elevenlabs.io |

Ba biến quan trọng khác đã có sẵn giá trị đúng trong template, **đừng đổi khi chạy local**:

```
STORAGE_PROVIDER=local          # r2 cần credential Cloudflare, chưa cấu hình
VOICE_LLM_MODEL=gemini-3.5-flash-lite
VOICE_LLM_FALLBACK_MODEL=gemini-3.1-flash-lite
```

> **Vì sao phải là Flash-Lite:** các model Flash thường chỉ có **RPD 20** trên free tier. Một buổi phỏng vấn tốn tới 15 request, tức là **một buổi mỗi ngày** rồi hết quota. Flash-Lite có RPD 500 (~33 buổi).

### 1.2 Python

```powershell
uv sync
```

Tạo `.venv` ở thư mục gốc và cài đủ dependency từ `pyproject.toml`.

### 1.3 Node

```powershell
cd frontend
```

```powershell
npm install
```

> `npm install --prefix frontend` **không chạy được** — npm vẫn tìm `package.json` ở thư mục hiện tại, mà file đó chỉ có trong `frontend/`. Phải `cd` vào.

---

## 2. Khởi động hằng ngày

### Bước 1 — Database

Mở **Docker Desktop**, đợi nó sẵn sàng, rồi:

```powershell
docker compose up -d db
```

Chỉ cần `db`. Không cần `clamav` hay `backend` khi chạy native.

### Bước 2 — Backend (Terminal 1, ở thư mục gốc)

```powershell
.venv\Scripts\uvicorn.exe src.main:app --app-dir backend --reload --port 8000
```

**Đợi tới khi thấy `Application startup complete`** — mất khoảng 30–60 giây vì phải nạp `torch` và `sentence-transformers`. Trong lúc đó mọi lời gọi API đều lỗi 500.

Kiểm tra:

```powershell
curl.exe http://127.0.0.1:8000/ready
```

Đúng thì ra: `{"status":"ok","database":"ready",...}`

### Bước 3 — Frontend (Terminal 2)

```powershell
cd frontend
```

```powershell
npm run dev
```

Mở http://localhost:3000

---

## 3. Đọc log

### Backend chạy native

Log in thẳng ra Terminal 1. Không cần lệnh gì.

### Backend chạy Docker

```powershell
docker compose logs -f backend
```

`Ctrl+C` chỉ thoát chế độ xem, không tắt container.

```powershell
docker compose logs --tail 80 backend
```

Lọc riêng phần voice:

```powershell
docker compose logs backend | Select-String -Pattern "stt|gemini|transcript|utterance|error"
```

### Các dòng log cần biết

| Dòng | Ý nghĩa |
|---|---|
| `Gemini Live STT started (model=... keyterms=N)` | Phiên STT mở được; `N` = số thuật ngữ nạp từ CV/JD |
| `Gemini Live STT closed` | Đóng phiên bình thường |
| `Không nhận được transcript cuối trong 8.0s` | Server chưa chốt kịp — phần cuối câu trả lời có thể mất |
| `Gemini Live STT receive error` | Lỗi phía Gemini |
| `ElevenLabs TTS lỗi (...); fallback sang gTTS` | TTS rơi về dự phòng |
| **Không có dòng `STT started` nào** | `start_recording` chưa tới backend → lỗi ở frontend |

### Xem lại các phiên phỏng vấn đã lưu

Log runtime mất khi restart. Dữ liệu phiên phỏng vấn thì nằm trong Postgres — câu hỏi, câu trả lời, điểm STAR, báo cáo. Đây mới là thứ cho biết buổi phỏng vấn **thực sự** diễn ra thế nào:

```powershell
$env:PYTHONPATH="backend"; .venv\Scripts\python.exe scripts/inspect_interviews.py
```

```powershell
$env:PYTHONPATH="backend"; .venv\Scripts\python.exe scripts/inspect_interviews.py --limit 3 --full
```

Xem một phiên cụ thể:

```powershell
$env:PYTHONPATH="backend"; .venv\Scripts\python.exe scripts/inspect_interviews.py --session <session-id>
```

Script tự chẩn đoán dòng `Chẩn đoán:` cho mỗi phiên:

| Kết quả | Ý nghĩa |
|---|---|
| `ổn (N câu, trung bình X ký tự)` | STT hoạt động |
| `MỌI CÂU TRẢ LỜI ĐỀU RỖNG` | **STT không nghe được gì** — dù giao diện trông vẫn chạy |
| `câu trả lời rất ngắn` | STT nghe được nhưng cắt cụt — nghi lỗi chốt transcript |
| `KHÔNG CÓ CÂU NÀO` | Phiên chết trước khi hỏi được gì |

Đây là cách nhanh nhất phân biệt "voice hỏng" với "voice chạy nhưng chất lượng kém", vì nó đọc đúng thứ đã được lưu chứ không phụ thuộc vào việc bạn có mở DevTools đúng lúc hay không.

### Gom toàn bộ chẩn đoán vào một file

Khi cần nhờ người khác phân tích, chạy **sau khi test xong**:

```powershell
$env:PYTHONPATH="backend"; .venv\Scripts\python.exe scripts/collect_diagnostics.py
```

Sinh ra `logs/diagnostic-<timestamp>.md` gồm bốn phần: cấu hình đang chạy, trạng thái môi trường, nội dung các phiên phỏng vấn, và log backend.

Mọi chuỗi giống API key đều **bị che tự động** trước khi ghi. Nhưng nội dung câu trả lời phỏng vấn thì giữ nguyên — xem qua trước khi gửi nếu đó là dữ liệu thật của người khác.

> Backend ghi log ra `logs/backend.log` (xoay vòng 5MB × 3 file), cấu hình trong `backend/src/main.py`. Đổi mức chi tiết bằng `LOG_LEVEL` trong `.env`, đổi thư mục bằng `LOG_DIR`.

---

## 4. Chạy test

Full suite (khoảng 2–6 phút):

```powershell
$env:PYTHONPATH="backend"; .venv\Scripts\python.exe -m pytest backend/tests/ -q
```

Riêng phần voice:

```powershell
$env:PYTHONPATH="backend"; .venv\Scripts\python.exe -m pytest backend/tests/test_stt_service.py backend/tests/test_tts_service.py backend/tests/test_voice_keyterms.py -q
```

Lint (giống hệt CI):

```powershell
.venv\Scripts\python.exe -m ruff check backend/src/ backend/tests/
```

Frontend:

```powershell
cd frontend
```

```powershell
npm run typecheck
```

---

## 5. Nghiệm thu tính năng voice

Đây là bài kiểm tra **không test tự động nào thay thế được**, vì nó đi qua micro và AudioWorklet trong trình duyệt thật.

**Chuẩn bị:** cần sẵn một CV và một JD trong tài khoản. Nếu upload CV hỏng, dùng **form nhập CV thủ công** trong mục CV — nó gọi `/cvs/manual`, không đụng OCR.

**Cách làm:**

1. Vào phòng phỏng vấn
2. Mở DevTools (F12) → tab **Network** → lọc **WS** → chọn `ws/interview/...` → tab **Messages**
3. Bấm mic và nói đúng kịch bản này:

> "Tôi có ba năm kinh nghiệm làm backend" — **im 3 giây** — "với Python và FastAPI"

**Đối chiếu trong tab Messages:**

| Thấy gì | Kết luận |
|---|---|
| `audio_chunk` gửi đi liên tục | AudioWorklet chạy |
| `transcript_partial` hiện dần khi đang nói | Partial realtime ✓ |
| `transcript_final` sau khi ngừng | Tự chốt ✓ |
| **`transcript_final` thứ hai chứa "Python và FastAPI"** | **Giữ được phần sau chỗ ngập ngừng ✓** |

Dòng cuối là quan trọng nhất. Nếu chỉ có **một** `transcript_final` và mất vế sau, đó là lỗi ở `_drain()` trong `backend/src/services/voice/stt_service.py` — hàm này phải chờ luồng lặng hẳn chứ không được dừng ở `generation_complete` đầu tiên.

> **Lưu ý về hành vi có chủ đích:** `_on_utterance_end` **không** tự gửi câu trả lời. VAD chốt ngay ở lần im lặng đầu tiên, mà ứng viên ngập ngừng giữa câu là bình thường — tự gửi sẽ cắt ngang. Ứng viên vẫn phải bấm nút gửi. Đây là thiết kế, không phải thiếu sót.

---

## 6. Sự cố thường gặp

| Triệu chứng | Nguyên nhân | Cách xử lý |
|---|---|---|
| Trang web báo **500** ở mọi API | Backend chưa chạy hoặc chưa khởi động xong | Đợi `Application startup complete`; kiểm tra `curl.exe http://127.0.0.1:8000/ready` |
| Loạt **401** ở `/auth/me`, `/notifications` | `SECRET_KEY` trong `.env` đã đổi nên token cũ hết hiệu lực | Đăng nhập lại. Nếu không tự thoát, chạy trong Console: `localStorage.clear(); location.reload()` |
| Upload CV lỗi | `MINERU_API_TOKEN` rỗng → dùng API công khai bị giới hạn IP | Điền token, **khởi động lại backend** |
| Phỏng vấn đọc câu hỏi cứng, không theo CV | Thiếu `GEMINI_API_KEY` → rơi vào `_fallback_response()` | Điền key, khởi động lại backend |
| Giọng đọc như máy | ElevenLabs lỗi/thiếu key → rơi về gTTS | Xem log tìm `fallback sang gTTS` |
| ElevenLabs trả **402** | Gói Free không dùng được "library voice" | Dùng giọng đã xác minh chạy trên Free: Sarah, Laura, Alice, Matilda, Jessica, Lily, George. **Bị chặn:** Rachel, Charlotte |
| Bấm mic nhưng không ra chữ | `pcm16-worklet.js` không nạp được | Xem Console tìm lỗi `addModule` / `Failed to load module script` |
| Transcript sai nhiều | Gain 2.5 làm méo tiếng khi nói to | Hạ `voiceGainNode.gain.value` xuống ~1.2 trong `frontend/app.js` |
| Sửa `.env` mà không có tác dụng | `get_settings()` có `@lru_cache`, chỉ đọc lúc khởi tạo | **Luôn khởi động lại backend sau khi sửa `.env`** |

---

## 7. Chạy toàn bộ bằng Docker (chỉ để kiểm tra trước khi deploy)

Dùng khi muốn xác nhận image production dựng và chạy được — `.venv` không đảm bảo điều đó, vì hai môi trường lấy dependency từ hai nguồn khác nhau (`pyproject.toml` cho local, `requirements-prod.txt` cho Docker).

```powershell
docker compose up -d --build
```

Hai điểm khác với chạy native:

- **Bắt buộc có ClamAV.** Compose ghi đè `MALWARE_SCAN_MODE: required`, nên container `clamav` phải healthy thì upload CV mới chạy (mất ~90 giây khởi động). Chạy native thì `.env` cho ra `auto`, không cần ClamAV.
- **Sửa code phải build lại.** Không có volume mount cho `backend/src`.

Tắt:

```powershell
docker compose down
```
