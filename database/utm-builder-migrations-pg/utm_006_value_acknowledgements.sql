CREATE TABLE IF NOT EXISTS utm_value_acknowledgements (
    id BIGSERIAL PRIMARY KEY,
    field TEXT NOT NULL,
    value TEXT NOT NULL,
    acknowledged_by_user_id BIGINT,
    acknowledged_by_name TEXT,
    created_at TIMESTAMPTZ NOT NULL,
    UNIQUE(field, value)
);
CREATE INDEX IF NOT EXISTS idx_utm_value_ack_field ON utm_value_acknowledgements(field);
