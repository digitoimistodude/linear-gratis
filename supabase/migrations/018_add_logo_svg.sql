-- Add a column for pasted-SVG logo markup as an alternative to logo_url.
-- When set, the public surfaces render this inline instead of an <img> tag,
-- preserving sharpness and letting the SVG inherit theme colours via
-- currentColor / CSS variables.

alter table branding_settings
  add column if not exists logo_svg text;
