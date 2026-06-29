CREATE TABLE IF NOT EXISTS link_audit_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fingerprint TEXT,
    request_id INTEGER,
    action TEXT NOT NULL,
    actor_user_id TEXT,
    actor_user_name TEXT,
    summary TEXT,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_link_audit_fingerprint ON link_audit_events(fingerprint, created_at DESC, id DESC);
