-- Lock down the public comment and vote tables.
--
-- "Service role can manage all comments" was named for the service role but had
-- no TO clause, so Postgres applied it to PUBLIC. With the anon key (public by
-- design in this repo) anyone could read every comment including hidden and
-- unapproved ones, and update or delete any row. The service role bypasses RLS
-- entirely, so nothing legitimate depended on it.
--
-- Every application write to these tables goes through an API route using the
-- service-role client, and no client component reads them with the anon key, so
-- anon needs no access at all here.

BEGIN;

DROP POLICY IF EXISTS "Service role can manage all comments" ON view_comments;
DROP POLICY IF EXISTS "Anyone can read approved comments" ON view_comments;
DROP POLICY IF EXISTS "Anyone can insert comments" ON view_comments;

CREATE POLICY "Authenticated can read comments" ON view_comments
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Authenticated can moderate comments" ON view_comments
    FOR UPDATE TO authenticated
    USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can delete comments" ON view_comments
    FOR DELETE TO authenticated
    USING (true);

-- Roadmap child tables: anon could insert votes and comments directly, skipping
-- the API's validation, dedupe and IP hashing, and could delete any vote.
DROP POLICY IF EXISTS "Anyone can insert votes" ON roadmap_votes;
DROP POLICY IF EXISTS "Anyone can delete votes" ON roadmap_votes;
DROP POLICY IF EXISTS "Anyone can view votes" ON roadmap_votes;

CREATE POLICY "Authenticated can read votes" ON roadmap_votes
    FOR SELECT TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Anyone can insert comments" ON roadmap_comments;
DROP POLICY IF EXISTS "Anyone can view approved comments" ON roadmap_comments;

CREATE POLICY "Authenticated can read roadmap comments" ON roadmap_comments
    FOR SELECT TO authenticated
    USING (true);

-- Belt and braces: revoke the table grants the anon role inherits, so a future
-- permissive policy cannot re-open these tables on its own.
REVOKE ALL ON view_comments FROM anon;
REVOKE ALL ON roadmap_votes FROM anon;
REVOKE ALL ON roadmap_comments FROM anon;

-- Length limits mirroring the API checks, so a direct write can never store
-- more than the app would accept. NOT VALID keeps the migration from failing on
-- any legacy row that predates the limits.
ALTER TABLE view_comments
    DROP CONSTRAINT IF EXISTS view_comments_content_length;
ALTER TABLE view_comments
    ADD CONSTRAINT view_comments_content_length
    CHECK (char_length(content) BETWEEN 1 AND 2000) NOT VALID;

ALTER TABLE view_comments
    DROP CONSTRAINT IF EXISTS view_comments_author_name_length;
ALTER TABLE view_comments
    ADD CONSTRAINT view_comments_author_name_length
    CHECK (char_length(author_name) BETWEEN 1 AND 100) NOT VALID;

COMMIT;
