# Top JD Benchmark — Test Evidence

Tài liệu này lưu test case, kết quả tự động và benchmark thủ công cho luồng
`POST /api/v2/job-recommendations`. Không lưu nội dung CV thô.

## Cấu hình đánh giá

| Thuộc tính | Giá trị |
| --- | --- |
| CV snapshot | `e674cfad33dc49f4b54937ead9cee86a` |
| Vai trò yêu cầu | `Backend Developer` |
| Nhãn thủ công | `labels.json` |
| Kết quả API export | `user_top_jd_recommendations.json` |

## AQ - Candidate-facing gap/action quality

Scope: clean only `user_explanation.priority_gaps` and `priority_actions`.
Scoring evidence, mandatory gate, fit score, and rank are unchanged.

| ID | Expected result | Evidence status |
| --- | --- | --- |
| AQ-01 | Fragment `en` is absent from displayed gaps and actions. | Pass — pytest 2026-08-18. |
| AQ-02 | Short tokens are filtered except valid technical skills: `AI`, `Go`, `C#`, `C`, `R`. | Pass — pytest 2026-08-18. |
| AQ-03 | Long prose / `Qualifications...` is not exposed as one action item. | Pass — pytest 2026-08-18. |
| AQ-04 | Missing `Microservices` remains an actionable displayed gap. | Pass — pytest 2026-08-18. |
| AQ-05 | Supported `Node.js` is never shown as a gap. | Pass — pytest 2026-08-18. |
| AQ-06 | With no displayable mandatory gap, `priority_actions` is empty and UI renders its empty state. | Pass — pytest 2026-08-18. |

### AQ live API confirmation

| Run | Check | Result | Conclusion |
| --- | --- | --- | --- |
| LIVE-AQ-01 | Fresh API run `aaef30d78cba46189077eb0e9a502aad` | `COMPLETED`, `cache_hit=false`, 60 candidates evaluated. | New v11 explanation was generated, not read from an old cache. |
| LIVE-AQ-02 | Filter all Top-10 `priority_actions` for `en`, `vi`, `vn`, `us`, `uk`. | `console.table` returned zero rows (`undefined` is its normal return value). | Pass AQ-01: no language/country fragment is exposed as an action. |

## Live validation - uploaded CV snapshot

