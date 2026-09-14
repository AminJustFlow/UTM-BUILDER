UPDATE requests
SET normalized_payload = jsonb_set(
  jsonb_set(
    normalized_payload::jsonb,
    '{client}',
    to_jsonb(CASE lower(normalized_payload::jsonb->>'client') WHEN 'sfg' THEN 'studleys' WHEN 'cic' THEN 'castle' ELSE lower(normalized_payload::jsonb->>'client') END),
    true
  ),
  '{client_display_name}',
  to_jsonb(CASE
    WHEN lower(normalized_payload::jsonb->>'client') IN ('sfg', 'studleys') THEN COALESCE((SELECT NULLIF(display_name, '') FROM client_management WHERE client_key = 'studleys' AND purged = FALSE), 'Studleys')
    WHEN lower(normalized_payload::jsonb->>'client') IN ('cic', 'castle') THEN COALESCE((SELECT NULLIF(display_name, '') FROM client_management WHERE client_key = 'castle' AND purged = FALSE), 'Castle In The Clouds')
    ELSE COALESCE(normalized_payload::jsonb->>'client_display_name', normalized_payload::jsonb->>'client')
  END),
  true
)::text
WHERE lower(normalized_payload::jsonb->>'client') IN ('sfg', 'studleys', 'cic', 'castle');

UPDATE requests
SET parsed_payload = jsonb_set(
  jsonb_set(
    parsed_payload::jsonb,
    '{client}',
    to_jsonb(CASE lower(parsed_payload::jsonb->>'client') WHEN 'sfg' THEN 'studleys' WHEN 'cic' THEN 'castle' ELSE lower(parsed_payload::jsonb->>'client') END),
    true
  ),
  '{client_display_name}',
  to_jsonb(CASE
    WHEN lower(parsed_payload::jsonb->>'client') IN ('sfg', 'studleys') THEN COALESCE((SELECT NULLIF(display_name, '') FROM client_management WHERE client_key = 'studleys' AND purged = FALSE), 'Studleys')
    WHEN lower(parsed_payload::jsonb->>'client') IN ('cic', 'castle') THEN COALESCE((SELECT NULLIF(display_name, '') FROM client_management WHERE client_key = 'castle' AND purged = FALSE), 'Castle In The Clouds')
    ELSE COALESCE(parsed_payload::jsonb->>'client_display_name', parsed_payload::jsonb->>'client')
  END),
  true
)::text
WHERE parsed_payload IS NOT NULL
  AND parsed_payload <> ''
  AND lower(parsed_payload::jsonb->>'client') IN ('sfg', 'studleys', 'cic', 'castle');

UPDATE generated_links SET client = 'studleys' WHERE lower(client) = 'sfg';
UPDATE generated_links SET client = 'castle' WHERE lower(client) = 'cic';
