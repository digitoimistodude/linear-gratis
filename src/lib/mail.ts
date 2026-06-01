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

// Deployments must supply MAIL_FROM (e.g. "App <notifications@example.com>"),
// so the public repo never bakes in a specific organization's address.
function fromAddress(): string | null {
  return process.env.MAIL_FROM || null;
}

export async function sendEmail(args: SendArgs): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;
  const from = fromAddress();
  if (!from) {
    console.error('MAIL_FROM is not configured; skipping email send');
    return false;
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
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

function safe(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function appDomain(): string {
  return process.env.NEXT_PUBLIC_APP_DOMAIN || 'linear.gratis';
}

// Deep link to a specific issue inside a public view. Pattern matches the
// auto-open logic on the public view page (/view/SLUG/IDENTIFIER opens the
// issue detail modal).
export function buildIssueUrl(slug: string, issueIdentifier?: string | null): string {
  const domain = appDomain();
  if (issueIdentifier) {
    return `https://${domain}/view/${encodeURIComponent(slug)}/${encodeURIComponent(issueIdentifier)}`;
  }
  return `https://${domain}/view/${encodeURIComponent(slug)}`;
}

// Build the unsubscribe URL for a customer subscription. When the recipient is
// the workspace owner we pass `null` and the footer renders without it.
export function buildUnsubscribeUrl(token: string | null): string | null {
  if (!token) return null;
  return `https://${appDomain()}/unsubscribe?token=${encodeURIComponent(token)}`;
}

const SHELL_OPEN = `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; line-height: 1.5; color: #0c0d0e; max-width: 560px;">
`;

function footer(unsubscribeUrl: string | null): string {
  const domain = safe(appDomain());
  const lines: string[] = [
    `<p style="margin: 0 0 4px;">Sent by <a href="https://${domain}" style="color: #6f7177;">${domain}</a></p>`,
  ];
  if (unsubscribeUrl) {
    lines.push(
      `<p style="margin: 0;"><a href="${safe(unsubscribeUrl)}" style="color: #6f7177;">Unsubscribe</a> from this thread.</p>`,
    );
  }
  return `
    <hr style="border: none; border-top: 1px solid #e6e6e8; margin: 24px 0 12px;" />
    <div style="font-size: 12px; color: #6f7177;">
      ${lines.join('\n      ')}
    </div>
  `;
}

function wrap(inner: string, unsubscribeUrl: string | null = null): string {
  return `${SHELL_OPEN}${inner}${footer(unsubscribeUrl)}</div>`;
}

// === Owner notifications ===================================================

export function renderCommentEmail(args: {
  authorName: string;
  content: string;
  viewName: string;
  viewSlug: string;
  issueIdentifier?: string;
}): { subject: string; html: string; text: string } {
  const url = buildIssueUrl(args.viewSlug, args.issueIdentifier);
  const subject = `New comment on ${args.issueIdentifier ?? 'a public view'}: ${args.viewName}`;
  const text = `${args.authorName} commented on ${args.viewName}${args.issueIdentifier ? ` (${args.issueIdentifier})` : ''}:\n\n${args.content}\n\nOpen the issue: ${url}\n\nSent by ${appDomain()}`;
  const html = wrap(`
    <p style="margin: 0 0 12px;"><strong>${safe(args.authorName)}</strong> commented on <strong>${safe(args.viewName)}</strong>${args.issueIdentifier ? ` (${safe(args.issueIdentifier)})` : ''}:</p>
    <blockquote style="margin: 0 0 16px; padding: 8px 12px; border-left: 3px solid #e6e6e8; color: #4b4f56; white-space: pre-wrap;">${safe(args.content)}</blockquote>
    <p style="margin: 0;"><a href="${safe(url)}" style="color: #5e6ad2;">Open the issue →</a></p>
  `);
  return { subject, html, text };
}

export function renderIssueCreatedEmail(args: {
  authorName?: string;
  title: string;
  identifier?: string;
  viewName: string;
  viewSlug: string;
}): { subject: string; html: string; text: string } {
  const url = buildIssueUrl(args.viewSlug, args.identifier);
  const subject = `New issue${args.identifier ? ` ${args.identifier}` : ''} via ${args.viewName}: ${args.title}`;
  const text = `${args.authorName ?? 'A customer'} filed a new issue${args.identifier ? ` (${args.identifier})` : ''} via ${args.viewName}:\n\n${args.title}\n\nOpen the issue: ${url}\n\nSent by ${appDomain()}`;
  const html = wrap(`
    <p style="margin: 0 0 12px;"><strong>${safe(args.authorName ?? 'A customer')}</strong> filed a new issue${args.identifier ? ` <strong>${safe(args.identifier)}</strong>` : ''} via <strong>${safe(args.viewName)}</strong>:</p>
    <p style="margin: 0 0 16px; font-size: 16px;">${safe(args.title)}</p>
    <p style="margin: 0;"><a href="${safe(url)}" style="color: #5e6ad2;">Open the issue →</a></p>
  `);
  return { subject, html, text };
}

// Owner notification when a Linear-side reply lands in a thread on one of
// their public views. Distinct subject so it can be filtered separately.
export function renderOwnerReplyEmail(args: {
  authorName: string;
  content: string;
  viewName: string;
  viewSlug: string;
  issueIdentifier?: string;
}): { subject: string; html: string; text: string } {
  const url = buildIssueUrl(args.viewSlug, args.issueIdentifier);
  const subject = `Linear reply on ${args.issueIdentifier ?? 'a public view'}: ${args.viewName}`;
  const text = `${args.authorName} replied in Linear on ${args.viewName}${args.issueIdentifier ? ` (${args.issueIdentifier})` : ''}:\n\n${args.content}\n\nOpen the issue: ${url}\n\nSent by ${appDomain()}`;
  const html = wrap(`
    <p style="margin: 0 0 12px;"><strong>${safe(args.authorName)}</strong> replied in Linear on <strong>${safe(args.viewName)}</strong>${args.issueIdentifier ? ` (${safe(args.issueIdentifier)})` : ''}:</p>
    <blockquote style="margin: 0 0 16px; padding: 8px 12px; border-left: 3px solid #e6e6e8; color: #4b4f56; white-space: pre-wrap;">${safe(args.content)}</blockquote>
    <p style="margin: 0;"><a href="${safe(url)}" style="color: #5e6ad2;">Open the issue →</a></p>
  `);
  return { subject, html, text };
}

// === Customer notifications ===============================================

// Sent to a customer who opted in (via comment or issue creation) when a
// Linear-side reply lands on the issue they subscribed to.
export function renderCustomerReplyEmail(args: {
  authorName: string;
  content: string;
  viewName: string;
  viewSlug: string;
  issueIdentifier?: string;
  unsubscribeUrl: string;
}): { subject: string; html: string; text: string } {
  const url = buildIssueUrl(args.viewSlug, args.issueIdentifier);
  const subject = `New reply on ${args.viewName}${args.issueIdentifier ? ` (${args.issueIdentifier})` : ''}`;
  const text = `${args.authorName} replied to your conversation on ${args.viewName}${args.issueIdentifier ? ` (${args.issueIdentifier})` : ''}:\n\n${args.content}\n\nOpen the issue: ${url}\n\nSent by ${appDomain()}\nUnsubscribe: ${args.unsubscribeUrl}`;
  const html = wrap(
    `
    <p style="margin: 0 0 12px;"><strong>${safe(args.authorName)}</strong> replied to your conversation on <strong>${safe(args.viewName)}</strong>${args.issueIdentifier ? ` (${safe(args.issueIdentifier)})` : ''}:</p>
    <blockquote style="margin: 0 0 16px; padding: 8px 12px; border-left: 3px solid #e6e6e8; color: #4b4f56; white-space: pre-wrap;">${safe(args.content)}</blockquote>
    <p style="margin: 0;"><a href="${safe(url)}" style="color: #5e6ad2;">Open the issue →</a></p>
  `,
    args.unsubscribeUrl,
  );
  return { subject, html, text };
}
