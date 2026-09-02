# Development Journal — Team WinTop (P-041)

> **Dự án**: Career Assistant — Nền tảng Trợ lý Hướng nghiệp & Tối ưu CV/Phỏng vấn dựa trên bằng chứng thật  
> **Chương trình**: VinUni AI20K Build Phase — Cohort 3  
> **Mentor**: Trần Vũ Anh (Andy)  
> **Deliverable**: #8 — Development Journal  

---

## 1. Thành viên & Phân công trách nhiệm (25% mỗi thành viên)

1. **NGUYỄN THỊ THANH HIỀN (2A202601150 · `@HinDayNi`)** — *Project Lead & Frontend Architect*: Phụ trách quản lý tiến độ, kiến trúc Frontend Next.js 15 (Student, Counselor, Admin portals), hệ thống Design System / Bento Grid, tối ưu trải nghiệm người dùng (UX/UI), kiểm soát chất lượng dữ liệu và triển khai Vercel.
2. **VŨ HỮU TRƯỜNG (2A202601694 · `@truonghuu344`)** — *AI System & Database Architect*: Phụ trách thiết kế LangGraph Multi-Agent, CV Optimizer (CP-SAT Constraint Programming), Nova Agent (Cascading RAG 3 tầng), Voice-to-Voice STAR Interview Engine, quản trị PostgreSQL 16 + pgvector và Docker containerization.
3. **VŨ XUÂN ĐỨC (2A202601668 · `@DucVX010108`)** — *Backend Core & Security Engineer*: Phụ trách hạ tầng Backend FastAPI async, phân quyền Auth RBAC, JWT / OTP session security, rate limiting, module tuyển dụng & quản lý 98 JD catalog, quét mã độc ClamAV và triển khai Render.
4. **NGUYỄN MINH QUÂN (2A202601478 · `@NguyenMinhQuan-2A202601478`)** — *QA & Evaluation Lead*: Phụ trách khung kiểm thử toàn diện (740+ Pytest backend & 159 Jest frontend), đánh giá chất lượng mô hình (Golden dataset 15/15 cases, Top-K benchmark), CI/CD GitHub Actions và LangSmith observability.

---

## 2. Nhật ký phát triển theo các giai đoạn (Sprint Journals)

### 🗓️ Giai đoạn 1 (24/07 – 03/08/2026): Khởi tạo dự án, Gate 1 & Kiến trúc nền tảng

#### Ghi nhận đóng góp thành viên:
- **Thanh Hiền**: Thiết lập repository GitHub P-041, quy chuẩn Conventional Commits tiếng Việt, cấu hình Git hooks logging (`.ai-log/`) và tài liệu Gate 1 (PRD, User Persona, System Flow).
- **Hữu Trường**: Nghiên cứu kiến trúc RAG không bịa đặt (*"Không evidence → không claim"*), dựng khung LangGraph 4 graph độc lập, thiết kế schema CSDL cho CV/JD snapshots.
- **Xuân Đức**: Khởi tạo cấu trúc backend FastAPI, tích hợp Pydantic v2 settings, cấu hình Docker Compose cho PostgreSQL và pgvector extension.
- **Minh Quân**: Thiết lập pipeline CI GitHub Actions (Lint, Typecheck, Test), dựng khung Pytest ban đầu và bộ kiểm thử UI contracts.

#### Khó khăn kỹ thuật & Giải pháp:
| Vấn đề gặp phải | Giải pháp kỹ thuật | Kết quả đạt được |
|---|---|---|
| Môi trường Windows và Linux bị lệch line ending (`CRLF` vs `LF`) làm lỗi Git hook log. | Viết lại pre-push hook với `LF`, bổ sung script `_pyrun.sh` kiểm tra runtime Python độc lập. | Hook hoạt động đồng nhất trên mọi máy thành viên. |
| Quota API embedding Google Gemini bị nghẽn khi chạy batch lớn. | Xây dựng cơ chế fallback sang Local Hashing Embedding khi gặp mã lỗi 429. | Pipeline xử lý dữ liệu không bao giờ bị dừng đột ngột. |

---

### 🗓️ Giai đoạn 2 (04/08 – 10/08/2026): Core Engine, CV Parser, ClamAV & pgvector

