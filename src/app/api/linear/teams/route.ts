import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getLinearToken } from '@/lib/linear-token';

export type Team = {
  id: string
  name: string
  key: string
  description?: string
}

export async function POST(request: NextRequest) {
  try {
    // Try to read token from body (backwards compat), otherwise resolve from session
    let apiToken: string | null = null;
    try {
      const body = await request.json() as { apiToken?: string };
      if (body.apiToken) apiToken = body.apiToken;
    } catch {
      // No body or invalid JSON — fall through to session resolution
    }

    if (!apiToken) {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      apiToken = await getLinearToken(user.id);
    }

    if (!apiToken) {
      return NextResponse.json(
        { error: 'Linear API token not configured' },
        { status: 400 }
      );
    }

    // Fetch all teams via cursor pagination (Linear API max is 250 per page)
    type TeamNode = {
      id: string
      name: string
      key: string
      description?: string
    }

    const allTeams: TeamNode[] = [];
    let endCursor: string | null = null;
    let hasNextPage = true;

    while (hasNextPage) {
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

      const response = await fetch('https://api.linear.app/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': apiToken.trim()
        },
        body: JSON.stringify({ query, variables: { after: endCursor } })
      });

      if (!response.ok) {
        let errorDetails = '';
        try {
          const errorBody = await response.text();
          errorDetails = ` - ${errorBody}`;
        } catch {
          // Ignore text parsing errors
        }
        throw new Error(`Linear API error: ${response.status} ${response.statusText}${errorDetails}`);
      }

      const result = await response.json() as {
        data?: {
          teams: {
            nodes: TeamNode[]
            pageInfo: {
              hasNextPage: boolean
              endCursor: string | null
            }
          }
        }
        errors?: Array<{ message: string }>
      };

      if (result.errors) {
        throw new Error(`GraphQL errors: ${result.errors.map(e => e.message).join(', ')}`);
      }

      if (!result.data) {
        throw new Error('No data returned from Linear API');
      }

      allTeams.push(...result.data.teams.nodes);
      hasNextPage = result.data.teams.pageInfo.hasNextPage;
      endCursor = result.data.teams.pageInfo.endCursor;
    }

    return NextResponse.json({
      success: true,
      teams: allTeams.map(team => ({
        id: team.id,
        name: team.name,
        key: team.key,
        description: team.description
      }))
    });

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