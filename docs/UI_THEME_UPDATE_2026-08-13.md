# Cập nhật giao diện chế độ sáng (Light Mode) — 2026-08-13

Thực hiện bởi: agent_code (nhánh `quan`)
Phạm vi: chỉ chế độ sáng (light mode). Dark mode giữ nguyên. Animation (starfield canvas, spaceship-corridor-sweep, mascot phi hành gia, mọi transition/keyframe) không bị đụng tới.

## 1. Yêu cầu gốc

Áp dụng palette pastel-glass (nền gradient trắng-xanh-tím nhạt, card kính mờ viền tím nhạt, 4 thẻ điểm STAR có icon + màu riêng theo chữ cái) cho toàn bộ light mode của app, dựa trên 2 ảnh mẫu "Chi Tiết Phỏng Vấn STAR" và khối `:root` CSS mẫu do người dùng cung cấp.

## 2. File đã sửa

- `src/frontend/style.css`
- `src/frontend/app.js`

Không sửa `src/frontend/app/page.tsx`, `index.html`, hay bất kỳ file animation/canvas nào. (Lưu ý: `page.tsx` và một số file khác trong repo đã có thay đổi uncommitted từ trước phiên này — không liên quan đến task này, không bị tôi đụng tới hay ghi đè.)

## 3. Biến CSS đã đổi/thêm

### 3a. Block `:root` (dark mode mặc định, dòng ~36-58)
Thêm mới (giá trị giữ nguyên tông neon cũ để không đổi dark mode):
- `--primary-hover: #5b52e0`
- `--success-bg`, `--warning`, `--warning-bg`, `--danger-bg`
- `--situation: #00e676` / `--situation-bg`
- `--task: #00bcd4` / `--task-bg`
- `--action: #b084fc` / `--action-bg`
- `--result: #ff8c42` / `--result-bg`

### 3b. Block `body.light-mode, html.light, [data-theme="light"]` (dòng ~99+)
Đổi giá trị các biến hiện có theo palette mẫu:
- `--background/--bg-deep`: `#F7F9FF`
- `--text-primary/--foreground`: `#18233F`
- `--text-secondary/--text-dim/--muted`: `#60708F`
- `--card/--bg-card/--glass`: `rgba(255,255,255,0.88)`
- `--card-border/--glass-border`: `rgba(107,92,255,0.22)`
- `--border`: `#D9D8FF`
- `--shadow/--card-shadow`: `0 12px 32px rgba(82,99,160,0.14)`
- `--navbar-bg`: `rgba(255,255,255,0.85)`, `--navbar-border`, `--navbar-shadow` tương ứng
- `--icon-hover`, `--ring`, `--gauge-bg-stroke`, `--input-*` cập nhật theo tông mới

Thêm mới trong block light-mode:
- `--bg-gradient: linear-gradient(135deg, #F9FBFF 0%, #EEF4FF 50%, #F7F0FF 100%)`
- `--primary: #6B5CFF`, `--primary-hover: #5848F0` (override riêng cho light mode)
- `--success-bg: #E9FBF3`, `--warning: #F5A524`, `--warning-bg: #FFF6DF`, `--danger-bg: #FFF0F3`
- `--situation: #18C7E8` / `--situation-bg: #E8FBFF` (cyan)
- `--task: #7A5CFA` / `--task-bg: #F1EDFF` (tím)
- `--action: #4D91FF` / `--action-bg: #EDF4FF` (xanh dương)
- `--result: #FF8A3D` / `--result-bg: #FFF3EA` (cam)

### 3c. Rule mới
- `body.light-mode { background: var(--bg-gradient); background-attachment: fixed; }` — canvas starfield/nebula (`z-index: -2`) vẫn vẽ đè lên trên nền gradient này, không bị che.
- Block override glass-card cho light mode, áp dụng cho `.interview-card, .gap-card, .gap-results-card, .profile-settings-card, .archive-card` (trước đó các class này hardcode nền navy đậm `rgba(14,18,48,...)` hoặc gần như trong suốt `rgba(255,255,255,0.03)` — không đổi theo theme, khiến card tối/xỉn nổi trên nền pastel mới). Giờ dùng `var(--card)` + `backdrop-filter: blur(16px)`.
- Override `.archive-detail-score-row` (dòng tổng điểm ở trang "Xem chi tiết") dùng `var(--situation-bg)` làm nền, `var(--primary)` cho số điểm.
- **Sửa 1 bug tiện thể phát hiện được**: `.navbar { background: rgba(8,10,30,0.72) !important; border-bottom: 1px solid rgba(0,229,255,0.18) !important; }` hardcode cứng, không tham chiếu biến `--navbar-bg`/`--navbar-border` dù 2 biến này đã tồn tại từ trước — khiến thanh navbar luôn tối bất kể theme. Đã đổi thành `var(--navbar-bg, ...)`/`var(--navbar-border, ...)` với fallback giữ nguyên giá trị dark mode cũ. Đã verify qua DevTools: dark mode không đổi, light mode navbar giờ đúng màu trắng kính mờ.
- `.btn-primary` light-mode override: đổi gradient hardcode `#6C63FF → #3BB9FF` thành `var(--primary) → var(--primary-hover)` để khớp đúng giá trị mẫu.

