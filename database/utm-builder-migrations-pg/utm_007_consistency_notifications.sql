CREATE TABLE IF NOT EXISTS consistency_notification_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  enabled INTEGER NOT NULL DEFAULT 0,
  recipients TEXT NOT NULL DEFAULT '[]',
  last_run_local_date TEXT NULL,
  last_result TEXT NULL,
  last_error TEXT NULL,
  updated_by_user_id BIGINT NULL,
  updated_by_name TEXT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO consistency_notification_settings (
  id, enabled, recipients, created_at, updated_at
) VALUES (1, 0, '[]', CURRENT_TIMESTAMP::TEXT, CURRENT_TIMESTAMP::TEXT)
ON CONFLICT (id) DO NOTHING;
