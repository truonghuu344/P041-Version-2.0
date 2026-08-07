# 🏗️ Sơ đồ Kiến trúc Phân tầng Hệ thống (System Architecture)
> **Career Assistant X System - C4 Container Architecture Model**

## 1. Tổng quan Kiến trúc

Hệ thống **Career Assistant X** được thiết kế theo mô hình phân tầng đa lớp (Multi-tier Containerized Monolith & AI Engine) đảm bảo tính mở rộng, bảo mật cao, tích hợp Human-In-The-Loop (HITL) và xử lý thời gian thực qua WebSocket.

```mermaid
graph TB
    subgraph USERS ["👥 TẦNG 1: ACTORS / USERS"]
        Student["🎓 Sinh viên (Student)<br/><i>Tạo CV, So khớp, PV thử</i>"]
        Counselor["👨‍🏫 Cố vấn (Counselor)<br/><i>Giám sát HITL & Feedback</i>"]
        Enterprise["🏢 Doanh nghiệp (Enterprise)<br/><i>Đăng JD & Duyệt ứng viên</i>"]
    end

    subgraph SYSTEM ["🛡️ CAREER ASSISTANT X CORE"]
        
        subgraph LAYER_A ["TẦNG A: PRESENTATION LAYER"]
            NextJS["🖥️ Next.js 14 Web Portal<br/>(React 18, TypeScript, TailwindCSS)"]
        end

        subgraph LAYER_B ["TẦNG B: GATEWAY & SECURITY PROXY"]
            Nginx["⚡ Nginx Reverse Proxy<br/>(SSL/TLS, Load Balancer, Router)"]
        end

        subgraph LAYER_C ["TẦNG C: CORE BACKEND SERVICES (FastAPI Monolith)"]
            Gateway["🔌 API Gateway / Core Router<br/>(REST API / WebSocket Stream)"]
            Auth["🔒 Auth & Security<br/>(JWT, Bcrypt, RBAC)"]
            ResumeMgr["📄 Resume & ATS Manager<br/>(3 ATS Templates, HITL, PDF Export)"]
            JdMgr["💼 JD Manager<br/>(Library & External JDs)"]
            InterviewCtrl["💬 Interview Controller<br/>(WebSocket, CSAT 1-5★)"]
            FeedbackMgr["✍️ Counselor Feedback<br/>(Assignments & Feedback)"]
        end

        subgraph LAYER_D ["TẦNG D: AI ENGINE & LANGGRAPH AGENTS LAYER"]
            GapAgent["🧠 CV Gap Analysis Agent<br/>(LangGraph, Gap Analysis)"]
            MockAgent["🤖 Mock Interview Agent<br/>(LangGraph Stateful Flow)"]
            EvalJudge["⚖️ STAR Evaluator<br/>(LLM-as-a-Judge, Rubric STAR)"]
            RagEngine["🔍 RAG & Vector Pipeline<br/>(LangChain, FastEmbed, Qdrant Reranker)"]
        end

        subgraph LAYER_E ["TẦNG E: DATABASE & VECTOR PERSISTENCE LAYER"]
            Postgres[("🗄️ PostgreSQL 16 DB<br/>Relational Data")]
            Qdrant[("🎯 Qdrant Vector DB<br/>Embeddings & Semantic Search")]
            FileStore[("📁 File Storage (S3 / MinIO)<br/>Raw & Generated PDFs")]
        end

    end

    subgraph DEVOPS ["🐳 DEVOPS INFRASTRUCTURE"]
        Docker["Docker Containers / Docker Compose"]
    end

    %% Giao tiếp từ Users tới Proxy
    Student -->|HTTPS / WSS| Nginx
    Counselor -->|HTTPS| Nginx
    Enterprise -->|HTTPS| Nginx

    %% Internal routing
    Nginx -->|Proxy Traffic| NextJS
    NextJS -->|REST / WebSocket| Gateway

    %% Backend Monolith Internal Calls
    Gateway --> Auth
    Gateway --> ResumeMgr
    Gateway --> JdMgr
    Gateway --> InterviewCtrl
    Gateway --> FeedbackMgr

    %% Core Services to AI Engine
    ResumeMgr --> GapAgent
    InterviewCtrl --> MockAgent
    MockAgent --> EvalJudge
    GapAgent --> RagEngine

    %% Persistence Connection
    RagEngine -->|gRPC Port 6333| Qdrant
    ResumeMgr -->|SQLAlchemy| Postgres
    InterviewCtrl -->|SQLAlchemy| Postgres
    Postgres --> FileStore
```

