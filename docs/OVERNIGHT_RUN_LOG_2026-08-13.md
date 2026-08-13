# Nhật ký chạy không giám sát qua đêm — 2026-08-13

Phiên chạy: kết hợp 3 persona (`agent_plan` → `agent_code` → `agent_test`) trên nhánh `quan`, tại `C:\AI Thuc Chien\PROJECT\P-041`. Không commit git — toàn bộ thay đổi để nguyên ở working tree cho user xem lại sáng mai.

---

## 1. Tóm tắt nhanh (đọc trước nếu không có thời gian đọc hết)

- **2 việc đã quyết định (Phase 1)**: `requirements.txt` đã sửa xong, xác nhận `pip install` chạy sạch. `/cv/upload` **CHƯA sửa** — dừng lại vì tiền đề "không có test nào gọi route" trong yêu cầu là **sai**, xem mục 3.2.
- **Phát hiện nghiêm trọng ngoài dự kiến**: `src/frontend/app.js` và `src/frontend/app/page.tsx` có **conflict marker Git chưa resolve còn sống trong code đang chạy** (không phải chỉ `requirements.txt`). Đây là cú pháp JS/TSX không hợp lệ — đã tìm thấy, merge cẩn thận theo đúng ý đồ 2 bên, và xác nhận app chạy lại bình thường. Xem mục 3.1.
- **Bug Dashboard sync (đã biết) — ĐÃ SỬA và xác nhận qua browser**: Match Score / STAR Score trên Trang chủ giờ cập nhật đúng theo dữ liệu thật, cả khi tải lại trang lẫn ngay sau khi chạy phân tích/phỏng vấn mới, không cần reload.
- **2 bug mới tự phát hiện trong lúc test "Tìm việc"**: (a) thiếu 99 file dữ liệu JD doanh nghiệp trong `data/` do một commit "cleanup" trước đó xoá nhầm — đã khôi phục từ lịch sử git; (b) lỗi hiển thị "0.0% phù hợp" giả trên mọi JD chưa xếp hạng — đã sửa 1 dòng trong `app.js`.
- **1 việc phát hiện nhưng KHÔNG tự sửa** (ngoài tầm code): tính năng "AI lọc JD phù hợp theo CV" hiện trả về 0 kết quả vì Qdrant chưa được đồng bộ — nguyên nhân gốc là **quota Gemini API đã hết (429 RESOURCE_EXHAUSTED)** lúc backend khởi động, không phải lỗi code. Xem mục 3.4.
- **pytest cuối cùng: 184 passed, 0 failed** (từ baseline ban đầu 176 passed / 8 failed). `docker compose ps`: cả 6 service healthy/running.

---

## 2. Phase 0 — Đào sâu tìm gap so với spec

Đã đọc kỹ `CV_JD.md`, spec kỹ thuật (~3100 dòng), `cv_jd_pipeline.py` (982 dòng — không phải ~1286 dòng như ước tính cũ, có thể do đếm dòng khác thời điểm), `db/models.py`, `matches.py`, `job_rag.py`, `file_security.py`.

**Đối chiếu spec vs code — kết quả: hầu hết đã implement đúng, không phát hiện gap lớn mới:**

