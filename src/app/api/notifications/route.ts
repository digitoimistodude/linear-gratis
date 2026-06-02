import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from('notifications')
      .select('id, view_id, issue_id, issue_identifier, kind, title, body, url, read_at, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) {
      console.error('Failed to load notifications:', error);
      return NextResponse.json({ error: 'Failed to load notifications' }, { status: 500 });
    }

    const notifications = data ?? [];
    const unreadCount = notifications.filter((n) => !n.read_at).length;
    return NextResponse.json({ success: true, notifications, unreadCount });
  } catch (err) {
    console.error('Notifications GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as { ids?: string[]; all?: boolean };
    const now = new Date().toISOString();

    if (body.all) {
      const { error } = await supabaseAdmin
        .from('notifications')
        .update({ read_at: now })
        .eq('user_id', user.id)
        .is('read_at', null);
      if (error) throw error;
    } else if (body.ids && body.ids.length > 0) {
      const { error } = await supabaseAdmin
        .from('notifications')
        .update({ read_at: now })
        .eq('user_id', user.id)
        .in('id', body.ids);
      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Notifications POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
