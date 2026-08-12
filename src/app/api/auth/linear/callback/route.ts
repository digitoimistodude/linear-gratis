import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createClient } from '@/lib/supabase/server';
import { encryptToken, decryptToken } from '@/lib/encryption';

export async function GET(request: NextRequest) {
  const origin = new URL(request.url).origin;

  try {
    // This binds a Linear OAuth token as the workspace token, so only a signed-in
    // user may complete the exchange.
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.redirect(`${origin}/login`);
    }

    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      console.error('Linear OAuth error:', error);
      return NextResponse.redirect(`${origin}/settings?linear_oauth=error`);
    }

    if (!code || !state) {
      return NextResponse.redirect(`${origin}/settings?linear_oauth=error`);
    }

    // Validate state cookie for CSRF protection
    const storedState = request.cookies.get('linear_oauth_state')?.value;
    if (!storedState || storedState !== state) {
      console.error('Linear OAuth state mismatch');
      return NextResponse.redirect(`${origin}/settings?linear_oauth=error`);
    }

    // Read OAuth credentials from workspace_settings
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('workspace_settings')
      .select('id, linear_oauth_client_id, linear_oauth_client_secret')
      .limit(1)
      .single();

    if (settingsError || !settings?.linear_oauth_client_id || !settings?.linear_oauth_client_secret) {
      console.error('Linear OAuth credentials not found in workspace_settings');
      return NextResponse.redirect(`${origin}/settings?linear_oauth=error`);
    }

    const clientId = settings.linear_oauth_client_id;
    const clientSecret = decryptToken(settings.linear_oauth_client_secret);
    const redirectUri = `${origin}/api/auth/linear/callback`;

    // Exchange code for access token
    const tokenResponse = await fetch('https://api.linear.app/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const errorBody = await tokenResponse.text();
      console.error('Linear OAuth token exchange failed:', errorBody);
      return NextResponse.redirect(`${origin}/settings?linear_oauth=error`);
    }

    const tokenData = await tokenResponse.json() as { access_token?: string };
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      console.error('No access token in Linear OAuth response');
      return NextResponse.redirect(`${origin}/settings?linear_oauth=error`);
    }

    // Encrypt and store the token
    const encryptedToken = encryptToken(accessToken);

    const { error: updateError } = await supabaseAdmin
      .from('workspace_settings')
      .update({
        linear_oauth_token: encryptedToken,
        updated_at: new Date().toISOString(),
      })
      .eq('id', settings.id);

    if (updateError) {
      console.error('Failed to store Linear OAuth token:', updateError);
      return NextResponse.redirect(`${origin}/settings?linear_oauth=error`);
    }

    // Clear the state cookie and redirect to success
    const response = NextResponse.redirect(`${origin}/settings?linear_oauth=success`);
    response.cookies.delete('linear_oauth_state');
    return response;
  } catch (err) {
    console.error('Linear OAuth callback error:', err);
    return NextResponse.redirect(`${origin}/settings?linear_oauth=error`);
  }
}