#### Ghi nhận đóng góp thành viên:
- **Thanh Hiền**: Xây dựng module đánh giá chất lượng dữ liệu (Completeness & Uniqueness checks), thu thập và làm sạch bộ 98 JD thị trường chuẩn.
- **Hữu Trường**: Tích hợp MinerU layout-aware OCR parser trích xuất cấu trúc văn bản CV; triển khai Hybrid Retrieval (BM25 ⊕ pgvector cosine distance) với Reciprocal Rank Fusion (RRF).
- **Xuân Đức**: Tích hợp antivirus ClamAV quét file tải lên (chặn file độc hại trước khi OCR); hoàn thiện API xác thực JWT, RBAC và mã hóa mật khẩu.
- **Minh Quân**: Xây dựng 3-level test case structure (Unit, Integration, E2E) và bổ sung 50+ test cases kiểm tra parser CV và matching algorithm.

#### Quyết định kỹ thuật cốt lõi:
- **Quyết định**: Không cho phép LLM tự cho điểm số CV–JD match.
- **Lý do**: LLM thường bị ảo giác (hallucination), điểm số không nhất quán giữa các lần gọi. Điểm FitScore phải do Backend tính toán tất định (deterministic) dựa trên số lượng và trọng số evidence trích xuất được.

---

### 🗓️ Giai đoạn 3 (11/08 – 17/08/2026): Thuật toán So khớp CV–JD & Top Jobs Recommendation

#### Ghi nhận đóng góp thành viên:
- **Thanh Hiền**: Thiết kế giao diện Gap Analysis tương tác (bento grid, radar chart kỹ năng, evidence preview cards); xử lý CORS và WebSocket connection lifecycle.
- **Hữu Trường**: Tối ưu hóa thuật toán Top Jobs: lọc metadata → BM25 ⊕ Dense Top-30 → Weighted RRF → Tính FitScore 5 thành phần (Kỹ năng, Kinh nghiệm, Học vấn, Ưu tiên, Ngành nghề) → Confidence Gate.
- **Xuân Đức**: Hoàn thiện CRUD API cho Catalog 98 JD; cấu hình Rate Limiting và middleware chống tấn công DoS/Replay.
- **Minh Quân**: Viết bộ benchmark Top-K recommendations, đo lường độ chính xác gợi ý và độ bao phủ kỹ năng theo chuẩn rubric.

#### Khó khăn kỹ thuật & Giải pháp:
| Vấn đề gặp phải | Giải pháp kỹ thuật | Kết quả đạt được |
|---|---|---|
| Tìm kiếm từ khóa tiếng Việt có dấu/không dấu bị lệch trong BM25. | Bổ sung tokenizer chuẩn hóa tiếng Việt, tách dấu và xử lý đồng nghĩa kỹ thuật số. | Tăng Recall@10 từ 68% lên 92% trên tập benchmark. |
| Thời gian so khớp 1 CV với toàn bộ 98 JD quá chậm (>15 giây). | Sử dụng 2-stage retrieval: Stage 1 lọc Top-30 bằng vector thô, Stage 2 mới so khớp chi tiết rubric. | Giảm độ trễ xuống dưới 1.8 giây/lần gợi ý. |

---

### 🗓️ Giai đoạn 4 (18/08 – 24/08/2026): Voice-to-Voice STAR Interview & AI Agents

#### Ghi nhận đóng góp thành viên:
- **Thanh Hiền**: Xây dựng giao diện phòng phỏng vấn trực tiếp: hiển thị timeline phỏng vấn, visualizer sóng âm thanh (waveform), báo cáo điểm STAR và transcript chi tiết.
- **Hữu Trường**: Xây dựng Voice Engine kết hợp Deepgram Nova-3 (STT) → LangGraph Interviewer StateMachine → gTTS (TTS tiếng Việt); xây dựng Nova Agent với Cascading RAG 3 tầng.
- **Xuân Đức**: Thiết kế CV Optimizer sử dụng Google OR-Tools CP-SAT tối ưu hóa dung lượng vừa khít trang A4 theo rubric ATS; quản lý snapshots bất biến.
- **Minh Quân**: Viết bộ E2E scenario test cho luồng Voice Interview, kiểm tra cơ chế ngắt lời, phục hồi WebSocket khi mất mạng và ghi log LangSmith.

#### Bài học rút ra:
- Phỏng vấn giọng nói qua WebSocket cần cơ chế State Machine phân định 6 phase rõ ràng (Greeting → Self-Intro → Experience → Technical → Behavioral → Closing) để LLM không nói lan man ngoài kịch bản.
- Trích xuất STAR cần so khớp span nguyên văn từ transcript của thí sinh, tránh việc LLM tự tưởng tượng thêm tình huống.

---

### 🗓️ Giai đoạn 5 (25/08 – 31/08/2026): Hoàn thiện Ba Phân Hệ, Admin Portal & Hardening

