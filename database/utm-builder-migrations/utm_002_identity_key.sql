ALTER TABLE requests ADD COLUMN utm_identity_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_requests_active_utm_identity
ON requests(utm_identity_key)
WHERE utm_identity_key IS NOT NULL
  AND status IN ('normalized', 'completed', 'completed_without_short_link');
