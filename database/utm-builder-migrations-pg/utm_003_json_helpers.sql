CREATE OR REPLACE FUNCTION jsonb_field(payload_text TEXT, field_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF payload_text IS NULL OR btrim(payload_text) = '' THEN
    RETURN NULL;
  END IF;

  RETURN payload_text::jsonb ->> field_name;
EXCEPTION
  WHEN others THEN
    RETURN NULL;
END;
$$;