### 3d. Component mới: thẻ điểm STAR (`.star-badge`)
- `.star-grid, .archive-detail-star-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; }` (trước đó `.star-grid` chưa hề được định nghĩa trong CSS dù đã gán trong HTML — 3 vùng breakdown STAR trước đây thực chất render thành list dọc canh giữa nhờ style inline, không phải grid 4 cột).
- `.star-badge` + `.star-badge-icon` + `.star-badge-label` + `.star-badge-value`: khung thẻ bo góc, icon hình tròn, nhãn, điểm số to.
- 4 biến thể `.star-badge.situation/.task/.action/.result`: nền = `var(--*-bg)`, chữ + icon = `var(--*)` — tự động đổi màu đúng theo theme đang active, không hardcode hex trong CSS lẫn JS.

## 4. Thay đổi trong `app.js`

- Thêm helper dùng chung `renderStarBadgeGrid(scores, fallback)` (đặt ngay sau `escapeHtml`, dòng ~1007) cùng 4 SVG icon inline (bong bóng chat, clipboard, bút chì, mục tiêu — vẽ theo đúng phong cách SVG `stroke="currentColor"` đã dùng sẵn cho `.feature-icon` trong `page.tsx`, không dùng emoji vì toàn bộ app hiện tại dùng SVG inline cho icon tính năng).
- Thay 3 vị trí hardcode màu hex (`#00e676`, `#00bcd4`, `#b084fc`, `#ff8c42`) bằng lời gọi `renderStarBadgeGrid(...)`:
  1. `loadPageSTARReport()` (dòng ~3549) — luồng "Phòng phỏng vấn" trang chính, đang hoạt động (live).
  2. `renderArchiveDetailStarSection()` (dòng ~3853) — luồng "Xem chi tiết" ở Lịch sử, đang hoạt động (live).
  3. `loadSTARReport()` (dòng ~5516) — modal `#modal-interview-overlay` cũ. **Đã xác nhận đây là dead code**: không tìm thấy bất kỳ nút/trigger nào trong `app.js`/`page.tsx` mở `modal-interview-overlay` (chỉ có `getElementById` đọc ra, không có logic mở modal). Vẫn sửa đồng bộ theo yêu cầu, nhưng không thể kiểm thử qua UI vì không có điểm vào.
- Không đổi hành vi/luồng logic nào khác ngoài phần build HTML của 3 vùng breakdown điểm.

## 5. Kiểm thử đã chạy

| Bước | Kết quả |
|---|---|
| `node --check src/frontend/app.js` | OK, không lỗi cú pháp |
| `docker compose up -d --build frontend` (2 lần — lần 2 sau khi sửa thêm bug `.navbar`) | Build thành công, container healthy |
| `docker compose restart gateway` | OK |
| `pytest tests/ -q` | **184 passed, 0 failed** — đúng baseline, không có test nào trong `tests/test_frontend/test_ui_contracts.py` đụng tới vùng đã sửa |
| Kiểm tra qua Claude Browser (DevTools/JS, không đăng nhập) | Xem mục 6 |

## 6. Giới hạn kiểm thử — QUAN TRỌNG, cần xác nhận thêm

**Không thể đăng nhập để chụp ảnh màn hình trực tiếp trang "Chi Tiết Phỏng Vấn STAR".** Phiên Claude Browser mở ra ở trạng thái "Chưa đăng nhập" (không có sẵn session sinh viên như giả định trong yêu cầu). Theo quy tắc an toàn bắt buộc của tôi, tôi **không được phép tự nhập mật khẩu để đăng nhập thay người dùng**, kể cả với tài khoản test/synthetic nội bộ — đây là giới hạn cứng, không thể bỏ qua dù được yêu cầu. Ngoài ra công cụ chụp ảnh màn hình (`screenshot`) của Browser pane bị lỗi "pane không hiển thị" trong phiên chạy nền này nên kể cả các trang public cũng không chụp được ảnh trực quan.

