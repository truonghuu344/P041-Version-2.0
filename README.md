# 🤖 AI20K Agent Template

Template chính thức cho học viên **VinUni AI20K Build Phase** — cung cấp sẵn cấu trúc dự án, code mẫu, và hướng dẫn kỹ thuật chi tiết để xây dựng AI Agent đạt điểm cao (35+/50).

> 📖 **Technical Guidebook:** [phoenix.note.transformerlabs.ai/technical-book](https://phoenix.note.transformerlabs.ai/technical-book)

## Trạng thái triển khai hiện tại

### Chức năng đã hoàn thành

#### 1. Xác thực người dùng

- Đăng ký bằng email và mật khẩu, có validation email, độ mạnh mật khẩu, họ tên và vai trò.
- Đăng nhập, đăng xuất và đọc thông tin người dùng hiện tại.
- Đăng ký/đăng nhập bằng Google ID Token.
- Phiên đăng nhập dùng JWT trong cookie `HttpOnly`; API bảo vệ dữ liệu theo người dùng.
- Có tài khoản và quyền `student`, `counselor`, `enterprise`, `admin`.

Các endpoint chính:

```text
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/google
GET  /api/v1/auth/me
POST /api/v1/auth/logout
```

#### 2. Nova AI Career Agent chatbot

- Chat nhiều lượt bằng Google Gemini; mặc định dùng model ổn định `gemini-3.6-flash`.
- Khi `ASSISTANT_PROVIDER=gemini`, backend chỉ gọi Gemini và không âm thầm chuyển sang model của provider khác.
- Trả lời dự phòng an toàn khi provider chưa cấu hình hoặc tạm thời lỗi.
- Dùng ngữ cảnh đã xác minh từ hồ sơ người dùng, CV và Job Description trong PostgreSQL.
- Hỗ trợ tư vấn CV, Gap Analysis, phỏng vấn STAR và tra cứu thời tiết trực tiếp.
- WeatherAPI dùng `WEATHER_API_KEY` là nguồn chính; Open-Meteo là nguồn dự phòng khi key hết hạn hoặc dịch vụ tạm lỗi.
- Sinh nút hành động để điều hướng người dùng tới trang CV, JD, Gap Analysis hoặc phỏng vấn.
- Lưu hội thoại và tin nhắn theo từng tài khoản; hỗ trợ xem danh sách, mở lại và xóa hội thoại.
- Ghi `ai_audit_logs` gồm provider, model, trạng thái LLM, độ trễ và tool đã dùng.
- Chống truy cập hội thoại của tài khoản khác và không tự bịa thông tin CV/JD còn thiếu.

Các endpoint chính:

```text
GET    /api/v1/assistant/status
POST   /api/v1/assistant/chat
GET    /api/v1/assistant/conversations
GET    /api/v1/assistant/conversations/{conversation_id}
DELETE /api/v1/assistant/conversations/{conversation_id}
```

#### 3. Quản trị người dùng

- Trang Admin tải danh sách tài khoản trực tiếp từ PostgreSQL.
- Admin có thể tạo, cập nhật thông tin, đổi mật khẩu và xóa tài khoản được quản lý.
- Bắt buộc xác thực quyền `admin`; tài khoản thường nhận `403 Forbidden`.
- Không cho tự xóa, vô hiệu hóa hoặc hạ quyền tài khoản quản trị hệ thống.
- Email được kiểm tra trùng và mật khẩu áp dụng cùng quy tắc độ mạnh với đăng ký.
- Lỗi API đã được giao diện xử lý sẽ hiển thị trong bảng/toast thay vì kích hoạt Next.js Console Error overlay.

```text
GET    /api/v1/admin/users
POST   /api/v1/admin/users
PUT    /api/v1/admin/users/{user_id}
DELETE /api/v1/admin/users/{user_id}
```

### Công nghệ đang sử dụng

| Thành phần | Công nghệ |
|---|---|
| Frontend | Next.js 15, React 18, TypeScript, JavaScript |
| Backend API | FastAPI, Uvicorn, Pydantic v2 |
| Authentication | JWT, cookie HttpOnly, bcrypt, Google OAuth ID Token |
| AI provider chính | Google Gemini REST API `generateContent` (`gemini-3.6-flash`) |
| AI provider tùy chọn | OpenAI Responses API (chỉ dùng khi đổi `ASSISTANT_PROVIDER`) |
| Agent tools | CV context, JD context, hồ sơ người dùng, WeatherAPI + Open-Meteo fallback |
| Database | PostgreSQL, SQLAlchemy async, asyncpg, Alembic |
| Kiểm thử | pytest, pytest-asyncio, FastAPI TestClient, TypeScript compiler, Next.js build |

### Cách cài đặt và chạy

Yêu cầu: Python 3.11+, Node.js, npm và PostgreSQL đang hoạt động.

#### 1. Cài backend

Windows PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

Cập nhật tối thiểu các biến sau trong `.env`:

```dotenv
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/database_name
SECRET_KEY=replace-with-a-long-random-secret
ASSISTANT_PROVIDER=gemini
GOOGLE_API_KEY=your-valid-google-key
GEMINI_MODEL=gemini-3.6-flash
WEATHER_API_KEY=your-valid-weatherapi-key
GOOGLE_OAUTH_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

Đặt `ASSISTANT_PROVIDER=gemini` để Nova luôn dùng Gemini. Backend chấp nhận cả `GOOGLE_API_KEY` và `GEMINI_API_KEY`; nếu có cả hai thì `GOOGLE_API_KEY` được ưu tiên. Giá trị mẫu chỉ là hướng dẫn, không phải khóa hoạt động. Hãy tạo khóa trong Google AI Studio, đặt khóa thật ở backend `.env`, không đưa khóa vào frontend hoặc commit lên Git.

Khởi tạo database mới và chạy backend:

```powershell
alembic upgrade head
uvicorn src.backend.main:app --reload --port 8000
```

Swagger UI: [http://localhost:8000/docs](http://localhost:8000/docs)

Kiểm tra Gemini đã sẵn sàng:

```powershell
Invoke-RestMethod http://localhost:8000/api/v1/assistant/status
```

Kết quả đúng có `configured: true`, `provider: gemini` và `model: gemini-3.6-flash`. Nếu vừa sửa `.env`, hãy khởi động lại Uvicorn để backend nạp API key mới.

Trong giao diện Nova, có thể bấm nút **Thời tiết** hoặc hỏi trực tiếp: `Thời tiết Hà Nội hôm nay thế nào?`. Backend sẽ lấy dữ liệu hiện tại từ WeatherAPI; nếu WeatherAPI không phản hồi, hệ thống tự dùng Open-Meteo rồi đưa dữ liệu đã xác minh cho Gemini diễn đạt bằng tiếng Việt.

#### 2. Cài và chạy frontend

Mở terminal thứ hai:

```powershell
cd src\frontend
npm install
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000), đăng ký hoặc đăng nhập, sau đó bấm biểu tượng Nova ở góc màn hình để bắt đầu chat. Next.js tự proxy `/api/v1/*` sang FastAPI ở cổng `8000`.