- **Evidence Status** (§53): `SUPPORTED / PARTIALLY_SUPPORTED / NOT_FOUND / CONFLICTING / UNCERTAIN` — implement đầy đủ, đúng logic (`cv_jd_pipeline.py` dòng ~605-610, 700-733, 807-813).
- **Skill Match Classification** (§55): `EXACT_MATCH / NORMALIZED_MATCH / SEMANTIC_MATCH / PARTIAL_MATCH / NOT_FOUND` — implement đầy đủ (dòng ~581-599), đúng nguyên tắc "C++ ≠ C#, Java ≠ JavaScript".
- **Rubric scoring** (§56-59): trọng số mặc định 35/30/10/10/15 khớp spec, validate `RUBRIC_001` khi tổng trọng số enabled ≠ 100% (dòng ~774-776) — đúng tinh thần `RUBRIC_INVALID_WEIGHT` của spec (khác tên mã lỗi nhưng cùng chức năng).
- **Versioning** (§87): cả 9 trường `pipeline/cv_schema/jd_schema/normalization/chunking/embedding_model/retrieval/rubric/scoring` đều có trong `result["versions"]` (dòng ~969-979) — đầy đủ, không thiếu trường nào như đánh giá cũ từng nghi ngờ.
- **Error codes** (§83-84): đối chiếu 16 mã lỗi tối thiểu trong spec với code — có `UPLOAD_001/002/003/004`, `PARSER_001/002/003`, `OCR_001`, `EXTRACTION_001`, `EMBEDDING_001`, `RUBRIC_001`, `EVALUATION_001`, `MATCH_001` đều xuất hiện đúng chỗ.

**Gap nhỏ thật sự còn sót (không chặn demo, ghi nhận để biết):**
1. `EXTRACTION_002` (schema validation failed), `VECTOR_001`, `BM25_001`, `FUSION_001` không có mã lỗi riêng — nếu các bước này lỗi nội bộ, sẽ rơi về `EVALUATION_001` mặc định (do `except Exception` bắt chung trong `matches.py::_process_match`). Không gây mất chức năng, chỉ kém chi tiết khi debug.
2. `matches.py::_process_match` chỉ set `match.status`/`current_step` ở 2 mốc `PARSING`→`EVALUATING` ra ngoài API, dù nội bộ `processing_trace` có đủ 8 bước (`PENDING/PARSING/EXTRACTING/NORMALIZING/CHUNKING/INDEXING/RETRIEVING/EVALUATING/COMPLETED`). Cosmetic, đã ghi nhận từ lần trước, vẫn đúng như vậy.
3. Tài liệu `ARCHITECTURE.md`, `docs/architecture_diagram.md`, `JOURNAL.md`, `WORKLOG.md` vẫn là template rỗng (không thuộc phạm vi code, không đụng tới).

**Kết luận Phase 0**: đánh giá "hầu hết spec đã implement" từ lần trước được xác nhận lại chính xác qua một lượt đọc kỹ thứ hai. Không có gap tích hợp/liêm chính (no-fabrication, HITL) nào bị vi phạm.

---

## 3. Phase 1 & phát hiện phát sinh trong lúc làm

### 3.1. PHÁT HIỆN NGOÀI DỰ KIẾN — conflict marker sống trong `app.js` và `page.tsx`

Trong lúc điều tra bug Dashboard sync (đọc `renderInlineCVAnalysis` trong `app.js`), phát hiện **5 khối `<<<<<<< HEAD / ======= / >>>>>>> 9f4ac042...` chưa resolve** trong `src/frontend/app.js` (quanh dòng 2119-2283 trong hàm `renderInlineCVAnalysis`, và dòng 3284-3308 trong handler `pageBtnRunGap`), và **1 khối tương tự trong `src/frontend/app/page.tsx`** (dòng 983-1107, toàn bộ section "VIEW: GAP ANALYSIS" cũ).

Đây là cú pháp không hợp lệ (`<<<<<<< HEAD` không phải JS/TSX hợp lệ) nằm ngay trong file đang được Next.js dev server phục vụ — nghiêm trọng hơn nhiều so với `requirements.txt` (vốn không được Docker build dùng tới, xem mục 5).

