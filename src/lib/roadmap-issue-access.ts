import { NextResponse } from 'next/server';
import type { Roadmap } from '@/lib/supabase';
import { getLinearToken } from '@/lib/linear-token';
import { fetchIssueScope } from '@/lib/view-scope';

type RoadmapIssueAccessResult =
  | { ok: true }
  | { ok: false; response: NextResponse };

/**
 * Verify a caller-supplied `issueId` belongs to one of the roadmap's projects.
 * Without this the comment and vote endpoints accept any id and store rows
 * under it. Upstream does the same check in `roadmap-issue-access.ts`; this is
 * the equivalent against our own token resolution and column shape.
 */
export async function assertRoadmapIssueInScope(
  roadmap: Pick<Roadmap, 'user_id' | 'project_ids'>,
  issueId: string,
): Promise<RoadmapIssueAccessResult> {
  const projectIds = roadmap.project_ids ?? [];
  if (projectIds.length === 0) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Roadmap has no projects configured' },
        { status: 400 },
      ),
    };
  }

  const token = await getLinearToken(roadmap.user_id);
  if (!token) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Unable to verify issue - Linear API token not found' },
        { status: 500 },
      ),
    };
  }

  const scope = await fetchIssueScope(token, issueId);
  if (!scope?.projectId || !projectIds.includes(scope.projectId)) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Issue not found' }, { status: 404 }),
    };
  }

  return { ok: true };
}
