-- Admin verification workflow for enterprise accounts.
--
-- Safe/additive: all statements are idempotent. Existing enterprise profiles
-- keep their data and start in the "pending" queue so an admin can review
-- them from /admin/enterprises.

ALTER TABLE enterprise_profiles
    ADD COLUMN IF NOT EXISTS verification_status VARCHAR(30) NOT NULL DEFAULT 'pending';

ALTER TABLE enterprise_profiles
    ADD COLUMN IF NOT EXISTS verification_note TEXT NULL;

ALTER TABLE enterprise_profiles
    ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ NULL;

-- Backfill guard for clients that inserted explicit NULLs.
UPDATE enterprise_profiles SET verification_status = 'pending' WHERE verification_status IS NULL;

CREATE INDEX IF NOT EXISTS ix_enterprise_profiles_verification_status
    ON enterprise_profiles(verification_status);
