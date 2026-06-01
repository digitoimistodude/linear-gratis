// Customer email subscriptions live in `view_subscriptions`. One row per
// (view, issue, email) - upsert-safe because of the unique constraint.

import { supabaseAdmin } from '@/lib/supabase';

function randomToken(): string {
  // 32 hex chars - safe in URLs, unique enough for unsubscribe links.
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  }
  // Fallback for older runtimes that lack randomUUID. Should never hit on CF.
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function looksLikeEmail(value: string | null | undefined): value is string {
  if (!value) return false;
  return /.+@.+\..+/.test(value.trim());
}

export async function upsertSubscription(args: {
  viewId: string;
  issueId: string;
  email: string | null | undefined;
}): Promise<{ token: string } | null> {
  if (!looksLikeEmail(args.email)) return null;
  const email = args.email.trim().toLowerCase();
  const token = randomToken();

  // Try insert; on conflict (already subscribed), fetch existing token so the
  // email footer always renders a valid unsubscribe URL.
  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('view_subscriptions')
    .insert({
      view_id: args.viewId,
      issue_id: args.issueId,
      email,
      unsubscribe_token: token,
    })
    .select('unsubscribe_token')
    .single();

  if (!insertError && inserted) {
    return { token: inserted.unsubscribe_token as string };
  }

  // Already subscribed - fetch existing token.
  const { data: existing } = await supabaseAdmin
    .from('view_subscriptions')
    .select('unsubscribe_token')
    .eq('view_id', args.viewId)
    .eq('issue_id', args.issueId)
    .eq('email', email)
    .maybeSingle();

  if (existing?.unsubscribe_token) {
    return { token: existing.unsubscribe_token as string };
  }
  return null;
}

export async function listSubscribers(args: {
  viewId: string;
  issueId: string;
  excludeEmail?: string;
}): Promise<Array<{ email: string; token: string }>> {
  const { data } = await supabaseAdmin
    .from('view_subscriptions')
    .select('email, unsubscribe_token')
    .eq('view_id', args.viewId)
    .eq('issue_id', args.issueId);
  const rows = (data ?? []) as Array<{ email: string; unsubscribe_token: string }>;
  const exclude = args.excludeEmail?.trim().toLowerCase();
  return rows
    .filter((r) => r.email !== exclude)
    .map((r) => ({ email: r.email, token: r.unsubscribe_token }));
}

export async function deleteSubscriptionByToken(token: string): Promise<{ email: string } | null> {
  const { data } = await supabaseAdmin
    .from('view_subscriptions')
    .delete()
    .eq('unsubscribe_token', token)
    .select('email')
    .maybeSingle();
  if (data?.email) {
    return { email: data.email as string };
  }
  return null;
}
