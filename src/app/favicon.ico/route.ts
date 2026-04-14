import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Cache the favicon response for 5 minutes - branding doesn't change often
export const revalidate = 300;

const FALLBACK_FAVICON_URL = 'https://linear.gratis/favicon.ico';

export async function GET() {
  try {
    // Fetch the first branding_settings row that has a favicon_url.
    // For shared/team workspaces this is effectively a workspace-level favicon.
    const { data } = await supabaseAdmin
      .from('branding_settings')
      .select('favicon_url')
      .not('favicon_url', 'is', null)
      .limit(1)
      .maybeSingle();

    const faviconUrl = data?.favicon_url;
    if (!faviconUrl) {
      // Fall back to the upstream linear.gratis favicon
      const fallback = await fetch(FALLBACK_FAVICON_URL);
      return new NextResponse(fallback.body, {
        headers: {
          'Content-Type': fallback.headers.get('Content-Type') || 'image/x-icon',
          'Cache-Control': 'public, max-age=300',
        },
      });
    }

    // Proxy the branding favicon
    const response = await fetch(faviconUrl);
    if (!response.ok) {
      return new NextResponse(null, { status: 404 });
    }

    const contentType = response.headers.get('Content-Type') || 'image/x-icon';
    return new NextResponse(response.body, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch (error) {
    console.error('Favicon route error:', error);
    return new NextResponse(null, { status: 500 });
  }
}
