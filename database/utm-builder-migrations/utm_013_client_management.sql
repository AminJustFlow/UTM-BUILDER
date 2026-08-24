CREATE TABLE IF NOT EXISTS client_management (
  client_key TEXT PRIMARY KEY,
  display_name TEXT NOT NULL DEFAULT '',
  purged INTEGER NOT NULL DEFAULT 0,
  updated_by_user_id INTEGER NULL,
  updated_by_name TEXT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
