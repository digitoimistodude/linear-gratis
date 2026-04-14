import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getLinearToken } from '@/lib/linear-token';

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

    // Fetch all projects via cursor pagination (Linear API max is 250 per page)
    type ProjectNode = {
      id: string
      name: string
      description?: string
      createdAt: string
    }

    const allProjects: ProjectNode[] = [];
    let endCursor: string | null = null;
    let hasNextPage = true;

    while (hasNextPage) {
      const query = `
        query Projects($after: String) {
          projects(first: 250, after: $after) {
            nodes {
              id
              name
              description
              createdAt
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
          projects: {
            nodes: ProjectNode[]
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

      allProjects.push(...result.data.projects.nodes);
      hasNextPage = result.data.projects.pageInfo.hasNextPage;
      endCursor = result.data.projects.pageInfo.endCursor;
    }

    return NextResponse.json({
      success: true,
      projects: allProjects.map(project => ({
        id: project.id,
        name: project.name,
        description: project.description
      }))
    });

  } catch (error) {
    console.error('Projects API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}