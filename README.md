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

Match CV đo mức độ phù hợp giữa một CV và một Job Description (JD). Mọi kết luận đều phải có bằng chứng trong CV; hệ thống không tự thêm kỹ năng, kinh nghiệm, bằng cấp hoặc thành tích.

#### Cách sử dụng

1. Đăng nhập và mở màn hình **Match CV**.
2. Chọn CV trong Kho CV hoặc tải file PDF/DOCX mới.
3. Chọn công việc trong danh mục hoặc tải JD dạng PDF/DOCX/TXT/ảnh.
4. Nhấn **Phân tích Match** và theo dõi tiến độ trên nút.
5. Xem Match Score, kỹ năng phù hợp/còn thiếu, bằng chứng và việc cần ưu tiên trong popup kết quả.

Nút phân tích chỉ hoạt động khi đã chọn đủ CV và JD. CV mới được lưu vào Kho CV của đúng tài khoản.

#### Workflow và cách hoạt động

```text
CV + JD
  → Parse và chuẩn hóa
  → Chia CV theo section
  → Tách yêu cầu JD
  → Tìm evidence
  → Đánh giá từng yêu cầu
  → Tính Match Score
  → Lưu và hiển thị báo cáo
```

| Bước | Xử lý | Đầu ra |
|---|---|---|
| 1. Parse | Parser cục bộ đọc CV/JD; Gemini chỉ hỗ trợ khi dữ liệu thiếu cấu trúc hoặc độ tin cậy thấp. | CV và JD có cấu trúc. |
| 2. Chunking | CV được chia thành Summary, Skills, Experience, Projects, Education và Certifications. Thông tin liên hệ không dùng làm evidence năng lực. | Các CV chunk có section và trang nguồn. |
| 3. Requirement extraction | JD được tách thành kỹ năng bắt buộc/ưu tiên, kinh nghiệm, trách nhiệm, học vấn và domain. | Danh sách requirement cần kiểm tra. |
| 4. Retrieval | BM25 tìm từ khóa; semantic embedding tìm nội dung cùng nghĩa; RRF hợp nhất hai thứ hạng. | Tối đa 3 evidence tốt nhất cho mỗi requirement. |
| 5. Evaluation | Evidence được phân loại theo mức khớp và kiểm tra đúng section. | Supported, partial, missing hoặc uncertain. |
| 6. Scoring | Rubric tính điểm từng tiêu chí rồi cộng điểm có trọng số. | Match Score từ 0 đến 100. |
| 7. Persistence | Backend lưu score, evidence, processing trace và báo cáo. | Kết quả có thể xem lại và truy nguồn. |

Frontend tạo tác vụ nền bằng `POST /api/v1/matches`, sau đó đọc tiến độ từ `GET /api/v1/matches/{match_id}` và lấy báo cáo tại `GET /api/v1/matches/{match_id}/report`.

#### Các luồng hoạt động

| Luồng | Khi nào chạy | Các bước chính |
|---|---|---|
| CV đã lưu + JD danh mục | Người dùng chọn dữ liệu đã có | Kiểm tra quyền sở hữu → tạo snapshot CV/JD → tạo match job → phân tích nền → lưu báo cáo. |
| Tải CV mới | Người dùng chọn PDF/DOCX | Quét file bằng ClamAV → trích xuất text → CV Parsing & ATS Agent chuẩn hóa → lưu Kho CV → chạy match job. |
| JD tùy chỉnh | Người dùng tải file hoặc nhập JD riêng | Trích xuất và chuẩn hóa JD → lưu JD của người dùng → chạy cùng pipeline Match CV. |
| AI khả dụng | Dữ liệu khó parse hoặc kết quả cần giải thích thêm | Gemini hỗ trợ structured parse/giải thích; Match Score vẫn do rubric cố định tính. |
| AI hoặc embedding lỗi | Thiếu API key, hết quota hoặc provider lỗi | Parser cục bộ, deterministic explanation và local hashing embedding tiếp tục xử lý. |

Match job chạy theo trạng thái `PENDING → PARSING → EVALUATING → FINALIZING → COMPLETED`. Nếu một bước không thể hoàn tất, trạng thái chuyển thành `FAILED` kèm mã lỗi; frontend hiển thị tiến độ tương ứng `5% → 20% → 65% → 90% → 100%`.

#### Agent tham gia

