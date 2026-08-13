import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { encryptToken } from '@/lib/encryption';

/**
 * Write-only endpoint for the current user's personal Linear API token.
 *
 * The plaintext token never travels back to the browser: GET reports only
 * whether one is configured. Replaces the old client-side decrypt round-trip.
 * Ported from upstream d0dcfeb.
 */

// GET - report whether a personal token is configured, never the token itself
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('linear_api_token')
      .eq('id', user.id)
      .single();

    return NextResponse.json({ configured: !!profile?.linear_api_token });
  } catch (error) {
    console.error('Profile Linear token status error:', error);
    return NextResponse.json({ error: 'Failed to check status' }, { status: 500 });
  }
}

// PUT - encrypt and store the token on the current user's profile
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as { token?: string };
    const token = body.token?.trim();

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    if (token.length > 1000) {
      return NextResponse.json({ error: 'Token is too long' }, { status: 400 });
    }

    const encryptedToken = await encryptToken(token);

    const { error } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: user.id,
        email: user.email,
        linear_api_token: encryptedToken,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      console.error('Profile Linear token save error:', error);
      return NextResponse.json({ error: 'Failed to save token' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Profile Linear token save error:', error);
    return NextResponse.json({ error: 'Failed to save token' }, { status: 500 });
  }
}

// DELETE - clear the stored token
export async function DELETE() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ linear_api_token: null, updated_at: new Date().toISOString() })
      .eq('id', user.id);

    if (error) {
      console.error('Profile Linear token delete error:', error);
      return NextResponse.json({ error: 'Failed to remove token' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Profile Linear token delete error:', error);
    return NextResponse.json({ error: 'Failed to remove token' }, { status: 500 });
  }
}
