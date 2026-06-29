CREATE TABLE IF NOT EXISTS requests (
    id BIGSERIAL PRIMARY KEY,
    request_uuid TEXT NOT NULL UNIQUE,
    delivery_key TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL,
    original_message TEXT NOT NULL,
    raw_payload TEXT,
    parsed_payload TEXT,
    normalized_payload TEXT,
    fingerprint TEXT,
    final_long_url TEXT,
    short_url TEXT,
    qr_url TEXT,
    warnings TEXT,
    missing_fields TEXT,
    clickup_workspace_id TEXT,
    clickup_channel_id TEXT,
    clickup_message_id TEXT,
    clickup_thread_message_id TEXT,
    source_user_id TEXT,
    source_user_name TEXT,
    response_message_id TEXT,
    reused_existing INTEGER DEFAULT 0,
    openai_request_id TEXT,
    openai_model TEXT,
    bitly_id TEXT,
    bitly_payload TEXT,
    error_code TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_library_scope ON requests(status, created_at DESC, id DESC) WHERE final_long_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_requests_library_dedupe ON requests(COALESCE(NULLIF(fingerprint, ''), request_uuid), created_at DESC, id DESC) WHERE final_long_url IS NOT NULL;

CREATE TABLE IF NOT EXISTS generated_links (
    id BIGSERIAL PRIMARY KEY,
    fingerprint TEXT NOT NULL UNIQUE,
    client TEXT NOT NULL,
    channel TEXT NOT NULL,
    asset_type TEXT NOT NULL,
    normalized_destination_url TEXT NOT NULL,
    canonical_campaign TEXT NOT NULL,
    utm_source TEXT NOT NULL DEFAULT '',
    utm_medium TEXT NOT NULL DEFAULT '',
    utm_campaign TEXT NOT NULL DEFAULT '',
    utm_term TEXT NOT NULL DEFAULT '',
    utm_content TEXT NOT NULL DEFAULT '',
    final_long_url TEXT NOT NULL,
    short_url TEXT NOT NULL,
    qr_url TEXT,
    bitly_id TEXT,
    bitly_payload TEXT,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_generated_links_lookup ON generated_links(client, channel, canonical_campaign);
CREATE INDEX IF NOT EXISTS idx_generated_links_utm_fields ON generated_links(client, channel, utm_campaign, utm_source, utm_medium);
