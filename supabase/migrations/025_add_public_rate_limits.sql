-- Rate-limit buckets for the unauthenticated write endpoints. Ported from
-- upstream 018_lockdown_public_metadata_surfaces.sql, renumbered into our
-- sequence because our 018 is add_logo_svg.
--
-- Only the service role may execute the function; the app calls it through the
-- service-role client and no client-side code touches the table.

BEGIN;

CREATE TABLE IF NOT EXISTS public_rate_limits (
  key text PRIMARY KEY,
  count integer NOT NULL,
  reset_at timestamptz NOT NULL
);

ALTER TABLE public_rate_limits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public_rate_limits FROM anon;

CREATE OR REPLACE FUNCTION consume_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
RETURNS TABLE(allowed boolean, retry_after_seconds integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  now_ts timestamptz := now();
  bucket_count integer;
  bucket_reset_at timestamptz;
BEGIN
  INSERT INTO public_rate_limits AS buckets (key, count, reset_at)
  VALUES (p_key, 1, now_ts + make_interval(secs => p_window_seconds))
  ON CONFLICT (key) DO UPDATE
    SET count = CASE
          WHEN buckets.reset_at <= now_ts THEN 1
          ELSE buckets.count + 1
        END,
        reset_at = CASE
          WHEN buckets.reset_at <= now_ts THEN now_ts + make_interval(secs => p_window_seconds)
          ELSE buckets.reset_at
        END
  RETURNING count, reset_at
  INTO bucket_count, bucket_reset_at;

  allowed := bucket_count <= p_limit;
  retry_after_seconds := greatest(1, ceil(extract(epoch from bucket_reset_at - now_ts))::integer);
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION consume_rate_limit(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION consume_rate_limit(text, integer, integer) TO service_role;

-- Stale buckets are harmless but unbounded, so give cleanup an index to use.
CREATE INDEX IF NOT EXISTS idx_public_rate_limits_reset_at
  ON public_rate_limits (reset_at);

COMMIT;
