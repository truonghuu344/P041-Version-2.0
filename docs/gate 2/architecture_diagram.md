# System Architecture Documentation — Career Assistant X (P-041)

Tài liệu kiến trúc hệ thống P-041 được chuẩn hóa theo chuẩn **C4 Model (Container Level)** và **Azure Architecture Center**, phản ánh chính xác cấu trúc thực tế của codebase (`backend/src`, `frontend/src`, `docker-compose.yml`, `backend/src/services/object_storage.py`).

> **Khắc phục triệt để lỗi chồng đè (Overlap) & Đứt nét:**
> 1. **100% Node-to-Node Connections**: Tuyệt đối không nối dây vào tên `subgraph` (nguyên nhân gây đứt đường nối và mũi tên trôi dạt).
> 2. **Đồng nhất chiều dọc (`direction TB`)**: Không dùng `direction LR` lồng bên trong để tránh các box nằm đè lên nhau.
> 3. **Tách cụm rõ ràng**: Dịch vụ nghiệp vụ và AI Agent được xếp song song theo cặp logic (CV $\rightarrow$ CV Parser, Match $\rightarrow$ Gap Analysis, Interview $\rightarrow$ Interview Agent, Nova $\rightarrow$ Nova Agent).

---

## 1. System Architecture Overview (Tổng quan kiến trúc hệ thống)

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
    %% ================= STYLES =================
    classDef clientBox fill:#EFF6FF,stroke:#3B82F6,stroke-width:1.5px,rx:6px,color:#1E3A8A;
    classDef gatewayBox fill:#F1F5F9,stroke:#475569,stroke-width:1.5px,rx:6px,color:#0F172A;
    classDef domainBox fill:#FFFFFF,stroke:#64748B,stroke-width:1.5px,rx:6px,color:#1E293B;
    classDef aiBox fill:#FAF5FF,stroke:#9333EA,stroke-width:1.5px,rx:6px,color:#581C87;
    classDef dataBox fill:#F0FDF4,stroke:#16A34A,stroke-width:1.5px,rx:6px,color:#14532D;
    classDef extBox fill:#FFF7ED,stroke:#EA580C,stroke-width:1.5px,rx:6px,color:#7C2D12;

    %% ================= 1. CLIENT & PRESENTATION =================
    subgraph G_CLIENTS ["1. USER & PRESENTATION LAYER"]
        style G_CLIENTS fill:#F8FAFC,stroke:#E2E8F0,stroke-width:1.5px
        U_USERS["Người dùng: Sinh viên • Cố vấn • Doanh nghiệp"]:::clientBox
        FE_APP["Next.js 15 Web Application (React 18 • TypeScript • Tailwind CSS)"]:::clientBox
        U_USERS -->|"Truy cập Web Browser"| FE_APP
    end

    %% ================= 2. API INGRESS & SECURITY =================
    subgraph G_GATEWAY ["2. API GATEWAY & SECURITY CONTROLS"]
        style G_GATEWAY fill:#F8FAFC,stroke:#CBD5E1,stroke-width:1.5px
        API_GW["FastAPI API Gateway Server (/api/v1/* & /api/v2/*)"]:::gatewayBox
        SEC_AUTH["JWT Authentication & Role-Based Access Control"]:::gatewayBox
        SEC_SCAN["ClamAV Stream Filter (Quét virus file upload)"]:::gatewayBox
        
        FE_APP -->|"HTTP / REST API (JWT Bearer)"| API_GW
        API_GW --> SEC_AUTH
        SEC_AUTH --> SEC_SCAN
    end

    %% ================= 3. APPLICATION DOMAIN SERVICES =================
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

    %% ================= 4. AI LANGGRAPH AGENTS =================
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

    %% ================= 5. DATA PERSISTENCE & CLOUD =================
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

---

## 2. Core Technical & AI Pipeline (Luồng kỹ thuật và AI Pipeline)

