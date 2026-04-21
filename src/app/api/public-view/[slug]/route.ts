import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getLinearToken } from '@/lib/linear-token';
import { fetchLinearIssues } from '@/lib/linear';
import bcrypt from 'bcryptjs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    if (!slug) {
      return NextResponse.json(
        { error: 'Slug parameter is required' },
        { status: 400 }
      );
    }

    // Check if view exists and is active
    const { data: viewData, error: viewError } = await supabaseAdmin
      .from('public_views')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (viewError || !viewData) {
      return NextResponse.json(
        { error: 'Public view not found or inactive' },
        { status: 404 }
      );
    }

    // Check if view has expired
    if (viewData.expires_at && new Date(viewData.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'This public view has expired' },
        { status: 410 }
      );
    }

    // Check if view requires password
    if (viewData.password_protected) {
      return NextResponse.json(
        { error: 'Password required', requiresPassword: true },
        { status: 401 }
      );
    }

    // Get the Linear token (workspace-shared or view owner's personal)
    const decryptedToken = await getLinearToken(viewData.user_id);

    if (!decryptedToken) {
      return NextResponse.json(
        { error: 'Unable to load data - Linear API token not found' },
        { status: 500 }
      );
    }

    const projectIds: string[] = viewData.project_ids?.length
      ? viewData.project_ids
      : viewData.project_id ? [viewData.project_id] : [];

    const issuesResult = await fetchLinearIssues(decryptedToken, {
      projectIds: projectIds.length > 0 ? projectIds : undefined,
      teamId: viewData.team_id || undefined,
      statuses: viewData.allowed_statuses?.length > 0 ? viewData.allowed_statuses : undefined,
    });

    if (!issuesResult.success) {
      throw new Error(`Failed to fetch issues from Linear: ${issuesResult.error}`);
    }

    // Strip out any issues the view owner has excluded. Filtering happens
    // server-side so excluded IDs never leave the server.
    const excludedIds = new Set<string>(viewData.excluded_issue_ids ?? []);
    const filteredIssues = excludedIds.size > 0
      ? issuesResult.issues.filter((issue) => !excludedIds.has(issue.id))
      : issuesResult.issues;

    // Apply per-issue public description overrides. When an override exists
    // for (view, issue), it fully replaces the Linear description in the
    // public payload - the original never reaches the client.
    const { data: overrideRows } = await supabaseAdmin
      .from('view_issue_description_overrides')
      .select('issue_id, public_description')
      .eq('view_id', viewData.id)
      .in('issue_id', filteredIssues.map((issue) => issue.id));
    const overrides = new Map<string, string>(
      (overrideRows ?? []).map((row) => [row.issue_id, row.public_description])
    );
    const visibleIssues = overrides.size > 0
      ? filteredIssues.map((issue) => overrides.has(issue.id)
          ? { ...issue, description: overrides.get(issue.id) }
          : issue)
      : filteredIssues;

    return NextResponse.json({
      success: true,
      view: {
        id: viewData.id,
        user_id: viewData.user_id,
        name: viewData.name,
        slug: viewData.slug,
        view_title: viewData.view_title,
        description: viewData.description,
        project_id: viewData.project_id,
        project_name: viewData.project_name,
        project_ids: viewData.project_ids ?? [],
        project_names: viewData.project_names ?? [],
        team_id: viewData.team_id,
        team_name: viewData.team_name,
        show_assignees: viewData.show_assignees,
        show_labels: viewData.show_labels,
        show_priorities: viewData.show_priorities,
        show_descriptions: viewData.show_descriptions,
        show_comments: viewData.show_comments ?? false,
        show_activity: viewData.show_activity ?? false,
        show_project_updates: viewData.show_project_updates ?? true,
        allow_issue_creation: viewData.allow_issue_creation,
        allow_customer_comments: viewData.allow_customer_comments ?? false,
        show_sub_issues: viewData.show_sub_issues ?? true,
        branding_logo_url: viewData.branding_logo_url || null,
        branding_primary_color: viewData.branding_primary_color || null,
        created_at: viewData.created_at
      },
      issues: visibleIssues
    });

  } catch (error) {
    console.error('Public view API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const resolvedParams = await params;
    const { slug } = resolvedParams;
    const { password } = await request.json() as { password?: string };

    if (!slug) {
      return NextResponse.json(
        { error: 'Slug parameter is required' },
        { status: 400 }
      );
    }

    // Check if view exists and is active
    const { data: viewData, error: viewError } = await supabaseAdmin
      .from('public_views')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (viewError || !viewData) {
      return NextResponse.json(
        { error: 'Public view not found or inactive' },
        { status: 404 }
      );
    }

    // Check password if view is password protected
    if (viewData.password_protected) {
      if (!password) {
        return NextResponse.json(
          { error: 'Password required', requiresPassword: true },
          { status: 401 }
        );
      }

      // Check password against hash
      const isPasswordValid = await bcrypt.compare(password, viewData.password_hash);
      if (!isPasswordValid) {
        return NextResponse.json(
          { error: 'Invalid password', requiresPassword: true },
          { status: 401 }
        );
      }
    }

    // Check if view has expired
    if (viewData.expires_at && new Date(viewData.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'This public view has expired' },
        { status: 410 }
      );
    }

    // Get the Linear token (workspace-shared or view owner's personal)
    const decryptedToken = await getLinearToken(viewData.user_id);

    if (!decryptedToken) {
      return NextResponse.json(
        { error: 'Unable to load data - Linear API token not found' },
        { status: 500 }
      );
    }

    const projectIds: string[] = viewData.project_ids?.length
      ? viewData.project_ids
      : viewData.project_id ? [viewData.project_id] : [];

    const issuesResult = await fetchLinearIssues(decryptedToken, {
      projectIds: projectIds.length > 0 ? projectIds : undefined,
      teamId: viewData.team_id || undefined,
      statuses: viewData.allowed_statuses?.length > 0 ? viewData.allowed_statuses : undefined,
    });

    if (!issuesResult.success) {
      throw new Error(`Failed to fetch issues from Linear: ${issuesResult.error}`);
    }

    const excludedIds = new Set<string>(viewData.excluded_issue_ids ?? []);
    const visibleIssues = excludedIds.size > 0
      ? issuesResult.issues.filter((issue) => !excludedIds.has(issue.id))
      : issuesResult.issues;

    return NextResponse.json({
      success: true,
      view: {
        id: viewData.id,
        user_id: viewData.user_id,
        name: viewData.name,
        slug: viewData.slug,
        view_title: viewData.view_title,
        description: viewData.description,
        project_id: viewData.project_id,
        project_name: viewData.project_name,
        project_ids: viewData.project_ids ?? [],
        project_names: viewData.project_names ?? [],
        team_id: viewData.team_id,
        team_name: viewData.team_name,
        show_assignees: viewData.show_assignees,
        show_labels: viewData.show_labels,
        show_priorities: viewData.show_priorities,
        show_descriptions: viewData.show_descriptions,
        show_comments: viewData.show_comments ?? false,
        show_activity: viewData.show_activity ?? false,
        show_project_updates: viewData.show_project_updates ?? true,
        password_protected: viewData.password_protected,
        allow_issue_creation: viewData.allow_issue_creation,
        allow_customer_comments: viewData.allow_customer_comments ?? false,
        show_sub_issues: viewData.show_sub_issues ?? true,
        branding_logo_url: viewData.branding_logo_url || null,
        branding_primary_color: viewData.branding_primary_color || null,
        created_at: viewData.created_at
      },
      issues: visibleIssues
    });

  } catch (error) {
    console.error('Public view password validation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}