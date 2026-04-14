import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getLinearToken } from '@/lib/linear-token';

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

    // Get the Linear token (workspace-shared, falling back to user's personal)
    const decryptedToken = await getLinearToken(viewData.user_id);
    if (!decryptedToken) {
      return NextResponse.json(
        { error: 'Unable to load metadata - Linear API token not found' },
        { status: 500 }
      );
    }

    const metadataResponse = await fetch(`${request.nextUrl.origin}/api/linear/metadata`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiToken: decryptedToken,
        teamId: viewData.team_id,
        projectId: viewData.project_id,
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