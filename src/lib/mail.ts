// Minimal transactional email sender via Resend. Designed to run from the
// Cloudflare Worker - no SDK, just a fetch to the REST API. If RESEND_API_KEY
// is not configured we no-op so feature-flag-style rollout works and tests
// don't hit the network.

import { supabaseAdmin } from '@/lib/supabase';

type SendArgs = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

function fromAddress(): string {
  // Configurable so the same code ships on different deployments without
  // hardcoding the dude.fi sender into the public repo.
  return process.env.MAIL_FROM || 'linear.dude.fi <notifications@dude.fi>';
}

export async function sendEmail(args: SendArgs): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: fromAddress(),
        to: [args.to],
        subject: args.subject,
        html: args.html,
        text: args.text,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('Resend send failed:', res.status, body);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Resend send threw:', err);
    return false;
  }
}

export async function getOwnerEmail(userId: string): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (error || !data?.user?.email) return null;
    return data.user.email;
  } catch (err) {
    console.error('Failed to resolve owner email:', err);
    return null;
  }
}

// Lightweight wrappers in a separate module would balloon scope; keeping the
// HTML inline since each template is short.

export function renderCommentEmail(args: {
  authorName: string;
  content: string;
  viewName: string;
  issueIdentifier?: string;
  viewUrl: string;
}): { subject: string; html: string; text: string } {
  const safe = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const subject = `New comment on ${args.issueIdentifier ?? 'a public view'}: ${args.viewName}`;
  const text = `${args.authorName} commented on ${args.viewName}${args.issueIdentifier ? ` (${args.issueIdentifier})` : ''}:\n\n${args.content}\n\nOpen the view: ${args.viewUrl}`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; line-height: 1.5; color: #0c0d0e;">
      <p style="margin: 0 0 12px;"><strong>${safe(args.authorName)}</strong> commented on <strong>${safe(args.viewName)}</strong>${args.issueIdentifier ? ` (${safe(args.issueIdentifier)})` : ''}:</p>
      <blockquote style="margin: 0 0 16px; padding: 8px 12px; border-left: 3px solid #e6e6e8; color: #4b4f56; white-space: pre-wrap;">${safe(args.content)}</blockquote>
      <p style="margin: 0;"><a href="${safe(args.viewUrl)}" style="color: #5e6ad2;">Open the view →</a></p>
    </div>
  `;
  return { subject, html, text };
}

export function renderIssueCreatedEmail(args: {
  authorName?: string;
  title: string;
  identifier?: string;
  viewName: string;
  viewUrl: string;
}): { subject: string; html: string; text: string } {
  const safe = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const subject = `New issue${args.identifier ? ` ${args.identifier}` : ''} via ${args.viewName}: ${args.title}`;
  const text = `${args.authorName ?? 'A customer'} filed a new issue${args.identifier ? ` (${args.identifier})` : ''} via ${args.viewName}:\n\n${args.title}\n\nOpen the view: ${args.viewUrl}`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; line-height: 1.5; color: #0c0d0e;">
      <p style="margin: 0 0 12px;"><strong>${safe(args.authorName ?? 'A customer')}</strong> filed a new issue${args.identifier ? ` <strong>${safe(args.identifier)}</strong>` : ''} via <strong>${safe(args.viewName)}</strong>:</p>
      <p style="margin: 0 0 16px; font-size: 16px;">${safe(args.title)}</p>
      <p style="margin: 0;"><a href="${safe(args.viewUrl)}" style="color: #5e6ad2;">Open the view →</a></p>
    </div>
  `;
  return { subject, html, text };
}
