# 📊 Thư viện Sơ đồ Hệ thống (Career Assistant X Diagrams)

Tài liệu này tổng hợp toàn bộ sơ đồ thiết kế hệ thống **Career Assistant X** được chuyển đổi sang định dạng Markdown (`.md`) hỗ trợ vẽ sơ đồ tự động bằng **Mermaid**, dễ dàng xem trực tiếp trên VS Code, GitHub hay các trình xem Markdown tiêu chuẩn.

---

## Danh sách Sơ đồ Markdown

| STT | File Tài liệu | Tên Sơ đồ | Loại Sơ đồ | Mô tả Tóm tắt |
|---|---|---|---|---|
| 1 | [CareerAssistantX_Architecture.md] | **Sơ đồ Kiến trúc Phân tầng** | C4 Container Model | Mô hình 6 tầng: Users, Frontend Next.js 14, Nginx Proxy, FastAPI Monolith Core, LangGraph AI Engine, DB/Persistence (PostgreSQL, Qdrant). |
| 2 | [CareerAssistantX_ClassDiagram.md] | **Sơ đồ Lớp Chi tiết** | UML Class Diagram | 11 Lớp entity chính: User, Student, Counselor, Enterprise, Resume, CounselorFeedback, JobDescription, CvJdMatch, InterviewSession, InterviewQALog, EvaluationReport. |
| 3 | [CareerAssistantX_DatabaseERD.md] | **Sơ đồ Cơ sở Dữ liệu** | ERD Diagram | 11 Bảng dữ liệu quan hệ PostgreSQL 16 với khóa chính (PK), khóa ngoại (FK), kiểu dữ liệu và mô tả chi tiết từng thuộc tính. |
| 4 | [CareerAssistantX_Hierarchy.md] | **Sơ đồ Phân cấp Chức năng** | Functional Hierarchy Tree | 7 Module tính năng chính và các submodule từ 1.1 đến 7.4 phủ toàn bộ yêu cầu dự án. |
| 5 | [CareerAssistantX_UserFlow.md] | **Sơ đồ Luồng Người dùng** | Activity / Swimlane Flowchart | Luồng tương tác liên thông giữa Sinh viên, Doanh nghiệp tuyển dụng, Cố vấn Hướng nghiệp (HITL) và AI Mock Interview Agent. |