| Agent | Vai trò | Luồng nội bộ |
|---|---|---|
| **CV Parsing & ATS Agent** | Xử lý CV mới hoặc CV cần parse lại; tạo dữ liệu CV có cấu trúc và đánh giá chất lượng ATS. | Validate CV → local evidence parse → Gemini structured parse khi cần → evidence guardrail → ATS quality → finalize. |
| **CV Gap Analysis Agent** | Agent chính của Match CV; đối chiếu CV–JD, tạo Gap Analysis và bảo vệ tính trung thực của kết quả. | Validate input → extract evidence → draft analysis/action plan → integrity guardrail → trả báo cáo. |

`Background Match Runner` chỉ điều phối trạng thái, snapshot và lưu dữ liệu; BM25, embedding, RRF, evidence evaluator và rubric là service/tool của hai agent, không phải agent độc lập. Gemini là model được agent gọi khi cần và không trực tiếp quyết định Match Score.

#### Cách tính và giải thích kết quả

Rubric mặc định:

| Tiêu chí | Trọng số |
|---|---:|
| Kỹ năng/yêu cầu bắt buộc | 35% |
| Kinh nghiệm và trách nhiệm | 30% |
| Domain phù hợp | 15% |
| Học vấn | 10% |
| Kỹ năng/yêu cầu ưu tiên | 10% |

Nếu JD không có dữ liệu cho một tiêu chí, trọng số được phân bổ lại giữa các tiêu chí còn hoạt động để tổng luôn bằng 100%.

```text
Điểm tiêu chí = Trung bình điểm các requirement thuộc tiêu chí
Điểm có trọng số = Điểm tiêu chí × Trọng số
Match Score = Tổng điểm có trọng số
```

| Mức khớp | Điểm requirement | Giải thích |
|---|---:|---|
| Exact/Normalized Match | 100% | Khớp trực tiếp hoặc khớp sau chuẩn hóa alias, ví dụ ReactJS → React. |
| Semantic Match | 80% | Evidence tương đồng rõ về ý nghĩa. |
| Partial Match | 50% | Có evidence liên quan nhưng chưa đáp ứng đầy đủ. |
| Not Found | 0% | Không tìm thấy bằng chứng đáng tin cậy. |

Điểm có thể thấp dù CV chứa nhiều từ khóa vì:

- Evidence phải nằm trong section phù hợp với loại requirement.
- Một kỹ năng chỉ xuất hiện trong danh sách không chứng minh đầy đủ kinh nghiệm sử dụng.
- Yêu cầu bắt buộc có trọng số cao hơn yêu cầu ưu tiên.
- Khớp semantic hoặc khớp một phần không nhận toàn bộ điểm.
- Nội dung thiếu, mơ hồ hoặc parse không chắc chắn được đánh dấu `UNCERTAIN` thay vì suy đoán.

`confidence_score` phản ánh chất lượng parse và mức đầy đủ của evidence; đây không phải Match Score. Thiếu yêu cầu bắt buộc tạo cảnh báo `mandatory_requirement_failed`, nhưng phiên bản hiện tại không tự đưa điểm về 0 và không thay nhà tuyển dụng quyết định tuyển/loại.

| Match Score | Rating |
|---:|---|
| 0–49.9 | POOR |
| 50–69.9 | AVERAGE |
| 70–84.9 | GOOD |
| 85–100 | EXCELLENT |

#### Công nghệ dùng riêng cho Match CV

| Mục đích | Công nghệ |
|---|---|
| API và xử lý nền | FastAPI, Uvicorn, Python async |
| Parse CV/JD | Parser cục bộ, Gemini khi cần |
| Tìm kiếm từ khóa | BM25 |
| Tìm kiếm ngữ nghĩa | Gemini Embedding `gemini-embedding-2` |
| Fallback embedding | Local hashing embedding 768 chiều |
| Hợp nhất kết quả | Reciprocal Rank Fusion (RRF) |
| So sánh vector | Cosine similarity |
| Lưu báo cáo | PostgreSQL, SQLAlchemy |
| Tìm JD trong danh mục | PostgreSQL + pgvector |
| Kiểm tra file upload | ClamAV |

Khi Gemini Embedding không khả dụng và provider là `auto`, hệ thống tự chuyển sang local hashing embedding để Match CV vẫn hoàn thành.

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
