CREATE TABLE IF NOT EXISTS application_status_notifications (
    id VARCHAR(36) PRIMARY KEY,
    application_id VARCHAR(36) NOT NULL REFERENCES job_applications(id) ON DELETE CASCADE,
    student_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(30) NOT NULL,
    read_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_application_status_notifications_student_created
    ON application_status_notifications (student_id, created_at DESC);
