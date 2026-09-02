-- Chuyển id mục agenda từ số thứ tự sang danh tính, ở CẢ HAI phía.
--
-- VÌ SAO CẦN: sanitize_agenda() từng gán id mục agenda theo VỊ TRÍ, nên id
-- không phải danh tính. Hai hệ quả:
--
--   1. Mọi agenda đều có 'A-001' — cầm mình id thì không biết nó thuộc agenda nào.
--   2. ensure_agenda(force_regenerate=True) ghi đè questions_json TẠI CHỖ, giữ
--      nguyên không gian id. Sau một lần bấm "Sinh lại", id cũ trỏ sang câu hỏi
--      khác và vẫn phân giải THÀNH CÔNG — sai mà không có cách nào phát hiện.
--
-- Code đã chuyển sang id ngẫu nhiên ('A-' + 32 hex, xem
-- backend/src/services/interview_agenda.py::_new_question_id) nên agenda sinh
-- MỚI đã an toàn. Nhưng agenda ĐÃ NẰM TRONG DATABASE vẫn mang id dạng cũ bên
-- trong questions_json, và chúng chỉ được thay khi người dùng bấm "Sinh lại".
--
-- PHẢI SỬA CẢ HAI PHÍA. Chỉ đổi interview_questions.agenda_question_id là vô
-- nghĩa: đích mà nó trỏ tới — mục trong questions_json — vẫn đang mang id dạng
-- cũ, nên không có id mới nào để trỏ sang. Migration này cấp id mới cho từng
-- mục agenda RỒI mới chuyển các tham chiếu, trong cùng một transaction.
--
-- CÁCH XỬ LÝ tham chiếu, ba nhánh:
--
--   A. Id cũ khớp một mục trong agenda của phiên, VÀ văn bản câu đã hỏi khớp
--      mục đó  -> liên kết là thật, chuyển sang id mới của mục đó.
--   B. Id cũ khớp một mục nhưng văn bản KHÔNG khớp -> agenda đã được sinh lại,
--      liên kết cũ vốn đã sai  -> NULL.
--   C. Không tìm được agenda/mục tương ứng  -> NULL.
--
-- interview_questions.question_text lưu nguyên văn câu đã hỏi nên nhánh B và C
-- không làm mất nội dung phỏng vấn, chỉ bỏ một con trỏ vốn không đáng tin.
--
-- Hợp đồng phía ứng dụng: backend/src/db/models.py::InterviewQuestion,
-- backend/src/services/interview_agenda.py.

-- ---------------------------------------------------------------------------
-- TIỀN KIỂM (chạy riêng, chỉ đọc, an toàn bất cứ lúc nào):
--
--   SELECT
--     (SELECT COUNT(*) FROM interview_agendas a
--        CROSS JOIN LATERAL json_array_elements(a.questions_json) item
--       WHERE item->>'id' ~ '^A-[0-9]{3}$')                    AS muc_agenda_dang_cu,
--     (SELECT COUNT(*) FROM interview_questions
--       WHERE agenda_question_id ~ '^A-[0-9]{3}$')             AS tham_chieu_dang_cu;
--
-- Cả hai bằng 0 nghĩa là không có gì để làm.
-- ---------------------------------------------------------------------------

BEGIN;

DO $$
DECLARE
    n_muc      INTEGER;
    n_ref      INTEGER;
    n_chuyen   INTEGER;
    n_null     INTEGER;
    n_agenda   INTEGER;
