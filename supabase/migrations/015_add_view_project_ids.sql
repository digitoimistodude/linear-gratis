-- Allow a single public_view to display issues from multiple Linear projects.
-- Adds parallel array columns alongside the existing single project_id/project_name
-- columns. The old columns are kept for backwards compatibility (populated with
-- the first element on write) and will be dropped in a follow-up migration once
-- all readers have been updated.

ALTER TABLE public_views
  ADD COLUMN IF NOT EXISTS project_ids TEXT[] DEFAULT '{}'::TEXT[],
  ADD COLUMN IF NOT EXISTS project_names TEXT[] DEFAULT '{}'::TEXT[];

-- Backfill: every existing single-project view becomes a one-element array.
UPDATE public_views
SET project_ids = ARRAY[project_id],
    project_names = ARRAY[COALESCE(project_name, '')]
WHERE project_id IS NOT NULL
  AND (project_ids IS NULL OR array_length(project_ids, 1) IS NULL);

CREATE INDEX IF NOT EXISTS idx_public_views_project_ids ON public_views USING GIN (project_ids);
