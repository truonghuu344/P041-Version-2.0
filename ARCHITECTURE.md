# Architecture Document — Career Assistant X (P-041)

## Phạm vi hiện tại

Career Assistant X là ứng dụng web hỗ trợ định hướng nghề nghiệp. Ba vai trò người dùng trên giao diện là **Sinh viên**, **Cố vấn** và **Doanh nghiệp**. Hệ thống cung cấp quản lý CV/JD, phân tích CV–JD, gợi ý việc làm, phỏng vấn thử và trợ lý nghề nghiệp Nova.

> Các route `/admin/*` tồn tại cho tác vụ vận hành/quản trị dữ liệu; chúng không đại diện cho role người dùng thứ tư trong MVP.

## System overview

```mermaid
%%{init: {
  'theme': 'base',
  'themeVariables': {
    'fontFamily': 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
    'fontSize': '12px',
    'primaryColor': '#FFFFFF',
    'primaryBorderColor': '#CBD5E1',
    'primaryTextColor': '#0F172A',
    'lineColor': '#475569',
    'tertiaryColor': '#F8FAFC'
  }
}}%%

flowchart TB
    classDef clientBox fill:#EFF6FF,stroke:#3B82F6,stroke-width:1.5px,rx:6px,color:#1E3A8A;
    classDef gatewayBox fill:#F1F5F9,stroke:#475569,stroke-width:1.5px,rx:6px,color:#0F172A;
    classDef domainBox fill:#FFFFFF,stroke:#64748B,stroke-width:1.5px,rx:6px,color:#1E293B;
    classDef aiBox fill:#FAF5FF,stroke:#9333EA,stroke-width:1.5px,rx:6px,color:#581C87;
    classDef dataBox fill:#F0FDF4,stroke:#16A34A,stroke-width:1.5px,rx:6px,color:#14532D;
    classDef extBox fill:#FFF7ED,stroke:#EA580C,stroke-width:1.5px,rx:6px,color:#7C2D12;

    subgraph G_CLIENTS ["1. USER & PRESENTATION LAYER"]
        style G_CLIENTS fill:#F8FAFC,stroke:#E2E8F0,stroke-width:1.5px
        U_USERS["Người dùng: Sinh viên • Cố vấn • Doanh nghiệp"]:::clientBox
        FE_APP["Next.js 15 Web Application (React 18 • TypeScript • Tailwind CSS)"]:::clientBox
        U_USERS -->|"Truy cập Web Browser"| FE_APP
    end

    subgraph G_GATEWAY ["2. API GATEWAY & SECURITY CONTROLS"]
        style G_GATEWAY fill:#F8FAFC,stroke:#CBD5E1,stroke-width:1.5px
        API_GW["FastAPI API Gateway Server (/api/v1/* & /api/v2/*)"]:::gatewayBox
        SEC_AUTH["JWT Authentication & Role-Based Access Control"]:::gatewayBox
        SEC_SCAN["ClamAV Stream Filter (Quét virus file upload)"]:::gatewayBox
        
        FE_APP -->|"HTTP / REST API (JWT Bearer)"| API_GW
        API_GW --> SEC_AUTH
        SEC_AUTH --> SEC_SCAN
    end

    subgraph G_CORE ["3. CORE APPLICATION DOMAIN SERVICES"]
        style G_CORE fill:#FFFFFF,stroke:#94A3B8,stroke-width:1.5px
        SVC_CV["CV Management Service (Upload, Parse, Export)"]:::domainBox
        SVC_JOB["Job Catalog & Market RAG Service"]:::domainBox
        SVC_MATCH["CV-JD Matching & Gap Analysis Service"]:::domainBox
        SVC_INTERVIEW["Mock Interview Engine (STAR Simulation)"]:::domainBox
        SVC_NOVA["Nova Career Assistant Conversational Service"]:::domainBox
        
        SEC_SCAN -->|"Process CV Upload"| SVC_CV
        SEC_AUTH -->|"Query Jobs / RAG"| SVC_JOB
        SEC_AUTH -->|"Calculate Matching"| SVC_MATCH
        SEC_AUTH -->|"Conduct Interview"| SVC_INTERVIEW
        SEC_AUTH -->|"Chat with Assistant"| SVC_NOVA
    end

    subgraph G_AI ["4. AI ORCHESTRATION LAYER (LangGraph)"]
        style G_AI fill:#FAF5FF,stroke:#D8B4FE,stroke-width:1.5px
        AG_PARSER["CV Parser Graph"]:::aiBox
        AG_GAP["Gap Analysis Graph"]:::aiBox
        AG_INTERVIEW["Interview Simulation Graph"]:::aiBox
        AG_NOVA["Nova Agent Orchestrator"]:::aiBox
        
        SVC_CV -->|"Invoke"| AG_PARSER
        SVC_MATCH -->|"Invoke"| AG_GAP
        SVC_INTERVIEW -->|"Invoke"| AG_INTERVIEW
        SVC_NOVA -->|"Invoke"| AG_NOVA
    end

    subgraph G_INFRA ["5. DATA STORAGE, OBJECT STORE & EXTERNAL CLOUD"]
        style G_INFRA fill:#F0FDF4,stroke:#86EFAC,stroke-width:1.5px
        DB_PG[("PostgreSQL 16 DB (Users, CVs, JDs, Matches, Logs)")]:::dataBox
        DB_VEC[("pgvector Extension (Market JD Cosine Embeddings)")]:::dataBox
        STO_R2[("Cloudflare R2 Storage (r2://... CV/JD Object Store)")]:::dataBox
        EXT_GEMINI["Google Gemini API (LLM Generation & text-embedding-004)"]:::extBox
        EXT_CLAMAV["ClamAV Antivirus Daemon (:3310)"]:::extBox

        SVC_CV -->|"Lưu File Binary"| STO_R2
        SVC_CV -->|"Lưu Profile Data"| DB_PG
        SVC_JOB -->|"Hybrid Vector Search"| DB_VEC
        SVC_MATCH -->|"Lưu Match Results"| DB_PG
        SVC_INTERVIEW -->|"Lưu STAR Reports"| DB_PG
        SVC_NOVA -->|"Lưu Chat History"| DB_PG

        SEC_SCAN -.->|"Socket Stream Scan"| EXT_CLAMAV
        
        AG_PARSER -->|"Inference & Embeddings"| EXT_GEMINI
        AG_GAP -->|"Inference"| EXT_GEMINI
        AG_INTERVIEW -->|"Inference"| EXT_GEMINI
        AG_NOVA -->|"Inference"| EXT_GEMINI
    end
```

