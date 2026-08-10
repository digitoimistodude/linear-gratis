import type { PublicView } from './supabase';

/**
 * The subset of Linear issue fields needed to decide whether an issue falls
 * inside a public view's configured scope.
 */
export type IssueScopeFields = {
  id: string;
  projectId?: string | null;
  teamId?: string | null;
  stateName?: string | null;
};

type ScopeView = Pick<
  PublicView,
  'project_ids' | 'project_id' | 'team_id' | 'excluded_issue_ids' | 'allowed_statuses'
>;

/**
 * Whether `issue` is inside `view`'s scope, using the SAME predicate the list
 * endpoint applies via fetchLinearIssues: the issue must belong to one of the
 * view's projects (or its team when the view is team-scoped), must not be
 * individually excluded, and must sit in an allowed status when the view
 * restricts statuses.
 *
 * The child issue/comments endpoints must call this before returning or
 * mutating anything for a caller-supplied issue id. Without it, any active-slug
 * holder can pull or comment on arbitrary workspace issues by id, bypassing the
 * view's project scope, exclusions and password (BOLA / CWE-639, CWE-862).
 */
export function issueInViewScope(view: ScopeView, issue: IssueScopeFields): boolean {
  // Exclusions are stored as issue UUIDs; issue.id is always the UUID even when
  // the request addressed the issue by its human identifier (DEV-123).
  const excluded = new Set(view.excluded_issue_ids ?? []);
  if (excluded.has(issue.id)) return false;

  // Project membership, falling back to team scope, mirroring the filter
  // precedence in fetchLinearIssues (project wins when both are present).
  const projectIds = view.project_ids?.length
    ? view.project_ids
    : view.project_id
      ? [view.project_id]
      : [];

  if (projectIds.length > 0) {
    if (!issue.projectId || !projectIds.includes(issue.projectId)) return false;
  } else if (view.team_id) {
    if (issue.teamId !== view.team_id) return false;
  } else {
    // A view with neither a project nor a team scope exposes nothing.
    return false;
  }

  // Status restriction, when the view sets one.
  if (view.allowed_statuses?.length > 0) {
    if (!issue.stateName || !view.allowed_statuses.includes(issue.stateName)) {
      return false;
    }
  }

  return true;
}

/**
 * Resolves the minimal scope fields for `issueId` (UUID or human identifier)
 * using the view owner's Linear token. Returns null when the issue can't be
 * resolved, so callers fail closed (deny) rather than open.
 */
export async function fetchIssueScope(
  apiToken: string,
  issueId: string
): Promise<IssueScopeFields | null> {
  const query = `
    query IssueScope($issueId: String!) {
      issue(id: $issueId) {
        id
        project { id }
        team { id }
        state { name }
      }
    }
  `;
  try {
    const res = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: apiToken.trim(),
      },
      body: JSON.stringify({ query, variables: { issueId } }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data?: {
        issue?: {
          id: string;
          project?: { id: string } | null;
          team?: { id: string } | null;
          state?: { name: string } | null;
        } | null;
      };
    };
    const issue = json.data?.issue;
    if (!issue) return null;
    return {
      id: issue.id,
      projectId: issue.project?.id ?? null,
      teamId: issue.team?.id ?? null,
      stateName: issue.state?.name ?? null,
    };
  } catch {
    return null;
  }
}
