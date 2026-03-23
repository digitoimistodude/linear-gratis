import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import crypto from 'crypto';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Read client ID from workspace settings
    const { data: settings } = await supabaseAdmin
      .from('workspace_settings')
      .select('linear_oauth_client_id')
      .limit(1)
      .single();

    const clientId = settings?.linear_oauth_client_id;
    if (!clientId) {
      return NextResponse.json(
        { error: 'Linear OAuth is not configured. Save your Client ID and Secret in Workspace settings first.' },
        { status: 500 }
      );
    }

    const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || 'linear.gratis';
    const redirectUri = `https://${appDomain}/api/auth/linear/callback`;

    const state = crypto.randomBytes(32).toString('hex');

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
      maxAge: 600,
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
