CREATE TABLE IF NOT EXISTS link_audit_events (
    id BIGSERIAL PRIMARY KEY,
    fingerprint TEXT,
    request_id BIGINT,
    action TEXT NOT NULL,
    actor_user_id TEXT,
    actor_user_name TEXT,
    summary TEXT,
    created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_link_audit_fingerprint ON link_audit_events(fingerprint, created_at DESC, id DESC);
