# Evaluation Evidence — Deliverable #10

> **Dự án**: P-041 — Career Assistant X  
> **Chương trình**: VinUni AI20K Build Phase — Cohort 3  
> **Nguyên tắc báo cáo**: Mọi số liệu pass/fail đều trích xuất trực tiếp từ output lần chạy kiểm thử thực tế. Không suy diễn, không tạo bằng chứng giả.

---

## 1. Tổng quan Bằng chứng Đánh giá

| Loại bằng chứng | Số lượng | Nguồn | Trạng thái |
|---|---|---|---|
| Backend pytest (unit + integration + agent) | **740+** tests | `backend/tests/` (49 files test) | ✅ All green |
| Frontend Jest (UI contracts + components) | **159** tests | `backend/tests/test_frontend/` | ✅ All green |
| CV Parser golden eval (synthetic bilingual) | **50/50** assertions, 10 cases | [`eval/results/cv_parser_report.json`](../eval/results/cv_parser_report.json) | ✅ 100% pass |
| CV–JD Matching pipeline golden dataset | **14/15** cases pass (93.3%) | [`eval/results/cv_jd_report.json`](../eval/results/cv_jd_report.json) | ✅ Pass |
| Top-K Candidate Retrieval Benchmark | 52 CV × 98 JD, K=30 optimal | [`eval/results/top_k_benchmark_report.json`](../eval/results/top_k_benchmark_report.json) | ✅ Completed |
| V1 CV–JD Semantic Matching Audit | 2 cases (1 REAL + 1 SYNTHETIC) | [`eval/results/v1_eval_report.json`](../eval/results/v1_eval_report.json) | ✅ Completed |
| User Top-JD Benchmark (user-specific ranking) | 10 label cases | [`eval/user_top_jd_benchmark/TEST_EVIDENCE.md`](../eval/user_top_jd_benchmark/TEST_EVIDENCE.md) | ✅ Pass |
| Manual System Test (Gate 2, 6 test cases) | 6/6 Pass | [`eval/MANUAL_TEST_EVIDENCE.md`](../eval/MANUAL_TEST_EVIDENCE.md) | ✅ 6/6 Pass |

---

## 2. Kiểm thử Tự động (Automated Testing)

### 2.1. Backend — Pytest Suite (740+ tests)

**Thư mục**: [`../backend/tests/`](../backend/tests/) — 49 test files, 7 sub-directories.

Các nhóm test chính:

| Nhóm kiểm thử | File đại diện | Mô tả |
|---|---|---|
| CV Parser | `test_cv_jd_pipeline.py`, `test_cv_normalization_pipeline.py`, `test_cv_retrieval.py` | Trích xuất cấu trúc CV, chuẩn hóa dữ liệu |
| Matching Engine | `test_dynamic_scoring_spec.py`, `test_semantic_matching_v1.py`, `test_scoring_safety.py` | FitScore tất định, rubric 5 thành phần |
| Final Ranking | `test_final_ranking.py`, `test_mandatory_gate.py`, `test_ranker.py` | Mandatory gate, tie-breaking |
| Recommendation | `test_recommendation_service.py`, `test_job_recommendations_api.py` | Top-K pipeline end-to-end |
| RRF Retrieval | `test_rrf.py`, `test_bm25_retriever.py`, `test_semantic_retriever.py` | Hybrid BM25 + Vector search |
| Voice Interview | `test_voice_orchestrator.py`, `test_voice_orchestrator_phase_hint.py`, `test_interview_agenda.py` | STAR 6-phase state machine |
| Agent Guardrail | `test_guardrails/` | Chống prompt injection, data leakage |
| API | `test_api/` | REST endpoints, JWT auth, RBAC |
| UI Contracts | `test_frontend/test_ui_contracts.py` | Ràng buộc hợp đồng frontend–backend |
| Security | `test_file_security.py` | ClamAV stream scan, file type validation |
| V1 Evaluation | `test_v1_evaluation.py` (47 KB), `test_cv_jd_spec_v1.py` | Kiểm định pipeline v1 |

**Lệnh chạy**:
```bash
cd backend
python -m pytest -q --tb=short
```

### 2.2. Frontend — Jest Suite (159 tests)

**Thư mục**: [`../backend/tests/test_frontend/`](../backend/tests/test_frontend/)

**Lệnh chạy**:
```bash
cd frontend
npm run test -- --watchAll=false
```

---

## 3. Đánh giá Chất lượng Model (Model Quality Evaluation)

### 3.1. CV Parser — Synthetic Bilingual Fixtures

> **Nguồn**: [`eval/results/cv_parser_report.json`](../eval/results/cv_parser_report.json)  
> **Thời điểm**: 2026-08-16T15:45:32Z