Để bù lại, tôi đã verify bằng DevTools/JavaScript (đọc computed style trực tiếp trên DOM thật đang chạy ở `localhost:8080`), xác nhận:
- Toggle sang light mode: `body.light-mode` có `background-image` đúng bằng `--bg-gradient` mẫu.
- 4 biến `--situation/--task/--action/--result` (+ `-bg`) resolve đúng chính xác từng mã màu trong bảng mẫu người dùng cung cấp (đã so khớp từng giá trị rgb).
- Dựng thử 1 khối `.star-grid` + 4 `.star-badge.*` tạm thời trong DOM thật → nền/màu chữ từng thẻ khớp 100% với bảng mẫu.
- Dark mode (`isLight:false`): `--situation/--task/--action/--result` vẫn giữ đúng 4 giá trị neon gốc (`#00e676/#00bcd4/#b084fc/#ff8c42`), nền `body` vẫn `rgb(5,8,22)` — xác nhận **dark mode không bị ảnh hưởng**.
- `.btn-primary`, `.archive-card`, `.profile-settings-card` ở light mode đều trả về đúng `var(--primary)`/`var(--card)` mới.
- Navbar sau khi vá bug: đúng `rgba(255,255,255,0.85)` ở light mode (có độ trễ ~0.3s do transition CSS sẵn có của `.navbar`, đã verify bằng cách đợi rồi đọc lại).

**Chưa verify được bằng mắt**: bố cục thực tế trang STAR report (cần đăng nhập + có sẵn 1 phiên phỏng vấn/lịch sử), mascot phi hành gia có bị che khuất bởi layout mới hay không, độ tương phản chữ trên các icon SVG mới ở kích thước thực tế, và toàn bộ 2-3 trang khác (Phân tích CV, Lịch sử) như yêu cầu ban đầu — các trang này đòi hỏi đăng nhập.

**Ước tính đối chiếu với ảnh mẫu**: về mặt giá trị màu sắc/token CSS — khớp ~100% (đã đo trực tiếp trên DOM). Về bố cục/thị giác thực tế (icon SVG có "giống" bong bóng chat/clipboard/bút chì/mục tiêu như ảnh mẫu hay không, độ giống glassmorphism khi render thật) — **chưa thể xác nhận bằng mắt**, cần bạn tự đăng nhập kiểm tra hoặc cấp cho tôi một phiên đã đăng nhập sẵn (ví dụ mở sẵn tab đã login trong Claude Browser) ở lượt sau.

## 7. Việc cần xác nhận tiếp theo

1. Bạn tự đăng nhập tài khoản sinh viên, bật light mode, vào trang STAR report (Phòng phỏng vấn hoặc Xem chi tiết ở Lịch sử) để xác nhận bố cục/icon đúng như ảnh mẫu — tôi không thể tự làm bước này do giới hạn an toàn không được nhập mật khẩu.
2. Xác nhận xử lý `loadSTARReport()`/modal `#modal-interview-overlay` — tôi kết luận đây là dead code (không tìm thấy trigger mở modal trong toàn bộ `app.js`/`page.tsx`). Nếu đúng, có thể cân nhắc dọn dẹp ở task riêng sau (không làm trong task này vì ngoài phạm vi).
3. Icon SVG cho 4 thẻ STAR là tự vẽ tối giản (chat bubble/clipboard/pencil/target theo phong cách stroke `currentColor` đã dùng trong `page.tsx`) — nếu bạn muốn khớp chính xác hơn với icon trong ảnh mẫu, cần xem lại ảnh mẫu cùng nhau để tinh chỉnh path SVG.
4. Đã tiện tay sửa 1 bug ngoài checklist gốc (navbar hardcode màu tối, không đọc biến CSS) vì nó phá vỡ toàn bộ light mode (thanh nav luôn tối bất kể theme) — nằm trong tinh thần "đảm bảo card/nút khác dùng đúng biến" của yêu cầu ban đầu. Nêu ra để bạn biết, không phải thay đổi ngoài ý muốn.

## 8. Không thực hiện (đúng ranh giới an toàn)

- Không `git commit`/`push`/`reset --hard`.
- Không sửa `.env`, không `docker compose down`.
- Không đăng nhập bằng mật khẩu (kể cả tài khoản test) — theo quy tắc an toàn không thể bỏ qua.
- Không đụng `@keyframes`, canvas starfield JS, `spaceship-corridor-sweep`, mascot phi hành gia.