**Cách xử lý — đọc kỹ cả 2 phía trước khi merge, không đoán:**
- `app.js` dòng ~2119-2283: phía HEAD là bản đã fix null-guard (`applyDomField()` + `missingIds` + toast lỗi, đúng như bug đã ghi nhận "Fixed and confirmed 2026-08-12"); phía kia (hash `9f4ac042`) là bản có nhiều trường render hơn (confidence summary, score breakdown, criteria list, evidence matrix, soft skills, certifications, projects, suggestions, guardrail status) — đúng những field mà `page.tsx` đã có sẵn DOM id và test `test_gap_analysis_replaces_static_roadmap_with_evidence_backed_detail` đòi hỏi. **Đã merge cả 2**: giữ pattern `applyDomField`/`missingIds` (an toàn, đã xác nhận qua test trước) cho các trường HEAD phụ trách, giữ nguyên toàn bộ logic render mở rộng của phía kia, không trùng lặp, không mất field nào.
- `app.js` dòng ~3284-3308 (`pageBtnRunGap`): tương tự, đã merge và đổi các lệnh `document.getElementById(...).innerHTML = ...` trần (không an toàn) sang `applyDomField(...)` cho nhất quán.
- `page.tsx` dòng 983-1107: phía HEAD là toàn bộ section `<section id="view-gap">` cũ (trajectory-roadmap-card, `page-gap-select-cv`, `page-btn-run-gap`...); phía kia là **rỗng** (đã xoá hẳn section này). Test `test_gap_analysis_replaces_static_roadmap_with_evidence_backed_detail` và `test_inline_analysis_and_interview_dropdown_contract_are_present` (2 test đang FAIL từ trước) khẳng định rõ ý đồ: section cũ này phải bị xoá, thay bằng luồng inline dropdown mới (`cv-analysis-cv-select`/`cv-analysis-jd-select`). **Đã xoá theo đúng ý đồ đó** — khớp 100% với 2 test đang fail.

**Xác nhận sau khi sửa:**
- `node --check src/frontend/app.js` → cú pháp hợp lệ.
- `docker compose build frontend` → Next.js build + type-check thành công (`✓ Compiled successfully`, `✓ Generating static pages (4/4)`).
- `pytest tests/test_frontend/` → 20/20 pass (trước đó 18/20, 2 fail đúng là 2 test nói trên).
- Test trực tiếp trên browser: Gap Analysis chạy xong hiển thị đầy đủ tất cả các trường mới (score breakdown, matching skills, guardrail status...) không lỗi console, không crash — xem mục 4.

**Vì sao đáng lưu ý**: đây gần như chắc chắn là hậu quả của một lần merge/rebase Git chưa hoàn tất trước khi giao máy cho phiên chạy đêm nay (cùng hash `9f4ac042a3ecb6bfd71ff85a6cab3f07893b59ee` xuất hiện ở tất cả conflict marker, kể cả trong `requirements.txt`). Nên kiểm tra lại toàn repo có còn sót conflict marker nào khác không trước khi merge nhánh `quan` vào `develop`.

### 3.2. Fix #1 — `requirements.txt`: ĐÃ XONG

Gỡ marker `<<<<<<< HEAD / ======= / >>>>>>>`, giữ cả 2 khối `pgvector`/`sentence-transformers` và `qdrant-client` theo đúng yêu cầu.

**Lưu ý nhỏ cần biết**: tự grep lại `pgvector`/`sentence_transformers`/`SentenceTransformer` trong toàn bộ `src/` thì **không tìm thấy chỗ nào import 2 package này** (không có cột kiểu `Vector` trong `db/models.py`, không có `from pgvector...` hay `SentenceTransformer(...)` ở đâu cả). Yêu cầu ban đầu nói "đã xác minh cả 2 đều được import trong code" — điều này **không khớp** với những gì tôi tự kiểm tra được. Đã **vẫn giữ cả 2 package theo đúng chỉ đạo** (rủi ro thấp, chỉ là cài thêm dependency không dùng tới, không ảnh hưởng an toàn/bảo mật) nhưng ghi chú lại đây để user biết và cân nhắc bỏ nếu xác nhận đúng là không dùng.

**Kiểm tra**: `.venv/Scripts/python.exe -m pip install -r requirements.txt` chạy xong không lỗi cú pháp, cài đặt thành công toàn bộ dependency.

