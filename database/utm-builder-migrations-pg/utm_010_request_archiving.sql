ALTER TABLE requests ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS archived_by_user_id BIGINT;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS archived_by_name TEXT;
CREATE INDEX IF NOT EXISTS idx_requests_archived_at ON requests(archived_at);
