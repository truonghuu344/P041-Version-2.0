-- Candidate feedback for completed recruitment applications.
CREATE TABLE IF NOT EXISTS application_feedback (
    id VARCHAR(36) PRIMARY KEY,
    application_id VARCHAR(36) NOT NULL REFERENCES job_applications(id) ON DELETE CASCADE,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_application_feedback_application UNIQUE (application_id)
);

CREATE INDEX IF NOT EXISTS ix_application_feedback_application_id ON application_feedback(application_id);
CREATE INDEX IF NOT EXISTS ix_application_feedback_user_id ON application_feedback(user_id);
