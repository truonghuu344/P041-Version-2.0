-- Một snapshot cho mỗi (nguồn, nội dung): unique index trên
-- cv_snapshots (cv_id, source_hash) và jd_snapshots (jd_id, source_hash).
--
-- VÌ SAO CẦN: get_or_create_cv_snapshot() / get_or_create_jd_snapshot() trong
-- backend/src/services/pipeline_context.py tra cứu theo source_hash rồi mới
-- ghi. Ràng buộc uq_cv_snapshot_version chỉ chặn được khi hai request song
-- song cùng tính ra MỘT số version; nếu request kia kịp ghi xong trước khi
-- mình đọc max(version_number) thì mình tính ra số kế tiếp và INSERT trót
-- lọt — sinh ra hàng thứ hai trùng hệt nội dung. Snapshot là ranh giới cache
-- của cả ba luồng (phân tích, so khớp, phỏng vấn) nên hàng trùng làm hỏng
-- việc tái dùng chứ không chỉ tốn chỗ. Index này đóng nốt cửa sổ đó ở tầng DB.
--
-- CẢNH BÁO TRƯỚC KHI CHẠY: nếu DB đang có hàng trùng thì CREATE UNIQUE INDEX
-- sẽ fail. Migration này tự gộp trước — giữ bản có version_number NHỎ NHẤT
-- làm canonical, chuyển mọi tham chiếu sang bản đó rồi mới xoá bản trùng.
-- Toàn bộ nằm trong một transaction: hỏng ở bước nào thì không đổi gì cả.
--
-- Chạy khối TIỀN KIỂM bên dưới trước để biết sẽ đụng bao nhiêu hàng.
-- RAISE NOTICE trong lúc chạy cũng in ra con số đó.
--
-- Hợp đồng phía ứng dụng: backend/src/db/models.py::CVSnapshot / JDSnapshot.

-- ---------------------------------------------------------------------------
-- TIỀN KIỂM (chạy riêng, chỉ đọc, an toàn bất cứ lúc nào):
--
--   SELECT 'cv' AS kind, cv_id AS source_id, source_hash, COUNT(*) AS n
--   FROM cv_snapshots GROUP BY cv_id, source_hash HAVING COUNT(*) > 1
--   UNION ALL
--   SELECT 'jd', jd_id, source_hash, COUNT(*)
--   FROM jd_snapshots GROUP BY jd_id, source_hash HAVING COUNT(*) > 1;
--
-- Không trả về hàng nào nghĩa là migration chỉ tạo index, không đụng dữ liệu.
-- ---------------------------------------------------------------------------

BEGIN;

-- 1. Ánh xạ bản trùng -> bản canonical (version_number nhỏ nhất).
CREATE TEMP TABLE snapshot_merge_map (
    kind         TEXT        NOT NULL,
    duplicate_id VARCHAR(36) NOT NULL,
    canonical_id VARCHAR(36) NOT NULL
) ON COMMIT DROP;

INSERT INTO snapshot_merge_map (kind, duplicate_id, canonical_id)
SELECT 'cv', ranked.id, ranked.canonical_id
FROM (
    SELECT
        id,
        FIRST_VALUE(id) OVER (
            PARTITION BY cv_id, source_hash ORDER BY version_number, id
        ) AS canonical_id
    FROM cv_snapshots
) AS ranked
WHERE ranked.id <> ranked.canonical_id;

INSERT INTO snapshot_merge_map (kind, duplicate_id, canonical_id)
SELECT 'jd', ranked.id, ranked.canonical_id
FROM (
    SELECT
        id,
        FIRST_VALUE(id) OVER (
            PARTITION BY jd_id, source_hash ORDER BY version_number, id
        ) AS canonical_id
    FROM jd_snapshots
) AS ranked
WHERE ranked.id <> ranked.canonical_id;

CREATE INDEX ON snapshot_merge_map (kind, duplicate_id);

DO $$
DECLARE
    n_cv INTEGER;
    n_jd INTEGER;
BEGIN
    SELECT COUNT(*) INTO n_cv FROM snapshot_merge_map WHERE kind = 'cv';
    SELECT COUNT(*) INTO n_jd FROM snapshot_merge_map WHERE kind = 'jd';
    RAISE NOTICE 'Se gop % CV snapshot va % JD snapshot trung noi dung.', n_cv, n_jd;
END $$;

