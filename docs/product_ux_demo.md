# 🎨 Tài liệu Product UX, Tiêu chí ATS, Test CV & Kịch bản Demo (Product & Data UX Specifications)

---

## 📌 1. Danh sách 15 Job Descriptions (JDs) Mẫu Chuẩn hóa

Tập hợp 15 JD mẫu đại diện được trích xuất từ 91 bản ghi làm sạch ([jds_clean.json](data/clean/jds_clean.json)) dùng làm tập tham chiếu cho bài toán so khớp CV-JD:

| Mã JD | Chức danh Tuyển dụng (Job Title) | Tên Công ty | Mức lương | Kinh nghiệm | Kỹ năng Bắt buộc (`must_have_skills`) |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `JD-001` | Software Engineer Intern - Backend | ShopBack | Thỏa thuận | Internship (0-1 năm) | `Java`, `Python`, `Algorithms`, `Data Structure`, `Go`, `C` |
| `JD-002` | Software Developer - Intern | Bouygues Construction IT | Phụ cấp hàng tháng | Internship (0-1 năm) | `C#`, `.NET`, `JavaScript`, `SQL Server`, `OOP` |
| `JD-003` | Thực tập sinh Java | CÔNG TY TNHH BZCOM | 4-6 triệu VNĐ | Intern / Fresher | `Java`, `Spring Boot`, `MySQL`, `RESTful API`, `SQL` |
| `JD-004` | Thực tập sinh Backend Developer | Công ty Cổ phần HouseNow | 4-6 triệu VNĐ | Internship (0-1 năm) | `Node.js`, `Java`, `PostgreSQL`, `RESTful API` |
| `JD-005` | Lập trình viên Java | Công ty Cổ phần Công nghệ BAP | 8-12 triệu VNĐ | 1+ năm | `Java`, `Spring Boot`, `MySQL`, `DevOps`, `RESTful API` |
| `JD-024` | Thực tập sinh Lập trình Python | Công ty TNHH Giải pháp AI | 3-5 triệu VNĐ | Intern | `Python`, `Django`, `Flask`, `Git`, `SQL` |
| `JD-028` | Thực tập sinh QA / Tester | Công ty Phần mềm FPT | 3-5 triệu VNĐ | Intern | `QA`, `Manual Testing`, `Postman`, `Selenium` |
| `JD-038` | Junior CloudOps / SysOps Engineer | Teamwork Vietnam Ltd | 12-18 triệu VNĐ | 1+ năm | `Linux`, `Docker`, `Kubernetes`, `CI/CD`, `AWS` |
| `JD-045` | AI Engineer Intern (Smart Input - OCR) | Tập đoàn Công nghệ BKAV | 5-8 triệu VNĐ | Intern | `Python`, `Computer Vision`, `OCR`, `PyTorch` |
| `JD-064` | Tuyển dụng Lập trình viên Frontend | Công ty Cổ phần Blueco | 12-30 triệu VNĐ | 2+ năm | `HTML`, `CSS`, `JavaScript`, `ReactJS`, `VueJS` |
| `JD-066` | Security Software Engineer Intern | GeoComply | Thỏa thuận | Intern | `Security Engineering`, `Python`, `Golang`, `PHP`, `DNS` |
| `JD-084` | Software Engineer Intern (Salesforce/Guidewire) | Capgemini | Thỏa thuận | Intern | `Java`, `.NET`, `Salesforce`, `SQL`, `Python` |
| `JD-092` | Penetration Tester - Intern | Bouygues Construction IT | Phụ cấp hàng tháng | Intern | `Penetration Testing`, `Security`, `Networking`, `Linux` |
| `JD-093` | Software Engineer Intern - QA | ShopBack | Thỏa thuận | Intern | `QA`, `Automation`, `Go`, `Mobile Testing`, `Selenium` |
| `JD-098` | Security Software Engineer Intern | GeoComply | Thỏa thuận | Intern | `Security Engineering`, `AI`, `Network Analysis`, `VPN` |

---

## 🎯 2. Trọng số & Công thức Đánh giá Điểm ATS (ATS Scoring Criteria)

Hệ thống chấm điểm **ATS Match Score (0 - 100%)** dựa trên công thức trọng số 4 thành phần:

$$\text{ATS Score} = (0.50 \times \text{Hard Skill Score}) + (0.20 \times \text{Nice Skill Score}) + (0.20 \times \text{Domain Fit Score}) + (0.10 \times \text{Experience Score})$$

### Bảng Chi tiết Tiêu chí:

| Tiêu chí | Trọng số | Mô tả Phương pháp Tính |
| :--- | :---: | :--- |
| **Kỹ năng Bắt buộc (`must_have_skills`)** | **50%** | Tỷ lệ % từ khóa kỹ năng cứng của ứng viên xuất hiện trong `must_have_skills` của JD. |
| **Kỹ năng Ưu tiên (`nice_to_have_skills`)** | **20%** | Độ khớp các kỹ năng cộng điểm phụ. |
| **Độ khớp Chuyên môn (`domain_category`)** | **20%** | Khớp giữa định hướng CV (Backend, Frontend, Security, QA, DevOps) và JD Domain. |
| **Cấp bậc & Kinh nghiệm (`experience_required`)** | **10%** | Phù hợp trình độ (Internship, Junior, Experienced). |