```mermaid
%%{init: {
  'theme': 'base',
  'themeVariables': {
    'fontFamily': 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
    'fontSize': '12px',
    'primaryColor': '#FFFFFF',
    'primaryBorderColor': '#CBD5E1',
    'lineColor': '#475569'
  }
}}%%

flowchart TB
    %% ================= STYLES =================
    classDef inputNode fill:#EFF6FF,stroke:#3B82F6,stroke-width:1.5px,rx:6px,color:#1E3A8A;
    classDef procNode fill:#F8FAFC,stroke:#64748B,stroke-width:1px,rx:4px,color:#0F172A;
    classDef guardNode fill:#FEF2F2,stroke:#EF4444,stroke-width:1.5px,rx:4px,color:#991B1B;
    classDef aiNode fill:#FAF5FF,stroke:#8B5CF6,stroke-width:1.5px,rx:6px,color:#4C1D95;
    classDef dataNode fill:#F0FDF4,stroke:#16A34A,stroke-width:1.5px,rx:6px,color:#14532D;

    %% ================= PIPELINE 1 =================
    subgraph P1 ["PIPELINE 1: CV INGESTION, CLOUDFLARE R2 & PARSING"]
        style P1 fill:#FFFFFF,stroke:#CBD5E1,stroke-width:1.5px
        P1_IN["Tải tệp CV (PDF/DOCX)"]:::inputNode
        P1_SCAN{"Quét virus ClamAV"}:::guardNode
        P1_STORE_R2[("Lưu Cloudflare R2 (r2://...)")]:::dataNode
        P1_EXT["Trích xuất Text & OCR"]:::procNode
        P1_LLM["LangGraph: CV Parser (Gemini Schema)"]:::aiNode
        P1_GUARD{"Evidence Guardrail"}:::guardNode
        P1_DB[("Lưu PostgreSQL DB")]:::dataNode

        P1_IN --> P1_SCAN
        P1_SCAN --> P1_STORE_R2
        P1_STORE_R2 --> P1_EXT
        P1_EXT --> P1_LLM
        P1_LLM --> P1_GUARD
        P1_GUARD --> P1_DB
    end

    %% ================= PIPELINE 2 =================
    subgraph P2 ["PIPELINE 2: TWO-STAGE HYBRID RETRIEVAL & GAP MATCHING"]
        style P2 fill:#FFFFFF,stroke:#CBD5E1,stroke-width:1.5px
        P2_IN["Parsed Candidate Profile"]:::inputNode
        P2_BM25["1. BM25 Lexical Keyword Search"]:::procNode
        P2_VEC["2. pgvector Semantic Search"]:::dataNode
        P2_RRF["Reciprocal Rank Fusion (RRF) Ranking"]:::procNode
        P2_GAP["LangGraph: Gap Analysis Graph"]:::aiNode
        P2_GUARD{"Integrity Guardrail"}:::guardNode
        P2_OUT["Báo cáo Điểm phù hợp & Lộ trình phát triển"]:::inputNode

        P2_IN --> P2_BM25
        P2_IN --> P2_VEC
        P2_BM25 --> P2_RRF
        P2_VEC --> P2_RRF
        P2_RRF --> P2_GAP
        P2_GAP --> P2_GUARD
        P2_GUARD --> P2_OUT
    end

    %% ================= PIPELINE 3 =================
    subgraph P3 ["PIPELINE 3: MOCK INTERVIEW SIMULATION (STAR METHOD)"]
        style P3 fill:#FFFFFF,stroke:#CBD5E1,stroke-width:1.5px
        P3_IN["Ngữ cảnh JD mục tiêu + Hồ sơ CV"]:::inputNode
        P3_GEN["LangGraph: Sinh câu hỏi tình huống"]:::aiNode
        P3_GUARD{"Question Guard"}:::guardNode
        P3_EVAL["LangGraph: Chấm điểm STAR Rubric"]:::aiNode
        P3_REPORT["Báo cáo phân tích năng lực & khuyến nghị"]:::dataNode

        P3_IN --> P3_GEN
        P3_GEN --> P3_GUARD
        P3_GUARD --> P3_EVAL
        P3_EVAL --> P3_REPORT
    end
```

---

## 3. Runtime & Deployment Architecture (Kiến trúc triển khai Container & Cloud)

