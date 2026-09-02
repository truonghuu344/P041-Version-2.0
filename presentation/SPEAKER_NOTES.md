# Technical Q&A Playbook & Speaker Notes — Career Assistant

> **Dự án**: Career Assistant — Nền tảng Trợ lý Hướng nghiệp & Tối ưu CV/Phỏng vấn dựa trên bằng chứng thật  
> **Đội ngũ**: Team 041 · WinTop (VinUni AI20K Build Phase — Cohort 3)  
> **Sự kiện**: Demo Day 03/09/2026  
> **Quy chuẩn dữ liệu**: 100% đối chiếu với codebase thực tế (`backend/`, `frontend/`, `eval/`, `data/jds/raw/`).

---

## 📌 Bộ số liệu đo kiểm chuẩn hóa (Ground Truth Verified Metrics)

| Hạng mục | Số liệu thực tế | Nguồn trích xuất / Cách xác minh |
| :--- | :---: | :--- |
| **Backend Tests (pytest)** | **745+ tests** | `pytest --collect-only -q` $\rightarrow$ 745 collected tests across 49 test files |
| **Frontend Tests (Jest)** | **159 tests** | `npx jest` $\rightarrow$ `Tests: 159 passed, 159 total` |
| **Pipeline Golden Evaluation** | **14 / 15 cases (93.3%)** | `eval/results/cv_jd_report.json` (Score separation: Positive 84.7 / Negative 0.0) |
| **Manual System Verification** | **6 / 6 test cases (100%)** | `eval/MANUAL_TEST_EVIDENCE.md` (Gate 2 validation) |
| **JD Catalog Size** | **98 JDs** | File count: `data/jds/raw/` (98 file `JD-*.html`) |
| **Voice Interview Phases** | **8 phases** | `voice_orchestrator.py` list: greeting $\rightarrow$ self_intro $\rightarrow$ experience $\rightarrow$ skills $\rightarrow$ role $\rightarrow$ candidate_qa $\rightarrow$ admin $\rightarrow$ closing |
| **P95 Retrieval Latency** | **< 1.2s (1,152.9ms)** | `eval/results/top_k_benchmark_report.json` (K=30 latency benchmark) |
| **Top-K Retrieval Recall** | **Recall@30 = 71.7%** | `eval/results/top_k_benchmark_report.json` (52 CVs × 98 JDs) |
| **No-Evidence False Positive** | **0.00%** | `eval/results/v1_eval_report.json` |

---

## 🎙️ PHẦN 1: KỊCH BẢN THUYẾT TRÌNH THEO 10 SLIDES (10 Phút)

### Slide 1: Title — Career Assistant (0:00 – 1:00)
- **Nội dung trình bày**: Kính chào Hội đồng Giám khảo và Ban Tổ chức. Chúng tôi là Team 041 WinTop. Hôm nay, nhóm xin giới thiệu **Career Assistant** — nền tảng hướng nghiệp thông minh giúp sinh viên tối ưu CV, hiểu rõ khoảng cách kỹ năng và sẵn sàng cho các vòng phỏng vấn thực tế.
- **Thông điệp cốt lõi**: *"Tối ưu CV. Hiểu khoảng cách. Sẵn sàng phỏng vấn."*

### Slide 2: Problem — Nỗi đau của sinh viên năm 3–4 (1:00 – 2:00)
- **Nội dung trình bày**: Sinh viên năm 3–4 và mới tốt nghiệp đối mặt với chuỗi thất bại lặp lại: Gửi một bản CV chung cho mọi JD $\rightarrow$ Bị loại mà không có phản hồi $\rightarrow$ Không biết mình thiếu kỹ năng gì $\rightarrow$ Chỉ nhận ra bản thân chưa sẵn sàng khi đã trượt phỏng vấn thật.
- **Điểm nhấn**: Quá trình tuyển dụng thiếu tính minh bạch khiến ứng viên mất phương hướng cải thiện.

### Slide 3: Solution — Luồng giải pháp liên tục (2:00 – 3:00)
- **Nội dung trình bày**: Career Assistant giải quyết bài toán qua một luồng khép kín: Input (CV + JD) $\rightarrow$ Match $\rightarrow$ Gap Analysis $\rightarrow$ Optimize CV $\rightarrow$ Mock Interview $\rightarrow$ Apply.
- **Differentiator**: Nguyên tắc **"Không evidence $\rightarrow$ Không claim"**. Mọi phân tích dựa trên sự thật trích xuất từ CV, điểm số FitScore do backend tính toán tất định, không để LLM tự chấm tùy ý.