## Components

| Tầng | Công nghệ thực tế | Trách nhiệm |
|---|---|---|
| Frontend | Next.js `15.5.x`, React `18.3`, TypeScript, Tailwind CSS | UI theo ba role, dashboard, upload CV/JD, matching, interview và Nova chat. |
| API | FastAPI, Uvicorn, Pydantic, SQLAlchemy async | REST API dưới `/api/v1/*`; các workflow mới tại `/api/v2/*`. |
| Xác thực | PyJWT, bcrypt, Google Auth | Đăng ký/đăng nhập, token version/revoke, Google OAuth, phân quyền route. |
| Object Storage | Cloudflare R2 (`boto3` S3 API), local disk volume fallback | Lưu trữ toàn bộ CV và JD (`r2://<bucket>/...`) bảo mật, hỗ trợ fallback local `/app/data/uploads`. |
| AI orchestration | LangGraph, LangChain Google GenAI | Bốn graph độc lập: CV Parser, Gap Analysis, Interview và Nova. |
| LLM / embeddings | Google Gemini, model cấu hình bằng `MODEL_NAME` (mặc định `gemini-3.5-flash`) | Sinh nội dung AI và embedding; các luồng có fallback khi key/model không khả dụng. |
| Retrieval | BM25 + PostgreSQL `pgvector`, RRF | Index JD thị trường và truy xuất semantic; fallback catalog/keyword hoặc hashing embedding. |
| Dữ liệu | PostgreSQL 16 + pgvector, Alembic | Users, CVs, JDs, matches, interviews, chats, notifications, logs và vectors. |
| Bảo mật file | ClamAV, stream malware scan | Quét malware trước khi lưu CV/JD upload vào Cloudflare R2/storage. |

