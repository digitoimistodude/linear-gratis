-- Per-view, per-issue public description overrides. When a row exists for
-- (view_id, issue_id), the public view API replaces the Linear description
-- with the override content. The Linear description is never surfaced
-- alongside - the override is a full replacement, so admins can safely
-- strip internal context without leaking anything.

CREATE TABLE IF NOT EXISTS view_issue_description_overrides (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  view_id UUID NOT NULL REFERENCES public_views(id) ON DELETE CASCADE,
  issue_id TEXT NOT NULL,
  public_description TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (view_id, issue_id)
);

CREATE INDEX IF NOT EXISTS idx_view_issue_description_overrides_view
  ON view_issue_description_overrides(view_id);

ALTER TABLE view_issue_description_overrides ENABLE ROW LEVEL SECURITY;

-- Mirror the shared-views access model: any authenticated user can read and
-- write overrides for views in the workspace. Public (anon) readers never
-- hit this table directly - they receive the override content via the
-- public-view API using the service role.
CREATE POLICY "Authenticated can select view issue description overrides"
  ON view_issue_description_overrides
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated can insert view issue description overrides"
  ON view_issue_description_overrides
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can update view issue description overrides"
  ON view_issue_description_overrides
  FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "Authenticated can delete view issue description overrides"
  ON view_issue_description_overrides
  FOR DELETE TO authenticated
  USING (true);

-- Reuse the shared updated_at trigger function.
CREATE TRIGGER update_view_issue_description_overrides_updated_at
  BEFORE UPDATE ON view_issue_description_overrides
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
