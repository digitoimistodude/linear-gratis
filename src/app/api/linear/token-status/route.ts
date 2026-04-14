import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getLinearToken } from '@/lib/linear-token';

/**
 * Returns whether a Linear API token is available for the current user.
 * Checks workspace-shared token first, then user's personal token.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = await getLinearToken(user.id);

    return NextResponse.json({
      hasToken: !!token,
    });
  } catch (error) {
    console.error('Token status error:', error);
    return NextResponse.json({ error: 'Failed to check token status' }, { status: 500 });
  }
}