---

## 📄 3. Danh sách Test CV Giả lập & Ma trận Benchmark ATS Match

Tập tin giả lập [simulated_cvs.json](data/eval/simulated_cvs.json) gồm 5 hồ sơ đại diện:

| Mã CV | Tên Ứng viên Giả lập | Vị trí Mục tiêu | Kỹ năng Nổi bật trong CV | JD Khớp Tốt Nhất | Điểm ATS Score | Trạng thái Đánh giá |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: |
| `CV-001` | Nguyễn Văn A | Backend Engineer Intern | `Java`, `Spring Boot`, `Python`, `SQL`, `MySQL`, `REST API`, `Docker` | `JD-003` (BZCOM Java) | **88.5%** | 🟢 RẤT PHÙ HỢP |
| `CV-002` | Trần Thị B | Security Software Intern | `Security`, `Python`, `Golang`, `PHP`, `VPN`, `Proxy`, `Network` | `JD-098` (GeoComply) | **92.0%** | 🟢 RẤT PHÙ HỢP |
| `CV-003` | Lê Hoàng C | Frontend Developer | `ReactJS`, `JavaScript`, `TypeScript`, `HTML`, `CSS`, `VueJS` | `JD-064` (Blueco FE) | **90.0%** | 🟢 RẤT PHÙ HỢP |
| `CV-004` | Phạm Minh D | QA / Tester Intern | `QA`, `Manual Testing`, `Postman`, `Selenium`, `Python` | `JD-028` (FPT Tester) | **95.0%** | 🟢 RẤT PHÙ HỢP |
| `CV-005` | Võ Quốc E | Junior CloudOps / SysOps | `Linux`, `Docker`, `Kubernetes`, `CI/CD`, `AWS`, `GCP` | `JD-038` (CloudOps) | **94.0%** | 🟢 RẤT PHÙ HỢP |

---

## ✍️ 4. Thiết kế UX Copywriting (User Interface & Micro-copy)

### A. Thông điệp Huy hiệu Trạng thái (Fit Status Badges):
- 🟢 **80% - 100%**: `🟢 RẤT PHÙ HỢP — Ưng viên đáp ứng xuất sắc các kỹ năng cốt lõi.`
- 🟡 **60% - 79%**: `🟡 TƯƠNG ĐỐI PHÙ HỢP — Đáp ứng nền tảng, cần đào tạo thêm 1-2 kỹ năng bổ trợ.`
- 🔴 **< 60%**: `🔴 CẦN BỔ SUNG KỸ NĂNG — Thiếu các kỹ năng bắt buộc quan trọng.`

### B. Mẫu Gợi ý Đào tạo & Bổ sung Kỹ năng (Candidate Feedback Copy):
> *"Để tăng điểm ATS Score từ **65% ➔ 85%** cho vị trí **Backend Engineer**, ứng viên nên bổ sung kiến thức về: **Docker, Spring Boot, Microservices**."*

---

## ✅ 5. Acceptance Checklist (Danh mục Tiêu chí Chấp nhận Sản phẩm)

| STT | Hạng mục Kiểm thử (Feature Module) | Tiêu chí Chấp nhận (Acceptance Criteria) | Trạng thái |
| :---: | :--- | :--- | :---: |
| 1 | **Data Pipeline** | 91 bản ghi JD làm sạch đầy đủ trường `must_have_skills` & `embedding_text` | ✅ PASSED |
| 2 | **Data Quality Gate** | Tỷ lệ điền đầy đủ dữ liệu (Completeness) = 100%, Uniqueness = 100% | ✅ PASSED |
| 3 | **Retrieval Engine** | Hybrid Search (Dense Vector 384D + Sparse BM25) + RRF Reranking | ✅ PASSED |
| 4 | **RAG Evaluation** | Điểm LLM Judge Score đạt mốc **4.8 - 5.0 / 5.0**, Token F1 đạt **0.3944** | ✅ PASSED |
| 5 | **ATS Match Scoring** | Tính chính xác điểm ATS Score theo 4 trọng số tiêu chí | ✅ PASSED |

---

## 🎬 6. Kịch bản Demo End-to-End Step-by-Step (Demo Script)

### 📌 Mục tiêu Demo: Trình diễn khả năng So khớp CV-JD và Truy xuất RAG Tuyển dụng.

- **Bước 1 (Khởi động Pipeline)**: Chạy lệnh `python scripts/run_phase2_pipeline.py` để nạp dữ liệu sạch vào ChromaDB.
- **Bước 2 (Nạp CV Giả lập)**: Chọn hồ sơ `CV-001` (Nguyễn Văn A - Backend Intern).
- **Bước 3 (Thực thi Hybrid Search)**: RAG Agent thực hiện truy xuất tìm các JD tương thích nhất trong tập 91 bản ghi.
- **Bước 4 (Chấm điểm ATS Score)**: Mô hình xuất kết quả ATS Score **88.5%** đối với `JD-003` (BZCOM Thực tập sinh Java) và hiển thị danh sách kỹ năng đã khớp (`Java`, `Spring Boot`, `SQL`) cùng gợi ý nâng cấp kỹ năng.
- **Bước 5 (Trích xuất Báo cáo)**: Xuất báo cáo tại `data/reports/phase2_report.md`.