### Slide 4: Product — Hành trình sản phẩm & Dữ liệu thực (3:00 – 4:00)
- **Nội dung trình bày**: Minh họa hành trình 6 bước liền mạch với dữ liệu thực tế: Catalog 98 JD phong phú, phỏng vấn giọng nói 8 phases có cấu trúc, hỗ trợ định dạng PDF/DOCX với bộ parser MinerU OCR trích xuất layout phức tạp.

### Slide 5: Architecture — 5 Tầng & Quyết định công nghệ (4:00 – 5:00)
- **Nội dung trình bày**: Kiến trúc 5 tầng phân lập: Next.js 15 $\rightarrow$ FastAPI Gateway $\rightarrow$ LangGraph Workflows $\rightarrow$ PostgreSQL + pgvector $\rightarrow$ External Services (Gemini, Deepgram, MinerU).
- **Quyết định cốt lõi**: Sử dụng **LangGraph** để kiểm soát luồng trạng thái chặt chẽ; sử dụng **pgvector** để hợp nhất dữ liệu quan hệ và tìm kiếm vector trong một cơ sở dữ liệu duy nhất.

### Slide 6: AI/LLM Approach — Evidence Flow & State Machine (5:00 – 6:00)
- **Nội dung trình bày**: Luồng AI qua 3 chặng: Hybrid Retrieval (BM25 + pgvector RRF) $\rightarrow$ LangGraph State Machine (`validate_input` $\rightarrow$ `extract_evidence` $\rightarrow$ `draft_analysis` $\rightarrow$ `integrity_guardrail`) $\rightarrow$ Backend FitScore Formula (Skills 35%, Exp 30%, Domain 15%, Edu 10%, Pref 10%).
- **Chỉ số**: Đạt 14/15 test cases (93.3%) trên tập Golden Dataset.

### Slide 7: Technical Highlights — Số liệu kỹ thuật thực chứng (6:00 – 7:00)
- **Nội dung trình bày**: Cam kết chất lượng thông qua dữ liệu đo thực tế: 745+ backend tests, 159 frontend tests, quy trình CI/CD 5 bước tự động qua GitHub Actions, thời gian truy xuất P95 < 1.2s và Recall@30 đạt 71.7%.

### Slide 8: Demo Video — Trải nghiệm thực tế (7:00 – 8:00)
- **Nội dung trình bày**: Trình chiếu video demo 2–3 phút thể hiện trọn vẹn luồng từ tải CV, phân tích FitScore kèm bằng chứng, nhận gợi ý sửa đổi đến thực hiện phỏng vấn thử qua giọng nói.

### Slide 9: Challenges & Learnings — Thách thức & Bài học (8:00 – 9:00)
- **Nội dung trình bày**: 3 bài học đắt giá:
  1. Xử lý Hallucination: Dùng AI tìm bằng chứng, dùng Backend tính điểm tất định.
  2. Tối ưu thời gian so khớp: Chuyển sang 2-Stage Retrieval giúp giảm độ trễ từ >15s xuống <1.8s.
  3. Kiểm soát phỏng vấn thời gian thực: Thiết kế State Machine 8 phases một chiều (forward-only).
- **Nếu làm lại**: Xây dựng bộ Evaluation và Integrity Guardrail ngay từ Sprint đầu tiên.

### Slide 10: Team, Roadmap & Q&A (9:00 – 10:00)
- **Nội dung trình bày**: Giới thiệu 4 thành viên nhóm WinTop và Mentor Trần Vũ Anh (Andy). Trình bày lộ trình tăng trưởng: `PILOT` $\rightarrow$ `VALIDATE` $\rightarrow$ `EXPAND` $\rightarrow$ `SCALE`. Cảm ơn Ban Tổ chức và chuyển sang phần Q&A.

---

## 🎯 PHẦN 2: TECHNICAL Q&A PLAYBOOK (8 CÂU HỎI HỘI ĐỒNG)

---