## AI graphs

| Graph | Luồng chính | Kết quả |
|---|---|---|
| CV Parser | `validate_input → extract_local_evidence → llm_structured_parse → evidence_guardrail → ats_quality_gate` | Hồ sơ CV có cấu trúc và evidence. |
| Gap Analysis | `validate_input → extract_evidence → draft_analysis → integrity_guardrail` | Skill gaps và khuyến nghị có kiểm chứng. |
| Interview | `validate_input → generate_questions → guard_questions → evaluate_answer → generate_report` | Câu hỏi, follow-up và báo cáo STAR. |
| Nova | `plan → weather / datetime / respond / orchestrate` | Trợ lý hội thoại và điều hướng workflow. |

## Data flow — CV upload và job matching

```mermaid
sequenceDiagram
    autonumber
    actor Student as Sinh viên
    participant FE as Next.js frontend
    participant API as FastAPI API
    participant AV as ClamAV
    participant FS as Upload volume
    participant DB as PostgreSQL + pgvector
    participant Agent as CV Parser / LangGraph
    participant LLM as Google Gemini

    Student->>FE: Tải CV PDF/DOCX
    FE->>API: Upload CV kèm JWT
    API->>AV: Quét malware
    AV-->>API: Tệp an toàn
    API->>FS: Lưu tệp upload
    API->>DB: Lưu metadata và raw text
    API->>Agent: Parse CV
    Agent->>LLM: Structured extraction khi Gemini khả dụng
    LLM-->>Agent: Skills, experience, education
    Agent->>DB: Lưu parsed profile/evidence
    API-->>FE: Trạng thái parse

    Student->>FE: Yêu cầu job matching
    FE->>API: Tạo match workflow
    API->>DB: BM25 + pgvector truy xuất JD/CV evidence
    API->>DB: Lưu score, gaps, recommendations và trace
    API-->>FE: Trả kết quả matching
```

## RAG và matching

- Không có Qdrant trong source, dependencies hoặc `docker-compose.yml`.
- JD market catalog được đồng bộ vào PostgreSQL/pgvector bởi `backend/src/services/job_rag.py`.
- Embedding dùng Gemini khi cấu hình cho phép; nếu không có thể dùng hashing nội bộ. Khi pgvector không sẵn sàng, hệ thống dùng catalog/keyword fallback.
- Pipeline matching kết hợp BM25 và vector search, gộp với Reciprocal Rank Fusion (RRF), sau đó lưu evidence và rubric evaluation.

## Runtime / deployment hiện tại

```mermaid
flowchart LR
    Browser["Browser"] -->|"localhost:3000 khi phát triển"| FE["Next.js\nnpm run dev / npm start"]
    FE -->|"HTTP API"| BE["FastAPI backend\nDocker container :8000"]

    subgraph Compose["docker-compose.yml — 3 services"]
        BE --> DB[("db\npgvector/pgvector:pg16")]
        BE --> AV["clamav\nclamav/clamav:1.4"]
        BE --> Vol[("app_uploads volume")]
    end

    BE -->|"HTTPS"| Gemini["Google Gemini Developer API"]
```

`docker-compose.yml` chỉ định nghĩa `db`, `clamav` và `backend`. Next.js frontend, Nginx gateway và Qdrant **không** được khai báo trong file Compose hiện tại. Các persistent volumes là `postgres_data`, `clamav_data` và `app_uploads`.

## Security controls

- Secrets lấy từ `.env`; không hard-code API key hoặc password.
- JWT + bcrypt và dependency/middleware kiểm tra quyền trước khi vào route.
- Pydantic validate payload API.
- Tệp upload được ClamAV quét theo `MALWARE_SCAN_MODE`; Docker đặt chế độ `required`.
- Agent có evidence/integrity/question guardrail để không tự tạo kỹ năng hoặc kinh nghiệm không có trong dữ liệu đầu vào.
