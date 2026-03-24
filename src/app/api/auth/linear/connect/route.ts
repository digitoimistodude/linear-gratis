import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import crypto from 'crypto';

export async function GET(request: NextRequest) {
  try {
    // Read OAuth client ID from workspace_settings
    const { data: settings, error } = await supabaseAdmin
      .from('workspace_settings')
      .select('linear_oauth_client_id')
      .limit(1)
      .single();

    if (error || !settings?.linear_oauth_client_id) {
      return NextResponse.json(
        { error: 'Linear OAuth is not configured. Please add your Client ID in Settings.' },
        { status: 400 }
      );
    }

    const clientId = settings.linear_oauth_client_id;

    // Determine the redirect URI from the request origin
    const origin = request.headers.get('origin') || request.headers.get('referer')?.replace(/\/[^/]*$/, '') || new URL(request.url).origin;
    const redirectUri = `${origin}/api/auth/linear/callback`;

    // Generate a random state for CSRF protection
    const state = crypto.randomBytes(32).toString('hex');

    // Build the Linear OAuth authorize URL
    const authorizeUrl = new URL('https://linear.app/oauth/authorize');
    authorizeUrl.searchParams.set('client_id', clientId);
    authorizeUrl.searchParams.set('redirect_uri', redirectUri);
    authorizeUrl.searchParams.set('response_type', 'code');
    authorizeUrl.searchParams.set('scope', 'write');
    authorizeUrl.searchParams.set('state', state);
    authorizeUrl.searchParams.set('actor', 'app');
    authorizeUrl.searchParams.set('prompt', 'consent');

    // Set state cookie for CSRF validation
    const response = NextResponse.redirect(authorizeUrl.toString());
    response.cookies.set('linear_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Linear OAuth connect error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate Linear OAuth' },
      { status: 500 }
    );
  }
}
