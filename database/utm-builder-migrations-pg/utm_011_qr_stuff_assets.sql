ALTER TABLE generated_links ADD COLUMN IF NOT EXISTS qr_preview_url TEXT;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS qr_preview_url TEXT;
