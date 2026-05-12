import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getLinearToken } from '@/lib/linear-token';
import { paginateLinearConnection, type LinearConnection } from '@/lib/linear';
import { getCached, setCached } from '@/lib/linear-cache';

export type Team = {
  id: string
  name: string
  key: string
  description?: string
}

type TeamNode = Team;

export async function POST(_request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const apiToken = await getLinearToken(user.id);
    if (!apiToken) {
      return NextResponse.json(
        { error: 'Linear API token not configured' },
        { status: 400 }
      );
    }

    const cacheKey = `teams:${user.id}`;
    const cached = await getCached<Team[]>(cacheKey);
    if (cached) {
      return NextResponse.json({ success: true, teams: cached, cached: true });
    }

    const query = `
      query Teams($after: String) {
        teams(first: 250, after: $after) {
          nodes {
            id
            name
            key
            description
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    const result = await paginateLinearConnection<TeamNode>({
      apiToken,
      query,
      extract: (data) =>
        (data as { teams: LinearConnection<TeamNode> }).teams,
    });

    if (!result.success) {
      throw new Error(result.error);
    }

    const teams = result.nodes
      .map(team => ({
        id: team.id,
        name: team.name,
        key: team.key,
        description: team.description
      }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

    await setCached(cacheKey, teams);
    return NextResponse.json({ success: true, teams });

  } catch (error) {
    console.error('Teams API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}