---

## 2. Chi tiết các Tầng Kiến trúc

### 2.1. Tầng Presentation (Frontend)
- **Công nghệ**: Next.js 14, React 18, TypeScript, TailwindCSS.
- **Vai trò**: Cung cấp giao diện cho 3 nhóm người dùng:
  - **Student Portal**: Quản lý CV, chọn ATS Template, xem điểm ATS & Gap Analysis, phòng phỏng vấn trực tuyến WebSocket.
  - **Counselor Portal**: Bảng giám sát sinh viên, gửi bài tập/nhận xét (HITL), duyệt nội dung AI.
  - **Enterprise Portal**: Quản lý tin tuyển dụng, xem danh sách Top Candidate CV.

### 2.2. Tầng Gateway & Security (Proxy)
- **Công nghệ**: Nginx Reverse Proxy.
- **Vai trò**: Điều phối luồng dữ liệu, mã hóa SSL/TLS, giới hạn băng thông (Rate-limiting), hỗ trợ kết nối WebSocket hai chiều cho phỏng vấn thử.

### 2.3. Tầng Core Backend Services (FastAPI Monolith)
- **Công nghệ**: Python 3.11, FastAPI, Pydantic, SQLAlchemy.
- **Các Module chính**:
  1. **Auth & Security**: Đăng ký, đăng nhập, JWT Token, mã hóa mật khẩu Bcrypt, phân quyền 3 Role (Student, Counselor, Enterprise).
  2. **Resume & ATS Manager**: Trích xuất dữ liệu CV, hỗ trợ 3 mẫu ATS standard, cơ chế HITL Accept/Reject gợi ý chỉnh sửa, xuất file PDF bằng ReportLab.
  3. **JD Manager**: Quản lý thư viện JD doanh nghiệp và dán JD từ nguồn ngoài.
  4. **Interview Controller**: Quản lý vòng đời phỏng vấn qua WebSocket, tính điểm tổng kết và khảo sát CSAT (1-5★).
  5. **Counselor Feedback**: Lưu trữ và truyền tải thông tin phản hồi từ cố vấn đến sinh viên.

### 2.4. Tầng AI Engine & LangGraph Agents Layer
- **Công nghệ**: LangGraph, LangChain, FastEmbed, OpenAI / Gemini / Local LLM.
- **Các thành phần Agent**:
  1. **CV Gap Analysis Agent**: So sánh CV và JD, phát hiện kỹ năng còn thiếu dựa trên kinh nghiệm THẬT của người dùng.
  2. **Mock Interview Agent**: Điều phối cuộc đối thoại đa vòng, tự động sinh câu hỏi gợi mở follow-up nếu câu trả lời quá ngắn.
  3. **STAR Evaluator**: Phân rã câu trả lời thành Situation - Task - Action - Result và chấm điểm theo Rubric.
  4. **RAG & Vector Pipeline**: Chunking tài liệu JD/ATS/Rubric và thực hiện Rerank kết quả tìm kiếm ngữ nghĩa.

### 2.5. Tầng Cơ sở dữ liệu & Lưu trữ (Persistence Layer)
- **PostgreSQL 16**: Lưu trữ toàn bộ dữ liệu quan hệ (Users, Resumes, Sessions, QA Logs, Reports, Feedbacks).
- **Qdrant Vector DB**: Cơ sở dữ liệu vector lưu trữ Embeddings của JD thị trường, Tiêu chí ATS và Rubric STAR.
- **File Storage (S3 / MinIO)**: Lưu trữ file CV PDF/DOCX gốc và file PDF được xuất từ hệ thống.
