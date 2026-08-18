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

Người dùng chính (Primary User): Sinh viên năm 3–4 và mới tốt nghiệp đang chuẩn bị ứng tuyển các vị trí Internship, Fresher hoặc Entry-level; những người gặp khó khăn trong việc tối ưu CV theo từng JD và thiếu sự tự tin khi bước vào phỏng vấn thực tế.

Người dùng hỗ trợ (Secondary User): Cố vấn hướng nghiệp/Giảng viên tại các trường đại học cần một công cụ quản lý, giám sát tiến độ rèn luyện chuyên sâu và đưa ra phản hồi, định hướng bổ sung cho lượng lớn sinh viên.

## Kết quả mong đợi (Expected Outcome)

Sau 6 tuần, dự án sẽ hoàn thiện và demo một Web App thương mại hóa/MVP có hệ thống phân quyền rõ ràng giữa Sinh viên – Cố vấn, bao gồm các tính năng và tiêu chuẩn cốt lõi:Quản lý CV & Phân tích JD: Cho phép sinh viên tạo hoặc tải lên (upload) CV, dán/chọn JD công việc mục tiêu; hệ thống tự động bóc tách và phân tích khoảng trống kỹ năng/từ khóa (Gap Analysis) chỉ trong vài giây.Tối ưu hóa nội dung CV: Tự động đề xuất chỉnh sửa, bổ sung cấu trúc/bằng chứng định lượng dựa hoàn toàn trên kinh nghiệm thật của sinh viên (đảm bảo không bịa đặt, thổi phồng) và yêu cầu sinh viên duyệt nội dung trước khi xuất bản.Phòng phỏng vấn thử (Mock Interview): Giả lập phỏng vấn dạng Chat (5–7 câu hỏi/phiên) đóng vai nhà tuyển dụng, chủ động đặt câu hỏi đào sâu (follow-up) và tạo báo cáo đánh giá chi tiết theo khung rubric STAR (Situation, Task, Action, Result).Dashboard Cố vấn: Cung cấp giao diện quản lý giúp cố vấn dễ dàng theo dõi lịch sử luyện tập, sự cải thiện và tiến bộ của sinh viên đã được cấp quyền.Đóng gói & Đánh giá hiệu năng:Triển khai hệ thống trên hạ tầng Docker (Dockerized deployment) đi kèm bộ tài liệu hướng dẫn vận hành chi tiết.Đạt các chỉ số đo lường hiệu quả (KPIs): tỷ lệ sử dụng (Usage rate) $\ge 60\%$ và mức độ hài lòng của người dùng (CSAT) $\ge 4/5$.
