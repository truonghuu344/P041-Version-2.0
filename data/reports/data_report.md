# Báo cáo Tổng hợp Hệ thống Dữ liệu (Final Data Report)
*Ngày thực hiện: 2026-08-11*

## Trạng thái Hoàn thành
- [x] Extract dữ liệu từ CSV (100 JD, 100 CV).
- [x] Hỗ trợ Extract dữ liệu từ PDF thông qua `unstructured` (Hơn 400 CV đa ngành).
- [x] Clean (Loại bỏ HTML, Unicode).
- [x] Đã khởi tạo cấu trúc Test Cases cho Evaluation RAG (CV trái ngành, CV thiếu skill).
- [x] Dữ liệu đã được load thành công vào bảng `raw_cvs` và `raw_jds` trên PostgreSQL.
- [ ] Backend thực hiện Chunking & Embedding.

## Khuyến nghị tiếp theo
Đội Backend có thể bắt đầu pull dữ liệu từ PostgreSQL để tiến hành Pipeline Vector Search.