| Metric | Kết quả |
|---|---|
| Số lượng test cases | 10 (song ngữ Anh–Việt) |
| Tổng số assertions | 50 |
| Assertions passed | **50/50** |
| Accuracy | **100.0%** |
| Các trường kiểm tra | name, email, phone, skills, sections |

> ⚠️ Fixtures tổng hợp dùng để kiểm tra hồi quy; cần bộ CV thực có nhãn để đưa ra claim độ chính xác production.

### 3.2. CV–JD Matching Pipeline — Golden Dataset (15 cases)

> **Nguồn**: [`eval/results/cv_jd_report.json`](../eval/results/cv_jd_report.json)  
> **Pipeline version**: 1.0

| Metric | Kết quả |
|---|---|
| Tổng số test cases | 15 |
| Cases passed | **14/15** |
| Pass rate | **93.33%** |
| Score separation — positive_mean | **84.7** điểm |
| Score separation — negative_mean | **0.0** điểm (phân tách hoàn hảo) |
| FitScore formula | 0.35×Skills + 0.30×Exp + 0.10×Edu + 0.10×Pref + 0.15×Domain |

Ví dụ case điển hình:

| Case ID | Match Score | Match Level | Result |
|---|---|---|---|
| `high_backend` | **86.1** | `high_match` | ✅ Pass |
| `partial_database_alias` | **62.5** | `application_ready` | ✅ Pass |

### 3.3. Top-K Candidate Retrieval Benchmark

> **Nguồn**: [`eval/results/top_k_benchmark_report.md`](../eval/results/top_k_benchmark_report.md)  
> **Thời điểm**: 2026-08-24T17:00:33Z  
> **Tập chuẩn**: 52 CV profiles × 98 JD catalog

| K | Recall@K | nDCG@10 | MRR | Precision@3 | Latency Mean | Latency P95 |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| K=10 | 35.2% | 0.4153 | 0.5643 | 44.2% | 1271 ms | 2020 ms |
| K=20 | 55.2% | 0.3275 | 0.4209 | 24.4% | 1016 ms | 1438 ms |
| **K=30** *(optimal)* | **71.7%** | 0.1948 | 0.2778 | 16.0% | **863 ms** | **1153 ms** |
| K=50 | 87.1% | 0.0632 | 0.2025 | 8.3% | 1548 ms | 1979 ms |

**Kết luận**: K=30 được chọn làm cấu hình tiêu chuẩn — Recall cao nhất trong ngưỡng SLA P95 < 1.5s.

### 3.4. V1 CV–JD Semantic Matching Audit

> **Nguồn**: [`eval/results/v1_eval_report.json`](../eval/results/v1_eval_report.json)  
> **Thời điểm**: 2026-08-29T08:18:28Z  
> **Cases**: 2 (1 REAL + 1 SYNTHETIC)

| Metric | Overall | REAL | SYNTHETIC |
|---|:---:|:---:|:---:|
| Recall@3 (RRF) | **0.8571** | 1.0000 | 0.8000 |
| Recall@5 (RRF) | **0.9286** | 1.0000 | 0.9000 |
| MRR | 0.5238 | 0.4167 | 0.5667 |
| Evidence Macro F1 | **0.7949** | 0.6667 | 1.0000 |
| NO_EVIDENCE FP Rate | **0.00%** | 0.00% | 0.00% |
| Requirement Outcome Accuracy | **100%** | 100% | 100% |
| Critical Gap F1 | **1.0000** | 1.0000 | — |

**Phân tích retrieval theo tầng** (7 queries):

| Tầng Retrieval | Recall@3 | Recall@5 | MRR | nDCG@5 |
|---|:---:|:---:|:---:|:---:|
| 1. Lexical BM25 | 0.8571 | 0.9286 | 0.4524 | 0.5866 |
| 2. Dense Vector | 0.0714 | 0.0714 | 0.1429 | 0.0876 |
| 3. RRF Hybrid Fusion | 0.8571 | 0.9286 | 0.5238 | 0.6117 |
| **4. Final Evidence Selection** | **0.9286** | **0.9286** | **1.0000** | **0.9103** |

**Lỗi phát hiện**: 1/8 requirements (12.5%) — `SEMANTIC_VALIDATION_ERROR` (phân loại quan hệ DIRECT thành NO_EVIDENCE).

---

## 4. Kiểm thử Thủ công (Manual Testing — Gate 2)

> **Nguồn**: [`eval/MANUAL_TEST_EVIDENCE.md`](../eval/MANUAL_TEST_EVIDENCE.md)  
> **Thời điểm**: 2026-08-16  
> **Phạm vi**: Full-Stack (FastAPI + Next.js + PostgreSQL + JWT + RAG + Gemini)

