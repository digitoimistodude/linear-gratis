import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { encryptToken } from '@/lib/encryption';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: settings } = await supabaseAdmin
      .from('workspace_settings')
      .select('linear_oauth_client_id, linear_oauth_token')
      .limit(1)
      .single();

    return NextResponse.json({
      connected: !!settings?.linear_oauth_token,
      oauthConfigured: !!settings?.linear_oauth_client_id,
      hasClientId: !!settings?.linear_oauth_client_id,
    });
  } catch (error) {
    console.error('Linear OAuth status error:', error);
    return NextResponse.json({ error: 'Failed to check status' }, { status: 500 });
  }
}

// POST - Save client ID and secret
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as { clientId?: string; clientSecret?: string };
    const { clientId, clientSecret } = body;

    if (!clientId || !clientSecret) {
      return NextResponse.json({ error: 'Client ID and Client Secret are required' }, { status: 400 });
    }

    const encryptedSecret = encryptToken(clientSecret);

    const { data: existing } = await supabaseAdmin
      .from('workspace_settings')
      .select('id')
      .limit(1)
      .single();

    if (existing) {
      await supabaseAdmin
        .from('workspace_settings')
        .update({
          linear_oauth_client_id: clientId,
          linear_oauth_client_secret: encryptedSecret,
        })
        .eq('id', existing.id);
    } else {
      await supabaseAdmin
        .from('workspace_settings')
        .insert({
          linear_oauth_client_id: clientId,
          linear_oauth_client_secret: encryptedSecret,
        });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Linear OAuth save error:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: existing } = await supabaseAdmin
      .from('workspace_settings')
      .select('id')
      .limit(1)
      .single();

    if (existing) {
      await supabaseAdmin
        .from('workspace_settings')
        .update({ linear_oauth_token: null })
        .eq('id', existing.id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Linear OAuth disconnect error:', error);
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
  }
}
