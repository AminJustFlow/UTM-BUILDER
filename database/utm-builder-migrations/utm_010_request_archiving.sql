ALTER TABLE requests ADD COLUMN archived_at TEXT;
ALTER TABLE requests ADD COLUMN archived_by_user_id INTEGER;
ALTER TABLE requests ADD COLUMN archived_by_name TEXT;
CREATE INDEX IF NOT EXISTS idx_requests_archived_at ON requests(archived_at);
