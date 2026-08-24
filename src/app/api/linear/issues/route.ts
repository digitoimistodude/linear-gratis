import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getLinearToken } from "@/lib/linear-token";
import { paginateLinearConnection, type LinearConnection } from "@/lib/linear";
import { getCached, setCached, sha256Hex } from "@/lib/linear-cache";

export type LinearIssue = {
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
  parent?: {
    id: string;
    identifier: string;
    title: string;
  };
  project?: {
    id: string;
    name: string;
  };
  milestone?: {
    id: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
  /** Set by the public-view API when the description came from a per-view
      override rather than Linear. UI uses this to bypass show_descriptions. */
  has_override?: boolean;
};

export type LinearTeam = {
  id: string;
  name: string;
  key: string;
};

export type RequestBody = {
  projectId?: string;
  projectIds?: string[];
  teamId?: string;
  statuses?: string[];
};

type IssueNode = {
  id: string;
  identifier: string;
  title: string;
  description?: string;
  priority: number;
  priorityLabel: string;
  estimate?: number;
  url: string;
  state: { id: string; name: string; color: string; type: string };
  assignee?: { id: string; name: string; avatarUrl?: string };
  labels: { nodes: Array<{ id: string; name: string; color: string }> };
  parent?: { id: string; identifier: string; title: string };
  project?: { id: string; name: string };
  projectMilestone?: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
};

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const apiToken = await getLinearToken(user.id);
    if (!apiToken) {
      return NextResponse.json(
        { error: "Linear API token not configured" },
        { status: 400 },
      );
    }

    const { projectId, projectIds, teamId, statuses } =
      (await request.json()) as RequestBody;

    const effectiveProjectIds =
      projectIds && projectIds.length > 0
        ? projectIds
        : projectId
          ? [projectId]
          : [];

    if (effectiveProjectIds.length === 0 && !teamId) {
      return NextResponse.json(
        { error: "Either projectIds or teamId must be provided" },
        { status: 400 },
      );
    }

    // Hashed token keeps the cache key off the wire/log surface while still
    // partitioning entries per workspace.
    const tokenHash = (await sha256Hex(apiToken)).slice(0, 16);
    const statusKey = statuses && statuses.length > 0
      ? statuses.slice().sort().join(",")
      : "";
    const projectKey = effectiveProjectIds.slice().sort().join(",");
    const cacheKey = `issues:${tokenHash}:${projectKey}:${teamId ?? ""}:${statusKey}`;
    const cached = await getCached<LinearIssue[]>(cacheKey);
    if (cached) {
      return NextResponse.json({ success: true, issues: cached, cached: true });
    }

    // Build the filter as a typed variable rather than string-interpolating
    // user-supplied values into the query text. Linear's IssueFilter input
    // type handles the shape.
    const filter: Record<string, unknown> = {};
    if (effectiveProjectIds.length > 0) {
      filter.project =
        effectiveProjectIds.length === 1
          ? { id: { eq: effectiveProjectIds[0] } }
          : { or: effectiveProjectIds.map((id) => ({ id: { eq: id } })) };
    } else if (teamId) {
      filter.team = { id: { eq: teamId } };
    }
    if (statuses && statuses.length > 0) {
      filter.state = { name: { in: statuses } };
    }

    const query = `
      query Issues($after: String, $filter: IssueFilter) {
        issues(
          filter: $filter
          orderBy: createdAt
          first: 250
          after: $after
        ) {
          nodes {
            id
            identifier
            title
            description
            priority
            priorityLabel
            estimate
            url
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
            parent {
              id
              identifier
              title
            }
            project {
              id
              name
            }
            projectMilestone {
              id
              name
            }
            createdAt
            updatedAt
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    const result = await paginateLinearConnection<IssueNode>({
      apiToken,
      query,
      variables: { filter },
      extract: (data) =>
        (data as { issues: LinearConnection<IssueNode> }).issues,
    });

    if (!result.success) {
      throw new Error(result.error);
    }

    const issues: LinearIssue[] = result.nodes.map((issue) => ({
      id: issue.id,
      project: issue.project,
      identifier: issue.identifier,
      title: issue.title,
      description: issue.description,
      priority: issue.priority,
      priorityLabel: issue.priorityLabel,
      estimate: issue.estimate,
      url: issue.url,
      state: issue.state,
      assignee: issue.assignee,
      labels: issue.labels.nodes,
      parent: issue.parent,
      milestone: issue.projectMilestone ?? undefined,
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt,
    }));

    await setCached(cacheKey, issues, 60);
    return NextResponse.json({
      success: true,
      issues,
    });
  } catch (error) {
    console.error("Issues API error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 },
    );
  }
}
