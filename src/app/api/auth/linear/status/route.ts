import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createClient } from '@/lib/supabase/server';
import { encryptToken } from '@/lib/encryption';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: settings } = await supabaseAdmin
      .from('workspace_settings')
      .select('linear_oauth_client_id, linear_oauth_token')
      .limit(1)
      .single();

    return NextResponse.json({
      connected: !!(settings?.linear_oauth_token),
      oauthConfigured: !!(settings?.linear_oauth_client_id),
    });
  } catch (error) {
    console.error('Linear OAuth status error:', error);
    return NextResponse.json(
      { error: 'Failed to check Linear OAuth status' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as { clientId?: string; clientSecret?: string };
    const { clientId, clientSecret } = body;

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: 'Client ID and Client Secret are required' },
        { status: 400 }
      );
    }

    const encryptedSecret = encryptToken(clientSecret);

    // Check if workspace_settings already has a row
    const { data: existing } = await supabaseAdmin
      .from('workspace_settings')
      .select('id')
      .limit(1)
      .single();

    if (existing) {
      const { error: updateError } = await supabaseAdmin
        .from('workspace_settings')
        .update({
          linear_oauth_client_id: clientId,
          linear_oauth_client_secret: encryptedSecret,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabaseAdmin
        .from('workspace_settings')
        .insert({
          linear_oauth_client_id: clientId,
          linear_oauth_client_secret: encryptedSecret,
        });

      if (insertError) throw insertError;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Linear OAuth save error:', error);
    return NextResponse.json(
      { error: 'Failed to save Linear OAuth credentials' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: existing } = await supabaseAdmin
      .from('workspace_settings')
      .select('id')
      .limit(1)
      .single();

    if (existing) {
      const { error: updateError } = await supabaseAdmin
        .from('workspace_settings')
        .update({
          linear_oauth_token: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (updateError) throw updateError;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Linear OAuth disconnect error:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect Linear OAuth' },
      { status: 500 }
    );
  }
}
