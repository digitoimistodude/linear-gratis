import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createClient } from '@/lib/supabase/server';
import { decryptToken } from '@/lib/encryption';
import crypto from 'crypto';

export async function GET(request: NextRequest) {
  try {
    // This route revokes and clears the workspace OAuth token before starting a
    // new consent flow, so an unauthenticated caller could knock out every
    // Linear integration on the workspace.
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Read OAuth settings from workspace_settings
    const { data: settings, error } = await supabaseAdmin
      .from('workspace_settings')
      .select('id, linear_oauth_client_id, linear_oauth_client_secret, linear_oauth_token')
      .limit(1)
      .single();

    if (error || !settings?.linear_oauth_client_id) {
      return NextResponse.json(
        { error: 'Linear OAuth is not configured. Please add your Client ID in Settings.' },
        { status: 400 }
      );
    }

    const clientId = settings.linear_oauth_client_id;

    // If there's an existing token, revoke it first so Linear shows the consent screen
    if (settings.linear_oauth_token && settings.linear_oauth_client_secret) {
      try {
        const existingToken = decryptToken(settings.linear_oauth_token);
        const clientSecret = decryptToken(settings.linear_oauth_client_secret);
        await fetch('https://api.linear.app/oauth/revoke', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            token: existingToken,
          }).toString(),
        });
        // Clear the stored token
        await supabaseAdmin
          .from('workspace_settings')
          .update({ linear_oauth_token: null })
          .eq('id', settings.id);
      } catch (revokeError) {
        console.error('Failed to revoke existing token:', revokeError);
      }
    }

    // Derive the redirect URI from the request URL only. Origin and Referer are
    // caller-controlled, so trusting them lets an attacker point the OAuth
    // redirect at a host of their choosing.
    const redirectUri = `${new URL(request.url).origin}/api/auth/linear/callback`;

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
