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

    // Get projects from Linear using direct GraphQL request
    const query = `
      query Projects {
        projects {
          nodes {
            id
            name
            description
            createdAt
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
      body: JSON.stringify({ query })
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
          nodes: Array<{
            id: string
            name: string
            description?: string
            createdAt: string
          }>
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

    return NextResponse.json({
      success: true,
      projects: result.data.projects.nodes.map(project => ({
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