import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getLinearToken } from '@/lib/linear-token';
import { fetchLinearMetadata } from '@/lib/linear-metadata';

export async function GET(
  request: NextRequest,
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

    // Multi-project views: modal passes the picked projectId via query string.
    // Fall back to the first configured project for legacy single-project views.
    const requestedProjectId = request.nextUrl.searchParams.get('projectId');
    const allowedProjectIds: string[] = viewData.project_ids?.length
      ? viewData.project_ids
      : viewData.project_id ? [viewData.project_id] : [];
    const projectId = requestedProjectId && allowedProjectIds.includes(requestedProjectId)
      ? requestedProjectId
      : allowedProjectIds[0];

    const result = await fetchLinearMetadata(apiToken, {
      teamId: viewData.team_id,
      projectId,
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
