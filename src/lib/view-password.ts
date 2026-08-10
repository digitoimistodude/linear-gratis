/**
 * Shared plumbing for carrying a public view's password to the child endpoints.
 *
 * The parent endpoint (`/api/public-view/[slug]`) authenticates a visitor by
 * bcrypt-comparing a password POSTed in the body. The child endpoints are GETs
 * (and one POST) that used to skip that check entirely, so a password-protected
 * view's issues, comments, project updates and creation metadata were readable
 * without ever knowing the password. They now require the same secret, supplied
 * as a header so it never lands in a URL, access log or Referer.
 *
 * This module is imported by client components, so it must stay free of
 * bcrypt and other server-only dependencies. The verification half lives in
 * `view-password-check.ts`.
 */

export const VIEW_PASSWORD_HEADER = 'x-view-password';

/** localStorage key the public view page remembers a good password under. */
export const viewPasswordStorageKey = (slug: string) =>
  `public-view-password:${slug}`;

/** The remembered password for `slug`, or null when there isn't one. */
export function storedViewPassword(slug: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(viewPasswordStorageKey(slug));
  } catch {
    // localStorage unavailable (private mode, blocked cookies) - treat as absent
    return null;
  }
}

/**
 * Header bag to spread into a child-endpoint `fetch`. Empty when the visitor has
 * no remembered password, which is the normal case for an unprotected view.
 *
 * The value is percent-encoded, and must be: a header value is a byte sequence,
 * so `fetch` writes each JS code unit as one byte (latin-1). A password
 * containing "ä" would go out as 0xE4 while the runtime reading it back decodes
 * headers as UTF-8, where a lone 0xE4 is invalid and becomes U+FFFD - the
 * compare then fails for every non-ASCII password. encodeURIComponent keeps the
 * header pure ASCII so the bytes survive the round trip intact.
 */
export function viewPasswordHeaders(slug: string): Record<string, string> {
  const password = storedViewPassword(slug);
  return password
    ? { [VIEW_PASSWORD_HEADER]: encodeURIComponent(password) }
    : {};
}
