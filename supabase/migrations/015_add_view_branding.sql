-- Per-view branding overrides. When set, these take precedence over the
-- view owner's global branding_settings for the specific public view.
ALTER TABLE public_views ADD COLUMN IF NOT EXISTS branding_logo_url TEXT;
ALTER TABLE public_views ADD COLUMN IF NOT EXISTS branding_primary_color TEXT;