**Không cần rebuild Docker** cho fix này — `Dockerfile` build backend dùng `requirements-prod.txt` (không có conflict marker), không đụng tới `requirements.txt` (file này chỉ phục vụ dev cục bộ / `pytest`).

### 3.3. Fix #2 — `/cv/upload` (route `POST /cv/upload` gọi `parse_cv()` bịa dữ liệu): **DỪNG LẠI, CẦN USER XÁC NHẬN**

Yêu cầu nói: *"Đã xác nhận (grep toàn bộ src/frontend/, tests/, docs/, scripts/) không có bất kỳ nơi nào gọi route này — an toàn để đổi hành vi."*

**Tự kiểm tra lại thấy điều này SAI**: 3 file test đang **thực sự gọi và phụ thuộc route này**, và cả 3 đang **pass** (17/17 trong bộ test liên quan trước khi tôi đụng vào):
- `tests/test_guardrails/test_anti_fabrication.py::test_empty_cv_triggers_clarification_not_fabrication` (guardrail G-007, mock `cv_parser.parse_cv` trả CV rỗng, expect `200` + `needs_clarification`).
- `tests/test_e2e/conftest.py::uploaded_cv` fixture (mock `parse_cv`, expect `200` + `cv_id`) — fixture này được **toàn bộ chuỗi test `WF1-001` → `WF1-006`** trong `tests/test_e2e/test_workflow_cv_optimize.py` phụ thuộc (fixture chaining: upload → analyze → accept/reject → export).
- `tests/test_e2e/test_workflow_error_recovery.py::test_wf2_invalid_upload_leaves_no_ghost_cv_id` (`WF2-001`), expect status `404` hoặc `415` — không có `501` trong danh sách chấp nhận.

Nếu đổi route sang trả `501` không điều kiện như yêu cầu, các test trên **sẽ fail ngay** — vi phạm trực tiếp câu tiếp theo trong cùng yêu cầu: *"Sau Phase 1: chạy pytest tests/ -q ... xác nhận không có gì vỡ."* Đây là mâu thuẫn thật giữa 2 phần của cùng 1 yêu cầu, không phải tôi tự đặt ra rào cản.

**Theo đúng ranh giới an toàn đã được giao** ("nếu gặp việc mơ hồ... DỪNG lại, ghi rõ 'cần user xác nhận', KHÔNG tự đoán và làm liều") — tôi **không sửa `src/api/routes.py`**, giữ nguyên hành vi hiện tại của route (vẫn gọi `parse_cv()` bịa dữ liệu, dead code không được frontend thật gọi tới).

**3 phương án cho user chọn vào sáng mai:**
1. Giữ nguyên route như hiện tại (đã có test bao phủ, không ảnh hưởng demo vì frontend không gọi).
2. Đổi route sang lỗi rõ ràng (501) **và đồng thời sửa 3 file test trên** để phản ánh quyết định deprecate — nhưng đây là thay đổi test guardrail chống bịa dữ liệu (G-007) và toàn bộ luồng E2E workflow, nên cần user xác nhận rõ ràng trước khi động vào, không tự ý sửa test thay đổi ý nghĩa bài test.
3. Thay `parse_cv()` bằng một implementation thật (dùng lại pipeline đã có ở `src/services/cv_jd_pipeline.py`/`file_security.py` thay vì dữ liệu cứng) — vá đúng gốc rễ (fabrication) mà vẫn giữ test pass, nhưng đây là việc lớn hơn phạm vi 1 bug fix, cần lên kế hoạch riêng (`agent_plan`).

### 3.4. Phát hiện thêm trong Phase 2 — chưa/không tự sửa

