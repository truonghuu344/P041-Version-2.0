# 🤖 Career Assistant X (CV Assistant)

Trợ lý nghề nghiệp AI cho sinh viên năm 3–4/mới ra trường — phân tích CV theo JD (Gap Analysis, không bịa/thổi phồng kinh nghiệm), phỏng vấn thử theo Rubric STAR, và chatbot AI **Nova** hỗ trợ định hướng nghề nghiệp. Dự án capstone **VinUni AI20K Build Phase**, nhóm **WinTop**.

## 🌐 Demo

Dự án hiện chạy local: backend qua Docker, frontend qua Next.js, chưa deploy public:

```
http://localhost:3000
```

Xem [Cách chạy demo](#-cách-chạy-demo-first-mvp) bên dưới để dựng lên trên máy bạn.

## 🎯 Sản phẩm gồm những gì

- **Phân tích CV theo JD** — upload CV (PDF/DOCX), so khớp với JD (thư viện mẫu hoặc dán tùy chỉnh), ra **Match Score** kèm bằng chứng cụ thể (evidence-based), không tự thêm kỹ năng/kinh nghiệm không có thật.
- **Gap Analysis chi tiết** — kỹ năng phù hợp/cần bổ sung, việc cần ưu tiên, lộ trình học đề xuất, gợi ý sửa CV theo chuẩn ATS — mọi gợi ý đều phải qua **Accept/Reject (HITL)** của sinh viên trước khi áp dụng.
- **Phỏng vấn thử theo Rubric STAR** — 5 câu hỏi chính + follow-up theo CV/JD đã chọn, chấm điểm theo 4 tiêu chí (Situation/Task/Action/Result), có báo cáo và gợi ý luyện tập.
- **Chatbot Nova** — trợ lý AI hội thoại, trả lời dựa trên CV/JD của sinh viên, có tool tra thời tiết.
- **Dashboard cố vấn hướng nghiệp (HITL)** — cố vấn xem tiến độ/báo cáo của sinh viên được cấp quyền.
- **CV–JD Matching Pipeline v1** — BM25 + semantic embedding (Gemini) → RRF fusion → evidence classification → rubric có thể cấu hình, lưu đầy đủ chuỗi truy vết từ Final Score về CV chunk/trang nguồn. Xem đặc tả tại [`docs/pipeline/Phrase_2/CV_JD.md`](docs/pipeline/Phrase_2/CV_JD.md).

## 🚀 Cách chạy demo (First MVP)

### Yêu cầu

- Docker Desktop đang chạy.
- 1 API key Gemini miễn phí từ [Google AI Studio](https://aistudio.google.com/apikey).

### Bước 1 — Cấu hình `.env`

```bash
cp .env.example .env
```

Điền tối thiểu các biến sau (xem chú thích trong `.env.example` cho từng biến):

| Biến | Bắt buộc? | Ghi chú |
|---|---|---|
| `POSTGRES_PASSWORD` | ✅ Bắt buộc | Docker Compose sẽ báo lỗi ngay nếu thiếu |
| `SECRET_KEY` | ✅ Bắt buộc (production mode) | ≥32 ký tự ngẫu nhiên, không dùng giá trị mẫu |
| `INITIAL_ADMIN_PASSWORD` | ✅ Bắt buộc (production mode) | Mật khẩu cho tài khoản admin seed sẵn (`admin@cva.com`) |
| `GEMINI_API_KEY` | ✅ Bắt buộc để có AI thật | Không set thì Nova/Gap Analysis/Interview chạy ở chế độ fallback |
| `MODEL_NAME` | Khuyến nghị | Đặt `gemini-3.1-flash-lite` — đã xác nhận hoạt động ổn định (một số model khác như `gemini-2.0-flash` đã bị Google ngừng hỗ trợ) |
| `GOOGLE_OAUTH_CLIENT_ID` | Tùy chọn | Chỉ cần nếu muốn nút "Đăng nhập Google" hoạt động — lấy từ Google Cloud Console (Web application, Authorized JavaScript origins: `http://localhost:3000`) |

Lưu ý: `docker-compose.yml` tự đặt `APP_ENV=production` cho backend — khi đó `SECRET_KEY` và `INITIAL_ADMIN_PASSWORD` là **bắt buộc**, không có giá trị mặc định an toàn.

### Bước 2 — Khởi tạo backend bằng Docker

```bash
# Build lại image backend khi lần đầu chạy hoặc sau khi đổi Dockerfile/dependency/code backend
docker compose up --build -d
docker compose ps
docker compose logs -f backend
```

`docker compose up --build -d` khởi động PostgreSQL + pgvector, ClamAV và FastAPI. API có tại `http://localhost:8000`; kiểm tra nhanh bằng `http://localhost:8000/health`.

### Bước 3 — Khởi tạo frontend local

```bash
cd frontend && npm install
Copy-Item .env.local.example .env.local # PowerShell (chạy một lần)
npm run build
npm run start
```

Trên macOS/Linux, thay lệnh copy bằng `cp .env.local.example .env.local`. Frontend có tại `http://localhost:3000`. Cách `build` + `start` được khuyến nghị khi chạy demo, đặc biệt nếu dự án nằm trong OneDrive. Chỉ dùng `npm run dev` khi đang sửa giao diện và cần hot reload.

### Bước 4 — Mở app

Truy cập [http://localhost:3000](http://localhost:3000). Next.js local tự proxy các request `/api/v1/*` đến backend Docker tại `http://localhost:8000`.

- Đăng nhập admin: `admin@cva.com` + mật khẩu bạn đặt ở `INITIAL_ADMIN_PASSWORD`.
- Hoặc đăng ký tài khoản sinh viên mới ngay trên giao diện để test luồng chính (upload CV → chọn JD → Gap Analysis → phỏng vấn thử).

### Lệnh vận hành thường dùng

```bash
# Docker backend
docker compose up -d                  # Bật lại các container đã build
docker compose up --build -d           # Build image backend rồi khởi động
docker compose ps                      # Xem trạng thái service
docker compose logs -f backend         # Xem log FastAPI theo thời gian thực
docker compose restart backend          # Khởi động lại FastAPI
docker compose down                    # Dừng và xóa container/network, giữ data PostgreSQL
docker compose down -v                 # Xóa cả PostgreSQL/ClamAV/upload volumes — không thể khôi phục

# Frontend local (chạy trong frontend/)
npm run dev                            # Development server, http://localhost:3000
npm run typecheck                      # Kiểm tra TypeScript
npm run build && npm run start         # Build và chạy Next.js production local
```

Khi sửa mã backend hoặc dependency, dùng `docker compose up --build -d`. Khi chỉ sửa frontend, Next.js dev server tự reload; không cần Docker build.

Frontend dùng cache dev tại `frontend/node_modules/.cache/next-dev`, tách biệt với output production `frontend/.next`. Tuy vậy, OneDrive có thể vẫn xóa file cache hot reload theo thời gian. Khi giao diện chỉ còn HTML thô hoặc asset trả 404, hãy dừng dev server rồi chạy `npm run build` và `npm run start`; production server dùng bundle bất biến và ổn định hơn cho kiểm thử/demo.

ESLint của frontend bật kiểm tra `no-undef` cho các file JavaScript để chặn ngay khi build những lỗi runtime như `ReferenceError: <biến> is not defined`.

### Chức năng Match CV

Match CV yêu cầu người dùng đăng nhập và chọn đủ một CV cùng một JD trước khi phân tích:

1. **Chọn CV:** dùng CV đã có trong Kho CV hoặc tải file PDF/DOCX mới. CV tải tại màn Match được lưu vào đúng Kho CV của tài khoản đang đăng nhập. Trong danh sách CV bên dưới, nhấn trực tiếp vào thẻ CV (hoặc dùng `Enter`/`Space`) để chọn; thẻ được tô trạng thái đã chọn và nút phân tích sẽ dùng đúng CV đó.
2. **Chọn JD:** chọn công việc trong danh sách có sẵn hoặc tải JD riêng dạng PDF, DOCX, TXT hay ảnh. Khi mở một công việc có sẵn, hộp `Chi tiết công việc` luôn được cố định giữa viewport bên dưới navbar; nội dung dài cuộn trong hộp để nút `Chọn Job này` luôn truy cập được. JD được trình bày theo từng phần gồm tiêu đề/công ty, thông tin nhanh, kỹ năng chính, mô tả, trách nhiệm, yêu cầu và quyền lợi; nhãn trùng lặp cùng dữ liệu thô không cần thiết được loại bỏ.
3. **Phân tích:** nút `Phân tích Match` chỉ hoạt động khi cả CV và JD đã sẵn sàng. Tiến độ thực của backend hiển thị trực tiếp trên nút (`Đang phân tích …%`); trang không chèn thêm khối loading hoặc kết quả ở phía dưới.
4. **Xem kết quả:** khi phân tích hoàn tất, popup GAP tự mở ở giữa màn hình thay vì chèn kết quả xuống cuối trang. Popup chỉ giữ thông tin cần để người dùng ra quyết định: Match Score, kết luận ngắn, tối đa 6 kỹ năng ở mỗi nhóm phù hợp/thiếu/chưa rõ, 3 việc ưu tiên và tối đa 3 gợi ý sửa CV. Ma trận bằng chứng, công thức chấm điểm và các nội dung kỹ thuật dài không hiển thị trong popup. Có thể đóng bằng nút `×`, nhấn ngoài popup hoặc phím `Esc`.
5. **Tối ưu bằng AI:** nút `Tối ưu bằng AI` trong popup áp dụng toàn bộ gợi ý viết lại đã có bằng chứng và đã vượt guardrail vào bản CV tối ưu của kết quả phân tích. Các quyết định được lưu qua API hiện có để dùng khi xuất CV; CV gốc trong Kho CV không bị ghi đè. Nếu không có gợi ý đủ bằng chứng hoặc guardrail chưa đạt, hệ thống không tự áp dụng.

Luồng Match ưu tiên tốc độ: CV được parse cục bộ trước; LLM chỉ được yêu cầu khi tài liệu đủ dài nhưng dữ liệu trích xuất thiếu cấu trúc hoặc không đủ tín hiệu đáng tin cậy. Phần giải thích Match cũng chỉ gọi LLM khi cấu hình cho phép và kết quả có độ tin cậy thấp, yêu cầu JD chưa rõ hoặc bằng chứng kỹ năng chỉ khớp một phần. Nếu thiếu API key hoặc LLM lỗi, hệ thống tự dùng kết quả xác định cục bộ và vẫn hoàn thành báo cáo.

API tiến trình `GET /api/v1/matches/{match_id}` trả `current_step` và `progress_percent`; các trạng thái chính là `PENDING`, `PARSING`, `EVALUATING`, `FINALIZING`, `COMPLETED` hoặc `FAILED`.

### RAG JD thị trường với pgvector

Backend tự đồng bộ ~98 JD mẫu trong `data/jds` vào PostgreSQL/pgvector lúc khởi động. Khi `VECTOR_EMBEDDING_PROVIDER=auto`, nếu Gemini embedding lỗi hoặc hết quota, backend tự đồng bộ lại bằng `hashing-v1` chạy nội bộ; tìm kiếm semantic và Match CV vẫn dùng được mà không phải chờ quota. Nếu cấu hình rõ `VECTOR_EMBEDDING_PROVIDER=gemini`, lỗi Gemini vẫn được báo để người vận hành biết cấu hình bắt buộc không đáp ứng.

```bash
# Đồng bộ thủ công từ thư mục root (hoặc sau khi quota reset)
python scripts/index_market_jds.py

# Hoặc gọi endpoint quản trị (cần token admin)
curl -X POST http://localhost:8000/api/v1/jobs/rag/sync \
  -H "Authorization: Bearer <admin-token>"
```

### LangSmith và kiểm tra sau khi sửa

LangSmith tracing mặc định đang tắt để key mẫu không tạo lỗi `403 Forbidden`. Chỉ đặt `LANGCHAIN_TRACING_V2=true` và `LANGSMITH_TRACING=true` sau khi đã điền `LANGSMITH_API_KEY` hợp lệ.

```bash
# Backend (chạy trong backend/ sau khi cài requirements.txt)
python -m ruff check src tests
python -m pytest -q

# Frontend (chạy trong frontend/; dừng dev server trước khi build để tránh dùng chung cache .next)
npm run lint
npm run typecheck
npm run build
```

Kết quả kiểm tra gần nhất: backend `198 passed`; frontend lint, TypeScript và production build đều thành công. Runtime đã được smoke test qua proxy frontend: đăng nhập, tạo CV tạm, chọn JD, Match hoàn tất và CV kiểm tra đã được xóa.


## 🛠 Tech Stack

| Layer | Công nghệ |
|---|---|
| Backend | FastAPI + Uvicorn (async) |
| Frontend | Next.js (App Router) |
| LLM | Google Gemini (`gemini-3.1-flash-lite`, cấu hình qua `MODEL_NAME`) |
| Database | PostgreSQL + pgvector |
| Vector Search / RAG | PostgreSQL pgvector + Gemini Embedding (fallback offline hashing khi không có API key) |
| Malware Scan | ClamAV (`MALWARE_SCAN_MODE`) |
| DevOps | Docker Compose (3 service: db, clamav, backend) + GitHub Actions; Next.js chạy local |
| Testing | pytest + pytest-asyncio |

## 📁 Cấu trúc dự án (rút gọn)

```
├── backend/                # FastAPI service (Python)
│   ├── src/                # API, agents, services, database, core, config
│   ├── tests/              # pytest suite (unit, API, e2e, guardrails, UI contracts)
│   ├── Dockerfile
│   └── pyproject.toml, requirements*.txt
├── frontend/               # Next.js application (TypeScript/JavaScript/CSS)
│   ├── app/, components/, public/
│   └── package.json, Dockerfile
├── eval/                   # Bộ eval CV parser + CV-JD matching (golden cases)
├── docs/
│   ├── gate 1/             # Brief, PRD, wireframe (Gate 1)
│   ├── pipeline/            # Đặc tả kỹ thuật pipeline (Phrase_2: CV-JD Matching, Phrase_3: Voice Interview)
│   └── OVERNIGHT_RUN_LOG_*.md  # Nhật ký các phiên fix/test tự động
├── scripts/                 # AI Logging Hooks (BTC) + tiện ích đồng bộ pgvector
├── docker-compose.yml       # Backend stack: db, clamav, backend
└── Makefile                 # Local backend entry points
```

## 📊 AI Usage Logging (yêu cầu BTC — không thay đổi)

Template tích hợp sẵn auto-logging hooks cho Claude Code, Cursor, Codex CLI, Gemini CLI, GitHub Copilot, Antigravity IDE — log vào `.ai-log/session.jsonl`, tự động submit lên grading server mỗi khi `git push`.

```bash
# Cài hook 1 lần sau khi clone
bash scripts/setup_hooks.sh

# Log thủ công cho ChatGPT / web tools khác
bash scripts/_pyrun.sh scripts/log_manual.py --tool chatgpt --prompt "What you asked"
```

## 📋 10 Deliverables cho Demo Day

| # | Deliverable | Trạng thái |
|---|---|:---:|
| 1 | Source Code | ✅ |
| 2 | README.md | ✅ |
| 3 | Architecture Diagram | 📝 Cần điền (`ARCHITECTURE.md`, `docs/architecture_diagram.md`) |
| 4 | AI Logs | ✅ Tự động |
| 5 | Live URL | ⏳ Chưa deploy public — hiện chạy local qua Docker |
| 6 | Video Demo | 📝 Cần làm (`presentation/`) |
| 7 | Pitch Deck | 📝 Cần làm (`presentation/`) |
| 8 | Development Journal | 📝 Cần điền (`JOURNAL.md`) |
| 9 | Worklog | 📝 Cần điền (`WORKLOG.md`) |
| 10 | Evaluation Evidence | ✅ `eval/` (CV parser + CV-JD matching, 15/15 case pass) |

## 📖 Technical Guidebook (tài liệu chung khóa học)

**Online:** [phoenix.note.transformerlabs.ai/technical-book](https://phoenix.note.transformerlabs.ai/technical-book) — đăng nhập GitHub (org `AI20K-Build-Cohort-2`).
**Offline:** `docs/guide/` (10 chương).

## 🔗 Liên kết

- 🏫 **AI20K Program:** VinUni AI20K Build Phase, nhóm WinTop
- 👨‍🏫 **Mentor:** Trần Vũ Anh (Andy)

## 📄 License

MIT — Sử dụng tự do cho mục đích giáo dục.