### Câu 1: Tại sao nhóm chọn LangGraph thay vì CrewAI hay AutoGen?
**Trả lời trọng tâm**:
- **Bản chất bài toán**: Career Assistant không phải là một ứng dụng "chat/tán gẫu tự do" cần các agent tự phát sinh đối thoại, mà là một **quy trình nghiệp vụ nghiêm ngặt (deterministic business workflow)** đòi hỏi sự chính xác về trạng thái, phân nhánh có điều kiện và kiểm soát rủi ro.
- **Khả năng của LangGraph**:
  1. **State Graph rõ ràng**: Quản lý `AgentState` tập trung, cho phép kiểm tra kiểu dữ liệu (Pydantic/Schema validation) tại từng bước chuyển giao giữa các node (`validate_input` $\rightarrow$ `extract_evidence` $\rightarrow$ `draft_analysis` $\rightarrow$ `integrity_guardrail`).
  2. **Kiểm soát phân nhánh & Retry**: Khi node kiểm tra dữ liệu phát hiện lỗi (ví dụ file CV thiếu thông tin hoặc prompt injection), hệ thống lập tức rẽ nhánh an toàn sang trạng thái `END (error)` mà không kích hoạt gọi LLM tốn kém.
  3. **Tích hợp Guardrail nội tại**: Cho phép nhúng node kiểm tra tính toàn vẹn dữ liệu trước khi trả về cho client.
- **Hạn chế của CrewAI/AutoGen với dự án**: CrewAI và AutoGen phù hợp hơn cho các bài toán nghiên cứu mở (autonomous goal-seeking). Trong hệ thống tuyển dụng, tính tự do đó dễ dẫn đến hiện tượng hội thoại lặp vòng (infinite loops), chi phí token khó kiểm soát và khó debug trạng thái.

---

### Câu 2: Tại sao chọn PostgreSQL + pgvector thay vì Qdrant hay Pinecone?
**Trả lời trọng tâm**:
- **Hiện trạng kiến trúc thực tế**: Hệ thống đang vận hành production trên nền tảng **PostgreSQL kết hợp extension `pgvector`**.
- **Lý do lựa chọn**:
  1. **Hợp nhất Cơ sở dữ liệu (Single Source of Truth)**: Dữ liệu ứng viên, lịch sử nộp hồ sơ, danh mục 98 JD, dữ liệu phân quyền RBAC và vector embedding đều nằm trong cùng một cơ sở dữ liệu PostgreSQL.
  2. **Truy vấn lai kết hợp lọc Metadata hiệu quả**: Cho phép thực hiện các câu truy vấn phức tạp (ví dụ: tìm kiếm vector độ tương đồng ngữ nghĩa kết hợp lọc metadata theo `experience_level`, `location`, `salary_range` và `user_id`) thông qua cú pháp SQL chuẩn trong một lượt truy vấn (single query), loại bỏ hoàn toàn bài toán đồng bộ dữ liệu (dual-write / consistency issues) giữa database quan hệ và database vector riêng biệt.
  3. **Tối ưu chi phí & Độ phức tạp vận hành (Operational Overhead)**: Không phải duy trì, bảo mật, sao lưu và trả phí cho một cụm vector DB riêng biệt (như Qdrant cluster hay Pinecone cloud instance).
- *Lưu ý về định hướng quy mô lớn (Future Scale)*: Nếu dữ liệu JD và CV vượt qua ngưỡng hàng triệu vector với yêu cầu tìm kiếm phân tán trên nhiều khu vực địa lý, nhóm sẽ cân nhắc phân tách sang một chuyên dụng Vector DB độc lập như Qdrant khi cần thiết.

---

### Câu 3: Nhóm kiểm soát Ảo giác (Anti-Hallucination) và tính FitScore như thế nào?
**Trả lời trọng tâm**:
- **Triết lý thiết kế**: *"Không evidence $\rightarrow$ Không claim. AI tìm bằng chứng, Backend quyết định điểm."*
- **Quy trình 3 lớp kiểm soát**:
  1. **Lớp 1 — Trích xuất dẫn chứng (Evidence Extraction)**: LLM chỉ nhận nhiệm vụ phân tích ngữ nghĩa để tìm kiếm câu/đoạn trích dẫn thực tế trong CV tương ứng với từng yêu cầu trong JD. Nếu không tìm thấy, nhãn bắt buộc phải là `NO_EVIDENCE`.
  2. **Lớp 2 — Công thức Backend tất định (Deterministic Scoring Engine)**: LLM **không được phép tự phát sinh con số điểm**. Toàn bộ điểm FitScore do Backend tính toán bằng code Python theo công thức chuẩn 5 trọng số:
     $$\text{FitScore} = 0.35 \times \text{Skills} + 0.30 \times \text{Exp} + 0.15 \times \text{Domain} + 0.10 \times \text{Edu} + 0.10 \times \text{Pref}$$
  3. **Lớp 3 — Integrity Guardrail Node**: Trước khi trả kết quả, node guardrail trong LangGraph kiểm tra chéo: Mọi kỹ năng đạt điểm bắt buộc phải có `evidence_quote` thực tế trích từ CV; nếu phát hiện bịa đặt, node sẽ loại bỏ claim đó và hạ điểm tương ứng.
