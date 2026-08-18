# Bộ test case — CV Assistant

Tài liệu này mô tả phạm vi kiểm thử hiện tại của backend, AI agents và các hợp đồng UI quan trọng.
Các test tự động không gọi Gemini, OpenWeather hoặc WeatherAPI thật; dịch vụ ngoài được mock để test chạy ổn định và không tiêu tốn API quota.

## Cách chạy

```powershell
PYTHONPATH=backend pytest backend/tests -q -p no:cacheprovider
ruff check backend/src backend/tests
cd frontend
npm run build
```

## Ma trận test tự động

| ID | Khu vực | Tình huống chính | Kết quả mong đợi | File test |
|---|---|---|---|---|
| AUTH-01 | Đăng ký | Đăng ký email mới, khác chữ hoa/thường | Email được chuẩn hóa chữ thường | `test_auth_security.py` |
| AUTH-02 | Đăng ký | Đăng ký email đã tồn tại | HTTP 400 | `test_auth_security.py` |
| AUTH-03 | Validation | Email sai, mật khẩu ngắn, tên quá ngắn | HTTP 422 | `test_auth_security.py` |
| AUTH-04 | Đăng nhập | Sai mật khẩu hoặc email không tồn tại | Cùng HTTP 401 và cùng thông báo | `test_auth_security.py` |
| AUTH-05 | JWT | Thiếu token, token sai, token hết hạn | HTTP 401 | `test_auth_security.py` |
| AUTH-06 | Gmail | Dấu chấm, `+tag`, `googlemail.com` trỏ cùng hộp thư | Chỉ tạo được một tài khoản | `test_auth_security.py` |
| ADMIN-01 | Phân quyền | Student gọi API Admin | HTTP 403 | `test_auth_security.py` |
| ADMIN-02 | Quản trị user | Admin tạo, sửa và xóa user thường | Thành công | `test_auth_security.py` |
| ADMIN-03 | Admin duy nhất | Tạo/promote/demote/xóa Admin | Bị từ chối, DB chỉ có một Admin | `test_backend_full.py` |
| CV-01 | Upload | Không đăng nhập | HTTP 401 | `test_cv_management.py` |
| CV-02 | Upload | File không phải PDF/DOCX | HTTP 400 | `test_cv_management.py` |
| CV-03 | Upload | File lớn hơn 10 MB | HTTP 400 | `test_cv_management.py` |
| CV-04 | Upload | PDF hỏng/không trích xuất được | HTTP 422, không lưu file rác | `test_cv_management.py` |
| CV-05 | Upload | PDF hợp lệ, parser trả dữ liệu chuẩn | HTTP 201, lưu DB và file | `test_cv_management.py` |
| CV-06 | Danh sách/chi tiết | Chủ sở hữu xem CV | Chỉ nhận CV của chính mình | `test_cv_management.py` |
| CV-07 | IDOR | User đọc/xóa/phân tích lại CV người khác | HTTP 404 | `test_cv_management.py` |
| CV-08 | Xóa nhiều | ID trùng, chọn nhiều CV | Xóa đúng bản ghi và file đã chọn | `test_backend_full.py` |
| CV-09 | Xóa nhiều | Chọn CV người khác hoặc danh sách rỗng | HTTP 404/422, không mất file | `test_cv_management.py` |
| CV-10 | Agent status | Kiểm tra cấu hình CV Agent | Không lộ API key | `test_cv_management.py` |
| PARSER-01 | CV parser | Parser local nhận diện kỹ năng có bằng chứng | Không thêm kỹ năng không có trong CV | `test_cv_parser.py` |
| PARSER-02 | CV parser | Null byte và tên tiếng Việt bị tách ký tự | Làm sạch và ghép đúng | `test_cv_parser.py` |
| PARSER-03 | Guardrail | Gemini trả kỹ năng bịa | Kỹ năng không có bằng chứng bị loại | `test_cv_parser.py` |
| JD-01 | Danh sách | Hệ thống chưa có JD mẫu | Tự seed JD hệ thống | `test_job_descriptions.py` |
| JD-02 | Tạo JD | Thiếu company/location | Áp dụng giá trị mặc định an toàn | `test_job_descriptions.py` |
| JD-03 | Validation | Tiêu đề/nội dung quá ngắn | HTTP 422 | `test_job_descriptions.py` |
| JD-04 | IDOR | User đọc JD cá nhân của người khác | HTTP 404 | `test_job_descriptions.py` |
| JD-05 | JD hệ thống | User bất kỳ đọc JD hệ thống | Thành công | `test_job_descriptions.py` |
| JD-06 | Upload file | File không thuộc PDF/DOCX/TXT | HTTP 400 với thông báo định dạng hợp lệ | `test_job_descriptions.py` |
| ROLE-01 | Enterprise | Upload JD tùy chỉnh | HTTP 201 | `test_enterprise_access.py` |
| ROLE-02 | Enterprise | Dùng CV/Gap/STAR/Nova như sinh viên | Các workflow hoạt động bình thường | `test_enterprise_access.py` |
| ROLE-03 | Enterprise | Upload file JD theo mẫu | Trích xuất nội dung, tự lấy tên file và lưu JD cá nhân | `test_enterprise_access.py` |
| GAP-01 | Gap Analysis | CV và JD hợp lệ | Lưu kết quả, trả đủ đề xuất và lịch sử | `test_career_workflows.py` |
| GAP-02 | IDOR | CV/JD cá nhân thuộc user khác | HTTP 404, agent không chạy | `test_career_workflows.py` |
| GAP-03 | Lịch sử | User khác xem history | Danh sách rỗng | `test_career_workflows.py` |
| GAP-04 | Anti-hallucination | Kỹ năng thiếu trong JD | Không chèn thành kỹ năng đã có của ứng viên | `test_graph.py` |
| STAR-01 | Thiết lập | Số câu ngoài 3–10 hoặc CV không thuộc user | HTTP 422/400 | `test_career_workflows.py` |
| STAR-02 | Follow-up | Câu trả lời thiếu thành phần STAR | Trả đúng một câu hỏi bổ sung | `test_career_workflows.py` |
| STAR-03 | Hoàn tất | Trả lời đủ câu hỏi | Tạo báo cáo STAR và khóa phiên | `test_career_workflows.py` |
| STAR-04 | IDOR | User truy cập phiên/report người khác | HTTP 404 | `test_career_workflows.py` |
| NOVA-01 | Chatbot | Chưa đăng nhập | HTTP 401 | `test_routes.py` |
| NOVA-02 | Context | Đã đăng nhập và có CV | Agent nhận metadata đúng, không tự gửi nội dung CV | `test_career_workflows.py` |
| NOVA-03 | Validation | Tin nhắn > 4000 hoặc history > 12 | HTTP 422 | `test_career_workflows.py` |
| NOVA-04 | Gemini | Có/không có API key | Gọi LLM thật qua adapter hoặc báo thiếu cấu hình | `test_career_assistant.py` |
| NOVA-05 | Lịch sử | Tạo, tiếp tục, xem và xóa hội thoại | Lưu đúng thứ tự prompt/response theo user | `test_chat_history_and_ai_logs.py` |
| NOVA-06 | IDOR | User truy cập hội thoại người khác | HTTP 404 | `test_chat_history_and_ai_logs.py` |
| AUDIT-01 | AI log | Nova xử lý prompt thành công | Admin xem được prompt, response, model, latency và tools | `test_chat_history_and_ai_logs.py` |
| AUDIT-02 | AI log lỗi | Agent phát sinh exception | User nhận lỗi an toàn, Admin thấy mã lỗi không chứa secret | `test_chat_history_and_ai_logs.py` |
| AUDIT-03 | Phân quyền | User thường gọi API AI log | HTTP 403 | `test_chat_history_and_ai_logs.py` |
| WEATHER-01 | Intent | Câu hỏi tiếng Việt về thời tiết | Tách đúng địa điểm và số ngày | `test_weather_tool.py` |
| WEATHER-02 | Validation | Thiếu địa điểm/API key | Trả `needs_location`/`not_configured` | `test_weather_tool.py` |
| WEATHER-03 | Provider | API key OpenWeather 32 ký tự | Chọn đúng provider và giới hạn 3 ngày | `test_weather_tool.py` |
| WEATHER-04 | Privacy | Provider trả payload lớn | Rút gọn dữ liệu, không lộ API key | `test_weather_tool.py` |
| WEATHER-05 | Resilience | Mất mạng tới provider | Trả lỗi an toàn, không HTTP 500 | `test_weather_tool.py` |
| UI-01 | CV Upload | Chọn nhiều và xóa | Markup, state, API và CSS được nối đầy đủ | `test_ui_contracts.py` |
| UI-02 | Nova | Mở/đóng chatbot | Avatar ẩn khi chat mở, control có nhãn accessibility | `test_ui_contracts.py` |
| UI-03 | Gap dropdown | Dropdown CV/JD và nút chạy | ID, handler và CSS contract tồn tại | `test_ui_contracts.py` |
| UI-04 | Nova history | Mở lại/xóa hội thoại cũ | Gọi đúng persistent history API | `test_ui_contracts.py` |
| UI-05 | Admin AI log | Mở tab log, tìm kiếm và lọc | Hiển thị đúng dữ liệu audit dành riêng Admin | `test_ui_contracts.py` |
| UI-06 | Enterprise | Đăng nhập role doanh nghiệp | Hiện đầy đủ chức năng như sinh viên và vẫn có Upload JD | `test_ui_contracts.py` |
| UI-08 | Nova toàn cục | Chuyển Dashboard/CV/Jobs/STAR/Gap/Admin | Widget hoặc cửa sổ Nova vẫn hiển thị | `test_ui_contracts.py` |
| UI-07 | Logout | Nhập dữ liệu vào form rồi đăng xuất | Input, textarea, file và dữ liệu phiên được xóa | `test_ui_contracts.py` |