```mermaid
%%{init: {
  'theme': 'base',
  'themeVariables': {
    'fontFamily': 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
    'fontSize': '12px',
    'primaryColor': '#FFFFFF',
    'primaryBorderColor': '#CBD5E1',
    'lineColor': '#64748B'
  }
}}%%

flowchart TB
    %% ================= STYLES =================
    classDef clientEnv fill:#EFF6FF,stroke:#3B82F6,stroke-width:1.5px,rx:6px,color:#1E3A8A;
    classDef containerBox fill:#FFFFFF,stroke:#0284C7,stroke-width:1.5px,rx:6px,color:#0369A1;
    classDef storageBox fill:#F0FDF4,stroke:#16A34A,stroke-width:1.5px,rx:6px,color:#14532D;
    classDef cloudBox fill:#FFF7ED,stroke:#F97316,stroke-width:1.5px,rx:6px,color:#7C2D12;

    %% ================= 1. CLIENT & HOST =================
    subgraph S_CLIENT ["1. CLIENT & FRONTEND HOST"]
        style S_CLIENT fill:#F8FAFC,stroke:#CBD5E1,stroke-width:1.5px
        BROWSER["Web Browser User Interface"]:::clientEnv
        FE_DEV["Next.js 15 Node.js Server (Port: 3000 / 3001)"]:::clientEnv
        BROWSER -->|"HTTP (Port 3000)"| FE_DEV
    end

    %% ================= 2. DOCKER BACKEND =================
    subgraph S_BACKEND ["2. DOCKER COMPOSE — APPLICATION SERVER"]
        style S_BACKEND fill:#FFFFFF,stroke:#0284C7,stroke-width:1.5px
        BACKEND_CTR["backend container (FastAPI + Uvicorn :8000)"]:::containerBox
        FE_DEV -->|"REST API / JSON (Port 8000)"| BACKEND_CTR
    end

    %% ================= 3. DOCKER SUPPORTING CONTAINERS =================
    subgraph S_CONTAINERS ["3. DOCKER COMPOSE — DATA & SCANNER SERVICES"]
        style S_CONTAINERS fill:#F8FAFC,stroke:#94A3B8,stroke-width:1.5px
        DB_CTR["db container (pgvector/pgvector:pg16 :5432)"]:::storageBox
        CLAMAV_CTR["clamav container (clamav/clamav:1.4 :3310)"]:::containerBox
        BACKEND_CTR -->|"TCP Socket (Port 5432)"| DB_CTR
        BACKEND_CTR -->|"TCP Socket (Port 3310)"| CLAMAV_CTR
    end

    %% ================= 4. PERSISTENT STORAGE =================
    subgraph S_VOLUMES ["4. PERSISTENT DOCKER VOLUMES"]
        style S_VOLUMES fill:#F0FDF4,stroke:#86EFAC,stroke-width:1.5px
        VOL_PG[("postgres_data volume")]:::storageBox
        VOL_AV[("clamav_data volume")]:::storageBox
        VOL_APP[("app_uploads volume (Dev Local Fallback)")]:::storageBox
        DB_CTR --> VOL_PG
        CLAMAV_CTR --> VOL_AV
        BACKEND_CTR -->|"Mount"| VOL_APP
    end

    %% ================= 5. CLOUD SAAS =================
    subgraph S_CLOUD ["5. EXTERNAL CLOUD SERVICES"]
        style S_CLOUD fill:#FFF7ED,stroke:#FED7AA,stroke-width:1.5px
        GEMINI_CLOUD["Google Gemini Cloud API (Generation & Embeddings)"]:::cloudBox
        R2_CLOUD["Cloudflare R2 Object Storage (S3 API cvs/jds)"]:::cloudBox
        BACKEND_CTR -->|"HTTPS Outbound Egress"| GEMINI_CLOUD
        BACKEND_CTR -->|"HTTPS S3 API (boto3)"| R2_CLOUD
    end
```

---

## 4. Bảng tổng hợp thành phần và liên kết hệ thống

| Tầng / Phân hệ | Thành phần thực tế trong Codebase | Công nghệ | Vai trò & Kết nối |
|---|---|---|---|
| **Presentation** | `frontend/src/app` | Next.js 15.5, React 18, Tailwind CSS | Giao diện ba role: Sinh viên, Cố vấn, Doanh nghiệp. Tương tác với Backend qua Fetch client kèm Bearer JWT. |
| **API & Gateway** | `backend/src/api`, `backend/src/main.py` | FastAPI, Uvicorn, Pydantic | Cung cấp REST endpoints (`/api/v1/*`, `/api/v2/*`), xác thực PyJWT, CORS filter và Dependency Injection. |
| **File Security** | `backend/src/services/file_security.py` | ClamAV Daemon (`clamd`) | Quét virus stream cho file upload trước khi lưu trữ. |
| **Object Storage** | `backend/src/services/object_storage.py` | Cloudflare R2 (S3 API qua `boto3`), Local Fallback | Lưu trữ toàn bộ CV và JD tải lên (`r2://<bucket>/...`) hoặc fallback disk `/app/data/uploads`. |
| **Domain Services** | `backend/src/services/` | Python 3.11+, SQLAlchemy Async | Quản lý logic nghiệp vụ: CV/JD lifecycle, matching, interview evaluation, notifications. |
| **AI Orchestration** | `backend/src/agents/` | LangGraph, LangChain Google GenAI | Điều phối 4 workflow thông minh độc lập: CV Parser, Gap Analysis, Mock Interview, Nova Assistant. |
| **RAG & Search Engine** | `backend/src/services/job_rag.py` | BM25 + pgvector Cosine Search + RRF | Tìm kiếm việc làm thị trường bằng thuật toán Hybrid Ranking; fallback an toàn khi LLM/Vector offline. |
| **Storage Tier** | `backend/src/db/`, `docker-compose.yml` | PostgreSQL 16, pgvector, Docker Volumes | Lưu trữ toàn bộ dữ liệu quan hệ, embedding vector 768 chiều. |
| **AI Cloud** | External Service | Google Gemini Developer API | Cung cấp mô hình ngôn ngữ lớn và vector embedding (`text-embedding-004`). |
