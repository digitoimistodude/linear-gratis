import { NextRequest, NextResponse } from 'next/server';
import { getLinearToken } from '@/lib/linear-token';
import { createNotification } from '@/lib/notifications';
import { authorisePublicView } from '@/lib/public-view-auth';
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/request-security';

const LINEAR_API_URL = 'https://api.linear.app/graphql';

interface IssueCreateRequest {
  title: string;
  description?: string;
  stateId?: string;
  priority?: number;
  assigneeId?: string;
  labelIds?: string[];
  /** For multi-project views: the project the customer picked in the modal. */
  projectId?: string;
}

interface WorkflowState {
  id: string;
  name: string;
  type: string;
  color: string;
}

// Fetch team metadata directly from Linear API
async function fetchTeamMetadata(apiToken: string, teamId: string) {
  const query = `
    query TeamMetadata($teamId: String!) {
      team(id: $teamId) {
        id
        name
        triageEnabled
        triageIssueState {
          id
          name
          type
          color
        }
        states {
          nodes {
            id
            name
            type
            color
          }
        }
      }
    }
  `;

  const response = await fetch(LINEAR_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': apiToken,
    },
    body: JSON.stringify({ query, variables: { teamId } }),
  });

  const data = await response.json() as {
    data?: {
      team?: {
        triageEnabled?: boolean;
        triageIssueState?: WorkflowState;
        states?: { nodes: WorkflowState[] };
      };
    };
  };

  return data.data?.team;
}

// Resolve which team a project belongs to. Project-only views (multi-project
// support) carry no team_id, but Linear requires a team to create an issue.
async function fetchProjectTeamId(apiToken: string, projectId: string): Promise<string | null> {
  const query = `
    query ProjectTeam($projectId: String!) {
      project(id: $projectId) {
        teams(first: 1) {
          nodes { id }
        }
      }
    }
  `;

  const response = await fetch(LINEAR_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': apiToken,
    },
    body: JSON.stringify({ query, variables: { projectId } }),
  });

  const data = await response.json() as {
    data?: { project?: { teams?: { nodes?: Array<{ id: string }> } } };
  };

  return data.data?.project?.teams?.nodes?.[0]?.id ?? null;
}

