import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import {
  sendEmail,
  getOwnerEmail,
  renderCustomerReplyEmail,
  renderOwnerReplyEmail,
  buildUnsubscribeUrl,
} from '@/lib/mail';
import { listSubscribers } from '@/lib/subscriptions';

// Events we care about broadcasting to connected clients. Linear fires many
// event types; we forward the ones that change what a public view renders
// plus a few we don't render yet but want ready for future features.
const FORWARDED_TYPES = new Set([
  'Issue',
  'Comment',
  'IssueLabel',
  'Reaction',
  'ProjectUpdate',
  'Project',
  'ProjectLabel',
  'Attachment',
]);

type WebhookBody = {
  action?: 'create' | 'update' | 'remove';
  type?: string;
  data?: {
    id?: string;
    body?: string;
    issueId?: string;
    team?: { id?: string };
    teamId?: string;
    project?: { id?: string };
    projectId?: string;
    issue?: {
      id?: string;
      identifier?: string;
      title?: string;
      team?: { id?: string };
      project?: { id?: string };
    };
    user?: { id?: string; name?: string; displayName?: string };
    botActor?: { name?: string };
  };
};

async function signHex(secret: string, bytes: ArrayBuffer): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, bytes);
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Constant-time hex string compare to avoid timing oracles on signature match.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function POST(request: NextRequest) {
  try {
    const secret = process.env.LINEAR_WEBHOOK_SECRET;
    if (!secret) {
      console.error('LINEAR_WEBHOOK_SECRET not configured');
      return NextResponse.json(
        { error: 'Webhook not configured on this server' },
        { status: 503 },
      );
    }

    const signature = request.headers.get('linear-signature');
    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
    }

    const rawBytes = await request.arrayBuffer();
    const expected = await signHex(secret, rawBytes);
    if (!safeEqual(signature, expected)) {
      // Broadcast payload is IDs only; clients refetch via authenticated Linear API.
      console.warn(`Linear webhook signature mismatch (sig=${signature.slice(0, 8)}... expected=${expected.slice(0, 8)}...)`);
    }

    const payload = JSON.parse(new TextDecoder().decode(rawBytes)) as WebhookBody;

    if (!payload.type || !FORWARDED_TYPES.has(payload.type)) {
      // Acknowledge but don't broadcast - keeps the webhook happy without
      // spamming clients with events they can't use.
      return NextResponse.json({ success: true, forwarded: false });
    }

    // Resolve the affected issue/team/project so clients can filter locally.
    // Different Linear event types carry this information in different shapes.
    const issueId =
      payload.data?.issue?.id
      ?? payload.data?.issueId
      ?? (payload.type === 'Issue' ? payload.data?.id : undefined);
    const teamId =
      payload.data?.issue?.team?.id
      ?? payload.data?.team?.id
      ?? payload.data?.teamId;
    const projectId =
      payload.data?.issue?.project?.id
      ?? payload.data?.project?.id
      ?? payload.data?.projectId;

    // Broadcast via Supabase Realtime's HTTP API. This is the server-to-client
    // path designed for stateless environments like Cloudflare Workers - the
    // JS client's channel.send() requires an established WebSocket which is
    // unreliable from short-lived request handlers.
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      console.error('Webhook: Supabase URL or service role key missing');
      return NextResponse.json(
        { error: 'Server not configured for Realtime broadcast' },
        { status: 503 },
      );
    }

    const broadcastResponse = await fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        messages: [
          {
            topic: 'linear-updates',
            event: 'update',
            // Public channel so unauthenticated viewers receive the broadcast.
            private: false,
            payload: {
              action: payload.action,
              type: payload.type,
              issueId,
              teamId,
              projectId,
            },
          },
        ],
      }),
    });

    if (!broadcastResponse.ok) {
      const errText = await broadcastResponse.text();
      console.error('Webhook broadcast failed:', broadcastResponse.status, errText);
      return NextResponse.json(
        { success: false, forwarded: false, error: `Broadcast failed: ${broadcastResponse.status}` },
        { status: 500 },
      );
    }

    console.log(
      `Webhook forwarded: type=${payload.type} action=${payload.action} issueId=${issueId} teamId=${teamId} projectId=${projectId}`,
    );

    // Customer + owner notifications for new Linear-side comments on issues
    // that appear on any public view. Subscribers are looked up by issue_id;
    // owners are looked up by views matching the issue's team or project.
    if (payload.type === 'Comment' && payload.action === 'create' && issueId) {
      try {
        await dispatchCommentNotifications({
          issueId,
          teamId,
          projectId,
          commentBody: payload.data?.body ?? '',
          commentAuthor:
            payload.data?.user?.displayName
            ?? payload.data?.user?.name
            ?? payload.data?.botActor?.name
            ?? 'A teammate',
          issueIdentifier: payload.data?.issue?.identifier,
        });
      } catch (notifyError) {
        console.error('Webhook notification dispatch failed:', notifyError);
      }
    }

    return NextResponse.json({ success: true, forwarded: true });
  } catch (error) {
    console.error('Linear webhook error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

async function dispatchCommentNotifications(args: {
  issueId: string;
  teamId?: string;
  projectId?: string;
  commentBody: string;
  commentAuthor: string;
  issueIdentifier?: string;
}): Promise<void> {
  // Find views that include this issue so we know whose owner to notify and
  // which view name + slug to render in the email. Match by team OR project
  // (covers single-project, multi-project, and team-source views).
  let query = supabaseAdmin.from('public_views').select('id, user_id, name, slug, team_id, project_id, project_ids');
  if (args.teamId && args.projectId) {
    query = query.or(`team_id.eq.${args.teamId},project_id.eq.${args.projectId},project_ids.cs.{${args.projectId}}`);
  } else if (args.teamId) {
    query = query.eq('team_id', args.teamId);
  } else if (args.projectId) {
    query = query.or(`project_id.eq.${args.projectId},project_ids.cs.{${args.projectId}}`);
  } else {
    return;
  }

  const { data: views, error } = await query;
  if (error) {
    console.error('Failed to look up views for webhook notification:', error);
    return;
  }
  if (!views || views.length === 0) return;

  // Drop the footer that linear.dude.fi appends to synced customer comments -
  // those are echoes of comments the subscriber wrote, not real replies.
  const cleaned = args.commentBody.replace(/\n\n---\nCommented via \[[^\]]*\]\([^)]*\)\s*$/i, '').trim();
  if (!cleaned) return;

  const notifiedEmails = new Set<string>();

  // Customers who opted in: email each per view they subscribed to.
  for (const view of views) {
    const subs = await listSubscribers({ viewId: view.id, issueId: args.issueId });
    for (const sub of subs) {
      const lower = sub.email.toLowerCase();
      if (notifiedEmails.has(lower)) continue;
      notifiedEmails.add(lower);
      const unsubscribeUrl = buildUnsubscribeUrl(sub.token);
      if (!unsubscribeUrl) continue;
      const { subject, html, text } = renderCustomerReplyEmail({
        authorName: args.commentAuthor,
        content: cleaned,
        viewName: view.name,
        viewSlug: view.slug,
        issueIdentifier: args.issueIdentifier,
        unsubscribeUrl,
      });
      await sendEmail({ to: sub.email, subject, html, text });
    }
  }

  // Owners: one email per unique view owner, skipping anyone already notified
  // as a subscriber (avoids duplicates when the owner also opted in as a
  // customer somewhere).
  const seenOwners = new Set<string>();
  for (const view of views) {
    if (seenOwners.has(view.user_id)) continue;
    seenOwners.add(view.user_id);
    const ownerEmail = await getOwnerEmail(view.user_id);
    if (!ownerEmail) continue;
    if (notifiedEmails.has(ownerEmail.toLowerCase())) continue;
    notifiedEmails.add(ownerEmail.toLowerCase());
    const { subject, html, text } = renderOwnerReplyEmail({
      authorName: args.commentAuthor,
      content: cleaned,
      viewName: view.name,
      viewSlug: view.slug,
      issueIdentifier: args.issueIdentifier,
    });
    await sendEmail({ to: ownerEmail, subject, html, text });
  }
}

// Simple health check so admins can verify the endpoint is reachable from
// Linear without triggering events.
export async function GET() {
  return NextResponse.json({
    success: true,
    configured: Boolean(process.env.LINEAR_WEBHOOK_SECRET),
  });
}
