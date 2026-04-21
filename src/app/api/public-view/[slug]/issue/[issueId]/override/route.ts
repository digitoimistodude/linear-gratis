import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';

const MAX_OVERRIDE_LENGTH = 20000;

async function loadView(slug: string) {
  const { data, error } = await supabaseAdmin
    .from('public_views')
    .select('id, user_id')
    .eq('slug', slug)
    .single();
  if (error || !data) return null;
  return data as { id: string; user_id: string };
}

// GET - return the current override (admin-only). Public visitors read the
// override indirectly via the public-view API, which embeds the override into
// each issue's `description` field.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; issueId: string }> }
) {
  try {
    const { slug, issueId } = await params;

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const view = await loadView(slug);
    if (!view) {
      return NextResponse.json({ error: 'View not found' }, { status: 404 });
    }

    const { data: override } = await supabaseAdmin
      .from('view_issue_description_overrides')
      .select('public_description, updated_at')
      .eq('view_id', view.id)
      .eq('issue_id', issueId)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      override: override ?? null,
    });
  } catch (error) {
    console.error('Override GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST - upsert (non-empty body) or delete (empty body) the override.
// Authenticated workspace members only, mirroring the shared-views policy.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; issueId: string }> }
) {
  try {
    const { slug, issueId } = await params;
    const body = await request.json() as { description?: string | null };

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const view = await loadView(slug);
    if (!view) {
      return NextResponse.json({ error: 'View not found' }, { status: 404 });
    }

    const raw = typeof body.description === 'string' ? body.description : '';
    const trimmed = raw.trim();

    // Empty body = delete any existing override for this issue on this view.
    if (trimmed.length === 0) {
      const { error: deleteError } = await supabaseAdmin
        .from('view_issue_description_overrides')
        .delete()
        .eq('view_id', view.id)
        .eq('issue_id', issueId);

      if (deleteError) {
        console.error('Override delete error:', deleteError);
        return NextResponse.json(
          { error: 'Failed to remove override' },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, override: null });
    }

    if (trimmed.length > MAX_OVERRIDE_LENGTH) {
      return NextResponse.json(
        { error: `Override too long (max ${MAX_OVERRIDE_LENGTH} characters)` },
        { status: 400 }
      );
    }

    const { data: saved, error: upsertError } = await supabaseAdmin
      .from('view_issue_description_overrides')
      .upsert(
        {
          view_id: view.id,
          issue_id: issueId,
          public_description: trimmed,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'view_id,issue_id' }
      )
      .select('public_description, updated_at')
      .single();

    if (upsertError) {
      console.error('Override upsert error:', upsertError);
      return NextResponse.json(
        { error: 'Failed to save override' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      override: saved,
    });
  } catch (error) {
    console.error('Override POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
