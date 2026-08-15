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
npm run dev
```

Trên macOS/Linux, thay lệnh copy bằng `cp .env.local.example .env.local`. Frontend có tại `http://localhost:3000`.

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

### RAG JD thị trường với pgvector

Backend tự đồng bộ ~98 JD mẫu trong `data/jds` vào PostgreSQL/pgvector lúc khởi động. Nếu embedding lỗi hoặc quota Gemini API hết, API tự chuyển về tìm kiếm theo catalog để giao diện vẫn hoạt động bình thường (chỉ tính năng "AI lọc JD theo CV" bị ảnh hưởng, tìm việc theo từ khóa vẫn chạy).

```bash
# Đồng bộ thủ công từ thư mục root (hoặc sau khi quota reset)
python scripts/index_market_jds.py

# Hoặc gọi endpoint quản trị (cần token admin)
curl -X POST http://localhost:8000/api/v1/jobs/rag/sync \
  -H "Authorization: Bearer <admin-token>"
```


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

## 🧑‍💻 Chuẩn hoá môi trường Development

Tất cả thành viên dùng cùng major version:

| Công cụ | Phiên bản |
|---|---|
| Node.js | `20.x` LTS |
| npm | Đi kèm Node 20 |
| Python | `3.12.x` |
| Docker Desktop | Stable mới nhất |

Không dùng Node 24. Nếu nâng version phải cập nhật đồng thời Local + Docker + CI.

### 1. Cài Node 20

