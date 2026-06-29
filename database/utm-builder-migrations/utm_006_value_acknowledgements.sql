CREATE TABLE IF NOT EXISTS utm_value_acknowledgements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    field TEXT NOT NULL,
    value TEXT NOT NULL,
    acknowledged_by_user_id INTEGER,
    acknowledged_by_name TEXT,
    created_at TEXT NOT NULL,
    UNIQUE(field, value)
);
CREATE INDEX IF NOT EXISTS idx_utm_value_ack_field ON utm_value_acknowledgements(field);
