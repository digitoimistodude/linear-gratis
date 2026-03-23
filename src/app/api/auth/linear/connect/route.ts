import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const clientId = process.env.LINEAR_OAUTH_CLIENT_ID;
    if (!clientId) {
      return NextResponse.json(
        { error: 'Linear OAuth is not configured. Set LINEAR_OAUTH_CLIENT_ID environment variable.' },
        { status: 500 }
      );
    }

    const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || 'linear.gratis';
    const redirectUri = `https://${appDomain}/api/auth/linear/callback`;

    // Generate a random state parameter for CSRF protection
    const state = crypto.randomBytes(32).toString('hex');

    // Store state in a cookie for validation on callback
    const authUrl = new URL('https://linear.app/oauth/authorize');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'write');
    authUrl.searchParams.set('actor', 'application');
    authUrl.searchParams.set('state', state);

    const response = NextResponse.redirect(authUrl.toString());
    response.cookies.set('linear_oauth_state', state, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Linear OAuth connect error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate OAuth flow' },
      { status: 500 }
    );
  }
}
