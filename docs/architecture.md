# System Architecture — Career Assistant X (P-041)

> **Dự án**: Career Assistant — Nền tảng Trợ lý Hướng nghiệp & Tối ưu CV/Phỏng vấn dựa trên bằng chứng thật  
> **Chương trình**: VinUni AI20K Build Phase — Cohort 3  
> **Deliverable**: #3 — Architecture Diagram & System Design Specification  

---

## 1. Tổng quan Kiến trúc Hệ thống (Executive Overview)

Career Assistant X được thiết kế theo kiến trúc **5 tầng phân lập (5-Tier Layered Architecture)** với nguyên tắc cốt lõi: **"Không evidence → không claim — AI không tự quyết định điểm số"**.

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

    subgraph G_CLIENTS ["1. USER & PRESENTATION LAYER (Next.js 15)"]
        style G_CLIENTS fill:#F8FAFC,stroke:#E2E8F0,stroke-width:1.5px
        U_USERS["Người dùng: Sinh viên • Cố vấn • Doanh nghiệp"]:::clientBox
        FE_APP["Next.js 15 Web App (React 18 • TypeScript • Tailwind CSS • Bento Grid)"]:::clientBox
        U_USERS -->|"Truy cập Web Browser"| FE_APP
    end

    subgraph G_GATEWAY ["2. API GATEWAY & SECURITY CONTROLS"]
        style G_GATEWAY fill:#F8FAFC,stroke:#CBD5E1,stroke-width:1.5px
        API_GW["FastAPI API Gateway Server (/api/v1/* & /api/v2/*)"]:::gatewayBox
        SEC_AUTH["JWT Authentication & Role-Based Access Control (RBAC)"]:::gatewayBox
        SEC_SCAN["ClamAV Stream Filter (Quét mã độc file upload)"]:::gatewayBox
        
        FE_APP -->|"HTTP / REST API (JWT Bearer) & WebSocket"| API_GW
        API_GW --> SEC_AUTH
        SEC_AUTH --> SEC_SCAN
    end

    subgraph G_CORE ["3. CORE APPLICATION DOMAIN SERVICES"]
        style G_CORE fill:#FFFFFF,stroke:#94A3B8,stroke-width:1.5px
        SVC_CV["CV Management Service (Upload, MinerU OCR, Export PDF)"]:::domainBox
        SVC_JOB["Job Catalog & Market RAG Service (98 JD Catalog)"]:::domainBox
        SVC_MATCH["CV-JD Matching & Top-K Recommendations (FitScore Engine)"]:::domainBox
        SVC_INTERVIEW["Voice Interview Engine (Deepgram STT • gTTS • STAR Evaluator)"]:::domainBox
        SVC_NOVA["Nova Career Assistant (Cascading RAG 3-Tier Chatbot)"]:::domainBox
        
        SEC_SCAN -->|"Process CV Upload"| SVC_CV
        SEC_AUTH -->|"Query Jobs / RAG"| SVC_JOB
        SEC_AUTH -->|"Calculate Matching"| SVC_MATCH
        SEC_AUTH -->|"Conduct Voice Interview"| SVC_INTERVIEW
        SEC_AUTH -->|"Chat with Assistant"| SVC_NOVA
    end

    subgraph G_AI ["4. AI ORCHESTRATION LAYER (LangGraph Multi-Agent)"]
        style G_AI fill:#FAF5FF,stroke:#D8B4FE,stroke-width:1.5px
        AG_PARSER["CV Parser Graph (Evidence Extraction & ATS Gate)"]:::aiBox
        AG_GAP["Gap Analysis Graph (Integrity Guardrail)"]:::aiBox
        AG_INTERVIEW["Interview Simulation Graph (STAR Rubric Evaluation)"]:::aiBox
        AG_NOVA["Nova Agent Orchestrator (Cascading RAG Router)"]:::aiBox
        
        SVC_CV -->|"Invoke"| AG_PARSER
        SVC_MATCH -->|"Invoke"| AG_GAP
        SVC_INTERVIEW -->|"Invoke"| AG_INTERVIEW
        SVC_NOVA -->|"Invoke"| AG_NOVA
    end

    subgraph G_INFRA ["5. DATA STORAGE, OBJECT STORE & EXTERNAL CLOUD"]
        style G_INFRA fill:#F0FDF4,stroke:#86EFAC,stroke-width:1.5px
        DB_PG[("PostgreSQL 16 DB (Users, CVs, JDs, Matches, Logs)")]:::dataBox
        DB_VEC[("pgvector Extension (Cosine Embeddings 768d)")]:::dataBox
        STO_R2[("Cloudflare R2 Object Storage / Local Volume")]:::dataBox
        EXT_GEMINI["Google Gemini API (gemini-2.5-flash & text-embedding-004)"]:::extBox
        EXT_CLAMAV["ClamAV Antivirus Daemon (:3310)"]:::extBox
        EXT_DEEPGRAM["Deepgram Nova-3 API (Realtime STT)"]:::extBox

        SVC_CV -->|"Lưu File Binary"| STO_R2
        SVC_CV -->|"Lưu Profile Data"| DB_PG
        SVC_JOB -->|"Hybrid Vector Search"| DB_VEC
        SVC_MATCH -->|"Lưu Match Results"| DB_PG
        SVC_INTERVIEW -->|"Lưu STAR Reports"| DB_PG
        SVC_NOVA -->|"Lưu Chat History"| DB_PG

        SEC_SCAN -.->|"Socket Stream Scan"| EXT_CLAMAV
        SVC_INTERVIEW -.->|"Realtime Audio Stream"| EXT_DEEPGRAM
        
        AG_PARSER -->|"Inference & Embeddings"| EXT_GEMINI
        AG_GAP -->|"Inference"| EXT_GEMINI
        AG_INTERVIEW -->|"Inference"| EXT_GEMINI
        AG_NOVA -->|"Inference"| EXT_GEMINI
    end
