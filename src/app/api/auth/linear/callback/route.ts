import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { encryptToken } from '@/lib/encryption';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || 'linear.gratis';

    if (error) {
      return NextResponse.redirect(
        `https://${appDomain}/profile?linear_oauth=error&message=${encodeURIComponent(error)}`
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `https://${appDomain}/profile?linear_oauth=error&message=${encodeURIComponent('Missing authorization code')}`
      );
    }

    // Validate state parameter
    const storedState = request.cookies.get('linear_oauth_state')?.value;
    if (!storedState || storedState !== state) {
      return NextResponse.redirect(
        `https://${appDomain}/profile?linear_oauth=error&message=${encodeURIComponent('Invalid state parameter')}`
      );
    }

    // Get the authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.redirect(
        `https://${appDomain}/login`
      );
    }

    const clientId = process.env.LINEAR_OAUTH_CLIENT_ID;
    const clientSecret = process.env.LINEAR_OAUTH_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(
        `https://${appDomain}/profile?linear_oauth=error&message=${encodeURIComponent('OAuth not configured')}`
      );
    }

    const redirectUri = `https://${appDomain}/api/auth/linear/callback`;

    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://api.linear.app/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Linear OAuth token exchange failed:', errorText);
      return NextResponse.redirect(
        `https://${appDomain}/profile?linear_oauth=error&message=${encodeURIComponent('Token exchange failed')}`
      );
    }

    const tokenData = await tokenResponse.json() as {
      access_token: string;
      token_type: string;
      expires_in?: number;
      scope?: string;
    };

    // Encrypt and store the OAuth token
    const encryptedToken = encryptToken(tokenData.access_token);

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ linear_oauth_token: encryptedToken })
      .eq('id', user.id);

    if (updateError) {
      console.error('Failed to store OAuth token:', updateError);
      return NextResponse.redirect(
        `https://${appDomain}/profile?linear_oauth=error&message=${encodeURIComponent('Failed to save token')}`
      );
    }

    // Clear the state cookie and redirect to profile with success
    const response = NextResponse.redirect(
      `https://${appDomain}/profile?linear_oauth=success`
    );
    response.cookies.delete('linear_oauth_state');

    return response;
  } catch (error) {
    console.error('Linear OAuth callback error:', error);
    const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || 'linear.gratis';
    return NextResponse.redirect(
      `https://${appDomain}/profile?linear_oauth=error&message=${encodeURIComponent('Unexpected error')}`
    );
  }
}
