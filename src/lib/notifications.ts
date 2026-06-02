// Insert one notification row per user that should see this event in the
// admin bell-icon feed. Best-effort: never throws so callers don't have to
// wrap in try/catch.

import { supabaseAdmin } from '@/lib/supabase';
import { appDomain } from '@/lib/mail';

export type NotificationKind = 'comment' | 'issue_created' | 'reply';

type CreateArgs = {
  userId: string;
  viewId?: string | null;
  issueId?: string | null;
  issueIdentifier?: string | null;
  kind: NotificationKind;
  title: string;
  body?: string | null;
  viewSlug: string;
};

function buildUrl(viewSlug: string, issueIdentifier?: string | null): string {
  if (issueIdentifier) {
    return `https://${appDomain()}/view/${encodeURIComponent(viewSlug)}/${encodeURIComponent(issueIdentifier)}`;
  }
  return `https://${appDomain()}/view/${encodeURIComponent(viewSlug)}`;
}

export async function createNotification(args: CreateArgs): Promise<void> {
  try {
    await supabaseAdmin.from('notifications').insert({
      user_id: args.userId,
      view_id: args.viewId ?? null,
      issue_id: args.issueId ?? null,
      issue_identifier: args.issueIdentifier ?? null,
      kind: args.kind,
      title: args.title,
      body: args.body ?? null,
      url: buildUrl(args.viewSlug, args.issueIdentifier),
    });
  } catch (err) {
    console.error('Failed to create notification:', err);
  }
}
