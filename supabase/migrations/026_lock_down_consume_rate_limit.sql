-- Migration 025 revoked consume_rate_limit from PUBLIC, which is not enough on
-- Supabase: the anon and authenticated roles hold their own EXECUTE grant on
-- functions in the public schema, so anon could still call it. Verified against
-- production after 025 - an anon RPC call returned a real bucket.
--
-- The function is SECURITY DEFINER and writes to a table anon cannot touch, so
-- an unauthenticated caller could consume any key's budget by guessing it and
-- lock a specific customer out of commenting or voting.
--
-- Upstream's 018 has the same gap; this goes further deliberately.

BEGIN;

REVOKE EXECUTE ON FUNCTION consume_rate_limit(text, integer, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION consume_rate_limit(text, integer, integer) FROM authenticated;

-- Clear anything an anon caller managed to write before this landed.
DELETE FROM public_rate_limits WHERE key = 'probe';

COMMIT;
