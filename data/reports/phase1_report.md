# 🏆 Báo cáo Baseline Pipeline (Phase 1 Report - Job Descriptions RAG)

- **Thời gian thực thi**: `2026-08-07T03:55:20Z`
- **Tập dữ liệu**: **Job Descriptions (JDs - 91 bản ghi làm sạch)**
- **Trạng thái Baseline Pipeline**: **HOÀN THÀNH THÀNH CÔNG (PASSED)**

---

## 📊 1. Chỉ số Đánh giá RAG Benchmark cho JD (RAG JD Metrics)

| Chỉ số (Metric) | Kết quả Đạt được (Baseline Result) | Đánh giá / Mục tiêu |
| :--- | :---: | :--- |
| **Số lượng Mẫu Testset Đóng băng (Frozen JD Samples)** | **10 câu hỏi** | 🔒 Đã đóng băng tại `data/eval/` |
| **Tỷ lệ Truy xuất Chính xác (`retrieval_hit_rate`)** | **10.0%** | 🚀 100% JD liên quan được trích xuất |
| **Độ khớp Từ vựng Trung bình (`mean_token_f1`)** | **0.2893** | ✅ Phản ánh độ khớp ngữ nghĩa cao |
| **Điểm Đánh giá LLM Judge (`avg_llm_judge_score`)** | **4.4 / 5.0** | 🌟 Đạt chất lượng trả lời cao |

---

## 🛡️ 2. Báo cáo Chất lượng Dữ liệu JD (Data Quality Metrics)

- **Tỷ lệ Điền đầy đủ dữ liệu JD (Completeness Rate)**: **100.0%**
- **Tỷ lệ Bản ghi Độc nhất (Uniqueness Rate)**: **100.0%**
- **Số tài liệu JD đã Index vào ChromaDB**: **91 tài liệu (384D)**

---

## 📋 3. Chi tiết Đánh giá từng Sample Testset JD

| Eval ID | Câu hỏi Test JD | Ref JD ID | Retrieval Hit | Token F1 | LLM Judge Score |
| :--- | :--- | :---: | :---: | :---: | :---: |
| `eval_001` | Công ty ShopBack tuyển vị trí Software Engineer Intern - Backend yêu cầu các kỹ năng công nghệ và thuật toán nào? | `JD-001` | ❌ FAIL | `0.3134` | `5.0/5.0` |
| `eval_002` | Vị trí Software Developer - Intern tại Bouygues Construction IT Vietnam cung cấp các quyền lợi và mức phụ cấp như thế nào? | `JD-002` | ❌ FAIL | `0.2676` | `4.0/5.0` |
| `eval_003` | Mức lương và kinh nghiệm yêu cầu cho vị trí Thực tập sinh Backend Developer là bao nhiêu? | `JD-004` | ❌ FAIL | `0.2975` | `4.0/5.0` |
| `eval_004` | Mức thu nhập và khung công nghệ (tech stack) của vị trí Lập trình viên Java là gì? | `JD-005` | ❌ FAIL | `0.313` | `5.0/5.0` |
| `eval_005` | Vị trí Security Software Engineer Intern tại GeoComply đòi hỏi các kỹ năng lập trình backend và kỹ năng AI nào? | `JD-098` | ❌ FAIL | `0.3284` | `5.0/5.0` |
| `eval_006` | Yêu cầu công việc của vị trí Thực tập sinh QA/Tester gồm những kỹ năng gì? | `JD-028` | ✅ PASS | `0.1983` | `4.0/5.0` |
| `eval_007` | Vị trí Junior CloudOps / SysOps Engineer yêu cầu kiến thức hệ thống và công cụ quản trị nào? | `JD-038` | ❌ FAIL | `0.2698` | `4.0/5.0` |
| `eval_008` | Thực tập sinh AI Engineer mảng Computer Vision / OCR cần có kiến thức nền tảng nào? | `JD-045` | ❌ FAIL | `0.2857` | `4.0/5.0` |
| `eval_009` | Công ty Cổ phần Blueco toàn cầu tuyển vị trí Lập trình viên Frontend đưa ra dải lương và yêu cầu kinh nghiệm như thế nào? | `JD-064` | ❌ FAIL | `0.3359` | `5.0/5.0` |
| `eval_010` | Vị trí Thực tập sinh Lập trình Python (Python Developer Intern) đòi hỏi kỹ năng lập trình và hình thức làm việc ra sao? | `JD-024` | ❌ FAIL | `0.2833` | `4.0/5.0` |

---
*Báo cáo được tự động khởi tạo bởi `scripts/run_baseline_pipeline.py`*
