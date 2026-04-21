import { NextRequest, NextResponse } from 'next/server';

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
    issueId?: string;
    team?: { id?: string };
    teamId?: string;
    project?: { id?: string };
    projectId?: string;
    issue?: { id?: string; team?: { id?: string }; project?: { id?: string } };
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
      console.error(
        `Signature mismatch: got len=${signature.length} prefix=${signature.slice(0, 8)}..., expected len=${expected.length} prefix=${expected.slice(0, 8)}..., bodyLen=${rawBytes.byteLength}, secretLen=${secret.length}`,
      );
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
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
    return NextResponse.json({ success: true, forwarded: true });
  } catch (error) {
    console.error('Linear webhook error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
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
