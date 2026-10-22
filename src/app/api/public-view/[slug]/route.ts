import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import type { PublicView } from '@/lib/supabase';
import { getLinearToken } from '@/lib/linear-token';
import { fetchLinearIssues } from '@/lib/linear';
import { redactPublicViewIssue } from '@/lib/public-redaction';
import { authorisePublicView, setPublicViewAccessCookie } from '@/lib/public-view-auth';
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

    // Existence, expiry and password cookie checks. A browser that already
    // proved the password (via POST below) carries a signed access cookie, so
    // reloads and deep links like /view/slug/DEV-123 load straight away instead
    // of prompting again. Without a valid cookie this is the same 401 as before.
    const auth = await authorisePublicView(slug, request);
    if (!auth.ok) return auth.response;
    const viewData = auth.view;

    const response = await buildViewResponse(viewData);
    // Slide the cookie's expiry forward on every authenticated load so an
    // active viewer is not logged out mid-session. Lifetime stays the same.
    if (viewData.password_protected && response.ok) {
      setPublicViewAccessCookie(response, viewData);
    }
    return response;

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

    const response = await buildViewResponse(viewData as PublicView);

    // The correct password was just proven, so vouch for this browser on the
    // GET above and the child endpoints with a signed httpOnly cookie instead
    // of having the page keep the password around and replay it. Only vouch
    // if the payload actually built.
    if (response.ok) {
      setPublicViewAccessCookie(response, viewData);
    }
    return response;

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

/**
 * Loads the issues for an already-authorised view and builds the public
 * payload. Shared by GET (cookie-authenticated or unprotected) and POST
 * (password just proven) so both paths return exactly the same shape.
 */
async function buildViewResponse(viewData: PublicView): Promise<NextResponse> {
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
  // Redact first, then let an override put a description back: an override is
  // text the owner wrote for this audience, so it shows even when
  // show_descriptions is off, flagged by has_override.
  const visibleIssues = filteredIssues.map((issue) => {
    const redacted = redactPublicViewIssue(issue, viewData);
    return overrides.has(issue.id)
      ? { ...redacted, description: overrides.get(issue.id), has_override: true }
      : { ...redacted, has_override: false };
  });

  const response = NextResponse.json({
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
      branding_logo_svg: viewData.branding_logo_svg || null,
      branding_primary_color: viewData.branding_primary_color || null,
      created_at: viewData.created_at
    },
    issues: visibleIssues
  });

  // The payload is per-viewer (password gated, owner token), so nothing in
  // front of the Worker may cache it for another visitor.
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
