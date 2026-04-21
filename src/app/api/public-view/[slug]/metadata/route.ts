import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { decryptToken } from '@/lib/encryption';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    // Get the public view
    const { data: viewData, error: viewError } = await supabaseAdmin
      .from('public_views')
      .select('*')
      .eq('slug', slug)
      .single();

    if (viewError || !viewData) {
      return NextResponse.json(
        { error: 'View not found' },
        { status: 404 }
      );
    }

    // Check if issue creation is allowed
    if (!viewData.allow_issue_creation) {
      return NextResponse.json(
        { error: 'Issue creation is not allowed for this view' },
        { status: 403 }
      );
    }

    // Get the user's Linear token
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('linear_api_token')
      .eq('id', viewData.user_id)
      .single();

    if (profileError || !profileData?.linear_api_token) {
      return NextResponse.json(
        { error: 'Unable to load metadata - Linear API token not found' },
        { status: 500 }
      );
    }

    // Decrypt the token and fetch metadata
    const decryptedToken = decryptToken(profileData.linear_api_token);

    // Multi-project views: modal passes the picked projectId via query string.
    // Fall back to the first configured project for legacy single-project views.
    const requestedProjectId = request.nextUrl.searchParams.get('projectId');
    const allowedProjectIds: string[] = viewData.project_ids?.length
      ? viewData.project_ids
      : viewData.project_id ? [viewData.project_id] : [];
    const projectId = requestedProjectId && allowedProjectIds.includes(requestedProjectId)
      ? requestedProjectId
      : allowedProjectIds[0];

    const metadataResponse = await fetch(`${request.nextUrl.origin}/api/linear/metadata`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiToken: decryptedToken,
        teamId: viewData.team_id,
        projectId,
      })
    });

    if (!metadataResponse.ok) {
      throw new Error('Failed to fetch metadata from Linear');
    }

    const result = await metadataResponse.json();
    return NextResponse.json(result);

  } catch (error) {
    console.error('Error fetching metadata:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}