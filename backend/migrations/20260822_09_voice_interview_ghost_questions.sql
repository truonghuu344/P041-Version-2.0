-- Dọn dữ liệu hỏng của các phiên phỏng vấn giọng nói (interview_sessions.mode = 'voice').
--
-- Nguyên nhân
-- -----------
-- POST /interviews/start sinh sẵn N hàng interview_questions với question_index
-- 0..N-1 cho MỌI phiên, kể cả voice. Nhưng luồng voice (ws_interview.py) không
-- dùng bộ câu hỏi đó — nó tự ghi các hàng của riêng mình, cũng bắt đầu từ 0.
-- Hệ quả trên dữ liệu cũ:
--   1. Mỗi phiên voice có N hàng "ma" không ai trả lời (user_answer IS NULL);
--   2. question_index trùng theo pattern 0,0,1,1,2,2,3,3,4,4,5,6,7,...;
--   3. Điểm STAR bị gán sai câu, vì mã cũ ghép hàng DB với kết quả chấm bằng
--      zip() theo vị trí — hàng ma nằm xen kẽ nên nhận điểm của câu thật.
--
-- Script này KHÔNG khôi phục được điểm đúng: thông tin để ghép cặp đã mất.
-- Nó xoá hàng ma và đặt star_score_json về NULL cho phần còn lại, để báo cáo
-- hiển thị "chưa chấm" thay vì một con số sai.
--
-- KHÔNG ảnh hưởng: interview_reports.total_score và star_scores_json được tính
-- từ danh sách hỏi–đáp thật, không đi qua phép zip() bị lỗi.
--
-- Còn tồn đọng (chấp nhận): với dữ liệu cũ, hàng question_index = 0 của mỗi
-- phiên voice thực ra là lời chào mở đầu chứ không phải câu hỏi phỏng vấn. Mã
-- mới không ghi hàng cho lượt chào nữa, nhưng ở đây không xoá nó để tránh làm
-- thủng dãy question_index của các phiên cũ.

-- 1. Xoá các hàng câu hỏi sinh sẵn mà không ai trả lời.
DELETE FROM interview_questions
WHERE user_answer IS NULL
  AND session_id IN (
      SELECT id FROM interview_sessions WHERE mode = 'voice'
  );

-- 2. Bỏ điểm STAR đã gán sai trên các hàng còn lại của phiên voice.
UPDATE interview_questions
SET star_score_json = NULL
WHERE session_id IN (
    SELECT id FROM interview_sessions WHERE mode = 'voice'
);

-- 3. Đồng bộ lại total_questions của phiên voice theo số hàng thật còn lại.
UPDATE interview_sessions
SET total_questions = (
    SELECT COUNT(*)
    FROM interview_questions q
    WHERE q.session_id = interview_sessions.id
)
WHERE mode = 'voice';