## Test UI thủ công trước khi release

| ID | Các bước | Kết quả mong đợi |
|---|---|---|
| E2E-01 | Đăng ký → đăng nhập → tải PDF → mở chi tiết | Không có HTTP 500; tên/email/điện thoại lấy đúng từ CV |
| E2E-02 | Tải 3 CV → chọn 2 → xóa | Chỉ 2 CV được chọn biến mất; CV còn lại vẫn mở được |
| E2E-03 | Chọn CV và JD trong Gap Analysis → chạy | Dropdown không bị che/cắt; trả score, gap, khóa học, chứng chỉ và dự án gợi ý |
| E2E-04 | Mở Nova → hỏi thời tiết tại Hà Nội | Avatar ẩn, cửa sổ chat cố định, câu trả lời có nguồn thời tiết |
| E2E-05 | Đóng Nova | Cửa sổ ẩn và avatar xuất hiện lại đúng góc màn hình |
| E2E-06 | Student truy cập đường dẫn/chức năng Admin | Không thấy menu Admin và API trả HTTP 403 |
| E2E-07 | Hoàn thành 3–5 câu STAR | Báo cáo hiển thị điểm bốn thành phần và gợi ý cải thiện |

## Tiêu chí release đề xuất

- Toàn bộ `pytest` phải pass, không gọi API bên thứ ba thật.
- Next.js production build phải thành công.
- Không có lỗi Ruff mới trong các file thay đổi.
- Chạy E2E-01 đến E2E-07 trên Chrome ở desktop và viewport mobile trước khi deploy.