#### 3. Chạy kiểm tra trước khi bàn giao

```powershell
# Tại thư mục gốc
.\.venv\Scripts\python.exe -m ruff check src/backend tests/test_backend
.\.venv\Scripts\python.exe -m pytest tests/test_backend -q

# Tại src/frontend
npm run typecheck
npm run build
```

Nếu Gemini API key không hợp lệ hoặc Gemini không phản hồi, Nova vẫn trả lời ở chế độ dự phòng và giao diện hiển thị Gemini đang offline. Cần `GOOGLE_API_KEY` hoặc `GEMINI_API_KEY` hợp lệ để nhận phản hồi thực sự sinh bởi mô hình.

#### 4. Xử lý lỗi cache Next.js

Dự án tách cache development (`.next-dev`) và production (`.next`) để có thể chạy `npm run build` trong lúc dev server đang hoạt động mà không làm mất webpack chunks.

Frontend dùng font hệ thống cục bộ, nên cả `npm run dev` và `npm run build` không cần tải Google Fonts từ mạng.

Nếu dev server từng bị dừng đột ngột và hiển thị `Cannot find module './<chunk>.js'`, dừng frontend, xóa riêng hai thư mục cache rồi chạy lại:

```powershell
cd src\frontend
Remove-Item -Recurse -Force .next,.next-dev -ErrorAction SilentlyContinue
npm run dev
```

Hai thư mục này chỉ chứa dữ liệu build sinh tự động, không chứa source code hoặc dữ liệu người dùng.

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
# Mở .env và thêm OPENAI_API_KEY của bạn
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

### Bước 5: Đọc hướng dẫn

📖 Mở **[Technical Guidebook](https://phoenix.note.transformerlabs.ai/technical-book)** và làm theo từng chương.

---

## 📦 Data Setup & Quản lý dữ liệu cho Team Dev

Để đảm bảo repository gọn nhẹ, dễ bảo trì và hạn chế xung đột (Git merge conflict) khi làm việc nhóm, dự án tuân thủ các quy tắc quản lý dữ liệu sau:

### 1. Quy tắc Commit Git (Push vs Ignore)
- ✅ **ĐƯỢC COMMIT LÊN GIT**:
  - **Seed / Mock Data**: Các file dữ liệu mẫu nhỏ gọn (ví dụ: `data/eval/simulated_cvs.json`) dùng để Dev nhanh API/UI.
  - **Source Code & Scripts**: Toàn bộ code trong `ingestion/`, `retrieval/`, `eval/`, `scripts/`.
  - **Cấu hình Git**: File `.gitignore`.

- ❌ **TỰ ĐỘNG BỎ QUA (KHÔNG COMMIT)**:
  - **Full Dataset**: File dữ liệu thô dung lượng lớn (ví dụ: `Resume.csv` ~56MB).
  - **Vector Database**: Thư mục `chroma_db/`, các file `.bin` (HNSW Index), `*.sqlite3`, `*.db`.

### 2. Hướng dẫn Dev khởi tạo dữ liệu local (Quick Seeding)
Khi clone dự án về máy cá nhân, chạy câu lệnh sau để tự động tạo ChromaDB local và nạp dữ liệu thử nghiệm:

```bash
# Khởi tạo Vector DB & chạy thử nghiệm truy xuất dữ liệu mẫu
python scripts/demo_interactive_ats.py
```

### 3. Quy trình xử lý dữ liệu (ETLT) với PostgreSQL hội tụ
Hệ thống hiện tại sử dụng kiến trúc Converged Database với **PostgreSQL + pgvector**. Để khởi chạy luồng ETLT và tự động chạy test Pipeline:

```bash
# 1. Khởi động PostgreSQL (có sẵn pgvector) qua Docker
docker compose up db -d

# 2. Đảm bảo đã cài đặt các thư viện kết nối (psycopg2, pgvector, v.v.)
pip install -r requirements.txt

# 3. Chạy toàn bộ luồng ETLT (Load, Transform, Vectorize) và kiểm thử RAG
python scripts/run_phase2_pipeline.py
```
---

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
| LLM | OpenAI GPT-4o-mini | API |
| Frontend | Next.js / Streamlit | 14+ / 1.30+ |
| Database | SQLite (dev) / PostgreSQL (prod) | — |
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
