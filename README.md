# 🤖 AI20K Agent Template

Template chính thức cho học viên **VinUni AI20K Build Phase** — cung cấp sẵn cấu trúc dự án, code mẫu, và hướng dẫn kỹ thuật chi tiết để xây dựng AI Agent đạt điểm cao (35+/50).

> 📖 **Technical Guidebook:** [phoenix.note.transformerlabs.ai/technical-book](https://phoenix.note.transformerlabs.ai/technical-book)

## 🎯 Template này dùng để làm gì?

Khi tham gia AI20K Build Phase, mỗi đội cần xây dựng một AI Agent hoàn chỉnh — từ kiến trúc, code, test, đến deploy. Thay vì bắt đầu từ con số không, template này cung cấp:

- **Cấu trúc thư mục chuẩn** — đã được thiết kế theo best practices (separation of concerns)
- **Code mẫu** cho các phần cốt lõi: LangGraph agent, FastAPI API, config, schemas
- **Docker + CI/CD sẵn** — Dockerfile multi-stage, GitHub Actions workflow
- **Hướng dẫn kỹ thuật 10 chương** — từ clone template đến nộp bài Demo Day
- **Checklist 10 deliverables** — đảm bảo không bỏ sót yêu cầu BTC
- **AI Usage Logging tự động** — Pre-configured hooks cho Claude Code, Cursor, Codex, Gemini CLI, Antigravity, và GitHub Copilot

## ⚡ Quick Start

### Bước 1: Fork hoặc Clone

```bash
# Clone template
git clone https://github.com/AI20K-Build-Cohort-2/starter-code-template.git team-YOUR_TEAM_NAME
cd team-YOUR_TEAM_NAME

# Xóa git history cũ và khởi tạo lại
rm -rf .git
git init
git add .
git commit -m "feat: khởi tạo dự án từ template"
```

### Bước 2: Setup môi trường

```bash
# Tạo virtual environment
python3.11 -m venv .venv
source .venv/bin/activate

# Cài dependencies
pip install -e ".[dev]"

# Cấu hình API keys
cp .env.example .env
# Mở .env và thêm GEMINI_API_KEY của bạn (lấy từ Google AI Studio)
# Đồng thời cập nhật AI_LOG_API_KEY bằng key riêng từ link mời của BTC
# (giá trị trong .env.example chỉ là placeholder)
```

### Bước 3: Cài AI Logging Hooks

```bash
# Linux / macOS / Git Bash
bash scripts/setup_hooks.sh

# Windows PowerShell
# powershell -ExecutionPolicy Bypass -File scripts\setup_hooks.ps1
```

Hooks tự động log mọi AI prompt khi dùng Claude Code, Cursor, Codex, Gemini CLI, Antigravity, hoặc GitHub Copilot. Không cần thao tác thủ công.

### Bước 4: Chạy server

```bash
# Chạy FastAPI backend
uvicorn src.main:app --reload --port 8000

# Mở Swagger UI
# http://localhost:8000/docs
```

### Chạy full-stack với Docker

Yêu cầu Docker Desktop đang chạy. Sao chép `.env.example` thành `.env`, điền các API key cần dùng, và đặt `POSTGRES_PASSWORD` thành một mật khẩu mạnh. Sau đó chạy:

```bash
docker compose up --build -d
```

Truy cập ứng dụng qua Nginx Gateway tại [http://localhost:8080](http://localhost:8080); API documentation có tại [http://localhost:8080/docs](http://localhost:8080/docs). Chỉ Gateway được publish ra host, còn frontend/backend nằm trong mạng Docker. Kiểm tra trạng thái bằng `docker compose ps` hoặc `docker compose logs -f`.

Khi đưa lên Internet, trỏ Cloudflare Tunnel hoặc reverse proxy của máy chủ vào `http://localhost:8080`. Đặt `APP_ENV=production`, `CORS_ORIGINS=https://ten-mien-cua-ban`, `SECRET_KEY`, `INITIAL_ADMIN_PASSWORD`, `POSTGRES_PASSWORD` và `GOOGLE_OAUTH_CLIENT_ID` bằng giá trị thật; không dùng URL `trycloudflare.com` lâu dài cho đăng nhập hoặc dữ liệu thật.

Để dừng stack, dùng `docker compose down`. Thêm `-v` chỉ khi muốn xóa toàn bộ dữ liệu PostgreSQL và dữ liệu ứng dụng.

### RAG JD thị trường với Qdrant

Docker Compose khởi chạy Qdrant và backend tự đồng bộ tăng dần 98 JD trong `data/jds`. API `GET /api/v1/jobs` dùng vector retrieval khi có từ khóa hoặc `cv_id`, sau đó rerank theo kỹ năng; nếu Qdrant tạm lỗi, API tự chuyển về tìm kiếm catalog để giao diện vẫn hoạt động.

```bash
# Đồng bộ thủ công khi chạy backend ngoài Docker
python -m scripts.index_market_jds

# Hoặc gọi endpoint quản trị
curl -X POST http://localhost:8000/api/v1/jobs/rag/sync \
  -H "Authorization: Bearer <admin-token>"
```

`QDRANT_EMBEDDING_PROVIDER=auto` dùng `gemini-embedding-2` khi có `GEMINI_API_KEY`; nếu không có key, hệ thống dùng embedding hashing offline. Qdrant Dashboard ở `http://localhost:6333/dashboard` trong môi trường local.

### Bước 5: Đọc hướng dẫn

📖 Mở **[Technical Guidebook](https://phoenix.note.transformerlabs.ai/technical-book)** và làm theo từng chương.

## 📁 Cấu trúc dự án

```
├── src/
│   ├── agents/           # 🧠 LangGraph Agent
│   │   ├── graph.py      #    State graph (nodes + edges)
│   │   ├── state.py      #    State schema (TypedDict)
│   │   ├── nodes/        #    Node functions
│   │   └── tools/        #    Agent tools (@tool)
│   ├── api/              # 🌐 FastAPI Backend
│   │   └── routes.py     #    API endpoints
│   ├── models/           # 📋 Pydantic schemas
│   ├── services/         # 🔧 Business logic (LLM, etc.)
│   ├── config.py         # ⚙️ Pydantic Settings
│   └── main.py           # 🚀 App entry point
├── tests/                # 🧪 pytest suite
│   ├── test_agents/      #    Agent/graph tests
│   └── test_api/         #    API endpoint tests
├── scripts/              # 🔌 AI Logging Hooks
│   ├── log_hook.py       #    Auto-log cho Claude/Cursor/Codex/Gemini/Copilot
│   ├── log_antigravity.py#    Antigravity IDE prompt scanner
│   ├── log_manual.py     #    Manual log cho ChatGPT / web tools
│   ├── submit_log.py     #    Submit logs on git push
│   └── setup_hooks.sh    #    One-time hook installer
├── .claude/ .codex/ .cursor/ .gemini/  # Per-tool hook configs
├── .agents/              # Antigravity rules + workflows
├── .ai-log/              # 📊 AI usage logs (auto-generated)
├── docs/
│   ├── guide/            # 📖 Technical Guidebook (10 chapters)
│   └── architecture_diagram.md
├── eval/                 # 📊 Evaluation results
├── presentation/         # 🎤 Demo Day slides
├── .github/workflows/    # ⚡ CI/CD (GitHub Actions)
├── .github/hooks/        # 🪝 Copilot hook config
├── Dockerfile            # 🐳 Multi-stage build
├── docker-compose.yml    # 🐙 Full stack orchestration
└── README_boilerplate.md # 📝 README template cho đội của bạn
```

## 📚 Technical Guidebook — 10 Chương

| Chương | Nội dung | Thời gian |
|---------|----------|-----------|
| 1 | Lời mở đầu — Mục tiêu, cách sử dụng | 15 phút |
| 2 | Khởi tạo dự án — Clone, setup, git workflow | 4 giờ |
| 3 | Thiết kế kiến trúc — 3-tier, diagrams, ADR | 6 giờ |
| 4 | **LangGraph Agent** — State, nodes, edges, tools, RAG | 8 giờ |
| 5 | FastAPI — Routes, validation, error handling, streaming | 6 giờ |
| 6 | Giao diện — Next.js + Streamlit quickstart | 6 giờ |
| 7 | DevOps — Docker, CI/CD, deploy, logging | 6 giờ |
| 8 | Kiểm thử — Unit test, integration test, RAGAS | 4 giờ |
| 9 | Demo Day — 10 deliverables, checklist, tips | 2 giờ |
| 10 | Tài nguyên — Khóa học, docs, BMAD method | tham khảo |

📖 **Đọc online:** [phoenix.note.transformerlabs.ai/technical-book](https://phoenix.note.transformerlabs.ai/technical-book)

## 📋 10 Deliverables cho Demo Day

| # | Deliverable | File vị trí | Template có sẵn |
|---|-------------|-------------|:---:|
| 1 | Source Code | `src/` | ✅ |
| 2 | README.md | `README_boilerplate.md` → copy thành `README.md` | ✅ |
| 3 | Architecture Diagram | `docs/architecture_diagram.md` | ✅ |
| 4 | AI Logs | LangSmith (3 env vars) + Auto AI Usage Logging | ✅ |
| 5 | Live URL | Deploy lên Render/Vercel | ⚡ CI/CD sẵn |
| 6 | Video Demo | `presentation/` | 📝 |
| 7 | Pitch Deck | `presentation/` | 📝 |
| 8 | Development Journal | `JOURNAL.md` | ✅ |
| 9 | Worklog | `WORKLOG.md` | ✅ |
| 10 | Evaluation Evidence | `eval/` | 📝 |

## 🛠 Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| AI Agent | LangGraph + LangChain | Latest |
| Backend | FastAPI + Uvicorn | 0.100+ |
| LLM | Google Gemini 3.5 Flash | Gemini Developer API |
| Frontend | Next.js / Streamlit | 14+ / 1.30+ |
| Database | SQLite (dev) / PostgreSQL (prod) | — |
| Vector DB / RAG | Qdrant + Gemini Embedding 2 | 1.x |
| DevOps | Docker + GitHub Actions | — |
| Testing | pytest + pytest-asyncio | 8+ |

## 📊 AI Usage Logging

Template đã tích hợp sẵn auto-logging hooks cho 6 AI tools:

| Tool | Cơ chế | Config |
|------|--------|--------|
| Claude Code | `.claude/settings.json` hooks | Tự động |
| Cursor | `.cursor/hooks.json` | Tự động |
| OpenAI Codex CLI | `.codex/hooks.json` | Tự động |
| Gemini CLI | `.gemini/settings.json` | Tự động |
| GitHub Copilot | `.github/hooks/hooks.json` | Tự động |
| Antigravity IDE | Pre-push scan transcript | Tự động trên `git push` |

Tất cả prompts và tool calls được log vào `.ai-log/session.jsonl` và tự động submit lên grading server mỗi khi `git push`.

**ChatGPT / web tools khác** — log thủ công:
```bash
bash scripts/_pyrun.sh scripts/log_manual.py --tool chatgpt --prompt "What you asked"
```

> ⚠️ Chạy `bash scripts/setup_hooks.sh` một lần sau khi clone để cài pre-push hook.

## 📖 Đọc Technical Guidebook

**Online (khuyến nghị):** [phoenix.note.transformerlabs.ai/technical-book](https://phoenix.note.transformerlabs.ai/technical-book)

Đăng nhập bằng GitHub (cùng account đã được BTC mời vào org `AI20K-Build-Cohort-2`)
→ chọn tab **Technical Book** ở sidebar trái → đọc 10 chương + topic sections,
có table of contents bên phải, hỗ trợ light/dark/cyberpunk theme.

**Offline:** mọi chương đều ở thư mục `docs/guide/` trong template này — mở bằng
bất kỳ markdown viewer/editor nào (VS Code, Obsidian, GitHub UI, …).

## 🔗 Liên kết

- 📖 **Technical Guidebook:** [phoenix.note.transformerlabs.ai/technical-book](https://phoenix.note.transformerlabs.ai/technical-book)
- 🏫 **AI20K Program:** VinUni AI20K Build Phase
- 👨‍🏫 **Mentor:** Đặng Hải Lộc

## 📄 License

MIT — Sử dụng tự do cho mục đích giáo dục.

## CV–JD Matching Pipeline v1

Luồng phân tích hiện dùng atomic JD requirements → BM25 + semantic embedding → RRF → evidence → configurable rubric. Kết quả lưu đầy đủ chuỗi truy vết từ Final Score về CV chunk và trang nguồn.

Các API chính:

- `POST /api/v1/matches` bắt đầu match bất đồng bộ;
- `GET /api/v1/matches/{match_id}` đọc trạng thái/kết quả;
- `GET /api/v1/matches/{match_id}/evidence` lọc evidence theo requirement/criterion;
- `GET /api/v1/matches/{match_id}/report` lấy báo cáo JSON;
- `GET /api/v1/metrics/cv-jd` xem metrics vận hành (admin/counselor).

Đặc tả triển khai và cấu hình nằm tại `docs/pipeline/CV_JD.md`. Docker Compose kèm Qdrant và ClamAV; production đặt `MALWARE_SCAN_MODE=required` và `CV_JD_EMBEDDING_PROVIDER=gemini`.
