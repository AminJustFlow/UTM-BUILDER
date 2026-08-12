DROP INDEX IF EXISTS idx_requests_active_utm_identity;

CREATE UNIQUE INDEX idx_requests_active_utm_identity
ON requests(utm_identity_key)
WHERE utm_identity_key IS NOT NULL
  AND archived_at IS NULL
  AND status IN ('normalized', 'completed', 'completed_without_short_link');
