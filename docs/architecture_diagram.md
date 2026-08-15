# Architecture Diagram

## System Overview

```mermaid
graph TB
    User([Sinh viên / Cố vấn / Admin]) -->|HTTP :8080| GW[Nginx Gateway]
    GW -->|proxy /| FE[Frontend<br/>Next.js App Router]
    GW -->|proxy /api| BE[FastAPI Backend]
    FE -->|SSR proxy /api| BE

    BE --> Agents[LangGraph Agents<br/>CVParser · GapAnalysis · Interview · Nova]
    Agents --> LLM[Google Gemini<br/>gemini-3.1-flash-lite]
    Agents --> Qdrant[(Qdrant<br/>Market JD RAG)]
    BE --> DB[(PostgreSQL + pgvector)]
    BE --> ClamAV[ClamAV<br/>malware scan]
```

## Agent Flows (LangGraph, 4 graph độc lập)

### CVParserAgent — bóc tách CV thành JSON có evidence guardrail

```mermaid
graph LR
    START((Start)) --> A[validate_input]
    A --> B[extract_local_evidence]
    B --> C[llm_structured_parse]
    C --> D[evidence_guardrail]
    D --> E[ats_quality_gate]
    E --> END((End))
```

### GapAnalysisAgent — so khớp CV↔JD, sinh gợi ý tối ưu

```mermaid
graph LR
    START((Start)) --> A[validate_input]
    A --> B[extract_evidence]
    B --> C[draft_analysis]
    C --> D[integrity_guardrail]
    D --> END((End))
```

### InterviewAgent — phỏng vấn thử, chấm rubric STAR

```mermaid
graph LR
    START((Start)) --> A[validate_input]
    A --> B[generate_questions]
    B --> C[guard_questions]
    C --> D[evaluate_answer]
    D -->|thiếu ý, cần đào sâu| B
    D -->|đủ câu hỏi| E[generate_report]
    E --> END((End))
```

### CareerAssistantAgent "Nova" — chatbot hội thoại

```mermaid
graph LR
    START((Start)) --> P[plan]
    P -->|hỏi thời tiết| W[weather]
    P -->|hỏi thời gian| DT[datetime]
    P -->|trả lời trực tiếp| R[respond]
    P -->|cần phối hợp agent khác| O[orchestrate]
    W --> END((End))
    DT --> END
    R --> END
    O --> END
```

## Deployment (Docker Compose — 6 service)

```mermaid
graph LR
    subgraph Docker Compose
        GW[gateway<br/>nginx:1.27-alpine]
        FE[frontend]
        BE[backend]
        DBC[(db<br/>pgvector/pgvector:pg16)]
        QD[(qdrant)]
        CAV[clamav]
    end
    Host((":8080")) --> GW
    GW --> FE
    GW --> BE
    FE --> BE
    BE --> DBC
    BE --> QD
    BE --> CAV
```

## Component Details

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Gateway | Nginx | Cổng publish duy nhất (`:8080`), proxy tới frontend/backend nội bộ |
| Frontend | Next.js 15 (App Router) + React 18 + TypeScript | Giao diện Sinh viên/Cố vấn/Admin |
| Backend | FastAPI + Uvicorn (async) | REST API `/api/v1/*`, JWT auth, điều phối agent |
| Agents | LangGraph (4 graph riêng) | CVParser, GapAnalysis, Interview, Career Assistant "Nova" |
| LLM | Google Gemini (`gemini-3.1-flash-lite`) | Sinh nội dung + embedding |
| Database | PostgreSQL + pgvector (Alembic migrations) | Dữ liệu quan hệ: users, CV, JD, matches, interviews, chat, HITL |
| Vector Store | Qdrant + Gemini Embedding | RAG ~98 JD thị trường, fallback catalog search nếu lỗi |
| Malware Scan | ClamAV | Quét bắt buộc mọi CV upload trước khi lưu/parse |

Chi tiết đầy đủ (data flow, bảng DB, security, design decisions): xem [`ARCHITECTURE.md`](../ARCHITECTURE.md).
