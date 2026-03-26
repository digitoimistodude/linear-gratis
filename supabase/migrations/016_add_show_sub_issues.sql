-- Add show_sub_issues toggle to public views (default true to show all issues)
ALTER TABLE public_views ADD COLUMN IF NOT EXISTS show_sub_issues BOOLEAN DEFAULT true;