```

---

## 2. Chi tiết Thành phần Hệ thống (Component Specifications)

| Tầng | Công nghệ thực tế | Trách nhiệm & Quyết định kỹ thuật |
|---|---|---|
| **Presentation (Frontend)** | Next.js 15.5.x, React 18.3, TypeScript, Tailwind CSS | Cung cấp giao diện phân quyền 3 roles: Sinh viên, Cố vấn, Doanh nghiệp. Tích hợp Audio Recorder, Bento Grid và visualizer sóng âm. |
| **API Gateway** | FastAPI, Uvicorn, Pydantic v2, SQLAlchemy async | REST API `/api/v1/*`, `/api/v2/*` và WebSocket `/api/v1/ws/interview/{session_id}`. Xử lý Rate Limiting, Request Validation và Error Serialization. |
| **Bảo mật & Auth** | PyJWT, bcrypt, Google OAuth2, RBAC | Xác thực JWT Bearer, Token Revocation, phân quyền đa tầng và kiểm soát truy cập dữ liệu cá nhân hóa. |
| **Bảo vệ Mã độc** | ClamAV 1.4 Daemon (:3310) | Quét luồng stream nhị phân của mọi file PDF/DOCX tải lên trước khi đưa vào pipeline OCR. |
| **AI Multi-Agent** | LangGraph, LangChain Google GenAI | Điều phối 4 StateGraph độc lập: CV Parser, Gap Analysis, STAR Interviewer và Nova Conversational Agent. |
| **Cơ sở dữ liệu & Vector** | PostgreSQL 16 + pgvector | Lưu trữ dữ liệu quan hệ (Users, CVs, JDs, Matches, Interviews, Notifications, Logs) và chỉ mục vector cosine 768-chiều. |
| **Object Storage** | Cloudflare R2 (`boto3` S3 API) | Lưu trữ file CV/JD gốc và các bản PDF xuất tự động (`r2://<bucket>/...`) với cơ chế local volume fallback. |
| **Mô hình AI & Voice** | Google Gemini, Deepgram Nova-3, gTTS | Gemini Flash xử lý suy luận, Deepgram Nova-3 nhận dạng giọng nói realtime, gTTS phát âm tiếng Việt tự nhiên. |

---

## 3. Luồng Dữ liệu End-to-End (Data Flow Sequence)

```mermaid
sequenceDiagram
    autonumber
    actor Student as Sinh viên
    participant FE as Next.js Frontend
    participant API as FastAPI Gateway
    participant AV as ClamAV Scanner
    participant R2 as Cloudflare R2 / Disk
    participant DB as PostgreSQL + pgvector
    participant Agent as LangGraph Multi-Agent
    participant LLM as Google Gemini API

    Student->>FE: Tải CV (PDF / DOCX ≤ 10MB)
    FE->>API: POST /api/v1/cvs/upload (JWT Bearer)
    API->>AV: Quét virus stream nhị phân
    AV-->>API: File an toàn (0 infected)
    API->>R2: Lưu file gốc an toàn
    API->>DB: Tạo bản ghi CV và lưu snapshot
    API->>Agent: Kích hoạt CV Parser Graph
    Agent->>LLM: Trích xuất kỹ năng, học vấn, kinh nghiệm có dẫn chứng
    LLM-->>Agent: JSON structured claims + text spans
    Agent->>DB: Lưu parsed profile & evidence chunks
    API-->>FE: Trả về trạng thái hoàn thành phân tích

    Student->>FE: Yêu cầu Đối chiếu CV với JD mục tiêu
    FE->>API: POST /api/v2/cv-variants/match
    API->>DB: Truy vấn BM25 ⊕ pgvector Cosine Top-30
    API->>Agent: Kích hoạt Gap Analysis Graph
    Agent->>DB: Trích xuất evidence theo rubric
    API->>API: Tính FitScore tất định phía Backend
    API->>DB: Lưu Match Result, Gaps & Traceability Log
    API-->>FE: Trả về Radar Chart, Match Score & Lộ trình cải thiện
```

---

## 4. Thuật toán Lõi & Quy trình Chống Ảo giác (Anti-Hallucination Pipeline)

### 4.1. CV–JD Hybrid Matching & FitScore Formula
1. **Trích xuất nguyên tử**: Tách JD thành các yêu cầu nguyên tử (Required Skills, Experience, Education, Domain).
2. **Hybrid Search**: Kết hợp tìm kiếm từ khóa BM25 và Vector Similarity (Cosine distance trên `pgvector`).
3. **Reciprocal Rank Fusion (RRF)**:
   $$\text{RRF\_Score}(d) = \sum_{m \in \{\text{BM25}, \text{Vector}\}} \frac{1}{60 + \text{Rank}_m(d)}$$
4. **FitScore tất định (Deterministic Backend Calculation)**:
   $$\text{FitScore} = 0.35 \times S_{\text{Skills}} + 0.30 \times S_{\text{Exp}} + 0.10 \times S_{\text{Edu}} + 0.10 \times S_{\text{Pref}} + 0.15 \times S_{\text{Domain}}$$
   *Mọi điểm số đều phải có evidence span trích xuất từ CV gốc — Không có evidence $\rightarrow$ 0 điểm.*

### 4.2. CV Optimizer (CP-SAT Constraint Programming)
- Sử dụng Google OR-Tools Constraint Programming (CP-SAT) để tối ưu hóa việc chọn lọc nội dung, bullet points và độ dài câu văn sao cho vừa khít khung 1–2 trang A4 chuẩn quốc tế, không làm tràn trang và không bịa đặt kinh nghiệm.

### 4.3. Nova Agent — Cascading RAG 3 Tầng
- **Tầng 1 (Direct DB Query)**: Trả lời tức thì các câu hỏi cấu trúc (trạng thái ứng tuyển, lịch phỏng vấn) không cần gọi LLM.
- **Tầng 2 (Verbatim Evidence Extraction)**: Trích xuất nguyên văn đoạn nội dung khi độ tương đồng Hybrid $\ge 70\%$.
- **Tầng 3 (Grounded LLM Generation)**: Gemini Flash chỉ được tổng hợp câu trả lời dựa trên Top-3 evidence chunks đã truy xuất, kèm trích dẫn nguồn (Attribution Citation).

---

## 5. Khung Kiểm soát An ninh & Vận hành (Security & DevOps)

1. **Bảo mật File & Dữ liệu**:
   - Quét mã độc tự động với ClamAV trước khi lưu trữ.
   - Cơ chế cách ly dữ liệu theo người dùng (`user_id` scoping ở mọi câu truy vấn SQL).
2. **Kiểm soát Tải & Khả năng phục hồi**:
   - Token-bucket Rate Limiter ngăn chặn bão request.
   - Cơ chế tự động fallback sang Local Hashing Embedding khi API Gemini chạm giới hạn quota.
3. **CI/CD Tự động hóa**:
   - GitHub Actions chạy 5 bước kiểm tra: ESLint, TypeScript Typecheck, Next.js Build, Ruff Lint, Pytest Suite (740+ backend tests, 159 frontend tests).
   - Frontend tự động triển khai trên Vercel Edge Network.
   - Backend tự động đóng gói Docker container và triển khai trên Render Cloud Platform.
