CREATE TABLE IF NOT EXISTS client_management (
  client_key TEXT PRIMARY KEY,
  display_name TEXT NOT NULL DEFAULT '',
  purged BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by_user_id BIGINT NULL,
  updated_by_name TEXT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