**"AI lọc JD phù hợp theo CV" trả về 0 kết quả — nguyên nhân gốc: hết quota Gemini API.** Đọc log backend (`docker compose logs backend`) thấy khi container khởi động, `sync_market_jobs_safely()` cố đồng bộ 98 JD vào Qdrant nhưng lỗi:
```
google.genai.errors.ClientError: 429 RESOURCE_EXHAUSTED — "You exceeded your current quota, please check your plan and billing details."
```
→ Qdrant collection `market_job_descriptions` tồn tại nhưng `points_count: 0` (xác nhận qua `curl http://localhost:6333/collections/market_job_descriptions`). Khi sinh viên chọn CV để AI xếp hạng, code luôn thử Qdrant trước (không fallback nếu Qdrant trả về hợp lệ nhưng rỗng, chỉ fallback khi có exception) → luôn ra 0 JD.

**Không tự sửa vì**: đây là giới hạn dịch vụ ngoài (quota Gemini, "kiểm soát chi phí" là ràng buộc cứng của dự án) — không phải bug code, và chờ quota reset là hướng xử lý tự nhiên. Việc sửa logic fallback (vd: tự phát hiện "collection rỗng → dùng catalog nội bộ thay vì trả 0") là thay đổi hành vi cost/UX cần quyết định sản phẩm, không tự ý làm.

**Gợi ý cho sáng mai**: sau khi quota Gemini reset (hoặc kiểm tra lại billing plan), chạy `docker compose exec backend python scripts/index_market_jds.py` (cần thêm bước copy `scripts/` vào image, hiện Dockerfile không copy thư mục này) hoặc gọi `POST /api/v1/jobs/rag/sync` (yêu cầu role admin) để đồng bộ lại thủ công. Chế độ tìm việc **không cần AI** (duyệt theo từ khoá, không chọn CV) vẫn hoạt động bình thường (98 JD hiển thị đầy đủ).

---

## 4. Phase 2 — Kết quả vòng lặp test-sửa-test qua trình duyệt

**Lưu ý về công cụ**: Claude in Chrome (extension, phiên đã đăng nhập sẵn) **không kết nối được** trong phiên chạy đêm này (không có user để xác thực extension). Đã chuyển sang dùng **Claude Browser pane** (công cụ nội bộ có sẵn) và đăng ký **1 tài khoản test sinh viên tổng hợp cục bộ** qua `POST /api/v1/auth/register` (email `qa.overnight.student.20260813@mailinator.com`, dữ liệu 100% giả lập, chỉ tồn tại trong DB Postgres cục bộ của Docker) — phù hợp với đúng nguyên tắc `agent_test.md` đã quy định ("Dữ liệu test/demo dùng CV và JD giả lập"). Toàn bộ tương tác UI được lái qua JS thực thi trực tiếp trong trang (click/submit event thật trên DOM thật của `app.js`/`page.tsx` đang chạy) do accessibility-tree của Claude Browser pane không hiển thị nội dung modal trong môi trường headless này.

### Vòng 1 (vòng duy nhất cần thiết — sạch lỗi sau khi sửa)

| Luồng test | Trước | Sau |
|---|---|---|
| Dashboard sync (Match Score / STAR Score) | Bug đã biết: kẹt cứng "85%"/"82/100" | **ĐÃ SỬA**, xác nhận qua reload lẫn cập nhật live không cần reload (86.3%→86%, rồi 46.8%→47%; STAR 67.91→68/100) |
| Gap Analysis chi tiết | Chưa test do 5 conflict-marker JS/TSX chặn build | **ĐÃ SỬA conflict marker**, chạy 2 lần với 2 JD khác nhau, tất cả field mới (score breakdown, guardrail, confidence summary...) render đúng, không crash, không lỗi console |
| Lịch sử & Báo cáo | Đã fix lần trước | **Ổn định**, hiển thị đúng cả 2 lần phân tích CV + 1 phiên phỏng vấn vừa chạy |
| Chatbot Nova | Chưa test lần trước | **Hoạt động đúng**: trả lời thật từ Gemini, không bịa, hỏi lại thông tin còn thiếu thay vì đoán |
| Tìm việc / Danh sách JD | Chưa test lần trước | Phát hiện 2 bug mới (xem mục 3.4 và bug hiển thị "0.0%" giả — **đã sửa** phần code được, phần quota Gemini **không tự sửa**) |
| Phòng phỏng vấn STAR | Test qua API (start → 3 câu hỏi + follow-up → report), UI phòng phỏng vấn load không lỗi console | Hoạt động đúng, dùng Gemini thật, không lặp câu hỏi |

