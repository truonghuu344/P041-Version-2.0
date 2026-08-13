# 🤖 Career Assistant X (CV Assistant)

Trợ lý nghề nghiệp AI cho sinh viên năm 3–4/mới ra trường — phân tích CV theo JD (Gap Analysis, không bịa/thổi phồng kinh nghiệm), phỏng vấn thử theo Rubric STAR, và chatbot AI **Nova** hỗ trợ định hướng nghề nghiệp. Dự án capstone **VinUni AI20K Build Phase**, nhóm **WinTop**.

## 🌐 Demo

Dự án hiện chạy **local qua Docker**, chưa deploy public:

```
http://localhost:8080
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
| `GOOGLE_OAUTH_CLIENT_ID` | Tùy chọn | Chỉ cần nếu muốn nút "Đăng nhập Google" hoạt động — lấy từ Google Cloud Console (Web application, Authorized JavaScript origins: `http://localhost:8080`) |

Lưu ý: `docker-compose.yml` tự đặt `APP_ENV=production` cho backend — khi đó `SECRET_KEY` và `INITIAL_ADMIN_PASSWORD` là **bắt buộc**, không có giá trị mặc định an toàn.

### Bước 2 — Chạy full-stack

```bash
docker compose up --build -d
docker compose ps   # xác nhận cả 6 service: db, qdrant, clamav, backend, frontend, gateway đều Up
```

### Bước 3 — Mở app

Truy cập [http://localhost:8080](http://localhost:8080) qua Nginx Gateway (chỉ Gateway publish ra host, frontend/backend nằm trong mạng Docker nội bộ).

- Đăng nhập admin: `admin@cva.com` + mật khẩu bạn đặt ở `INITIAL_ADMIN_PASSWORD`.
- Hoặc đăng ký tài khoản sinh viên mới ngay trên giao diện để test luồng chính (upload CV → chọn JD → Gap Analysis → phỏng vấn thử).

Dừng stack: `docker compose down` (thêm `-v` chỉ khi muốn xóa sạch dữ liệu Postgres/Qdrant).

### RAG JD thị trường với Qdrant

Backend tự đồng bộ ~98 JD mẫu trong `data/jds` vào Qdrant lúc khởi động. Nếu Qdrant lỗi hoặc quota Gemini API hết (đồng bộ embedding thất bại), API tự chuyển về tìm kiếm theo catalog để giao diện vẫn hoạt động bình thường (chỉ tính năng "AI lọc JD theo CV" bị ảnh hưởng, tìm việc theo từ khóa vẫn chạy).

```bash
# Đồng bộ thủ công (chạy backend ngoài Docker, hoặc sau khi quota reset)
python -m scripts.index_market_jds

# Hoặc gọi endpoint quản trị (cần token admin)
curl -X POST http://localhost:8080/api/v1/jobs/rag/sync \
  -H "Authorization: Bearer <admin-token>"
```

Qdrant Dashboard (local): [http://localhost:6333/dashboard](http://localhost:6333/dashboard).

## 🛠 Tech Stack

| Layer | Công nghệ |
|---|---|
| Backend | FastAPI + Uvicorn (async) |
| Frontend | Next.js (App Router) |
| LLM | Google Gemini (`gemini-3.1-flash-lite`, cấu hình qua `MODEL_NAME`) |
| Database | PostgreSQL + pgvector |
| Vector Search / RAG | Qdrant + Gemini Embedding (fallback offline hashing khi không có API key) |
| Malware Scan | ClamAV (`MALWARE_SCAN_MODE`) |
| DevOps | Docker Compose (6 service: db, qdrant, clamav, backend, frontend, gateway) + GitHub Actions |
| Testing | pytest + pytest-asyncio |

## 📁 Cấu trúc dự án (rút gọn)

```
├── src/
│   ├── agents/            # LangGraph agents (CV parser, Gap Analysis, Interview, Career Assistant)
│   ├── api/v1/             # FastAPI routes (auth, cvs, jds, analysis, matches, interviews, assistant, admin, counselor, enterprise)
│   ├── db/                 # SQLAlchemy models + database init
│   ├── services/           # cv_jd_pipeline.py (BM25+Vector+RRF+Rubric), job_rag.py (Qdrant), file_security.py (ClamAV), llm.py
│   ├── frontend/            # Next.js app (app/ router) + app.js (tương tác UI chính)
│   └── config.py, main.py
├── tests/                  # pytest suite (unit, api, e2e, guardrails, frontend)
├── eval/                   # Bộ eval CV parser + CV-JD matching (golden cases)
├── docs/
│   ├── gate 1/             # Brief, PRD, wireframe (Gate 1)
│   ├── pipeline/            # Đặc tả kỹ thuật pipeline (Phrase_2: CV-JD Matching, Phrase_3: Voice Interview)
│   └── OVERNIGHT_RUN_LOG_*.md  # Nhật ký các phiên fix/test tự động
├── scripts/                 # AI Logging Hooks (BTC) + tiện ích đồng bộ Qdrant
├── docker-compose.yml       # Full stack: db, qdrant, clamav, backend, frontend, gateway
└── Dockerfile
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
