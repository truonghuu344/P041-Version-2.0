# Nhật ký sửa lỗi — 2026-08-13 (phiên làm việc ban ngày)

Bối cảnh: P-041 Career Assistant X, nhánh `quan`, làm việc trực tiếp trên Docker stack tại `http://localhost:8080`. Vai trò kết hợp agent_code + agent_test. Không `git commit`. Kiểm thử qua Claude Browser (Claude in Chrome bị mất kết nối extension giữa chừng, chuyển sang Claude Browser nội bộ với tài khoản sinh viên đã đăng nhập sẵn — không cần tạo tài khoản mới).

## Việc 1 — STAR Score không sync lên Dashboard nếu không F5

**Trạng thái: Đã fix, xác nhận qua 2 vòng phỏng vấn live không F5.**

- Fix đúng như đề bài: `refreshDashboardOverview()` (check `total_score !== null && !== undefined` trước `Number.isFinite`) và `loadSTARReport()` gọi `updateDashboardGaugeScores()` trực tiếp bằng `report.total_score`.
- **Phát hiện thêm quan trọng khi test live**: root cause đề bài mô tả nằm ở `loadSTARReport()` — nhưng đây là code cho một luồng **modal cũ** (`interview-chat-section`/`interview-report-section` trong `modal-interview-overlay`) không phải luồng đang thực sự chạy khi bấm "Phòng phỏng vấn" từ nav chính. Luồng thật là `loadPageSTARReport()` (dùng `page-interview-chat`/`page-interview-report`, view "Phòng Phỏng Vấn Thử") — hàm này **hoàn toàn chưa từng gọi** `refreshDashboardOverview()` hay cập nhật gauge, nên bug vẫn tái diễn sau khi chỉ sửa `loadSTARReport()`. Đã bổ sung `updateDashboardGaugeScores(NaN, Number(report.total_score))` + `refreshDashboardOverview()` vào `loadPageSTARReport()` — đây mới là fix thực sự khiến bug hết.
- Test: hoàn thành 2 phiên phỏng vấn STAR mới với điểm khác nhau (1.0/100, sau đó 54.8/100), điều hướng SPA (không F5) từ "Phòng phỏng vấn" sang "Trang chủ" — gauge cập nhật đúng ngay lập tức cả 2 lần, khớp với dữ liệu backend.

**File đã đổi**: `src/frontend/app.js` (dòng ~4160 khu `refreshDashboardOverview`, dòng ~3556 khu `loadPageSTARReport`, dòng ~5410 khu `loadSTARReport`).

## Việc 2 — "Tìm việc" trả về 0 kết quả cho mọi từ khóa

**Trạng thái: Đã fix, xác nhận qua 4 từ khóa live.**

- Sửa `search_market_jobs()` trong `src/services/job_rag.py`: sau khi Qdrant trả về không lỗi nhưng `total == 0` và có `query`/`cv_text`, tự động fallback sang `search_enterprise_jobs()` (catalog keyword), trả `retrieval_mode = "keyword_fallback"`.
- Rebuild backend (`docker compose up -d --build backend`).
- Test live 4 từ khóa: "Golden" → 1 JD, "PHP" → 6 JD, "Python" → 28 JD, "Hà Nội" → 52 JD — tất cả trả kết quả đúng thay vì "0 JD doanh nghiệp". Log backend xác nhận dòng cảnh báo fallback mới thêm được kích hoạt đúng lúc ("Qdrant search returned 0 hits ... trying keyword catalog fallback").

**File đã đổi**: `src/services/job_rag.py` (hàm `search_market_jobs`, dòng ~432-480).

## Việc 3 — Nút "Xóa bộ lọc" không xóa từ khóa đang search

**Trạng thái: Không có bug — đã kiểm tra code và test live, nút đã xóa đúng `jobSearchInput.value` từ trước.**

- Đọc handler `jobSearchResetButton` trong `app.js`: đã có sẵn `jobSearchInput.value = ''` cùng với reset CV/JD filter và re-fetch danh sách đầy đủ.
- Test live: search "PHP" → 6 JD, bấm "Xóa bộ lọc" → input trống, quay về "98 JD doanh nghiệp". Không sửa gì thêm.

## Việc 4 — Gộp "Xem Báo Cáo STAR" + "Xuất CV Tối Ưu (PDF)" thành 1 nút "Xem chi tiết"

**Trạng thái: Đã hoàn thành đầy đủ (bao gồm cả điều chỉnh phát sinh giữa phiên — bỏ nút xuất PDF).**