| ID | Luồng chức năng | Endpoint | Kết quả | Đánh giá |
|---|---|---|---|:---:|
| TC-01 | System Health & DB Readiness | `GET /health`, `/ready`, `/api/v1/status` | `HTTP 200`, `status: ok`, `database: ready`, agents loaded | **Pass** |
| TC-02 | Student Auth Lifecycle (Register & Login) | `POST /api/v1/auth/register`, `/login` | `HTTP 201` (User ID mới), `HTTP 200` (Bearer JWT) | **Pass** |
| TC-03 | CV Document Parsing & Section Extraction | `POST /api/v1/cv/upload` (test_cv.pdf) | Skills trích xuất đầy đủ, ATS score `0.94` | **Pass** |
| TC-04 | Deterministic CV–JD Evidence Matching | Evidence Engine pipeline | Match score `88.9%`, level `high_match`, must-have `100%`, 9-step trace | **Pass** |
| TC-05 | Enterprise Job Catalog & Top-K Retrieval | `GET /api/v1/jobs` | 98 JDs theo domain, skills, level | **Pass** |
| TC-06 | Mock Interview Session & STAR Evaluation | `POST /api/v1/interviews/start` + answer | Session khởi tạo, STAR rubric nhận diện phản hồi | **Pass** |

---

## 5. User Top-JD Benchmark (Ranking cá nhân hóa)

> **Nguồn**: [`eval/user_top_jd_benchmark/TEST_EVIDENCE.md`](../eval/user_top_jd_benchmark/TEST_EVIDENCE.md)  
> **CV snapshot**: `e674cfad33dc49f4b54937ead9cee86a`

| Metric | Kết quả |
|---|---|
| Action Quality (AQ) | **6/6** cases pass (AQ-01 → AQ-06) |
| Ranking Justice (RJ) | **5/5** cases pass (RJ-01 → RJ-05) |
| Verdict & Label (VL) | **Pass 100% VL-01 → VL-08** |
| Mandatory Gate FNR (v7) | **28.57%** → cải tiến từ 90% (baseline) |
| Precision@3 (v6 relabel) | **1.000** |
| MRR (v6 relabel) | **1.000** |
| nDCG@10 (v6 relabel) | **0.9494** |

---

## 6. Kiểm tra Tĩnh (Static Analysis & Code Quality)

| Công cụ | Lệnh | Kết quả |
|---|---|---|
| **Ruff** (Python linter) | `python -m ruff check src tests` | ✅ 0 lỗi, 0 cảnh báo |
| **ESLint** (TypeScript/React) | `npm run lint` | ✅ No ESLint warnings or errors |
| **TypeScript** | `npm run typecheck` | ✅ 0 type errors |
| **Next.js Build** | `npm run build` | ✅ Build thành công |
| **AI Logging** | LangSmith trace | ✅ Toàn bộ LLM call được ghi vết |

---

## 7. Bằng chứng theo thư mục

| Thư mục / File | Nội dung |
|---|---|
| [`../eval/MANUAL_TEST_EVIDENCE.md`](../eval/MANUAL_TEST_EVIDENCE.md) | 6 kịch bản kiểm thử thủ công full-stack, output thực tế |
| [`../eval/results/cv_parser_report.json`](../eval/results/cv_parser_report.json) | 10 cases parser, 50/50 assertions |
| [`../eval/results/cv_jd_report.json`](../eval/results/cv_jd_report.json) | 15 matching cases, 14/15 pass |
| [`../eval/results/top_k_benchmark_report.md`](../eval/results/top_k_benchmark_report.md) | Benchmark K=10/20/30/50 trên 52×98 |
| [`../eval/results/v1_eval_report.md`](../eval/results/v1_eval_report.md) | V1 semantic audit, confusion matrix |
| [`../eval/results/user_top_jd_benchmark_report_post_v7.json`](../eval/results/user_top_jd_benchmark_report_post_v7.json) | Kết quả ranking cá nhân hóa v7 |
| [`../eval/user_top_jd_benchmark/TEST_EVIDENCE.md`](../eval/user_top_jd_benchmark/TEST_EVIDENCE.md) | 40+ test cases ranking, live API validation |
| [`../eval/top_k_benchmark/golden_dataset.json`](../eval/top_k_benchmark/golden_dataset.json) | Golden set 52 CV profiles |
| [`../backend/tests/`](../backend/tests/) | 49 test files (740+ pytest), 7 sub-directories |
| [`../eval/results/manual_test_run_output.json`](../eval/results/manual_test_run_output.json) | Output JSON đầy đủ của lần chạy manual test |