- **Kết quả đo kiểm**: Đạt tỷ lệ **NO_EVIDENCE False Positive = 0%** trong báo cáo đánh giá `eval/results/v1_eval_report.json`.

---

### Câu 4: Nhóm thiết kế kiến trúc để đáp ứng 1.000 người dùng đồng thời (Scale Architecture) như thế nào?
**Trả lời trọng tâm**:
- **Chiến lược xử lý phân lớp**:
  1. **Lớp 1 — Tối ưu hóa truy xuất với 2-Stage Retrieval**:
     - *Giai đoạn 1 (Lọc thô)*: Sử dụng Hybrid Search (BM25 + pgvector RRF) để quét nhanh danh mục 98+ JD và lấy ra `Top-30` vị trí tiềm năng nhất (thời gian P95 đo được là **1,152.9ms**, Recall@30 đạt **71.7%**).
     - *Giai đoạn 2 (Phân tích sâu)*: Chỉ chạy phân tích rubric chi tiết trên nhóm ứng viên rút gọn, tránh chạy toàn bộ LLM trên toàn bộ catalog.
  2. **Lớp 2 — Xử lý Bất đồng bộ (Asynchronous Task Queue)**:
     - Các tác vụ nặng như phân tích CV chuyên sâu, tối ưu nội dung và sinh giọng nói tổng hợp (TTS) được chuyển sang hàng đợi nền (Celery / Redis Queue).
     - API Gateway (FastAPI) phản hồi ngay `task_id` cho frontend và cập nhật tiến độ theo thời gian thực qua WebSocket hoặc Server-Sent Events (SSE).
  3. **Lớp 3 — Bộ nhớ đệm thông minh (Multi-Tier Caching)**:
     - Cache vector embeddings của toàn bộ JD catalog trong Redis.
     - Cache kết quả phân tích parsing của các CV không thay đổi nội dung.
  4. **Lớp 4 — Mở rộng hạ tầng (Horizontal Scaling)**:
     - Tách biệt Stateless API/Workers (triển khai trên Kubernetes/Docker containers với Auto-scaling) và Stateful Database (PostgreSQL với Read Replicas và Connection Pooling qua PgBouncer).

---

### Câu 5: Kiến trúc Voice Mock Interview hoạt động ra sao và xử lý độ trễ thời gian thực thế nào?
**Trả lời trọng tâm**:
- **Kiến trúc State Machine 8 Phases**: Quá trình phỏng vấn được điều phối theo máy trạng thái hữu hạn 8 giai đoạn nghiêm ngặt: `greeting` $\rightarrow$ `self_intro` $\rightarrow$ `experience_deepdive` $\rightarrow$ `skills_assessment` $\rightarrow$ `role_alignment` $\rightarrow$ `candidate_qa` $\rightarrow$ `admin_logistics` $\rightarrow$ `closing`.
- **Nguyên tắc Forward-Only**: Trạng thái chỉ tiến tới, không lùi vòng, đảm bảo buổi phỏng vấn diễn ra đúng khung thời gian chuẩn và không bị AI dẫn dắt lạc đề.
- **Pipeline Xử lý mượt mà**:
  1. **Giao thức WebSocket song công (Full-duplex)**: Duy trì kết nối liên tục giữa client và backend để truyền luồng âm thanh.
  2. **STT (Speech-to-Text)**: Tích hợp Deepgram API để chuyển giọng nói ứng viên thành văn bản theo thời gian thực với độ trễ tối thiểu.
  3. **Evaluator & Response Generation**: LangGraph Interview Agent đối chiếu câu trả lời với khung đánh giá STAR (Situation, Task, Action, Result).
  4. **TTS (Text-to-Speech)**: Sinh luồng phản hồi giọng nói của người phỏng vấn gửi ngược về client.
- **Cơ chế phục hồi kết nối**: Hệ thống lưu trữ `session_state` trong database, cho phép ứng viên tiếp tục đúng pha phỏng vấn hiện tại nếu xảy ra gián đoạn mạng đột ngột.

---