**Root cause của từng bug tìm thấy trong Vòng 1:**
1. **Dashboard sync**: xác nhận đúng nghi phạm đã nêu — `app.js` chỉ có `gauge-cv-label`/`gauge-interview-label` là string tĩnh trong dictionary đa ngôn ngữ, **không có bất kỳ hàm nào** từng fetch dữ liệu thật rồi ghi đè 2 span này. Đây không phải "bug logic bị lỗi" mà là **tính năng chưa từng được nối dây** (dashboard tổng quan cho student chưa từng gọi API lấy điểm mới nhất).
2. **"0.0% phù hợp" giả trên JD chưa xếp hạng**: `Number(null)` → `0` → `Number.isFinite(0)` → `true`, khiến điều kiện `hasMatchScore` sai khi `job.match_score` thực chất là `null` (chưa xếp hạng).
3. **"Tìm việc" trả về 0 JD hoàn toàn** (trước khi sửa): `data/jds/raw/*.html` (98 file) và `data/clean/jds_clean.json` bị xoá khỏi git ở commit `69bcd64` ("cleanup" — có vẻ không cố ý, vì message không nhắc gì tới việc xoá dữ liệu JD), trong khi `src/services/job_catalog.py::load_enterprise_job_catalog()` đọc trực tiếp 2 đường dẫn này lúc runtime.

**Cách sửa:**
1. Thêm `refreshDashboardOverview()` + `updateDashboardGaugeScores()` + `GAUGE_LABEL_PREFIX` (map 5 ngôn ngữ) vào `app.js`, gọi ở 3 điểm: `checkUserSession()` (khi login/tải trang, chỉ áp dụng cho role student), ngay sau `renderInlineCVAnalysis()` thành công trong luồng "Phân tích CV", và ngay sau khi `loadSTARReport()` tải xong báo cáo phỏng vấn. Lấy dữ liệu qua 2 API đã có sẵn (`ApiClient.getAnalysisHistory()`, `ApiClient.listInterviews()`), không thêm endpoint mới.
2. Sửa 1 dòng: `hasMatchScore = job.match_score !== null && job.match_score !== undefined && Number.isFinite(Number(job.match_score))`.
3. Khôi phục 99 file từ lịch sử git bằng `git checkout 5e90b4a -- data/jds/raw data/clean/jds_clean.json` (commit gốc đã thêm đúng các file này, xác nhận không có commit nào khác sửa lại nội dung giữa 2 lần đó) — không phải tạo dữ liệu mới, chỉ khôi phục dữ liệu cũ đã từng được duyệt/commit.

**Không phát hiện thêm lỗi nào khác sau khi sửa 3 việc trên** — dừng vòng lặp ở Vòng 1 vì đã sạch lỗi (theo đúng điều kiện dừng "dừng nếu sạch" trong yêu cầu), không cần dùng hết 6 vòng cho phép.

---

## 5. Danh sách file đã thay đổi

| File | Loại thay đổi |
|---|---|
| `requirements.txt` | Gỡ conflict marker, giữ cả 2 khối dependency |
| `src/frontend/app.js` | Gỡ 5 khối conflict marker (merge cẩn thận theo ý đồ 2 bên) + thêm `refreshDashboardOverview()`/`updateDashboardGaugeScores()`/`GAUGE_LABEL_PREFIX` + gọi hàm này ở 3 điểm + sửa 1 dòng `hasMatchScore` |
| `src/frontend/app/page.tsx` | Gỡ 1 khối conflict marker — xoá hẳn section `view-gap` cũ (trajectory roadmap + dropdown cũ), khớp đúng ý đồ nhánh mới và 2 test đang chờ |
| `data/jds/raw/JD-001.html` … `JD-098.html` (98 file) | Khôi phục từ git history (commit `5e90b4a`), bị xoá nhầm ở commit `69bcd64` |
| `data/clean/jds_clean.json` | Khôi phục từ git history, cùng lý do trên |

