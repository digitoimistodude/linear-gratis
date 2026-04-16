import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getLinearToken } from '@/lib/linear-token';
import { paginateLinearConnection, type LinearConnection } from '@/lib/linear';

type ProjectNode = {
  id: string
  name: string
  description?: string
  createdAt: string
}

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

    const result = await paginateLinearConnection<ProjectNode>({
      apiToken,
      query,
      extract: (data) =>
        (data as { projects: LinearConnection<ProjectNode> }).projects,
    });

    if (!result.success) {
      throw new Error(result.error);
    }

    const projects = result.nodes
      .map(project => ({
        id: project.id,
        name: project.name,
        description: project.description
      }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

    return NextResponse.json({ success: true, projects });

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