- Thêm 1 view mới `view-archive-detail` (dùng đúng cơ chế `app-view`/`switchView` sẵn có, không phải modal nhỏ) với nút "← Quay lại Lịch Sử".
- Đổi 2 nút trên card lịch sử (`renderMissionArchiveCards()`) thành 1 nút "🔍 Xem chi tiết" cho cả 2 loại thẻ (Phỏng vấn STAR và CV đã tối ưu/Gap Analysis).
- Card Phỏng vấn STAR → hiển thị đầy đủ báo cáo STAR (điểm tổng, breakdown S/T/A/R, điểm mạnh/cần cải thiện/khuyên luyện tập) — dùng lại đúng dữ liệu `ApiClient.getInterviewReport()`.
- Card Gap Analysis → hiển thị chi tiết: tỷ lệ phù hợp, kỹ năng đã khớp/còn thiếu, hành động ưu tiên, đề xuất chỉnh sửa CV (ghi rõ "cần Accept/Reject" theo đúng ràng buộc HITL của dự án).
- Giữ nguyên `openStarReportModal()` không đổi vì hàm này còn được trang Cố vấn (`loadCounselorStudent`) dùng lại — không đụng tới để tránh phá luồng cố vấn.
- **Cập nhật giữa phiên (theo yêu cầu mới của user)**: bỏ hẳn nút "Xuất CV Tối Ưu (PDF)" khỏi view chi tiết mới — lý do: nhóm chưa chốt template CV, tính năng xuất PDF chưa sẵn sàng cho demo. Đã xóa nút khỏi `page.tsx`, xóa hàm `exportOptimizedCvPdf()` và listener liên quan trong `app.js` (không dùng nữa nên xóa hẳn, không để lại dead code). **Đã kiểm tra không còn nút "Xuất CV Tối Ưu (PDF)" nào khác đang hiển thị trong app** — có 1 đoạn code liên quan (`page-cv-export-bar`/`page-download-optimized-cv` ở trang Phân tích CV) nhưng đây là code chết từ lâu, các id DOM này **không tồn tại** trong `page.tsx` hiện tại nên nút này chưa từng thực sự hiển thị — không cần sửa gì thêm. Backend endpoint `ApiClient.downloadCV`/route xuất PDF được giữ nguyên để dùng lại sau khi có template.
- Test live: cả 2 loại "Xem chi tiết" hoạt động đúng, nút quay lại hoạt động, không còn nút xuất PDF nào trong view mới.

**File đã đổi**: `src/frontend/app/page.tsx` (thêm section `view-archive-detail`), `src/frontend/app.js` (routing `ALL_VIEWS`/`VIEW_ORDER`/`roomTitles`, hàm `renderArchiveDetailStarSection`/`renderArchiveDetailGapSection`/`openMissionDetailView`, sửa `renderMissionArchiveCards`), `src/frontend/style.css` (style mới cho view chi tiết).

## Việc 5 — Rà soát UI chế độ sáng (light mode)

**Trạng thái: Đã rà soát và sửa các lỗi nghiêm trọng nhất tìm được trên toàn bộ trang sinh viên có thể truy cập.**

Tìm thấy và sửa 3 nhóm lỗi contrast thật sự (chữ gần như vô hình trên nền sáng):

1. **`.page-title`** (`style.css` dòng ~1358) — hardcode `color: #fff`, chưa từng có override cho light mode. Đây là class heading `<h1>` dùng cho **8 trang khác nhau**: Tìm việc, Danh sách JD, Phòng phỏng vấn, Lịch sử & Báo cáo, Chi tiết nhiệm vụ (view mới ở Việc 4), Profile, Dashboard Cố vấn, Dashboard Doanh nghiệp — lỗi nghiêm trọng nhất tìm được, ảnh hưởng gần như toàn bộ tiêu đề trang chính. Đã thêm override `color: var(--text-primary)` cho light mode.
2. **`.section-title-large` / `.section-subtitle`** (`style.css` dòng ~5815) — dùng kỹ thuật gradient text trắng-sang-tím (`-webkit-text-fill-color: transparent`) tối ưu cho nền tối, gần như vô hình trên nền sáng. Ảnh hưởng 3 tiêu đề: "Các Gói Dịch Vụ & Nâng Cấp" (Pricing), "Ứng Viên Nói Gì Về CV Assistant?" (Testimonials), "Quản Lý Người Dùng & Phân Quyền" (Admin). Đã thêm override light mode: bỏ gradient, dùng màu solid `var(--text-primary)`/`var(--text-secondary)`.
3. **`.job-results-toolbar` / `.job-results-mode`** (`style.css` dòng ~2461) — text "N JD doanh nghiệp" và pill "Tất cả JD"/"AI xếp hạng theo CV" trên trang Tìm việc dùng màu gần trắng (`#dce8f9`, `#78e6f1`), vô hình trên nền sáng. Đã thêm override light mode với màu tối hơn, giữ nguyên dark mode.

