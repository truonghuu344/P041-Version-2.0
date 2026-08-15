-- CV Variant & evidence-preserving optimization (PostgreSQL)
-- Upgrade: apply the statements above the DOWN marker in one transaction.
-- Production rollback policy: export published PDFs/audit rows before running DOWN.

BEGIN;

CREATE TABLE IF NOT EXISTS cv_templates (
    id VARCHAR(36) PRIMARY KEY,
    version INTEGER NOT NULL DEFAULT 1,
    name VARCHAR(80) NOT NULL,
    schema_json JSON NOT NULL,
    renderer_config JSON NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_cv_template_name_version ON cv_templates(name, version);

CREATE TABLE IF NOT EXISTS cv_variants (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_cv_snapshot_id VARCHAR(36) REFERENCES cv_snapshots(id) ON DELETE RESTRICT,
    target_jd_snapshot_id VARCHAR(36) NOT NULL REFERENCES jd_snapshots(id) ON DELETE RESTRICT,
    match_id VARCHAR(64) REFERENCES matches(id) ON DELETE SET NULL,
    template_id VARCHAR(36) NOT NULL REFERENCES cv_templates(id) ON DELETE RESTRICT,
    mode VARCHAR(16) NOT NULL,
    title VARCHAR(255) NOT NULL,
    content_json JSON NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    prompt_version VARCHAR(64) NOT NULL,
    pipeline_version VARCHAR(40) NOT NULL,
    validator_result_json JSON,
    ai_metadata_json JSON,
    rendered_uri VARCHAR(1000),
    rendered_checksum VARCHAR(64),
    trace_id VARCHAR(64) NOT NULL,
    idempotency_key VARCHAR(255),
    revision_no INTEGER NOT NULL DEFAULT 1,
    published_at TIMESTAMPTZ,
    retention_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_cv_variants_user_status_created ON cv_variants(user_id, status, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_cv_variants_user_idempotency ON cv_variants(user_id, idempotency_key);

CREATE TABLE IF NOT EXISTS cv_variant_claims (
    id VARCHAR(36) PRIMARY KEY,
    variant_id VARCHAR(36) NOT NULL REFERENCES cv_variants(id) ON DELETE CASCADE,
    claim_key VARCHAR(255) NOT NULL,
    claim_text TEXT NOT NULL,
    source_evidence_ids JSON NOT NULL,
    source_spans_json JSON NOT NULL,
    validation_status VARCHAR(30) NOT NULL,
    validator_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_cv_variant_claims_variant_status ON cv_variant_claims(variant_id, validation_status);

CREATE TABLE IF NOT EXISTS cv_variant_revisions (
    id VARCHAR(36) PRIMARY KEY,
    variant_id VARCHAR(36) NOT NULL REFERENCES cv_variants(id) ON DELETE CASCADE,
    revision_no INTEGER NOT NULL,
    content_json JSON NOT NULL,
    editor_type VARCHAR(20) NOT NULL,
    editor_user_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
    change_summary VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_cv_variant_revision ON cv_variant_revisions(variant_id, revision_no);

COMMIT;

-- DOWN (manual, destructive; published audit history will be lost):
-- BEGIN;
-- DROP TABLE IF EXISTS cv_variant_revisions;
-- DROP TABLE IF EXISTS cv_variant_claims;
-- DROP TABLE IF EXISTS cv_variants;
-- DROP TABLE IF EXISTS cv_templates;
-- COMMIT;
