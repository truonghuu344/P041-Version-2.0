# Báo cáo Nghiệm thu Vai trò Thành viên 4
**Feature:** Match Evaluation Modal & Gap-to-Action (end-to-end)
**Trạng thái:** Hoàn thành (MVP Desktop Web)

## 1. Công việc đã hoàn thành

### 1.1. Backend & Data (Hoàn thiện Luồng chấm điểm)
- **Cấu trúc lại tiêu chí:** Đã sửa lỗi map thiếu các category (`JD_CERTIFICATION`, `JD_LANGUAGE`) vào nhóm `CRIT_PREFERRED_SKILL`, giúp tab "Kỹ năng ưu tiên" hiển thị đúng dữ liệu thay vì bị trống.
- **Khắc phục lỗi Embedding/Semantic Search (0/40):** Xác định và hướng dẫn fix tận gốc lỗi lưu vết API Key (Memory Leak của `os.environ` trong Uvicorn), đảm bảo hệ thống sử dụng đúng model `gemini-embedding-2` thay vì bị rớt xuống thuật toán MD5 (lý do gây ra lỗi điểm kinh nghiệm 0/40).
- **Thuật toán Gap-to-Action:** Xác thực hệ thống tính điểm ưu tiên cải thiện (Deterministic Gap Priority) hoạt động chính xác thông qua 17/17 Unit Tests (Passed). Đáp ứng chuẩn: đưa tiêu chí bắt buộc (Mandatory) lên đầu, xử lý ngoại lệ ổn định và không phát sinh ảo giác (hallucinations) từ LLM.

### 1.2. Frontend (Giao diện Modal & Bằng chứng)
- **Match Evaluation Modal:** Đã xây dựng trọn vẹn Modal với hệ thống thẻ Tabs (Tổng quan, Đã phù hợp, Cần cải thiện, Tất cả tiêu chí).
- **Ngăn Bằng chứng (Evidence Drawer):**
  - Xử lý vấn đề bôi vàng toàn bộ đoạn văn bản dài: Áp dụng thuật toán trích xuất các câu có chứa từ khóa liên quan, rút gọn phần văn bản thừa bằng dấu `[...]` và highlight `<mark>` chính xác từ khóa để người dùng dễ dàng kiểm chứng.
  - Sửa lỗi hiển thị "Liên quan 3%": Chuyển đổi từ việc hiển thị điểm xếp hạng Reciprocal Rank Fusion (RRF) gây hiểu lầm sang hiển thị Semantic Score (Độ tương đồng ngữ nghĩa), giúp phần trăm trở nên hợp lý và trực quan (VD: 88%).
- **Trợ năng (Accessibility - A11y):** Đã đảm bảo Modal xử lý tốt các luồng Focus Trap, hỗ trợ đóng bằng phím `Esc` và có nhãn `aria-labelledby` phục vụ trình đọc màn hình.

---

## 2. Các điểm cần cải thiện & Đề xuất bổ sung

Mặc dù MVP trên nền tảng máy tính đã hoàn tất, để sẵn sàng Scale hoặc tiến lên phiên bản chuẩn chỉnh hơn, nhóm cần lưu ý các điểm sau:

1. **Bộ dữ liệu chuẩn (Golden Set) & Benchmark:**
   - *Hiện trạng:* File `golden_set.json` mới chỉ có 5 bộ dữ liệu test. Hàm Benchmark hiện tại đang sử dụng chế độ chạy giả lập (`dry-run`) sinh kết quả ngẫu nhiên để test script, không đánh giá được sức mạnh thực sự của AI.
   - *Đề xuất:* Team AI/Data cần xây dựng và gán nhãn thủ công đủ 50 cặp CV-JD. Sau đó upload lên hệ thống để chạy Benchmark thật, đảm bảo độ chính xác (Precision/Recall) của mô hình không bị suy giảm trong các lần cập nhật sau.

2. **Cải tiến Highlight Bằng chứng từ Backend:**
   - *Hiện trạng:* Frontend đang dùng regex và thuật toán tách từ (Stemming heuristics) để tự highlight bằng chứng từ các đoạn (chunks) dài do Backend trả về.
   - *Đề xuất:* Backend cần nâng cấp Pipeline để AI trả về chính xác tọa độ vị trí của bằng chứng (thông qua `span_start` và `span_end`). Từ đó, Frontend chỉ việc highlight theo Index, đảm bảo độ chính xác tuyệt đối 100%.

3. **Cải thiện việc hiển thị danh sách CV đã upload:**
- *Hiện trạng:* Upload 1 CV nhiều lần thì hệ thống vẫn ghi nhận thành nhiều bản (thay vì chỉ 1).
- *Đề xuất:* Tối ưu hóa việc hiển thị danh sách CV đã upload, đảm bảo chỉ hiển thị 1 CV duy nhất.

