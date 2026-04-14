import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createClient } from '@/lib/supabase/server';
import { encryptToken } from '@/lib/encryption';

// GET - Check if a workspace token is configured
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: settings } = await supabaseAdmin
      .from('workspace_settings')
      .select('linear_api_token')
      .limit(1)
      .single();

    return NextResponse.json({
      configured: !!settings?.linear_api_token,
    });
  } catch (error) {
    console.error('Workspace Linear token status error:', error);
    return NextResponse.json({ error: 'Failed to check status' }, { status: 500 });
  }
}

// POST - Save the workspace Linear API token
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as { token?: string };
    const { token } = body;

    if (!token || !token.trim()) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    const encryptedToken = encryptToken(token.trim());

    const { data: existing } = await supabaseAdmin
      .from('workspace_settings')
      .select('id')
      .limit(1)
      .single();

    if (existing) {
      const { error: updateError } = await supabaseAdmin
        .from('workspace_settings')
        .update({
          linear_api_token: encryptedToken,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabaseAdmin
        .from('workspace_settings')
        .insert({ linear_api_token: encryptedToken });

      if (insertError) throw insertError;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Workspace Linear token save error:', error);
    return NextResponse.json({ error: 'Failed to save token' }, { status: 500 });
  }
}

// DELETE - Remove the workspace Linear API token
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
        .update({ linear_api_token: null, updated_at: new Date().toISOString() })
        .eq('id', existing.id);

      if (updateError) throw updateError;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Workspace Linear token delete error:', error);
    return NextResponse.json({ error: 'Failed to remove token' }, { status: 500 });
  }
}