### Câu 6: Chiến lược quản lý chi phí Token và lựa chọn mô hình LLM (Cost Management)?
**Trả lời trọng tâm**:
- **Chiến lược phân tầng mô hình (Model Tiering)**:
  - Sử dụng mô hình tốc độ cao, chi phí thấp (ví dụ: Google Gemini 2.5 Flash / Flash Lite) cho các tác vụ định tuyến, phân loại quan hệ ngữ nghĩa thô và trích xuất thực thể.
  - Chỉ gọi mô hình nâng cao khi thực hiện tổng hợp báo cáo đánh giá năng lực phức tạp hoặc sinh câu hỏi phỏng vấn tình huống chuyên sâu.
- **Tối ưu hóa Context Window**:
  - Không truyền toàn bộ văn bản dài của CV và JD vào prompt.
  - Sử dụng Hybrid Retrieval để chỉ đưa các đoạn trích dẫn thực sự liên quan (*evidence chunks*) vào context của LLM.
- **Cắt giảm gọi LLM không cần thiết**:
  - Giao toàn bộ việc chấm điểm, xếp hạng và tính phần trăm cho code logic thuần túy tại Backend.
  - Áp dụng Semantic Caching đối với các câu hỏi phỏng vấn chuẩn hóa và JD phổ biến.

---

### Câu 7: Chiến lược kiểm thử & Đảm bảo chất lượng (QA & Test Strategy)?
**Trả lời trọng tâm**:
- **Hệ thống Kiểm thử đa tầng được xác minh từ codebase**:
  1. **Unit & Integration Tests Backend**: **745+ tests** viết bằng `pytest` bao phủ toàn bộ API routes, core services, security RBAC, parsing pipeline và agent nodes (`pytest --collect-only` xác nhận 745 tests trong 49 test files).
  2. **Frontend Component & Hook Tests**: **159 tests** viết bằng `Jest` và `React Testing Library` kiểm tra tính toàn vẹn của UI flows, form validation và state management (`npx jest` xác nhận 159 passed).
  3. **Golden Dataset Evaluation**: Bộ dữ liệu chuẩn đánh giá CV–JD pipeline đạt **14/15 ca kiểm thử thành công (93.3%)** với sự phân tách điểm số rõ rệt giữa hồ sơ phù hợp (Positive mean: 84.7) và hồ sơ không phù hợp (Negative mean: 0.0).
  4. **Manual End-to-End System Tests**: Hoàn thành đạt **6/6 ca kiểm thử toàn diện** ghi nhận trong `eval/MANUAL_TEST_EVIDENCE.md`.
  5. **CI/CD Quality Gates**: Mọi Pull Request đều bắt buộc vượt qua pipeline tự động gồm: `Ruff Lint` $\rightarrow$ `pytest` $\rightarrow$ `TypeScript Check` $\rightarrow$ `Next.js Build`.

---

### Câu 8: Hệ thống 2-Stage Retrieval và các chỉ số hiệu năng tìm kiếm hoạt động thế nào?
**Trả lời trọng tâm**:
- **Mục tiêu**: Giải quyết bài toán tốc độ khi người dùng tải CV lên và cần gợi ý ngay các công việc phù hợp nhất trong catalog 98 JD mà không bị nghẽn mạng (>15 giây).
- **Cơ chế 2 Chặng**:
  - **Chặng 1 — Lọc thô kết hợp (Hybrid Search + RRF Fusion)**: Kết hợp tìm kiếm từ khóa chính xác (BM25) với tìm kiếm ngữ nghĩa vector (`pgvector`) thông qua thuật toán Reciprocal Rank Fusion ($k=60$). Rút trích danh sách `Top-30` JD tiềm năng nhất.
  - **Chặng 2 — So khớp chi tiết (Rubric Alignment)**: Chạy pipeline phân tích bằng chứng chuyên sâu trên 30 vị trí này để đưa ra Top công việc và FitScore chính xác.
- **Số liệu đo kiểm thực tế (trích xuất từ `top_k_benchmark_report.json` trên 52 CV × 98 JD)**:
  - Thời gian phản hồi **P95 Latency**: **< 1.2s (1,152.9ms)** tại $K=30$.
  - Độ phủ ứng viên **Recall@30**: Đạt **71.7%** (tối ưu hóa giữa độ chính xác và chi phí tính toán so với quét toàn bộ).
  - Tốc độ gợi ý việc làm toàn diện giảm từ **>15s xuống <1.8s** trên giao diện người dùng.
