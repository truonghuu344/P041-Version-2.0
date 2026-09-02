-- Agenda phỏng vấn sinh sẵn từ một cặp (CV snapshot, JD snapshot).
--
-- Khoá tái dùng là cặp *snapshot* chứ không phải cặp cv_id/jd_id: hai hàm
-- get_or_create_cv_snapshot() / get_or_create_jd_snapshot() trong
-- backend/src/services/pipeline_context.py đã băm theo nội dung, nên CV hoặc
-- JD đổi nội dung sẽ sinh snapshot mới và kéo theo agenda mới, còn nội dung
-- không đổi thì dùng lại agenda cũ. Điều này đưa chi phí sinh câu hỏi từ
-- "mỗi phiên phỏng vấn" xuống "mỗi cặp CV+JD" — đáng kể vì quota Gemini
-- free-tier chỉ 20 request/ngày.
--
-- Hợp đồng phía ứng dụng: backend/src/db/models.py::InterviewAgenda và
-- backend/src/services/interview_agenda.py.

CREATE TABLE IF NOT EXISTS interview_agendas (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    cv_snapshot_id VARCHAR(36) NOT NULL REFERENCES cv_snapshots(id) ON DELETE CASCADE,
    jd_snapshot_id VARCHAR(36) NOT NULL REFERENCES jd_snapshots(id) ON DELETE CASCADE,
    questions_json JSON NOT NULL,
    generated_by VARCHAR(64) NOT NULL DEFAULT 'fallback',
    revision_no INTEGER NOT NULL DEFAULT 1,
    -- NOT NULL để khớp với khai báo Mapped[datetime] (không Optional) trong
    -- models.py. Các migration cũ trong repo bỏ sót ràng buộc này.
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Một agenda cho mỗi (người dùng, CV snapshot, JD snapshot). Sinh lại thì
-- ghi đè questions_json và tăng revision_no, không tạo hàng mới.
CREATE UNIQUE INDEX IF NOT EXISTS uq_interview_agenda_pair
    ON interview_agendas (user_id, cv_snapshot_id, jd_snapshot_id);

CREATE INDEX IF NOT EXISTS ix_interview_agendas_user_id
    ON interview_agendas (user_id);

CREATE INDEX IF NOT EXISTS ix_interview_agendas_cv_snapshot_id
    ON interview_agendas (cv_snapshot_id);

CREATE INDEX IF NOT EXISTS ix_interview_agendas_jd_snapshot_id
    ON interview_agendas (jd_snapshot_id);

-- Truy vết một câu hỏi đã hỏi về đúng mục trong agenda. Nullable vì câu hỏi
-- của các phiên cũ (và phiên không dùng agenda) không có nguồn gốc agenda.
-- Không đặt ràng buộc khoá ngoại: giá trị tham chiếu tới phần tử BÊN TRONG
-- interview_agendas.questions_json chứ không phải một hàng riêng, nên khoá
-- ngoại không áp dụng được.
ALTER TABLE interview_questions
    ADD COLUMN IF NOT EXISTS agenda_question_id VARCHAR(36);

CREATE INDEX IF NOT EXISTS ix_interview_questions_agenda_question_id
    ON interview_questions (agenda_question_id);

-- DOWN (thủ công, mất dữ liệu: toàn bộ agenda đã sinh và mọi liên kết
-- agenda_question_id sẽ mất):
-- ALTER TABLE interview_questions DROP COLUMN IF EXISTS agenda_question_id;
-- DROP TABLE IF EXISTS interview_agendas;
