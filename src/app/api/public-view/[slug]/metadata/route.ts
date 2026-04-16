import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getLinearToken } from '@/lib/linear-token';
import { fetchLinearMetadata } from '@/lib/linear-metadata';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const { data: viewData, error: viewError } = await supabaseAdmin
      .from('public_views')
      .select('*')
      .eq('slug', slug)
      .single();

    if (viewError || !viewData) {
      return NextResponse.json({ error: 'View not found' }, { status: 404 });
    }

    if (!viewData.allow_issue_creation) {
      return NextResponse.json(
        { error: 'Issue creation is not allowed for this view' },
        { status: 403 }
      );
    }

    // Get the Linear token (workspace-shared, falling back to user's personal)
    const apiToken = await getLinearToken(viewData.user_id);
    if (!apiToken) {
      return NextResponse.json(
        { error: 'Unable to load metadata - Linear API token not found' },
        { status: 500 }
      );
    }

    const result = await fetchLinearMetadata(apiToken, {
      teamId: viewData.team_id,
      projectId: viewData.project_id,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, details: result.details },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      metadata: result.metadata,
    });
  } catch (error) {
    console.error('Error fetching metadata:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