BEGIN
    -- Bảng và cột do migration 20260822_08 tạo. Nhánh chưa có tính năng agenda
    -- thì không có chúng và phải bỏ qua chứ không được lỗi.
    IF to_regclass('public.interview_agendas') IS NULL
       OR NOT EXISTS (
            SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public'
               AND table_name = 'interview_questions'
               AND column_name = 'agenda_question_id'
       )
    THEN
        RAISE NOTICE 'Bo qua: chua co interview_agendas hoac cot agenda_question_id.';
        RETURN;
    END IF;

    -- ---- Bản đồ: mỗi mục agenda dạng cũ nhận một id mới ----
    -- WITH ORDINALITY để biết vị trí phần tử, nhờ đó dựng lại mảng đúng thứ tự.
    -- Định dạng id trùng khớp _new_question_id(): 'A-' + 32 hex.
    CREATE TEMP TABLE agenda_item_newid ON COMMIT DROP AS
    SELECT
        a.id                                               AS agenda_id,
        item.ord                                           AS ord,
        item.value->>'id'                                  AS old_id,
        'A-' || replace(gen_random_uuid()::text, '-', '')  AS new_id,
        item.value                                         AS item
    FROM interview_agendas a
    CROSS JOIN LATERAL json_array_elements(a.questions_json)
        WITH ORDINALITY AS item(value, ord)
    WHERE json_typeof(a.questions_json) = 'array'
      AND item.value->>'id' ~ '^A-[0-9]{3}$';

    CREATE INDEX ON agenda_item_newid (agenda_id, old_id);

    SELECT COUNT(*) INTO n_muc FROM agenda_item_newid;
    SELECT COUNT(*) INTO n_ref
      FROM interview_questions WHERE agenda_question_id ~ '^A-[0-9]{3}$';

    IF n_muc = 0 AND n_ref = 0 THEN
        RAISE NOTICE 'Khong co id dang cu nao o ca hai phia. Khong doi gi.';
        RETURN;
    END IF;

    -- ---- Bước 1: chuyển tham chiếu, DÙNG BẢN ĐỒ chứ không đọc JSON đang sống ----
    -- Phải chạy TRƯỚC khi ghi đè questions_json, và điều kiện khớp văn bản là
    -- thứ phân biệt nhánh A với nhánh B.
    UPDATE interview_questions q
       SET agenda_question_id = m.new_id
      FROM interview_sessions s
      JOIN interview_agendas a
        ON a.user_id        = s.user_id
       AND a.cv_snapshot_id = s.cv_snapshot_id
       AND a.jd_snapshot_id = s.jd_snapshot_id
      JOIN agenda_item_newid m
        ON m.agenda_id = a.id
     WHERE s.id = q.session_id
       AND q.agenda_question_id ~ '^A-[0-9]{3}$'
       AND m.old_id = q.agenda_question_id
       AND (
             m.item->>'question_vi' = q.question_text
          OR m.item->>'question_en' = q.question_text
       );
    GET DIAGNOSTICS n_chuyen = ROW_COUNT;

    -- ---- Bước 2: phần còn lại là nhánh B và C ----
    UPDATE interview_questions
       SET agenda_question_id = NULL
     WHERE agenda_question_id ~ '^A-[0-9]{3}$';
    GET DIAGNOSTICS n_null = ROW_COUNT;

    -- ---- Bước 3: ghi lại questions_json với id mới ----
    -- Dựng lại từng mảng theo đúng thứ tự cũ; mục không nằm trong bản đồ
    -- (đã ở dạng mới) giữ nguyên không đụng tới.
    UPDATE interview_agendas a
       SET questions_json = sub.new_json
      FROM (
        SELECT
            a2.id AS agenda_id,
            json_agg(
                CASE
                    WHEN m.new_id IS NOT NULL
                    THEN jsonb_set(item.value::jsonb, '{id}', to_jsonb(m.new_id))::json
                    ELSE item.value
                END
                ORDER BY item.ord
            ) AS new_json
        FROM interview_agendas a2
        CROSS JOIN LATERAL json_array_elements(a2.questions_json)
            WITH ORDINALITY AS item(value, ord)
        LEFT JOIN agenda_item_newid m
               ON m.agenda_id = a2.id AND m.ord = item.ord
        WHERE json_typeof(a2.questions_json) = 'array'
        GROUP BY a2.id
      ) sub
     WHERE a.id = sub.agenda_id
       AND EXISTS (SELECT 1 FROM agenda_item_newid m WHERE m.agenda_id = a.id);
    GET DIAGNOSTICS n_agenda = ROW_COUNT;

    RAISE NOTICE 'Muc agenda dang cu: %. Tham chieu dang cu: %.', n_muc, n_ref;
    RAISE NOTICE 'Chuyen sang id moi: % tham chieu. Dat NULL: %. Agenda ghi lai: %.',
        n_chuyen, n_null, n_agenda;
END $$;

COMMIT;

-- DOWN: không có. Id mới là ngẫu nhiên nên không tái tạo được số thứ tự cũ, và
-- bản thân số thứ tự cũ đã không phải danh tính đáng tin. Muốn giữ nguyên trạng
-- thì phục hồi từ bản sao lưu interview_agendas + interview_questions.
