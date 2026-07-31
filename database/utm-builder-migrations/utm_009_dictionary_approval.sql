ALTER TABLE requests ADD COLUMN dictionary_approved INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_requests_dictionary_approved
ON requests(dictionary_approved, status, created_at);