#### Ghi nhận đóng góp thành viên:
- **Thanh Hiền**: Thiết kế lại toàn diện Admin Portal (Quản lý người dùng, Tuyển dụng, Giám sát AI Audit Logs), sửa lỗi xung đột giao diện, chuẩn hóa toàn bộ bảng màu `#0F172A` và typography.
- **Hữu Trường**: Tinh chỉnh prompt contracts, bổ sung Guardrail chặn Prompt Injection và bảo vệ dữ liệu nhạy cảm của sinh viên.
- **Xuân Đức**: Xử lý triệt để các vấn đề DB connection pool trên Neon/Render; tối ưu hóa Docker multi-stage build để giảm dung lượng image từ 1.8GB xuống 380MB.
- **Minh Quân**: Tăng độ phủ kiểm thử lên 740+ backend tests và 159 frontend tests; kiểm tra tính tương thích hợp đồng giao diện (UI Contracts test).

---

### 🗓️ Giai đoạn 6 (01/09/2026): Kiểm thử tổng lực & Đóng gói 10 Deliverables

#### Ghi nhận đóng góp thành viên:
- **Thanh Hiền**: Hoàn thiện slide thuyết trình Pitch Deck PDF (12 trang chuẩn 16:9), đồng bộ hóa tài liệu `docs/` và xuất bản Vercel live production.
- **Hữu Trường**: Kiểm tra độ trễ và khả năng chịu tải của RAG pipeline; chạy bộ benchmark đánh giá cuối cùng đạt 15/15 golden eval cases.
- **Xuân Đức**: Tự động hóa database migration, bảo mật toàn bộ environment variables, thiết lập health check `/health` đạt chuẩn 100% uptime.
- **Minh Quân**: Chạy toàn bộ 5 lệnh kiểm tra chất lượng: `npm run lint`, `npm run typecheck`, `npm run build`, `ruff check`, `pytest -q` (0 lỗi).

---

## 3. Phản tư kỹ thuật cá nhân (Individual Technical Reflections)

### 👩‍💻 Nguyễn Thị Thanh Hiền — Project Lead & Frontend Lead
> *"Thử thách lớn nhất của tôi là làm sao kết nối 3 đối tượng người dùng (Sinh viên, Cố vấn, Doanh nghiệp) vào cùng một hệ thống mà không gây rối rắm. Bằng cách áp dụng cấu trúc Bento Grid, Atomic Components và tách biệt giao diện theo RBAC, nhóm đã tạo ra một sản phẩm mượt mà, chuyên nghiệp và có thể demo trực tiếp mọi tính năng trong vòng 3 phút."*

### 👨‍💻 Vũ Hữu Trường — AI & Systems Architect
> *"Nguyên tắc 'Không evidence → không claim' là kim chỉ nam giúp nhóm vượt qua cạm bẫy ảo giác của LLM. Việc kết hợp CP-SAT để căn chỉnh trang CV cùng Cascading RAG 3 tầng cho chatbot Nova đã chứng minh rằng một kiến trúc AI chuẩn mực phải được xây dựng trên nền tảng kỹ thuật tính toán tất định chứ không thể phó mặc cho LLM."*

### 👨‍💻 Vũ Xuân Đức — Backend & Security Lead
> *"Đảm bảo hệ thống vận hành an toàn với ClamAV, Rate Limiting và JWT session đã giúp backend của nhóm vượt qua các bài kiểm thử khắt khe về bảo mật. Việc tối ưu hóa connection pool và Docker container giúp chi phí vận hành ở mức 0đ mà vẫn đáp ứng hàng trăm lượt truy cập đồng thời."*

### 👨‍💻 Nguyễn Minh Quân — QA & Evaluation Lead
> *"Với 740+ Pytest tests và 159 Jest tests đạt 100% green, nhóm chúng tôi tự tin rằng mã nguồn không chỉ chạy được mà còn cực kỳ ổn định. Việc thiết lập hệ thống LangSmith tracing từ sớm giúp việc debug các chuỗi suy luận của Agent trở nên minh bạch và dễ dàng."*

---

## 4. Tổng kết năng lực & Bàn giao dự án

- **10/10 Deliverables** nộp cho BTC AI20K đều đạt chất lượng hoàn chỉnh.
- **Mã nguồn sạch sẽ, bảo mật**: Không hardcoded secrets, không bare except, đầy đủ type hints và docstrings.
- **Sản phẩm chạy thật**: Live URL hoạt động ổn định trên cả Vercel (Frontend) và Render (Backend).
