CREATE OR REPLACE FUNCTION public.is_valid_cf(_cf TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
IMMUTABLE
SET search_path = public
AS $$
  SELECT _cf IS NULL OR _cf = '' OR _cf ~ '^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$'
$$;