// Minimal SVG sanitizer for owner-supplied logo markup. The branding admin is
// owner-only so this is mostly defence in depth, but we still strip the obvious
// XSS vectors before inlining the markup into other people's pages.
//
// Rules:
//   - drop <script>...</script>
//   - drop <foreignObject> (lets HTML/JS leak into SVG)
//   - drop on*= event handlers
//   - drop href / xlink:href values that start with javascript:
//   - drop <style> tags too, since arbitrary CSS in a public view can attack
//     the surrounding page via selectors targeting parent elements

export function sanitizeSvgMarkup(input: string | null | undefined): string {
  if (!input) return '';
  let s = input;

  s = s.replace(/<script\b[\s\S]*?<\/script>/gi, '');
  s = s.replace(/<style\b[\s\S]*?<\/style>/gi, '');
  s = s.replace(/<foreignObject\b[\s\S]*?<\/foreignObject>/gi, '');

  s = s.replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '');
  s = s.replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '');
  s = s.replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '');

  s = s.replace(/(href|xlink:href)\s*=\s*"\s*javascript:[^"]*"/gi, '$1=""');
  s = s.replace(/(href|xlink:href)\s*=\s*'\s*javascript:[^']*'/gi, "$1=''");

  return s.trim();
}

export function looksLikeSvg(input: string | null | undefined): boolean {
  if (!input) return false;
  return /<svg\b/i.test(input);
}
