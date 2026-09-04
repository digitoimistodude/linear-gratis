import { Buffer } from 'node:buffer'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { getAccessCookieSecret } from '@/lib/access-cookie'

/**
 * Linear keeps issue images and attachments on uploads.linear.app, which
 * answers 401 to anyone without a Linear session or API token. Shared views
 * are read by outsiders, so markdown that embeds such a file has to point at
 * our own origin instead, where the file proxy route fetches it with the view
 * owner's token and streams it back.
 *
 * Every rewritten URL carries an HMAC over (view id, file path). The proxy
 * refuses anything it did not sign, so a valid view slug never becomes an open
 * proxy for arbitrary workspace files: a path is only signed while we are
 * serving content that already passed the view's scope checks.
 */

export const LINEAR_UPLOADS_HOST = 'uploads.linear.app'

// Linear emits UUID segments, but older uploads can end in a file name, so
// accept the URL-safe character set rather than assuming UUIDs.
const UPLOAD_PATH_RE = /^[A-Za-z0-9._~-]+(?:\/[A-Za-z0-9._~-]+)*$/

// Matches https://uploads.linear.app/<path> plus an optional query string. The
// query is dropped on purpose: Linear appends a ?signature= that expires within
// minutes, and the proxy authenticates with the token instead. The match stops
// at whitespace and markdown or HTML delimiters.
const UPLOAD_URL_RE = /https:\/\/uploads\.linear\.app\/([A-Za-z0-9._~/-]+)(\?[^\s)"'<>]*)?/g

export function isLinearUploadPath(path: string): boolean {
  if (!UPLOAD_PATH_RE.test(path)) return false
  return !path.split('/').some((segment) => segment === '.' || segment === '..')
}

export function signLinearFilePath(viewId: string, path: string): string {
  return createHmac('sha256', getAccessCookieSecret())
    .update(`linear-file:${viewId}:${path}`)
    .digest('hex')
}

export function verifyLinearFileSignature(
  viewId: string,
  path: string,
  signature: string | null | undefined,
): boolean {
  if (!signature) return false
  const given = Buffer.from(signature, 'utf8')
  const expected = Buffer.from(signLinearFilePath(viewId, path), 'utf8')
  if (given.length !== expected.length) return false
  return timingSafeEqual(given, expected)
}

/** Same-origin URL the browser loads instead of uploads.linear.app. */
export function linearFileProxyUrl(view: { slug: string; id: string }, path: string): string {
  return `/api/public-view/${encodeURIComponent(view.slug)}/file/${path}?sig=${signLinearFilePath(view.id, path)}`
}

/**
 * Rewrites every uploads.linear.app URL in `markdown` to its signed proxy URL
 * for `view`. Call this on any Linear-authored text a public endpoint returns
 * for rendering. Non-string input passes through untouched.
 */
export function rewriteLinearUploadUrls<T extends string | null | undefined>(
  markdown: T,
  view: { slug: string; id: string },
): T {
  if (typeof markdown !== 'string' || markdown.length === 0) return markdown
  return markdown.replace(UPLOAD_URL_RE, (match: string, path: string) =>
    isLinearUploadPath(path) ? linearFileProxyUrl(view, path) : match,
  ) as T
}
