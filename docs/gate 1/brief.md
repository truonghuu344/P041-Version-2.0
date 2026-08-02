# Gate 1 Brief — Career Assistant X

## Tên dự án (Project Name)

**Career Assistant X** — Trợ lý nghề nghiệp AI giúp sinh viên tối ưu CV theo từng vị trí và luyện phỏng vấn thực tế.

## Vấn đề (The Problem)

Sinh viên năm 3–4 và mới tốt nghiệp thường dùng một CV chung cho nhiều vị trí, chưa biết hồ sơ thiếu gì so với Job Description (JD) và thiếu môi trường luyện phỏng vấn có phản hồi cụ thể. Việc tự dùng template hoặc AI tổng quát cũng có nguy cơ tạo CV chung chung, thổi phồng kinh nghiệm và làm sinh viên thiếu tự tin khi ứng tuyển.

## Giải pháp (The Solution)

Xây dựng web app cho phép sinh viên:

- Upload CV có sẵn hoặc tạo CV từ thông tin thật đã cung cấp.
- Chọn JD từ thư viện hệ thống hoặc dán JD của công ty muốn ứng tuyển.
- Nhận Match Score, Gap Analysis và gợi ý tối ưu CV theo JD.
- Chọn template CV chuẩn ATS, chỉnh sửa, xác nhận và tải CV.
- Luyện phỏng vấn thử theo CV + JD; nhận điểm và feedback theo rubric STAR.

## Vai trò của AI (AI Value Proposition)

AI không chỉ sửa câu chữ. LLM kết hợp RAG phân tích ngữ cảnh giữa CV, JD, tiêu chí ATS và rubric phỏng vấn để tạo phản hồi cá nhân hóa:

- So sánh hàng loạt kỹ năng, dự án, kinh nghiệm và từ khóa trong vài giây.
- Chỉ gợi ý nội dung có căn cứ từ dữ liệu sinh viên đã upload/xác nhận; thiếu bằng chứng thì hỏi lại, không bịa kinh nghiệm hoặc thành tích.
- Tạo câu hỏi phỏng vấn theo vị trí, hỏi đào sâu khi câu trả lời còn thiếu ý và chấm cấu trúc STAR.
- Cho phép sinh viên luyện lại nhiều lần với chi phí thấp hơn tư vấn 1-1, đồng thời cố vấn vẫn có thể can thiệp theo mô hình Human-in-the-Loop.

## Đối tượng mục tiêu (Target User)

**Người dùng chính:** Sinh viên năm 3–4 và mới tốt nghiệp đang chuẩn bị ứng tuyển internship, fresher hoặc entry-level job.

**Người dùng hỗ trợ:** Cố vấn hướng nghiệp/giảng viên theo dõi tiến độ của sinh viên đã cấp quyền và đưa phản hồi bổ sung.

## Kết quả mong đợi (Expected Outcome)

Sau 6 tuần, nhóm hoàn thiện và demo một web app có đăng nhập/phân quyền Sinh viên–Cố vấn, gồm:

- Tạo hoặc upload CV, chọn/dán JD và phân tích CV–JD.
- Tối ưu CV theo nguyên tắc không bịa thông tin, có bước sinh viên duyệt nội dung cuối.
- Phòng phỏng vấn thử dạng chat 5–7 câu, follow-up và báo cáo STAR.
- Dashboard cố vấn cơ bản và lưu lịch sử tiến bộ của sinh viên.
- Dockerized deployment, tài liệu hướng dẫn, kiểm thử/evaluation và bằng chứng KPI: usage rate mục tiêu ≥60%, CSAT mục tiêu ≥4/5.
