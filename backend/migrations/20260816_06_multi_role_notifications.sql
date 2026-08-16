-- Multi-role two-way notifications table and preferences
CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(36) PRIMARY KEY,
    recipient_user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_role VARCHAR(50) NOT NULL,
    actor_user_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
    actor_role VARCHAR(50),
    type VARCHAR(80) NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'application',
    entity_type VARCHAR(50) NOT NULL DEFAULT 'application',
    entity_id VARCHAR(36),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    priority VARCHAR(20) NOT NULL DEFAULT 'normal',
    action_url VARCHAR(500) NOT NULL,
    company_id VARCHAR(36),
    job_id VARCHAR(36),
    application_id VARCHAR(36),
    candidate_id VARCHAR(36),
    advisor_id VARCHAR(36),
    metadata_json JSON,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_notifications_recipient_created
    ON notifications (recipient_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_notifications_recipient_unread
    ON notifications (recipient_user_id, is_read);

CREATE INDEX IF NOT EXISTS ix_notifications_category
    ON notifications (recipient_user_id, category);

CREATE TABLE IF NOT EXISTS notification_preferences (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    email_job_alerts BOOLEAN NOT NULL DEFAULT TRUE,
    email_application_updates BOOLEAN NOT NULL DEFAULT TRUE,
    email_interviews BOOLEAN NOT NULL DEFAULT TRUE,
    email_offers BOOLEAN NOT NULL DEFAULT TRUE,
    email_advisor_messages BOOLEAN NOT NULL DEFAULT TRUE,
    inapp_job_alerts BOOLEAN NOT NULL DEFAULT TRUE,
    inapp_advisor_updates BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