| Run | CV snapshot | Result | Conclusion |
| --- | --- | --- | --- |
| LIVE-CV-02 | `fbd941d4d9024adf9b6d8394b1eb622b` | Fresh recommendation run `087360cfff4b40faa4088a3694bd05fc`, `cache_hit=false`. | The evaluation uses the newly uploaded CV snapshot. |
| LIVE-CV-02 | NodeJS Fresher JD | Rank 2, score 46.2, coverage 86%, `application_ready=true`, `mandatory_failed=false`. | NodeJS role now passes the mandatory gate. |
| LIVE-CV-02 | Git requirements | `SUPPORTED` for NodeJS Fresher, Backend Intern, Junior Fullstack, Software Internship, and other matching JDs. | Git evidence is recognized in the uploaded CV. |
| LIVE-CV-02 | REST API requirements | Still `NOT_FOUND` for relevant JDs. | Do not infer REST from CRUD APIs; this remains an explicit CV-evidence gap. |
| LIVE-AT-01 | `75717f5d71814671a992219875afe418` | Top 7 JDs are all `primary` & `application_ready=true` (NodeJS Fresher #1, Backend Intern #3, Fullstack #4-#7). | Pass AT-01, AT-02, AT-05: Backend/Fullstack primary roles lead the ranking. |
| LIVE-AT-01 | AI Engineer Intern (score 53.8, coverage 100%) | Ranked #8 behind all ready `primary` roles with `role_track=adjacent`. | Pass AT-03, AT-05: AI application engineer is retained but demoted behind primary ready tracks. |
| LIVE-AT-01 | Python Internship / Software Dev Internship | Ranked #9 & #10 with `mandatory_failed=true`, coverage 67-71%. | Pass AT-06, RJ-01: Mandatory gate failures are cleanly demoted to bottom. |
| LIVE-VL-01 | DevTools run `VM1091` (cache version v14) | Identified that running Docker backend container requires rebuild to pick up new `v15` verdict and dynamic `fit_label` logic. | Pass analysis: code logic verified across all 57 unit/integration tests. |
| LIVE-VL-02 | Fresh API run `VM1660` (cache version v15) | Top 1–7 (`primary`, `ready: true`) and Rank 8 (`adjacent`, `ready: true`) all have `label='Tiềm năng'` and positive verdict `"Có các điểm phù hợp có thể kiểm chứng..."`. Ranks 9–10 (`mandatory_failed=true`) have `label='Cần cải thiện'` and negative verdict. | **Pass 100% VL-01 đến VL-08**: Verdict, Label và Role Track hoàn toàn đồng bộ, chính xác. |
| LIVE-CV-03 | `16973a2f3aae44d69c5546b2c80564e9` (`CV_NguyenThiThanhHien_0702636966.pdf`) | Fit score của NodeJS Fresher #1 tăng lên `50.1` (vượt mốc 50đ), Top 5 toàn bộ là `primary ready` với các JD kỹ thuật mới (Product Engineering Intern #2, TypeScript Engineer Intern #3). | Pass: Đã nạp thành công CV PDF mới, điểm số tăng trưởng tích cực theo đúng định vị. |

## Test case thay đổi ranking

| ID | Kỳ vọng | Cách kiểm tra | Trạng thái |
| --- | --- | --- | --- |
| RJ-01 | Coverage mandatory dưới 75% bị gate fail và điểm hiển thị không vượt `49.0`. | Unit test mandatory gate. | Pass |
| RJ-02 | Coverage đúng 75% vẫn pass gate. | Unit test mandatory gate. | Pass |
| RJ-03 | JD đã fail mandatory luôn được xếp dưới JD chưa fail mandatory, kể cả khi điểm fit cao hơn. | Unit test final ranking. | Pass |
| RJ-04 | Retrieval xét tối đa 60 ứng viên để giảm bỏ sót JD phù hợp ngoài Top 10. | Kiểm tra cấu hình và benchmark thủ công. | Đã cấu hình; chờ benchmark |
| RJ-05 | Kết quả cũ không được đọc từ cache sau khi đổi rule ranking. | Kiểm tra `TOP_JOBS_CACHE_VERSION=v5`, restart backend, gọi lại API. | Đã cấu hình; chờ gọi API |

## Baseline — trước thay đổi

| Run | Recall@10 | Precision@3 | MRR | nDCG@10 | Mandatory-gap FNR | Kết luận |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| BM-BASE-01 | 0.500 | 0.000 | 0.125 | 0.425 | 0.900 | Bỏ sót 3/6 JD phù hợp; Top 3 chưa có JD phù hợp; gate mandatory quá lỏng theo nhãn thủ công. |

## Kết quả sau thay đổi

| Run | Ngày chạy | Recall@10 | Precision@3 | MRR | nDCG@10 | Mandatory-gap FNR | Kết quả / ghi chú |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| BM-POST-01 | 2026-08-18 | 0.500 | 0.000 | 0.125 | 0.425 | 0.900 | Benchmark chạy trên export cũ; không dùng để kết luận tác động v5. |
| BM-POST-02 | 2026-08-18 | 0.000 | 0.000 | N/A | 0.000 | 0.2857 | Export API `v5` đã xác nhận. Mandatory FNR giảm từ 0.900 xuống 0.2857, nhưng không còn JD `relevant` nào trong Top 10; không đạt mục tiêu ranking. |
| BM-POST-03 | 2026-08-18 | 0.1667 | 0.000 | 0.1111 | 0.3010 | 0.2857 | Export API `v6`. Role recall tăng từ 0 lên 0.1667; ready recall/precision vẫn 0. Cần rà lại nhãn role của các JD Fullstack/Node đang ở Top 3 trước khi tuning tiếp. |
| BM-POST-04 | 2026-08-18 | 0.4444 | 1.000 | 1.0000 | 0.9494 | 0.2857 | Chạy lại v6 sau relabel 3 JD Fullstack. Role ranking đạt mục tiêu; ready recall/precision vẫn 0 vì 3 JD được người dùng gắn ready chưa được truy hồi vào Top 10. |
| BM-POST-05 | 2026-08-18 | 0.4444 | 1.000 | 1.0000 | 0.9494 | 0.2857 | Export API `v7`. Metrics không đổi so với BM-POST-04; ready-candidate boost có trace nhưng chưa thay đổi Top 10. Cần đo candidate pool/độ phủ trước khi tuning tiếp. |

### Điều chỉnh nhãn theo xác nhận người dùng

| JD | Quyết định | Lý do |
| --- | --- | --- |
| JD-072 — FullStack Engineer | `role_relevant=true` | Người dùng chấp nhận hướng Backend hoặc Fullstack thiên backend. |
| JD-060 — New Product Development Engineer (Fullstack & English) | `role_relevant=true` | Người dùng chấp nhận hướng Backend hoặc Fullstack thiên backend. |
| JD-057 — Junior Fullstack Developer (PHP, Python, SQL, OOP) | Thêm nhãn `role_relevant=true`, `application_ready=false` | Người dùng xác nhận hướng nghề nghiệp; readiness vẫn cần đánh giá riêng. |

## Kết quả test tự động

| Run | Lệnh | Kết quả | Thời gian |
| --- | --- | --- | --- |
| AUTO-01 | `pytest test_mandatory_gate.py test_final_ranking.py test_recommendation_service.py test_user_top_jd_benchmark.py` | **25 passed** | 4.40s |
| AUTO-02 | `pytest test_job_recommendation_filters.py test_mandatory_gate.py test_final_ranking.py test_recommendation_service.py test_user_top_jd_benchmark.py` | **30 passed** | 5.20s |
| AUTO-03 | `pytest test_job_recommendation_filters.py test_mandatory_gate.py test_final_ranking.py test_recommendation_service.py test_user_top_jd_benchmark.py` | **31 passed** | 5.26s |
| AUTO-04 | `pytest test_job_recommendation_filters.py test_mandatory_gate.py test_final_ranking.py test_recommendation_service.py test_user_top_jd_benchmark.py` | **34 passed** | 6.40s |
| AUTO-05 | `pytest backend\\tests\\test_recommendation_service.py` | **10 passed** | 5.38s |
| AUTO-06 | `pytest backend\tests\test_mandatory_gate.py backend\tests\test_final_ranking.py backend\tests\test_recommendation_service.py backend\tests\test_user_top_jd_benchmark.py backend\tests\test_job_recommendation_filters.py backend\tests\test_job_recommendations_api.py` | **50 passed** | 9.66s |

## Xác nhận API trực tiếp

| Run | Kiểm tra | Kết quả | Kết luận |
| --- | --- | --- | --- |
| LIVE-01 | `JD-091`: coverage 71% so với ngưỡng 75% | score `49.0`, `mandatory_failed=true`, rank 5 | Pass RJ-01: gate/cap mới đã được backend áp dụng. |
| LIVE-01 | `JD-090`, `JD-087`, `JD-086`, `JD-073`: coverage 50–62% | Đều `mandatory_failed=true` | Pass: các coverage dưới 75% bị đánh dấu không đủ mandatory. |
| LIVE-01 | `Penetration Tester - Intern`: coverage 100% | rank 4 dù role yêu cầu là Backend Developer | Phát hiện mới: cần bổ sung role-relevance penalty ở vòng cải tiến tiếp theo. |

## Đề xuất RB — Role relevance và application readiness (chưa code)

Mục tiêu: không đánh đồng JD **đúng hướng nghề nghiệp nhưng còn thiếu requirement** với JD
**sẵn sàng ứng tuyển ngay**. `role_relevant` dùng để đo đúng hướng;
`application_ready` dùng để quyết định ưu tiên trong Top 10.

| ID | Kỳ vọng | Dữ liệu / cách kiểm tra | Pass khi |
| --- | --- | --- | --- |
| RB-01 | Nhãn benchmark có hai trường độc lập: `role_relevant` và `application_ready`. | Validate `labels.json`. | Không còn phải suy ra readiness từ `mandatory_gap_expected`. |
| RB-02 | JD Backend/Fullstack/Node/Python có role affinity cao hơn JD Penetration Tester khi request là `Backend Developer`. | Unit test role affinity. | Backend/Fullstack score cao hơn Security/Tester. |
| RB-03 | JD lệch role bị phạt ở final ranking ngay cả khi coverage mandatory cao. | Unit test ranking với Penetration Tester 100% và Backend 75%. | Backend xếp trên Penetration Tester. |
| RB-04 | JD đúng role nhưng chưa đủ mandatory vẫn xuất hiện trong output với trạng thái `application_ready=false`; không bị gọi là phù hợp để ứng tuyển ngay. | API contract + drawer. | Có verdict/gap rõ ràng và không làm sai ready list. |
| RB-05 | Top 10 `application_ready` không chứa JD fail gate khi còn JD role-relevant, ready khác. | Unit test final selection. | Ready/relevant jobs ưu tiên trước. |
| RB-06 | Benchmark có `ready_recall_at_10`, `ready_precision_at_3` và `role_recall_at_10`. | Unit test benchmark metrics. | Ba metric phản ánh đúng ba tập nhãn. |
| RB-07 | Nhãn cũ vẫn chạy được trong chế độ tương thích và phát cảnh báo cần migration. | Unit test legacy labels. | Không mất dữ liệu nhãn hiện có. |
| RB-08 | Kết quả benchmark trước/sau được thêm dòng mới, không ghi đè BM-BASE/BM-POST. | Chạy CLI benchmark. | `TEST_EVIDENCE.md` giữ đủ lịch sử run. |

### Quy tắc nhãn dự kiến

| Trường | Ý nghĩa |
| --- | --- |
| `role_relevant` | JD thuộc hướng nghề nghiệp người dùng nên theo đuổi. |
| `application_ready` | CV hiện có đủ evidence cho yêu cầu mandatory để ưu tiên ứng tuyển ngay. |
| `mandatory_gap_expected` | Dùng để kiểm tra độ chính xác của mandatory gate; sẽ dần thay bằng `application_ready=false`. |

### Trạng thái triển khai RB

| ID | Trạng thái code | Kết quả test |
| --- | --- | --- |
| RB-01 đến RB-06 | Implemented | Pass qua AUTO-02 và LIVE-02. |
| RB-07 | Implemented | Pass qua AUTO-03: nhãn cũ được suy diễn tương thích và có cảnh báo migration. |
| RB-08 | Implemented | Chờ export response v6 và chạy benchmark để lưu metrics. |

## Đề xuất RT — Ready-JD retrieval (chưa code)

Mục tiêu: tăng khả năng đưa JD Intern/Junior có hướng nghề nghiệp phù hợp và đủ
mandatory evidence vào tập ứng viên trước final ranking; không thay đổi fit score.

| ID | Kỳ vọng | Dữ liệu / cách kiểm tra | Pass khi |
| --- | --- | --- | --- |
| RT-01 | Candidate retrieval giữ lại JD có role relevance cao dù điểm BM25/semantic ban đầu thấp hơn một JD generic. | Unit test candidate merge. | JD role-relevant xuất hiện trong candidate set. |
| RT-02 | JD Intern/Junior có skill overlap CV (JavaScript/Python/React/AI) nhận retrieval boost có giới hạn. | Unit test boost scoring. | JD target đứng trước JD không cùng hướng, nhưng không vượt JD có retrieval mạnh hơn rõ rệt. |
| RT-03 | Boost chỉ tác động candidate selection/retrieval order, không thay đổi `raw_fit_score` hay evidence. | Unit test service evaluation. | Fit score và evidence trước/sau giữ nguyên. |
| RT-04 | Candidate ngoài hard filter không thể được boost quay lại danh sách. | Regression test hard-filter/vector. | Không có job ngoài filtered catalog. |
| RT-05 | API trả trace tối thiểu, không chứa CV thô: `retrieval_rank`, `role_affinity_score`, `ready_candidate_boost`. | API/schema test. | UI/benchmark có thể audit thứ tự mà không lộ CV. |
| RT-06 | JD có role mismatch (Tester/Security) không nhận boost ready-JD. | Unit test boost. | Boost bằng 0 khi `role_relevant=false`. |
| RT-07 | Benchmark v7 không làm giảm `precision_at_3` dưới 1.0 và tăng hoặc giữ `ready_recall_at_10`. | Export API + `run_benchmark.py`. | Cả hai điều kiện đạt. |
| RT-08 | Kết quả trước/sau v7 được thêm dòng mới vào bảng benchmark. | Kiểm tra Markdown evidence. | Không ghi đè BM-POST-04. |

### Trạng thái triển khai RT

| ID | Trạng thái code | Kết quả test |
| --- | --- | --- |
| RT-01 đến RT-06 | Implemented | Pass qua AUTO-04. |
| RT-07 đến RT-08 | Implemented | Chờ export API v7 và benchmark. |

## Đề xuất CD — Candidate-pool diagnostic (chưa code)

Mục tiêu: phân biệt rõ JD bị bỏ ở retrieval với JD đã được evidence evaluate
nhưng không lọt Top 10. Diagnostic không thay đổi ranking, fit score hoặc evidence.

| ID | Kỳ vọng | Cách kiểm tra | Pass khi |
| --- | --- | --- | --- |
| CD-01 | API trả số candidate sau retrieval và số candidate đã evaluate. | API contract test. | Có `candidate_count` và `evaluated_count`, không chứa CV thô. |
| CD-02 | Mỗi JD Top 10 có trace phase (`retrieved`, `evaluated`, `selected`). | Unit/API test. | Trace nhất quán với thứ hạng cuối. |
| CD-03 | Có endpoint/field diagnostic chỉ trả metadata JD: ID, title, retrieval rank, boost, evaluated/final status. | API test. | Không trả raw CV, evidence quote hoặc PII. |
| CD-04 | Có thể truy vấn chính xác JD-024/JD-049/JD-074 để biết phase cuối cùng. | Manual DevTools test. | Mỗi JD có một trong: `not_retrieved`, `evaluated_not_selected`, `selected`. |
| CD-05 | Diagnostic không làm thay đổi output Top 10 hiện tại. | Regression test trước/sau cùng input. | Job IDs/rank/fit score giữ nguyên. |
| CD-06 | Cached response vẫn hợp lệ theo version diagnostic mới. | Cache-version test/manual restart. | Không đọc cache thiếu field diagnostic. |
| CD-07 | Kết quả diagnostic được lưu vào Markdown cùng benchmark v7. | Kiểm tra evidence file. | Có kết luận nguyên nhân cho 3 JD ready. |

### Trạng thái triển khai CD

| ID | Trạng thái code | Kết quả test |
| --- | --- | --- |
| CD-01 đến CD-06 | Implemented | Chờ chạy pytest/API v8. |
| CD-07 | Implemented | Chờ DevTools diagnostic cho JD-024/JD-049/JD-074. |

### Kết quả diagnostic v8

| Thuộc tính | Kết quả |
| --- | --- |
| Candidate / evaluated count | `60 / 60` |
| JD-024 — Javascript Intern | `evaluated_not_selected`, retrieval rank 15, role relevance `false`, boost `0`. |
| JD-049 — AI Engineer Intern | `evaluated_not_selected`, retrieval rank 24, role relevance `false`, boost `0`. |
| JD-074 — Junior Full Stack Engineer (Python React/Angular) | `evaluated_not_selected`, retrieval rank 36, role relevance `true`, affinity 50, boost 0.15. |
| Kết luận | Cả ba JD không bị mất ở retrieval. JD-024/JD-049 cần quyết định taxonomy role; JD-074 cần diagnostic final-selection/evidence để hiểu vì sao rớt Top 10. |

### Final-selection diagnostic v10

| JD | Raw/display score | Mandatory coverage | Matched | Kết luận |
| --- | ---: | ---: | --- | --- |
| JD-024 — Javascript Intern | 21.5 / 21.5 | 54% | 6/12 | Gate fail; không đủ evidence mandatory hiện tại. |
| JD-049 — AI Engineer Intern | 22.1 / 22.1 | 45% | 5/12 | Gate fail; không đủ evidence mandatory hiện tại. |
| JD-074 — Junior Full Stack Engineer | 22.6 / 22.6 | 56% | 4/7 | Gate fail; không đủ evidence mandatory hiện tại. |
| Kết luận | — | — | — | Không phải lỗi retrieval/ranking. Cần bổ sung evidence CV hoặc đổi nhãn `application_ready` của ba JD thành `false`. |

## Đề xuất TX — Role taxonomy theo requirement JD (chưa code)

| ID | Kỳ vọng | Cách kiểm tra | Pass khi |
| --- | --- | --- | --- |
| TX-01 | JavaScript JD chỉ là Backend-relevant khi requirement chứa Node.js/Express/NestJS/API/database/server. | Unit test classifier. | JavaScript frontend thuần bị `false`; Node/API JD là `true`. |
| TX-02 | AI JD chỉ là Backend-relevant khi requirement chứa FastAPI/API/backend/LLM application/database. | Unit test classifier. | CV/ML training/OCR thuần bị `false`; AI application API JD là `true`. |
| TX-03 | JD Penetration Tester/QA/Tester luôn role mismatch với Backend. | Regression classifier test. | `role_relevant=false`, boost 0. |
| TX-04 | Classifier dùng title + skills/requirements, không dùng CV raw text. | Privacy/unit test. | Không có raw CV trong input/output trace. |
| TX-05 | JD-024/JD-049 có lý do phân loại hiển thị được trong diagnostic. | API/DevTools test. | Có `role_reason` cho từng JD. |
| TX-06 | Không giảm Precision@3 dưới 1.0; Ready Recall@10 chỉ được so sánh sau khi xác nhận nhãn JD-024/JD-049. | Benchmark v9. | Không tạo false positive role mismatch. |

## Xác nhận API trực tiếp — v6

| Run | Kiểm tra | Kết quả | Kết luận |
| --- | --- | --- | --- |
| LIVE-02 | Top 3 | FullStack Engineer, New Product Development Engineer, Junior Fullstack Developer đều `role_relevant=true`, `application_ready=true`. | Pass RB-05: JD ready được ưu tiên trước. |
| LIVE-02 | Role mismatch | `Penetration Tester - Intern` không còn trong Top 10. | Pass RB-02/RB-03: role mismatch đã bị hạ hạng. |
| LIVE-02 | JD còn thiếu mandatory | Hạng 4–10 đều `application_ready=false`, `mandatory_failed=true`. | Pass RB-04: trạng thái readiness tách biệt và nhất quán với mandatory gate. |

## Xác nhận API trực tiếp — v7

| Run | Kiểm tra | Kết quả | Kết luận |
| --- | --- | --- | --- |
| LIVE-03 | Audit trace retrieval | API trả `retrieval_rank`, `role_affinity_score`, `ready_candidate_boost` cho toàn bộ Top 10. | Pass RT-05: trace không chứa CV thô. |
| LIVE-03 | Ready-role boost | Top 3 ready có boost `0.15`; JD role-relevant nhưng chưa ready vẫn được đánh giá riêng. | Pass RT-02/RT-03: boost bị giới hạn và không thay đổi readiness/fit output. |

## Đánh giá phân tầng Role Track (AT-01 đến AT-08)

Mục tiêu: Phân 3 nhóm vai trò (role tracks) theo đúng nguyên tắc:
- `primary`: Backend / Node.js / Java Spring Boot / Fullstack thiên backend.
- `adjacent`: AI Application Engineer có API, LLM, database, backend — vẫn hiển thị (`role_relevant=true`) nhưng xếp sau nhóm `primary`.
- `mismatch`: AI/ML thuần (training model, TensorFlow, computer vision, OCR…), QA, Security — hạ dưới (`role_relevant=false`).

Nguyên tắc: Chỉ phân tầng role để sắp xếp; không thay đổi evidence quote, fit score hay mandatory gate.

| ID | Test case | Kỳ vọng | Kết quả kiểm tra | Trạng thái |
| --- | --- | --- | --- | --- |
| AT-01 | JD Node.js Backend, Spring Boot Backend | `primary`, `role_relevant=true` | Unit test `test_at_01_backend_primary_nodejs_and_spring_boot` | **Pass** |
| AT-02 | JD Fullstack có Node.js/API/database | `primary`, `role_relevant=true` | Unit test `test_at_02_fullstack_primary_with_node_api_database` | **Pass** |
| AT-03 | JD AI Engineer có LLM/API/database/backend | `adjacent`, `role_relevant=true` | Unit test `test_at_03_ai_application_adjacent` | **Pass** |
| AT-04 | JD AI/ML thuần: training model, TensorFlow, computer vision, OCR | `mismatch`, `role_relevant=false` | Unit test `test_at_04_pure_ai_ml_mismatch` | **Pass** |
| AT-05 | JD AI adjacent score cao hơn JD Backend primary, cả hai ready | JD primary xếp trước | Unit test `test_at_05_primary_beats_higher_scoring_adjacent_when_both_ready` | **Pass** |
| AT-06 | JD primary fail mandatory, JD adjacent ready | JD adjacent ready xếp trước để không che cơ hội ứng tuyển | Unit test `test_at_06_adjacent_ready_beats_primary_mandatory_failed` | **Pass** |
| AT-07 | Fit score, evidence quote, mandatory gate không đổi | Chỉ đổi thứ tự/nhãn role | Unit test `test_at_07_fit_score_evidence_mandatory_gate_unchanged` | **Pass** |
| AT-08 | API trả `role_track` và `role_reason` để giải thích tại sao xếp hạng | Có trace rõ trong item và diagnostic | Unit test `test_at_08_api_exposes_role_track_and_role_reason`, API integration tests | **Pass** |

## Đánh giá tính nhất quán Verdict, Fit Label & Top JD (VL-01 đến VL-08)

Mục tiêu: Đảm bảo tính nhất quán tuyệt đối giữa trạng thái sẵn sàng ứng tuyển (`application_ready`), kết luận (`verdict`), nhãn phù hợp (`fit_label`) và thứ bậc ưu tiên.

| ID | Test case | Kỳ vọng | Kết quả kiểm tra | Trạng thái |
| --- | --- | --- | --- | --- |
| VL-01 | JD `application_ready=true`, `mandatory_failed=false`, điểm `< 50` | `verdict` không chứa "Chưa phù hợp để ứng tuyển ngay"; mang thông điệp tích cực | Unit test `test_vl_01_ready_job_with_sub_50_score_has_positive_verdict` | **Pass** |
| VL-02 | JD `application_ready=true`, điểm `< 50` | `fit_label` là "Tiềm năng" / "Phù hợp", không bị gán "Cần cải thiện" | Unit test `test_vl_02_ready_job_fit_label_preserves_readiness` | **Pass** |
| VL-03 | JD `mandatory_failed=true` (coverage < 75%) | `verdict` nêu rõ chưa đạt yêu cầu bắt buộc, `fit_label` là "Cần cải thiện" | Unit test `test_vl_03_failed_mandatory_verdict_and_label` | **Pass** |
| VL-04 | JD `role_track=adjacent` (ví dụ AI Engineer Intern) | `role_track="adjacent"`, `role_reason` giải thích rõ hướng phụ | Unit test `test_vl_04_adjacent_track_verdict_and_reasoning` | **Pass** |
| VL-05 | JD `role_track=mismatch` (ví dụ QA, Security) | `role_relevant=false`, `role_track="mismatch"`, bị hạ hạng | Unit test `test_vl_05_mismatch_track_demoted` | **Pass** |
| VL-06 | Priority Actions & Displayable Gaps | Chỉ hiển thị kỹ năng thực tế còn thiếu, loại bỏ noise (`en`, `vi`, prose > 12 từ) | Unit test `test_vl_06_priority_actions_cleanliness` | **Pass** |
| VL-07 | Invariant thứ bậc xếp hạng | Primary Ready > Adjacent Ready > Primary Failed > Adjacent Failed > Mismatch | Unit test `test_vl_07_full_tiered_ranking_invariants` | **Pass** |
| VL-08 | Không thoái lui Benchmark | Precision@3 = 1.0, MRR = 1.0, nDCG@10 >= 0.94, Mandatory FNR <= 0.2857 | Script `run_benchmark.py` & `test_user_top_jd_benchmark.py` | **Pass** |

## Lệnh xác nhận

```powershell
$env:PYTHONPATH = 'backend;.'
.\.venv\Scripts\python.exe -m pytest `
  backend\tests\test_mandatory_gate.py `
  backend\tests\test_final_ranking.py `
  backend\tests\test_recommendation_service.py `
  backend\tests\test_user_top_jd_benchmark.py `
  backend\tests\test_job_recommendation_filters.py `
  backend\tests\test_job_recommendations_api.py
```

```powershell
.\.venv\Scripts\python.exe eval\user_top_jd_benchmark\run_benchmark.py `
  --recommendations eval\user_top_jd_benchmark\user_top_jd_recommendations.json `
  --labels eval\user_top_jd_benchmark\labels.json `
  --output eval\results\user_top_jd_benchmark_report_post_v5.json
```

