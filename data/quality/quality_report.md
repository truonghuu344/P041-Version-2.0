# 📊 Báo cáo Đánh giá Dữ liệu (CV & JD Evaluation Report)
*Cập nhật lần cuối: 2026-08-11 12:09:32*

## 1. Đánh giá Tập dữ liệu CV (Hồ sơ ứng viên)
- **Tổng số lượng**: 100 CVs đã được làm sạch.
- **Độ dài trung bình cột Kỹ năng (Skills)**: 8 từ / CV.
- **Số năm kinh nghiệm trung bình**: 2.3 năm.
- **Top 5 Ngành nghề/Vị trí phổ biến nhất trong tập CV**:
- **Cloud Architect**: 5 CVs
- **Cybersecurity Engineer**: 4 CVs
- **Prompt Engineer**: 4 CVs
- **Data Scientist**: 4 CVs
- **Quantum Computing Specialist**: 4 CVs

*Nhận xét CV*: Tập CV có độ đa dạng vị trí tốt, hỗ trợ kiểm thử case "CV trái ngành".

## 2. Đánh giá Tập dữ liệu JD (Mô tả công việc)
- **Tổng số lượng**: 57 JDs đã được làm sạch.
- **Độ dài trung bình yêu cầu (Requirements)**: 103 từ / JD.
- **Số lượng kỹ năng trung bình yêu cầu**: 2.8 kỹ năng / JD.
- **Top 5 Vị trí tuyển dụng phổ biến nhất**:
- **[HN] Công ty TNHH Admatic Tuyển Dụng Cộng Tác Viên Lập Trình Web-PHP-Laravel 2017**: 1 JDs
- **[HCM] Unik Technology Tuyển Dụng Developers 2017**: 1 JDs
- **[HN] SCUTI tuyển dụng Senior React JS Developer lương $800-$1200**: 1 JDs
- **[HN] TUYỂN THỰC TẬP SINH JAVA !!!!!**: 1 JDs
- **[HN] THỰC TẬP SINH JAVA**: 1 JDs

*Nhận xét JD*: Toàn bộ JDs tập trung mạnh vào mảng IT, lý tưởng để làm mốc đối chiếu với các CV Sales/HR nhằm phát hiện Skill Gap.

## 3. Khuyến nghị cho Mô hình Reranker
Hệ thống Backend cần chạy qua 2 Test Case chính:
1. **CV Trái Ngành**: Reranker phải đọc Context và lọc ra được các CV Sales/HR khi apply vào các Job IT.
2. **Thiếu Skill**: Reranker phải trừ điểm nếu CV thiếu các kỹ năng cứng trong JD (VD: JD yêu cầu 5 kỹ năng nhưng CV chỉ có 2).