Tải `nvm-setup.exe` tại [NVM for Windows](https://github.com/coreybutler/nvm-windows/releases/latest). Sau khi cài, đóng và mở lại VS Code/Terminal, rồi chạy:

```powershell
nvm install 20
nvm use 20
node -v
npm.cmd -v
```

Yêu cầu: `node -v` trả về `v20.x.x`.

Nếu PowerShell báo `node is not recognized`, thử:

```powershell
$env:Path += ";C:\nvm4w;C:\nvm4w\nodejs"
node -v
```

> Đường dẫn trên chỉ áp dụng khi NVM của máy được cài tại `C:\nvm4w`. Nếu vẫn lỗi, chạy `nvm root` để kiểm tra thư mục NVM thực tế, sau đó đóng và mở lại VS Code/Terminal.

Nếu `node` hoặc `npm.cmd` báo `is not recognized` trong một terminal mới (kể cả khi prompt đang hiển thị `(.venv)`), đây là lỗi `Path` của NVM, không phải lỗi Python virtual environment. Chạy lại theo đúng thứ tự:

```powershell
nvm use 20
where.exe node
where.exe npm
node -v
npm.cmd -v
```

Nếu `npm.cmd` vẫn không được nhận diện và NVM nằm ở `C:\nvm4w`, thêm Path tạm thời cho terminal hiện tại rồi kiểm tra lại:

```powershell
$env:Path += ";C:\nvm4w;C:\nvm4w\nodejs"
node -v
npm.cmd -v
```

Khi các lệnh đã trả version, chạy lại `npm.cmd run typecheck` và `npm.cmd run build`. Đóng hoàn toàn VS Code/PowerShell và mở lại để Windows nhận Path lâu dài.

### 2. Cài Python 3.12

Tại root project:

```powershell
python --version
python -m venv .venv
.\.venv\Scripts\Activate.ps1

python -m pip install --upgrade pip
python -m pip install -r backend\requirements.txt
```

Yêu cầu: `Python 3.12.x`.

### 3. Cài Frontend

```powershell
cd frontend

npm.cmd ci
npm.cmd run typecheck
npm.cmd run build

cd ..
```

Cả `typecheck` và `build` phải thành công.

### 4. Trước khi tạo Pull Request

Backend:

```powershell
ruff check backend/src backend/tests

$env:APP_ENV="test"
$env:GEMINI_API_KEY="test-key"
$env:PYTHONPATH="backend"

pytest backend/tests -v --tb=short
```

Frontend:

```powershell
cd frontend
npm.cmd run typecheck
npm.cmd run build
cd ..
```

Nếu tất cả đều thành công:

```powershell
git status
```

→ Commit trên feature branch → tạo Pull Request → GitHub CI sẽ kiểm tra lại trên môi trường sạch.

### 5. Quy trình commit và push cho từng member

Mỗi member làm trên **branch riêng**, không commit trực tiếp vào `main` hoặc `develop`. Branch nên đặt theo tính năng, ví dụ: `feat/top-job-recommendations`, `feat/cv-variants-optimization`, `feat/voice-interview-question-bank`, `feat/match-evaluation-modal`.

#### Bắt đầu một tính năng

```powershell
git switch develop
git pull --ff-only origin develop
git switch -c feat/ten-tinh-nang
```

Nếu branch đã tồn tại trên máy, dùng:

```powershell
git switch feat/ten-tinh-nang
git pull --rebase origin develop
```

#### Khi hoàn thành một phần chức năng

Chạy kiểm tra trước, từ root project:

```powershell
git status
git diff --check

ruff check backend/src backend/tests
$env:APP_ENV="test"
$env:GEMINI_API_KEY="test-key"
$env:PYTHONPATH="backend"
pytest backend/tests -v --tb=short

cd frontend
npm.cmd run typecheck
npm.cmd run build
cd ..
```

Chỉ stage những file thuộc phần việc của mình; không dùng `git add .` nếu `git status` có file của member khác:

```powershell
git add backend/src/services/example.py backend/tests/test_example.py frontend/components/ExampleView.tsx
git diff --cached --check
git diff --cached
git commit -m "feat: mo ta ngan gon tinh nang"
```

#### Push và tạo Pull Request

```powershell
git push -u origin feat/ten-tinh-nang
```

Sau đó tạo Pull Request trên GitHub:

```text
base: develop
compare: feat/ten-tinh-nang
```

Chỉ merge khi GitHub CI xanh và ít nhất một member khác review. Sau khi `develop` ổn định, người được phân công tạo PR từ `develop` vào `main`.

Nếu `develop` thay đổi trong lúc bạn đang làm, đồng bộ trước khi tiếp tục hoặc trước khi merge PR:

```powershell
git fetch origin
git rebase origin/develop
git push origin feat/ten-tinh-nang
```

Nếu rebase tạo conflict, giải quyết từng file, chạy lại test liên quan, sau đó dùng `git rebase --continue`. Không dùng `git push --force`; nếu branch cá nhân đã từng push và cần cập nhật sau rebase, trao đổi với reviewer trước khi dùng `git push --force-with-lease`.

### Xử lý lỗi thường gặp khi chạy test

#### `pgvector RAG unavailable` kèm `ConnectionRefusedError: [WinError 1225]`

**Triệu chứng:** `pytest` log `pgvector RAG unavailable; using deterministic catalog fallback`, sau đó các test Job Search/RAG trả về `0` job hoặc `0/98` JD.

**Nguyên nhân:** Job RAG từng tạo database session riêng, không đi qua FastAPI `get_db` override của pytest; vì vậy nó cố kết nối `DATABASE_URL` trong `.env` (ví dụ Neon/local PostgreSQL) thay vì SQLite in-memory của test.

**Cách xử lý:** Pull phiên bản mới nhất. `backend/tests/conftest.py` đã thay singleton Job RAG bằng SQLite + hashing embedding trong từng test. Không đổi `DATABASE_URL` production và không cần chạy Neon/Docker chỉ để chạy pytest.

```powershell
git pull
.\.venv\Scripts\Activate.ps1
$env:APP_ENV="test"
$env:GEMINI_API_KEY="test-key"
$env:PYTHONPATH="backend"
pytest backend/tests/test_job_rag.py backend/tests/test_api/test_job_search.py -v --tb=short
```

Nếu cảnh báo này xuất hiện khi **chạy ứng dụng** (không phải pytest), RAG đang fallback về tìm kiếm catalog nên ứng dụng vẫn có thể tìm việc. Kiểm tra database service trước:

```powershell
docker compose up -d db backend
docker compose ps
Invoke-WebRequest http://localhost:8000/ready
```

#### Catalog JD trả về `0` dù `data/jds/raw` có dữ liệu

**Triệu chứng:** `test_enterprise_job_catalog_is_backed_by_raw_jd_files` báo `assert 0 == 98`, kéo theo Job Search/RAG trả danh sách rỗng.

**Nguyên nhân:** Một số công cụ tạo thư mục `backend/data` rỗng. Phiên bản cũ ưu tiên mọi thư mục `backend/data`, nên bỏ qua catalog thật tại root project: `data/jds/raw` và `data/clean/jds_clean.json`.

**Cách xử lý:** Pull phiên bản mới nhất. `job_catalog.py` chỉ dùng `backend/data` trong Docker khi thư mục đó có đủ file catalog; local sẽ tự dùng dữ liệu tại root project. Không di chuyển hoặc sao chép 98 JD thủ công.

Kiểm tra dữ liệu local:

```powershell
(Get-ChildItem data\jds\raw -Filter "JD-*.html" -File).Count
Test-Path data\clean\jds_clean.json
```

Kết quả cần là `98` và `True`. Sau đó chạy lại test Job Search/RAG.

#### `test_ui_contracts.py` báo thiếu `id="..."` sau khi frontend chuyển sang React component

Đây là test contract cũ đang đọc trực tiếp `frontend/app.js` hoặc một file page cũ, trong khi UI mới đã tách thành component React. Không chép lại markup cũ chỉ để làm test xanh. Cập nhật test để kiểm tra component/view hiện tại hoặc thay bằng UI/E2E test, rồi xác nhận luồng thật bằng `npm.cmd run typecheck` và `npm.cmd run build`.
