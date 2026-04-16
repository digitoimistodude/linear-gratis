/**
 * Fetches Linear team or project metadata (states, members, labels, triage)
 * for use by the issue creation flow.
 *
 * Server-side only. Takes a decrypted Linear API token directly so callers
 * can route through their own auth (authenticated admin endpoint or public
 * view endpoint that resolves the view owner's token).
 */

const LINEAR_API_URL = 'https://api.linear.app/graphql';

interface TriageState {
  id: string;
  name: string;
  type: string;
  color: string;
}

type LinearMetadata = {
  team?: unknown;
  project?: unknown;
  states: unknown[];
  users: unknown[];
  labels: unknown[];
  triageEnabled: boolean;
  triageIssueState: TriageState | null;
};

export type FetchLinearMetadataResult =
  | { success: true; metadata: LinearMetadata }
  | { success: false; error: string; details?: unknown };

export async function fetchLinearMetadata(
  apiToken: string,
  options: { teamId?: string | null; projectId?: string | null }
): Promise<FetchLinearMetadataResult> {
  const { teamId, projectId } = options;

  if (!teamId && !projectId) {
    return { success: false, error: 'Either teamId or projectId is required' };
  }

  let query: string;
  let variables: Record<string, unknown> = {};

  if (teamId) {
    query = `
      query GetTeamMetadata($teamId: String!) {
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
          members(first: 50, filter: { active: { eq: true } }) {
            nodes {
              id
              displayName
              avatarUrl
              active
            }
          }
          labels(first: 50) {
            nodes {
              id
              name
              color
            }
          }
        }
      }
    `;
    variables = { teamId };
  } else {
    query = `
      query GetProjectMetadata($projectId: String!) {
        project(id: $projectId) {
          id
          name
          teams(first: 10) {
            nodes {
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
              members(first: 50, filter: { active: { eq: true } }) {
                nodes {
                  id
                  displayName
                  avatarUrl
                  active
                }
              }
              labels(first: 50) {
                nodes {
                  id
                  name
                  color
                }
              }
            }
          }
        }
      }
    `;
    variables = { projectId };
  }

  const response = await fetch(LINEAR_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: apiToken.trim(),
    },
    body: JSON.stringify({ query, variables }),
  });

  const data = await response.json() as {
    errors?: unknown[];
    data?: {
      team?: {
        triageEnabled: boolean;
        triageIssueState: TriageState | null;
        states: { nodes: unknown[] };
        members: { nodes: { active: boolean }[] };
        labels: { nodes: unknown[] };
      };
      project?: {
        teams: {
          nodes: {
            triageEnabled: boolean;
            triageIssueState: TriageState | null;
            states: { nodes: unknown[] };
            members: { nodes: { active: boolean }[] };
            labels: { nodes: unknown[] };
          }[];
        };
      };
    };
  };

  if (data.errors) {
    return { success: false, error: 'Failed to fetch metadata from Linear', details: data.errors };
  }

  if (teamId && data.data?.team) {
    const team = data.data.team;
    return {
      success: true,
      metadata: {
        team,
        states: team.states.nodes,
        users: team.members.nodes,
        labels: team.labels.nodes,
        triageEnabled: team.triageEnabled,
        triageIssueState: team.triageIssueState,
      },
    };
  }

  if (projectId && data.data?.project) {
    const project = data.data.project;
    const allStates: unknown[] = [];
    const allUsers: unknown[] = [];
    const allLabels: unknown[] = [];
    const firstTeam = project.teams.nodes[0];
    const triageEnabled = firstTeam?.triageEnabled ?? false;
    const triageIssueState = firstTeam?.triageIssueState ?? null;

    project.teams.nodes.forEach((team) => {
      allStates.push(...team.states.nodes);
      allUsers.push(...team.members.nodes);
      allLabels.push(...team.labels.nodes);
    });

    const uniqueStates = allStates.filter(
      (state, index, self) =>
        index === self.findIndex((s) => (s as { id: string }).id === (state as { id: string }).id)
    );
    const uniqueUsers = allUsers.filter(
      (user, index, self) =>
        index === self.findIndex((u) => (u as { id: string }).id === (user as { id: string }).id)
    );
    const uniqueLabels = allLabels.filter(
      (label, index, self) =>
        index === self.findIndex((l) => (l as { id: string }).id === (label as { id: string }).id)
    );

    return {
      success: true,
      metadata: {
        project,
        states: uniqueStates,
        users: uniqueUsers,
        labels: uniqueLabels,
        triageEnabled,
        triageIssueState,
      },
    };
  }

  return { success: false, error: 'No metadata returned' };
}
