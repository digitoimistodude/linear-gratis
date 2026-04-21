import { NextRequest, NextResponse } from "next/server";
import { paginateLinearConnection, type LinearConnection } from "@/lib/linear";

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
  project?: {
    id: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
};

export type LinearTeam = {
  id: string;
  name: string;
  key: string;
};

export type RequestBody = {
  apiToken: string;
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
  project?: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
};

export async function POST(request: NextRequest) {
  try {
    const { apiToken, projectId, projectIds, teamId, statuses } =
      (await request.json()) as RequestBody;

    if (!apiToken) {
      return NextResponse.json(
        { error: "Missing required field: apiToken" },
        { status: 400 },
      );
    }

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
          orderBy: updatedAt
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
            project {
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
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt,
    }));

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
