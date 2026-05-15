-- Per-view pasted-SVG logo override. Mirrors the workspace-level
-- branding_settings.logo_svg added in migration 018 but at the public_views
-- scope so individual views can ship their own inline-SVG logo without
-- changing workspace branding.

alter table public.public_views
  add column if not exists branding_logo_svg text;