**Docker image đã rebuild** (không phải thay đổi file nguồn, ghi chú để user biết trạng thái container): `career-assistant-frontend` (2 lần — sau khi sửa conflict marker, và sau khi sửa dashboard sync + hasMatchScore), `career-assistant-backend` (1 lần — sau khi khôi phục data JD). Gateway (`nginx`) đã restart 3 lần để nhận IP container mới (nginx cache DNS upstream lúc start, không tự resolve lại).

**Không đụng tới**: `src/api/routes.py` (fix #2 dừng lại, xem mục 3.3), `.env`, `.ai-log/`, hooks, không commit git.

---

## 6. Việc cần user xác nhận (tổng hợp)

1. **`/cv/upload` route** (mục 3.3) — chọn 1 trong 3 phương án, vì tiền đề ban đầu ("không test nào gọi route") sai và đổi route sẽ làm vỡ test guardrail G-007 + toàn bộ chuỗi E2E workflow WF1.
2. **`pgvector`/`sentence-transformers` trong `requirements.txt`** (mục 3.2) — đã giữ theo chỉ đạo, nhưng tự grep không thấy chỗ nào import 2 package này trong `src/`. Xác nhận lại có thật sự cần không, hay có thể bỏ.
3. **Qdrant/Gemini quota cho "Tìm việc bằng CV"** (mục 3.4) — chờ quota Gemini reset hoặc kiểm tra billing, sau đó chạy lại `scripts/index_market_jds.py` (cần thêm bước copy `scripts/` vào Docker image, hoặc chạy cục bộ với `QDRANT_ENABLED=true QDRANT_URL=http://localhost:6333`).
4. **Nên kiểm tra lại toàn bộ repo có còn sót conflict marker Git nào khác** trước khi merge `quan` vào `develop` — tối thiểu 3 file (`requirements.txt`, `app.js`, `page.tsx`) đều dính cùng 1 merge chưa hoàn tất (hash `9f4ac042...`), rất có thể còn sót ở nơi khác chưa được rà.
5. **99 file JD vừa khôi phục đang ở trạng thái staged** (`git add`) nhưng **chưa commit** — nếu đồng ý khôi phục là đúng, cần tự `git commit` vào sáng mai (đã tuân thủ tuyệt đối không tự commit).

---

## 7. Trạng thái cuối

- **pytest**: `184 passed, 0 failed` (baseline đầu phiên: `176 passed, 8 failed`; các fail cũ đều đã hết sau khi sửa conflict marker + khôi phục data JD).
- **docker compose ps**: `backend` (healthy), `db` (healthy), `clamav` (healthy), `gateway` (healthy), `qdrant` (running, không có healthcheck riêng), `frontend` (running, không có healthcheck riêng — xác nhận sống qua gateway + test UI trực tiếp).
- **Console browser**: sạch lỗi JS ngoài các lỗi tự gây ra lúc test (401/422/403 từ chính các request thử nghiệm sai có chủ đích của tôi, không phải lỗi ứng dụng thật).
- **Dữ liệu test tồn tại trong DB cục bộ** (không ảnh hưởng dữ liệu thật): 1 tài khoản `qa.overnight.student.20260813@mailinator.com` (role student), 1 CV tổng hợp "QA Overnight Test CV", 2 lượt Gap Analysis, 1 phiên phỏng vấn STAR 3 câu hỏi đã hoàn thành. User có thể xoá qua Admin panel nếu muốn dọn dẹp trước demo, hoặc giữ lại làm dữ liệu regression-test tham khảo.
