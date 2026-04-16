import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getLinearToken } from '@/lib/linear-token';
import { fetchLinearMetadata } from '@/lib/linear-metadata';

interface MetadataRequest {
  teamId?: string;
  projectId?: string;
}

export async function POST(request: NextRequest) {
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

    const { teamId, projectId }: MetadataRequest = await request.json();
    if (!teamId && !projectId) {
      return NextResponse.json(
        { error: 'Either teamId or projectId is required' },
        { status: 400 }
      );
    }

    const result = await fetchLinearMetadata(apiToken, { teamId, projectId });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, details: result.details },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      metadata: result.metadata,
    });
  } catch (error) {
    console.error('Error fetching metadata:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
