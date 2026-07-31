ALTER TABLE requests ADD COLUMN IF NOT EXISTS dictionary_approved BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_requests_dictionary_approved
ON requests(dictionary_approved, status, created_at);
