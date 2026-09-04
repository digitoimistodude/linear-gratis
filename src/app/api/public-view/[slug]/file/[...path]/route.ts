import { NextRequest, NextResponse } from 'next/server'
import { getLinearToken } from '@/lib/linear-token'
import { authorisePublicView } from '@/lib/public-view-auth'
import {
  LINEAR_UPLOADS_HOST,
  isLinearUploadPath,
  verifyLinearFileSignature,
} from '@/lib/linear-files'

// Types a browser may render inline. Anything else goes out as a download, so
// an uploaded HTML or SVG file can never run as a document on our origin.
const INLINE_TYPE_RE = /^(?:image\/(?!svg)[a-z0-9.+-]+|video\/[a-z0-9.+-]+|audio\/[a-z0-9.+-]+|application\/pdf)$/i

/**
 * Streams a file from uploads.linear.app to an outsider viewing a shared view.
 * Linear only serves those files to a session or API token, so the browser
 * asks us instead and we fetch with the view owner's token.
 *
 * The URL must carry the per-view signature minted by rewriteLinearUploadUrls
 * when the surrounding markdown was served. That keeps this endpoint from
 * being an open proxy: it never fetches a path we did not put in front of this
 * view's audience. The access cookie for password-protected views is scoped to
 * /api/public-view/, so an <img> under this path sends it like any other call.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; path: string[] }> },
) {
  try {
    const { slug, path } = await params

    const auth = await authorisePublicView(slug, request)
    if (!auth.ok) return auth.response
    const view = auth.view

    const filePath = (path ?? []).join('/')
    const signature = request.nextUrl.searchParams.get('sig')
    if (!isLinearUploadPath(filePath) || !verifyLinearFileSignature(view.id, filePath, signature)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const token = await getLinearToken(view.user_id)
    if (!token) {
      return NextResponse.json(
        { error: 'Unable to load file - Linear API token not found' },
        { status: 500 },
      )
    }

    // Same header shape as our GraphQL calls; Linear documents that file
    // storage accepts the same token and authorization header as the API.
    const upstream = await fetch(`https://${LINEAR_UPLOADS_HOST}/${filePath}`, {
      headers: { Authorization: token.trim() },
    })

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: upstream.status === 404 ? 404 : 502 },
      )
    }

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream'
    const mediaType = contentType.split(';')[0].trim()

    const inline = INLINE_TYPE_RE.test(mediaType)

    // No Content-Length: fetch may have decompressed the body, so the upstream
    // value would not match what we stream.
    const headers = new Headers({
      'Content-Type': contentType,
      // Linear addresses files by immutable ids, so a browser can keep one for
      // a day. Private, because the view may sit behind a password and shared
      // caches must not hand the bytes to the next visitor.
      'Cache-Control': 'private, max-age=86400',
      'Content-Disposition': inline ? 'inline' : 'attachment',
      'X-Content-Type-Options': 'nosniff',
    })
    if (!inline) {
      // Should a browser render the download anyway, it runs scriptless in a
      // sandboxed origin.
      headers.set('Content-Security-Policy', "default-src 'none'; sandbox")
    }

    return new Response(upstream.body, { status: 200, headers })
  } catch (error) {
    console.error('Linear file proxy error:', error)
    return NextResponse.json({ error: 'Failed to load file' }, { status: 502 })
  }
}