// Create issue directly via Linear API
async function createLinearIssue(
  apiToken: string,
  input: {
    title: string;
    description?: string;
    stateId?: string;
    priority?: number;
    projectId?: string;
    teamId: string;
    labelIds?: string[];
  }
) {
  const mutation = `
    mutation IssueCreate($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        success
        issue {
          id
          identifier
          title
          description
          priority
          state {
            id
            name
            type
            color
          }
          team {
            id
            name
            key
          }
          project {
            id
            name
          }
          labels {
            nodes {
              id
              name
              color
            }
          }
          createdAt
          updatedAt
        }
      }
    }
  `;

  const variables = {
    input: {
      title: input.title.trim(),
      ...(input.description && { description: input.description }),
      ...(input.stateId && { stateId: input.stateId }),
      ...(input.priority !== undefined && { priority: input.priority }),
      ...(input.projectId && { projectId: input.projectId }),
      teamId: input.teamId,
      ...(input.labelIds && input.labelIds.length > 0 && { labelIds: input.labelIds }),
    },
  };

  const response = await fetch(LINEAR_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': apiToken,
    },
    body: JSON.stringify({ query: mutation, variables }),
  });

  return response.json() as Promise<{
    errors?: unknown[];
    data?: {
      issueCreate?: {
        success: boolean;
        issue: unknown;
      };
    };
  }>;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const issueData: IssueCreateRequest = await request.json();

    const auth = await authorisePublicView(slug, request);
    if (!auth.ok) return auth.response;
    const viewData = auth.view;

    // Creates a real Linear issue per request.
    const limit = await checkRateLimit(`view-create-issue:${getClientIp(request)}:${viewData.id}`, {
      limit: 3,
      windowMs: 10 * 60 * 1000,
    });
    if (!limit.ok) return rateLimitResponse(limit.retryAfterSeconds);

    // Check if issue creation is allowed
    if (!viewData.allow_issue_creation) {
      return NextResponse.json(
        { error: 'Issue creation is not allowed for this view' },
        { status: 403 }
      );
    }

    // Resolve the project the new issue should land in. Multi-project views
    // require the customer to pick one via the modal; validate it's allowed.
    const allowedProjectIds: string[] = viewData.project_ids?.length
      ? viewData.project_ids
      : viewData.project_id ? [viewData.project_id] : [];
    let resolvedProjectId: string | undefined;
    if (allowedProjectIds.length > 1) {
      if (!issueData.projectId || !allowedProjectIds.includes(issueData.projectId)) {
        return NextResponse.json(
          { error: 'Please pick one of this view\'s projects for the new issue' },
          { status: 400 }
        );
      }
      resolvedProjectId = issueData.projectId;
    } else {
      resolvedProjectId = allowedProjectIds[0];
    }

    if (!viewData.team_id && !resolvedProjectId) {
      return NextResponse.json(
        { error: 'View has no team or project configured' },
        { status: 400 }
      );
    }

    // Get the Linear token (workspace-shared, falling back to user's personal)
    const decryptedToken = await getLinearToken(viewData.user_id);
    if (!decryptedToken) {
      return NextResponse.json(
        { error: 'Unable to create issue - Linear API token not found' },
        { status: 500 }
      );
    }

    // Project-only views carry no team; derive it from the chosen project so
    // Linear has the team it requires to create the issue.
    const teamId = viewData.team_id
      ?? (resolvedProjectId ? await fetchProjectTeamId(decryptedToken, resolvedProjectId) : null);

    if (!teamId) {
      return NextResponse.json(
        { error: 'Could not determine a team for this issue' },
        { status: 400 }
      );
    }

    // Fetch team metadata directly from Linear API
    const teamMetadata = await fetchTeamMetadata(decryptedToken, teamId);

    // Determine the correct state for public issue creation.
    // When triage is enabled we omit stateId entirely so Linear auto-routes
    // the new issue into the team's triage queue - matches Linear's docs and
    // avoids relying on `triageIssueState.id` which may be stale or null.
    let finalStateId: string | undefined = undefined;

    if (!teamMetadata?.triageEnabled && teamMetadata?.states?.nodes) {
      const unstartedState = teamMetadata.states.nodes.find(
        (s: WorkflowState) => s.type === 'unstarted'
      );
      if (unstartedState) {
        finalStateId = unstartedState.id;
      } else if (teamMetadata.states.nodes.length > 0) {
        finalStateId = teamMetadata.states.nodes[0].id;
      }
    }

    // Create the issue with enforced restrictions
    // Note: priority and assigneeId are intentionally not passed for public views
    const result = await createLinearIssue(decryptedToken, {
      title: issueData.title,
      description: issueData.description,
      stateId: finalStateId, // Enforced triage/unstarted state
      priority: 0, // Default to no priority for public views
      projectId: resolvedProjectId,
      teamId,
      labelIds: issueData.labelIds,
    });

    if (result.errors) {
      console.error('Linear API errors:', result.errors);
      return NextResponse.json(
        { error: 'Failed to create issue', details: result.errors },
        { status: 400 }
      );
    }

    if (!result.data?.issueCreate?.success) {
      return NextResponse.json(
        { error: 'Failed to create issue' },
        { status: 400 }
      );
    }

    // Owners get this via Linear's own notifications - in-app bell only.
    const createdIssue = result.data.issueCreate.issue as {
      id?: string;
      identifier?: string;
      title?: string;
    } | undefined;

    await createNotification({
      userId: viewData.user_id,
      viewId: viewData.id,
      issueId: createdIssue?.id ?? null,
      issueIdentifier: createdIssue?.identifier ?? null,
      kind: 'issue_created',
      title: `New issue${createdIssue?.identifier ? ` ${createdIssue.identifier}` : ''} via ${viewData.name}`,
      body: createdIssue?.title ?? issueData.title,
      viewSlug: viewData.slug,
    });

    return NextResponse.json({
      success: true,
      issue: result.data.issueCreate.issue,
    });

  } catch (error) {
    console.error('Error creating issue:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}