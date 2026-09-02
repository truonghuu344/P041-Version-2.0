-- Track where a job application came from: the student applied directly
-- ("self") or a counselor referred them ("counselor_referral").
--
-- Safe/additive: both statements are idempotent, existing rows keep their
-- status and are backfilled to 'self'.

ALTER TABLE job_applications
    ADD COLUMN IF NOT EXISTS source VARCHAR(30) NOT NULL DEFAULT 'self';

ALTER TABLE job_applications
    ADD COLUMN IF NOT EXISTS referred_by_counselor_id VARCHAR(36) NULL
        REFERENCES users(id) ON DELETE SET NULL;

-- Backfill guard: rows written before the DEFAULT existed (or by a client that
-- passed an explicit NULL) resolve to a direct application.
UPDATE job_applications SET source = 'self' WHERE source IS NULL;

CREATE INDEX IF NOT EXISTS ix_job_applications_source ON job_applications(source);
CREATE INDEX IF NOT EXISTS ix_job_applications_referred_by_counselor_id
    ON job_applications(referred_by_counselor_id);
