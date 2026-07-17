CREATE TABLE IF NOT EXISTS client_guidance_settings (
  client_key TEXT PRIMARY KEY,
  summary TEXT NOT NULL DEFAULT '',
  fields_json TEXT NOT NULL DEFAULT '{}',
  managed INTEGER NOT NULL DEFAULT 1,
  updated_by_user_id BIGINT NULL,
  updated_by_name TEXT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS client_campaign_profiles (
  id BIGSERIAL PRIMARY KEY,
  client_key TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 99,
  sort_order INTEGER NOT NULL DEFAULT 0,
  campaign TEXT NOT NULL,
  campaign_key TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  aliases_json TEXT NOT NULL DEFAULT '[]',
  guideline TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT '',
  medium TEXT NOT NULL DEFAULT '',
  term_label TEXT NOT NULL DEFAULT '',
  term_help TEXT NOT NULL DEFAULT '',
  term_placeholder TEXT NOT NULL DEFAULT '',
  content_label TEXT NOT NULL DEFAULT '',
  content_help TEXT NOT NULL DEFAULT '',
  content_placeholder TEXT NOT NULL DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 1,
  updated_by_user_id BIGINT NULL,
  updated_by_name TEXT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (client_key, campaign_key)
);

CREATE INDEX IF NOT EXISTS idx_client_campaign_profiles_client
  ON client_campaign_profiles(client_key, priority, sort_order, id);

CREATE TABLE IF NOT EXISTS client_guidance_audit_events (
  id BIGSERIAL PRIMARY KEY,
  client_key TEXT NOT NULL,
  profile_id BIGINT NULL,
  action TEXT NOT NULL,
  actor_user_id BIGINT NULL,
  actor_user_name TEXT NULL,
  summary TEXT NOT NULL DEFAULT '',
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_client_guidance_audit_client
  ON client_guidance_audit_events(client_key, created_at DESC, id DESC);
