UPDATE requests
SET normalized_payload = json_set(
  normalized_payload,
  '$.client',
  CASE lower(json_extract(normalized_payload, '$.client'))
    WHEN 'sfg' THEN 'studleys'
    WHEN 'cic' THEN 'castle'
    ELSE lower(json_extract(normalized_payload, '$.client'))
  END,
  '$.client_display_name',
  CASE lower(json_extract(normalized_payload, '$.client'))
    WHEN 'sfg' THEN COALESCE((SELECT NULLIF(display_name, '') FROM client_management WHERE client_key = 'studleys' AND purged = 0), 'Studleys')
    WHEN 'studleys' THEN COALESCE((SELECT NULLIF(display_name, '') FROM client_management WHERE client_key = 'studleys' AND purged = 0), 'Studleys')
    WHEN 'cic' THEN COALESCE((SELECT NULLIF(display_name, '') FROM client_management WHERE client_key = 'castle' AND purged = 0), 'Castle In The Clouds')
    WHEN 'castle' THEN COALESCE((SELECT NULLIF(display_name, '') FROM client_management WHERE client_key = 'castle' AND purged = 0), 'Castle In The Clouds')
    ELSE COALESCE(json_extract(normalized_payload, '$.client_display_name'), json_extract(normalized_payload, '$.client'))
  END
)
WHERE json_valid(normalized_payload)
  AND lower(json_extract(normalized_payload, '$.client')) IN ('sfg', 'studleys', 'cic', 'castle');

UPDATE requests
SET parsed_payload = json_set(
  parsed_payload,
  '$.client',
  CASE lower(json_extract(parsed_payload, '$.client'))
    WHEN 'sfg' THEN 'studleys'
    WHEN 'cic' THEN 'castle'
    ELSE lower(json_extract(parsed_payload, '$.client'))
  END,
  '$.client_display_name',
  CASE lower(json_extract(parsed_payload, '$.client'))
    WHEN 'sfg' THEN COALESCE((SELECT NULLIF(display_name, '') FROM client_management WHERE client_key = 'studleys' AND purged = 0), 'Studleys')
    WHEN 'studleys' THEN COALESCE((SELECT NULLIF(display_name, '') FROM client_management WHERE client_key = 'studleys' AND purged = 0), 'Studleys')
    WHEN 'cic' THEN COALESCE((SELECT NULLIF(display_name, '') FROM client_management WHERE client_key = 'castle' AND purged = 0), 'Castle In The Clouds')
    WHEN 'castle' THEN COALESCE((SELECT NULLIF(display_name, '') FROM client_management WHERE client_key = 'castle' AND purged = 0), 'Castle In The Clouds')
    ELSE COALESCE(json_extract(parsed_payload, '$.client_display_name'), json_extract(parsed_payload, '$.client'))
  END
)
WHERE json_valid(parsed_payload)
  AND lower(json_extract(parsed_payload, '$.client')) IN ('sfg', 'studleys', 'cic', 'castle');

UPDATE generated_links SET client = 'studleys' WHERE lower(client) = 'sfg';
UPDATE generated_links SET client = 'castle' WHERE lower(client) = 'cic';