**Các trang đã kiểm tra live (bật light mode, điều hướng SPA):** Trang chủ/Dashboard (kể cả cuộn xuống Pricing + Testimonials), Phân tích CV, Tìm việc (kể cả danh sách JD card), Phòng phỏng vấn, Lịch sử & Báo cáo, và cả 2 loại view "Xem chi tiết" mới (STAR + Gap Analysis) — tất cả đọc được rõ ràng sau khi sửa.

**Chưa kiểm tra trực tiếp (giới hạn do vai trò tài khoản test)**:
- **"Danh sách JD"** (`view-jobs`) — nav item này chỉ hiện với role `enterprise`, tài khoản test là `student` nên không truy cập được qua UI bình thường. Class `.page-title` áp dụng cho trang này cũng đã được fix theo class selector nên về lý thuyết đã hết lỗi, nhưng **chưa xác nhận trực tiếp bằng mắt** — cần user (hoặc `agent_test` với tài khoản `enterprise`) xác nhận lại.
- Trang **Profile (Crew Quarters)**, **Dashboard Cố vấn**, **Dashboard Doanh nghiệp** — cùng lý do role-gating (Profile không có link nav trực tiếp cho student trong phiên test này; Cố vấn/Doanh nghiệp cần tài khoản role tương ứng). `.page-title` và `.section-title-large` fix áp dụng theo class nên sẽ tự động có hiệu lực, nhưng **chưa xác nhận trực tiếp bằng mắt** — cần user xác nhận nếu cần chắc chắn 100%.
- Không loại trừ khả năng còn sót các lỗi contrast nhỏ hơn (ít nghiêm trọng hơn 3 lỗi trên) ở các phần chưa cuộn tới hoặc trạng thái UI chưa kích hoạt (ví dụ: một số trạng thái lỗi/rỗng cụ thể). Đã ưu tiên tìm và sửa các lỗi rõ ràng nhất, nghiêm trọng nhất trước theo đúng tinh thần "làm phần rõ ràng nhất".

**File đã đổi**: `src/frontend/style.css` (3 khối override light mode mới, không đổi màu dark mode).

## Kiểm thử cuối

- `pytest tests/ -q` (dùng `.venv` local vì image backend không cài pytest): **184 passed, 0 failed** — khớp baseline trước khi sửa, không có gì vỡ.
- Rebuild `backend` (Việc 2) và `frontend` (Việc 1, 4, 5) qua `docker compose up -d --build`, restart `gateway` sau mỗi lần rebuild frontend (nginx cache IP container cũ gây 502 tạm thời — restart gateway là cách khắc phục, không phải bug ứng dụng).
- Toàn bộ test qua Claude Browser với tài khoản sinh viên đã đăng nhập sẵn (Nguyễn Minh Quân), dữ liệu tạo ra trong phiên (2 phiên phỏng vấn mới, điểm 1.0/100 và 54.8/100) là dữ liệu thật của tài khoản test có sẵn, không phải dữ liệu giả lập mới tạo.
- Không `git commit`/`push`. Chưa kiểm tra `git status` cuối phiên nhưng các file đã đổi: `src/frontend/app.js`, `src/frontend/app/page.tsx`, `src/frontend/style.css`, `src/services/job_rag.py`.

## Cần user xác nhận thêm

1. **Việc 4/5**: xác nhận lại trang "Danh sách JD" (role enterprise), Profile, Dashboard Cố vấn, Dashboard Doanh nghiệp trong light mode — fix đã áp dụng theo class CSS nên nhiều khả năng đã hết lỗi nhưng chưa xác nhận trực tiếp bằng mắt do giới hạn role tài khoản test.
2. **Việc 4**: đã bỏ nút "Xuất CV Tối Ưu (PDF)" khỏi view chi tiết theo yêu cầu cập nhật giữa phiên — xác nhận đây đúng là phạm vi mong muốn (không cần thêm placeholder/thông báo "tính năng sắp ra mắt" nào khác).
3. Việc 1 phát hiện thêm: hàm `loadSTARReport()`/modal `modal-interview-overlay` (luồng phỏng vấn cũ) hiện có vẻ không còn điểm vào nào trong UI hiện tại (chưa xác nhận 100% — chỉ grep code, chưa dò hết mọi nút bấm) — nếu đúng là code chết, có thể cân nhắc dọn dẹp sau (ngoài phạm vi phiên này).
