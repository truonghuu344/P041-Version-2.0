# Career Assistant Backend

Backend của Career Assistant X sử dụng FastAPI, SQLAlchemy async, PostgreSQL và
Alembic. Thư mục này được xây dựng độc lập với giao diện tại `src/frontend`.

## Trạng thái hiện tại

Các nền tảng backend đã hoàn thành:

1. Khởi tạo package `src.backend` và ứng dụng FastAPI.
2. Cấu hình ứng dụng bằng biến môi trường; bí mật dùng `SecretStr`.
3. Kết nối PostgreSQL bất đồng bộ, connection pool và dependency session.
4. Định nghĩa 11 SQLAlchemy models theo ERD trong `docs/diagrams`.
5. Cấu hình Alembic và migration schema ban đầu.
6. Định nghĩa Pydantic request/response schemas khớp với frontend và PRD.

API hiện mới có các endpoint nền tảng `/health`, `/ready`, `/docs` và
`/openapi.json`. Các endpoint nghiệp vụ `/api/v1` sẽ được bổ sung ở các bước
tiếp theo; schemas trong `models/` là hợp đồng dữ liệu cho những endpoint đó.

## Cấu trúc

```text
src/backend/
├── agents/             # LangGraph agents (sẽ triển khai)
├── api/                # FastAPI routers (sẽ triển khai)
├── core/               # Authentication, security và dependencies
├── db/
│   ├── database.py     # Async engine, session và health check
│   ├── models.py       # SQLAlchemy ORM models
│   └── migrations/     # Alembic migration history
├── middleware/         # CORS, logging, error handling
├── models/             # Pydantic API request/response schemas
├── observability/      # AI/application telemetry
├── services/           # Business logic
├── config.py           # Environment settings
└── main.py             # FastAPI application entry point
```

## Cài đặt

Từ thư mục gốc repository:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Cập nhật các giá trị riêng trong `.env`. Không commit file `.env`, mật khẩu,
OAuth secret hoặc API key.

## Chạy backend

```powershell
.\.venv\Scripts\python.exe -m uvicorn src.backend.main:app --reload --port 8000
```

Sau khi chạy:

- Health: <http://localhost:8000/health>
- Readiness: <http://localhost:8000/ready>
- Swagger UI: <http://localhost:8000/docs>

## Database migration

Migration đầu tiên dành cho PostgreSQL/database sạch:

```powershell
.\.venv\Scripts\python.exe -m alembic upgrade head
```

Xem revision hiện tại hoặc lùi một revision:

```powershell
.\.venv\Scripts\python.exe -m alembic current
.\.venv\Scripts\python.exe -m alembic downgrade -1
```

Nếu database đã có schema cũ với các bảng trùng tên, không chạy migration đầu
tiên trực tiếp. Hãy sao lưu dữ liệu và dùng database/volume sạch, hoặc tạo một
baseline migration riêng.

Khi thay đổi SQLAlchemy models:

```powershell
.\.venv\Scripts\python.exe -m alembic revision --autogenerate -m "describe change"
.\.venv\Scripts\python.exe -m alembic upgrade head
```

Luôn đọc lại migration được sinh tự động trước khi áp dụng.

## API schemas

Các schema được chia theo nghiệp vụ:

- `auth.py`: đăng nhập, đăng ký, Google OAuth và quản trị user.
- `resume.py`: CV thủ công, CV response và xóa nhiều CV.
- `job_description.py`: tạo và đọc Job Description.
- `analysis.py`: Gap Analysis, đề xuất và bước Accept/Reject chống bịa đặt.
- `interview.py`: phiên phỏng vấn 5–7 câu, STAR report và CSAT 1–5.
- `counselor.py`: cấp quyền cố vấn và phản hồi HITL.

Tất cả schema kế thừa `APIModel`, hỗ trợ đọc từ ORM và tự loại khoảng trắng ở
đầu/cuối chuỗi. Các response từ database phải dùng UUID và timestamp có timezone.

## Kiểm tra chất lượng

Chạy đúng các bước CI:

```powershell
.\.venv\Scripts\python.exe -m ruff check src tests
$env:APP_ENV = "test"
$env:OPENAI_API_KEY = "test-key"
.\.venv\Scripts\python.exe -m pytest tests -v --tb=short
```

Kiểm tra SQL migration mà không thay đổi database:

```powershell
.\.venv\Scripts\python.exe -m alembic upgrade head --sql
.\.venv\Scripts\python.exe -m alembic downgrade 20260810_0001:base --sql
```

## Nguyên tắc phát triển tiếp

- Router chỉ nhận request, gọi service và trả response schema.
- Business logic không đặt trực tiếp trong router.
- Mỗi truy vấn phải giới hạn theo user/role hiện tại để tránh lộ dữ liệu.
- Nội dung AI tối ưu CV phải dựa trên dữ liệu đã xác nhận; không tự tạo thành tích.
- Mọi thay đổi schema database phải có Alembic migration và test tương ứng.

## AI-log cho Codex

Project chỉ ghi lại prompt bạn gửi cho Codex vào `.ai-log/session.jsonl`. API key
được đọc từ `AI_LOG_API_KEY` trong `.env` và không được ghi vào log hoặc Git.
Codex hook chỉ ghi cục bộ; pre-push hook gửi các bản ghi đang chờ tới server khi
`git push` rồi chuyển bản ghi đã gửi vào `archive`. Trước khi gửi, pre-push cũng
quét transcript Codex gần đây để khôi phục prompt nếu lifecycle hook của client
không chuyển được payload cho script.

Sau khi clone hoặc khi hook thay đổi:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup_hooks.ps1
.\.venv\Scripts\python.exe scripts\submit_log.py --check
```

Trong Codex, chạy `/hooks`, kiểm tra và trust hook của project, sau đó mở phiên
Codex mới. Chỉ sự kiện `UserPromptSubmit` được theo dõi. Lệnh `--check` chỉ kiểm
tra cấu hình và số bản ghi cục bộ, không gửi dữ liệu và không in API key.
