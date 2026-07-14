import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getLinearToken } from '@/lib/linear-token';
import { issueInViewScope } from '@/lib/view-scope';

export type IssueComment = {
  id: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
};

export type IssueHistory = {
  id: string;
  createdAt: string;
  fromState?: {
    name: string;
    color: string;
  };
  toState?: {
    name: string;
    color: string;
  };
  fromAssignee?: {
    name: string;
  };
  toAssignee?: {
    name: string;
  };
  fromPriority?: number;
  toPriority?: number;
  user: {
    name: string;
    avatarUrl?: string;
  };
};

export type IssueDetail = {
  id: string;
  identifier: string;
  title: string;
  description?: string;
  priority: number;
  priorityLabel: string;
  estimate?: number;
  url: string;
  state: {
    id: string;
    name: string;
    color: string;
    type: string;
  };
  assignee?: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
  labels: Array<{
    id: string;
    name: string;
    color: string;
  }>;
  createdAt: string;
  updatedAt: string;
  comments: IssueComment[];
  history: IssueHistory[];
  /** True when the description on this payload comes from a per-view override
      rather than Linear. Tells the UI to render the description even if the
      view has show_descriptions toggled off. */
  has_override?: boolean;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; issueId: string }> }
) {
  try {
    const { slug, issueId } = await params;

    if (!slug || !issueId) {
      return NextResponse.json(
        { error: 'Slug and issueId parameters are required' },
        { status: 400 }
      );
    }

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

    if (viewData.expires_at && new Date(viewData.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'This public view has expired' },
        { status: 410 }
      );
    }

    // Get the Linear token (workspace-shared, falling back to user's personal)
    const decryptedToken = await getLinearToken(viewData.user_id);
    if (!decryptedToken) {
      return NextResponse.json(
        { error: 'Unable to load data - Linear API token not found' },
        { status: 500 }
      );
    }

    // Gate comments and history via GraphQL @include. Keeps the query text
    // static (cacheable, readable) while view settings control the flags.
    const includeComments = viewData.show_comments ?? false;
    const includeActivity = viewData.show_activity ?? false;

    const query = `
      query IssueDetail($issueId: String!, $includeComments: Boolean!, $includeActivity: Boolean!) {
        issue(id: $issueId) {
          id
          identifier
          title
          description
          priority
          priorityLabel
          estimate
          url
          project {
            id
          }
          team {
            id
          }
          state {
            id
            name
            color
            type
          }
          assignee {
            id
            name
            avatarUrl
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
          comments @include(if: $includeComments) {
            nodes {
              id
              body
              createdAt
              updatedAt
              user {
                id
                name
                avatarUrl
              }
            }
          }
          history @include(if: $includeActivity) {
            nodes {
              id
              createdAt
              fromState {
                name
                color
              }
              toState {
                name
                color
              }
              fromAssignee {
                name
              }
              toAssignee {
                name
              }
              fromPriority
              toPriority
              actor {
                name
                avatarUrl
              }
            }
          }
        }
      }
    `;

    const response = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: decryptedToken.trim(),
      },
      body: JSON.stringify({
        query,
        variables: { issueId, includeComments, includeActivity },
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Linear API error: ${response.status} ${response.statusText}`
      );
    }

    const result = (await response.json()) as {
      data?: {
        issue: {
          id: string;
          identifier: string;
          title: string;
          description?: string;
          priority: number;
          priorityLabel: string;
          estimate?: number;
          url: string;
          project?: { id: string } | null;
          team?: { id: string } | null;
          state: {
            id: string;
            name: string;
            color: string;
            type: string;
          };
          assignee?: {
            id: string;
            name: string;
            avatarUrl?: string;
          };
          labels: {
            nodes: Array<{
              id: string;
              name: string;
              color: string;
            }>;
          };
          createdAt: string;
          updatedAt: string;
          comments?: {
            nodes: Array<{
              id: string;
              body: string;
              createdAt: string;
              updatedAt: string;
              user: {
                id: string;
                name: string;
                avatarUrl?: string;
              };
            }>;
          };
          history?: {
            nodes: Array<{
              id: string;
              createdAt: string;
              fromState?: {
                name: string;
                color: string;
              };
              toState?: {
                name: string;
                color: string;
              };
              fromAssignee?: {
                name: string;
              };
              toAssignee?: {
                name: string;
              };
              fromPriority?: number;
              toPriority?: number;
              actor: {
                name: string;
                avatarUrl?: string;
              };
            }>;
          };
        };
      };
      errors?: Array<{ message: string }>;
    };

    if (result.errors) {
      throw new Error(
        `GraphQL errors: ${result.errors.map((e) => e.message).join(', ')}`
      );
    }

    if (!result.data?.issue) {
      return NextResponse.json(
        { error: 'Issue not found' },
        { status: 404 }
      );
    }

    const issue = result.data.issue;

    // Enforce that the requested issue actually belongs to this view. The slug
    // and is_active checks above only prove the view exists - without this an
    // active-slug holder could read any workspace issue by id, bypassing the
    // view's project scope, exclusions and password (BOLA / CWE-639).
    if (
      !issueInViewScope(viewData, {
        id: issue.id,
        projectId: issue.project?.id ?? null,
        teamId: issue.team?.id ?? null,
        stateName: issue.state?.name ?? null,
      })
    ) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
    }

    // Substitute the Linear description with the per-view override if present.
    const { data: override } = await supabaseAdmin
      .from('view_issue_description_overrides')
      .select('public_description')
      .eq('view_id', viewData.id)
      .eq('issue_id', issueId)
      .maybeSingle();
    const hasOverride = Boolean(override?.public_description);
    const effectiveDescription = override?.public_description ?? issue.description;

    const issueDetail: IssueDetail = {
      has_override: hasOverride,
      id: issue.id,
      identifier: issue.identifier,
      title: issue.title,
      description: effectiveDescription,
      priority: issue.priority,
      priorityLabel: issue.priorityLabel,
      estimate: issue.estimate,
      url: issue.url,
      state: issue.state,
      assignee: issue.assignee,
      labels: issue.labels.nodes,
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt,
      comments: issue.comments?.nodes ?? [],
      history: (issue.history?.nodes ?? []).map((h) => ({
        id: h.id,
        createdAt: h.createdAt,
        fromState: h.fromState,
        toState: h.toState,
        fromAssignee: h.fromAssignee,
        toAssignee: h.toAssignee,
        fromPriority: h.fromPriority,
        toPriority: h.toPriority,
        user: { name: h.actor.name, avatarUrl: h.actor.avatarUrl },
      })),
    };

    return NextResponse.json({
      success: true,
      issue: issueDetail,
    });
  } catch (error) {
    console.error('Issue detail API error:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}
