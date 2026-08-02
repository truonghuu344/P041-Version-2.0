# Gate 1 Brief — CV ASSISTANT

## Tên dự án (Project Name)

**CV Assistant** — Trợ lý nghề nghiệp AI giúp sinh viên tối ưu CV theo từng vị trí và luyện phỏng vấn thực tế.

## Vấn đề (The Problem)

Thực trạng tìm kiếm việc làm và thực tập của sinh viên hiện nay đang đối mặt với nhiều rào cản lớn từ cả phía cá nhân lẫn nguồn lực hỗ trợ từ nhà trường.

Trước hết, phần lớn sinh viên chuẩn bị đi làm hoặc thực tập gặp tình trạng CV chưa chuẩn hóa theo JD. Các bạn thường có thói quen dùng duy nhất một bản CV chung cho mọi vị trí ứng tuyển, dẫn đến việc thiếu các từ khóa chuyên ngành, cấu trúc CV còn yếu và thiếu bằng chứng định lượng phù hợp với Job Description (JD). Điều này làm tăng nguy cơ bị loại ngay từ vòng lọc ATS ban đầu.

Bên cạnh đó, sinh viên cũng thiếu cơ hội cọ xát phỏng vấn do không có môi trường luyện tập thực tế bám sát từng JD cụ thể, đồng thời thiếu nhận xét (feedback) chuyên sâu về kỹ năng trả lời. Hậu quả là các bạn dễ nảy sinh tâm lý lo âu và thiếu tự tin khi bước vào buổi phỏng vấn thật.

Cuối cùng, rào cản còn đến từ sự giới hạn về nguồn lực cố vấn tại các trung tâm hướng nghiệp của trường đại học, khiến họ khó có thể cung cấp dịch vụ tư vấn 1-1 liên tục và mang tính cá nhân hóa trên quy mô lớn cho hàng nghìn sinh viên cùng lúc.

## Giải pháp (The Solution)

Nhằm giải quyết triệt để các hạn chế trên, hệ thống triển khai giải pháp AI Agent với hai mô hình chủ lực.

Đầu tiên là CV Gap Analysis Agent, đảm nhận nhiệm vụ so khớp CV của sinh viên với yêu cầu công việc (JD), từ đó chỉ ra các từ khóa hay kỹ năng còn thiếu và đề xuất cách tối ưu câu từ. Đáng chú ý, quá trình này hoàn toàn dựa trên kinh nghiệm thật của sinh viên, tuyệt đối không bịa đặt hay thổi phồng thông tin.

Tiếp đến là Mock Interview Agent, đóng vai trò như một nhà tuyển dụng thực thụ để tổ chức các buổi phỏng vấn thử tương tác theo đúng vị trí ứng tuyển. Agent này sẽ đặt các câu hỏi đào sâu và tiến hành chấm điểm chi tiết dựa trên mô hình rubric STAR (Situation, Task, Action, Result).

Sở dĩ AI mang lại hiệu quả vượt trội so với các giải pháp truyền thống là nhờ khả năng phân tích và đối soát CV với hàng loạt tiêu chí JD chỉ trong vài giây. Ngoài ra, AI còn cung cấp phản hồi cá nhân hóa 24/7, cho phép sinh viên chủ động luyện tập phỏng vấn lặp đi lặp lại không giới hạn số lần với chi phí tối ưu nhất.

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