-- 2. interview_agendas — phải xử lý TRƯỚC khi repoint.
--
-- Bảng này có uq_interview_agenda_pair (user_id, cv_snapshot_id,
-- jd_snapshot_id). Sau khi repoint, hai agenda vốn trỏ vào hai snapshot trùng
-- sẽ cùng trỏ về một cặp canonical và đụng ràng buộc đó. Giữ bản cũ nhất —
-- agenda chỉ là bộ câu hỏi sinh sẵn, và nội dung hai bản là như nhau vì cùng
-- một cặp CV+JD.
--
-- Bọc trong to_regclass: bảng do migration 20260822_08 tạo, nhánh chưa có
-- tính năng agenda thì không có bảng và phải bỏ qua chứ không được lỗi.
DO $$
BEGIN
    IF to_regclass('public.interview_agendas') IS NULL THEN
        RAISE NOTICE 'Bo qua interview_agendas: bang chua ton tai tren DB nay.';
        RETURN;
    END IF;

    WITH resolved AS (
        SELECT
            a.id,
            a.user_id,
            COALESCE(mc.canonical_id, a.cv_snapshot_id) AS cv_final,
            COALESCE(mj.canonical_id, a.jd_snapshot_id) AS jd_final,
            a.created_at
        FROM interview_agendas a
        LEFT JOIN snapshot_merge_map mc
               ON mc.kind = 'cv' AND mc.duplicate_id = a.cv_snapshot_id
        LEFT JOIN snapshot_merge_map mj
               ON mj.kind = 'jd' AND mj.duplicate_id = a.jd_snapshot_id
    ),
    ranked AS (
        SELECT
            id,
            ROW_NUMBER() OVER (
                PARTITION BY user_id, cv_final, jd_final ORDER BY created_at, id
            ) AS rn
        FROM resolved
    )
    DELETE FROM interview_agendas
    WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

    UPDATE interview_agendas a
       SET cv_snapshot_id = m.canonical_id
      FROM snapshot_merge_map m
     WHERE m.kind = 'cv' AND a.cv_snapshot_id = m.duplicate_id;

    UPDATE interview_agendas a
       SET jd_snapshot_id = m.canonical_id
      FROM snapshot_merge_map m
     WHERE m.kind = 'jd' AND a.jd_snapshot_id = m.duplicate_id;
END $$;

-- 3. documents — xoá thay vì repoint.
--
-- Khoá chính của bảng này CHỨA LUÔN snapshot id ('DOC_CV_<snapshot_id>', xem
-- backend/src/services/match_persistence.py), nên repoint sẽ để lại id lệch
-- với nội dung, còn đổi id thì đụng khoá chính khi nhiều bản trùng cùng gộp
-- về một canonical. Đây là artifact dẫn xuất, không bảng nào tham chiếu tới
-- và match_persistence tự tạo lại khi thiếu, nên xoá là an toàn và tự lành.
DELETE FROM documents d
 USING snapshot_merge_map m
 WHERE d.source_snapshot_id = m.duplicate_id;

-- 4. Chuyển mọi tham chiếu khoá ngoại còn lại sang bản canonical.
--
-- Danh sách bảng/cột được SUY RA TỪ CATALOG chứ không viết tay. Viết tay đã
-- một lần sai: cột của cv_variants là source_cv_snapshot_id /
-- target_jd_snapshot_id chứ không phải cv_snapshot_id / jd_snapshot_id, mà
-- hai cột đó đặt ondelete=RESTRICT nên bỏ sót là migration chết ở bước 5.
-- Đọc từ pg_constraint thì không thể lệch tên, và một bảng tham chiếu mới
-- thêm sau này cũng tự động được xử lý.
--
-- Chỉ bắt được khoá ngoại THẬT. Tham chiếu mềm (documents.source_snapshot_id)
-- không có khoá ngoại nên phải xử lý riêng — xem bước 3.
DO $$
DECLARE
    ref RECORD;
BEGIN
    FOR ref IN
        SELECT
            con.conrelid::regclass::text AS tbl,
            att.attname                  AS col,
            CASE con.confrelid::regclass::text
                WHEN 'cv_snapshots' THEN 'cv'
                ELSE 'jd'
            END                          AS kind
        FROM pg_constraint con
        JOIN LATERAL unnest(con.conkey) AS k(attnum) ON TRUE
        JOIN pg_attribute att
          ON att.attrelid = con.conrelid AND att.attnum = k.attnum
        WHERE con.contype = 'f'
          AND con.confrelid IN ('cv_snapshots'::regclass, 'jd_snapshots'::regclass)
    LOOP
        -- interview_agendas cũng nằm trong danh sách này; bước 2 đã repoint
        -- xong nên câu lệnh ở đây chỉ khớp 0 hàng, vô hại.
        EXECUTE format(
            'UPDATE %s t SET %I = m.canonical_id '
            'FROM snapshot_merge_map m '
            'WHERE m.kind = %L AND t.%I = m.duplicate_id',
            ref.tbl, ref.col, ref.kind, ref.col
        );
    END LOOP;
END $$;

-- 5. Không còn ai trỏ vào bản trùng nữa — xoá được.
--
-- Thứ tự quan trọng: cv_variants đặt ondelete=RESTRICT nên sẽ CHẶN bước này
-- nếu bước 4 bỏ sót, còn interview_agendas đặt ondelete=CASCADE nên sẽ âm thầm
-- kéo agenda đi theo. Cả hai đều đã được xử lý ở trên.
DELETE FROM cv_snapshots
 WHERE id IN (SELECT duplicate_id FROM snapshot_merge_map WHERE kind = 'cv');

DELETE FROM jd_snapshots
 WHERE id IN (SELECT duplicate_id FROM snapshot_merge_map WHERE kind = 'jd');

-- 6. Ràng buộc thật.
CREATE UNIQUE INDEX IF NOT EXISTS uq_cv_snapshot_source
    ON cv_snapshots (cv_id, source_hash);

CREATE UNIQUE INDEX IF NOT EXISTS uq_jd_snapshot_source
    ON jd_snapshots (jd_id, source_hash);

COMMIT;

-- DOWN (thủ công, KHÔNG khôi phục được dữ liệu đã gộp — snapshot trùng và
-- documents đã xoá thì mất hẳn, chỉ gỡ được ràng buộc):
-- DROP INDEX IF EXISTS uq_cv_snapshot_source;
-- DROP INDEX IF EXISTS uq_jd_snapshot_source;
