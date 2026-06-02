import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { decryptToken } from '@/lib/encryption';
import { getLinearToken } from '@/lib/linear-token';
import { sendEmail, getOwnerEmail, renderCommentEmail } from '@/lib/mail';
import { upsertSubscription } from '@/lib/subscriptions';
import { createNotification } from '@/lib/notifications';
import type { PublicView, ViewComment } from '@/lib/supabase';
import crypto from 'crypto';

// Strip the "Commented via linear.dude.fi" footer we append when syncing a
// customer comment into Linear, so it never shows back on the public view.
function stripSyncFooter(body: string): string {
  return body.replace(/\n\n---\nCommented via \[[^\]]*\]\([^)]*\)\s*$/i, '').trim();
}

type LinearThreadComment = {
  id: string;
  body: string;
  createdAt: string;
  parent?: { id: string } | null;
  user?: { name?: string; displayName?: string } | null;
  botActor?: { name?: string } | null;
};

async function fetchLinearThread(apiToken: string, issueId: string): Promise<LinearThreadComment[] | null> {
  const query = `
    query IssueComments($issueId: String!) {
      issue(id: $issueId) {
        comments(first: 100) {
          nodes {
            id
            body
            createdAt
            parent { id }
            user { name displayName }
            botActor { name }
          }
        }
      }
    }
  `;
  try {
    const res = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: apiToken.replace(/[^\x00-\xFF]/g, ''),
      },
      body: JSON.stringify({ query, variables: { issueId } }),
    });
    const json = await res.json() as {
      data?: { issue?: { comments?: { nodes?: LinearThreadComment[] } } };
    };
    return json.data?.issue?.comments?.nodes ?? null;
  } catch (err) {
    console.error('Failed to fetch Linear comment thread:', err);
    return null;
  }
}

function hashIP(ip: string): string {
  const salt = process.env.IP_HASH_SALT || 'default-salt';
  return crypto
    .createHash('sha256')
    .update(ip + salt)
    .digest('hex');
}

function getClientIP(request: NextRequest): string {
  const cfConnectingIP = request.headers.get('cf-connecting-ip');
  if (cfConnectingIP) return cfConnectingIP;

  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();

  const realIP = request.headers.get('x-real-ip');
  if (realIP) return realIP;

  return 'unknown';
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; issueId: string }> }
) {
  try {
    const { slug, issueId } = await params;

    if (!slug || !issueId) {
      return NextResponse.json(
        { error: 'Slug and issueId parameters are required' },
        { status: 400 }
      );
    }

    // Check if view exists and is active
    const { data: viewData, error: viewError } = await supabaseAdmin
      .from('public_views')
      .select('id, user_id, is_active')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (viewError || !viewData) {
      return NextResponse.json(
        { error: 'Public view not found or inactive' },
        { status: 404 }
      );
    }

    // Fetch approved, non-hidden comments
    const { data: rows, error: commentsError } = await supabaseAdmin
      .from('view_comments')
      .select('id, author_name, content, created_at, linear_comment_id')
      .eq('view_id', viewData.id)
      .eq('issue_id', issueId)
      .eq('is_approved', true)
      .eq('is_hidden', false)
      .order('created_at', { ascending: true });

    if (commentsError) {
      throw commentsError;
    }

    type Row = Pick<ViewComment, 'id' | 'author_name' | 'content' | 'created_at'> & { linear_comment_id?: string | null };
    const customerComments = (rows ?? []) as Row[];

    // Pull the live Linear thread so team replies appear publicly and deleted
    // comments drop off. Only replies nested under a customer comment are shown
    // - unrelated internal Linear comments stay private.
    const token = await getLinearToken(viewData.user_id);
    const thread = token ? await fetchLinearThread(token, issueId) : null;

    let merged: Array<{ id: string; author_name: string; content: string; created_at: string }>;

    if (thread) {
      const liveIds = new Set(thread.map((c) => c.id));
      const rootIds = new Set(
        customerComments.map((c) => c.linear_comment_id).filter((id): id is string => Boolean(id)),
      );

      // Customer comments still present in Linear (or legacy ones with no synced
      // id, which we keep showing rather than risk hiding real feedback).
      const visibleCustomer = customerComments
        .filter((c) => !c.linear_comment_id || liveIds.has(c.linear_comment_id))
        .map((c) => ({
          id: c.id,
          author_name: c.author_name,
          content: c.content,
          created_at: c.created_at,
        }));

      // Team replies = Linear comments whose parent is one of our customer
      // comments and that aren't themselves a synced customer comment.
      const replies = thread
        .filter((c) => c.parent?.id && rootIds.has(c.parent.id) && !rootIds.has(c.id))
        .map((c) => ({
          id: `linear-${c.id}`,
          author_name: c.user?.displayName || c.user?.name || c.botActor?.name || 'Team',
          content: stripSyncFooter(c.body),
          created_at: c.createdAt,
        }));

      merged = [...visibleCustomer, ...replies].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
    } else {
      // No Linear token available - fall back to the stored customer comments.
      merged = customerComments.map((c) => ({
        id: c.id,
        author_name: c.author_name,
        content: c.content,
        created_at: c.created_at,
      }));
    }

    return NextResponse.json({
      success: true,
      comments: merged,
    });
  } catch (error) {
    console.error('View comments GET error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; issueId: string }> }
) {
  try {
    const { slug, issueId } = await params;
    const body = await request.json() as {
      authorName?: string;
      authorEmail?: string;
      content?: string;
      issueIdentifier?: string;
    };

    const { authorName, authorEmail, content, issueIdentifier } = body;

    if (!slug || !issueId) {
      return NextResponse.json(
        { error: 'Slug and issueId parameters are required' },
        { status: 400 }
      );
    }

    if (!authorName || !content) {
      return NextResponse.json(
        { error: 'authorName and content are required' },
        { status: 400 }
      );
    }

    // Check if view exists, is active, and allows comments
    const { data: viewData, error: viewError } = await supabaseAdmin
      .from('public_views')
      .select('id, user_id, slug, name, is_active, allow_customer_comments')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (viewError || !viewData) {
      return NextResponse.json(
        { error: 'Public view not found or inactive' },
        { status: 404 }
      );
    }

    const view = viewData as Pick<PublicView, 'id' | 'user_id' | 'slug' | 'name' | 'is_active' | 'allow_customer_comments'>;

    if (!view.allow_customer_comments) {
      return NextResponse.json(
        { error: 'Comments are disabled for this view' },
        { status: 403 }
      );
    }

    const trimmedContent = content.trim();
    if (trimmedContent.length < 1) {
      return NextResponse.json({ error: 'Comment cannot be empty' }, { status: 400 });
    }
    if (trimmedContent.length > 2000) {
      return NextResponse.json({ error: 'Comment is too long (max 2000 characters)' }, { status: 400 });
    }

    const clientIP = getClientIP(request);
    const ipHash = hashIP(clientIP);
    const isApproved = true;

    // Insert the comment
    const { data: newComment, error: insertError } = await supabaseAdmin
      .from('view_comments')
      .insert({
        view_id: view.id,
        issue_id: issueId,
        author_name: authorName.trim(),
        author_email: '',
        content: trimmedContent,
        is_approved: isApproved,
        is_hidden: false,
        ip_hash: ipHash,
      })
      .select('id, author_name, content, created_at, is_approved')
      .single();

    if (insertError) {
      throw insertError;
    }

    const comment = newComment as Pick<ViewComment, 'id' | 'author_name' | 'content' | 'created_at' | 'is_approved'>;

    // If the customer left an email, subscribe them to the thread so Linear-
    // side replies land in their inbox. Best-effort: never blocks the comment.
    if (authorEmail) {
      try {
        await upsertSubscription({
          viewId: view.id,
          issueId,
          email: authorEmail,
        });
      } catch (subError) {
        console.error('Failed to upsert comment subscription:', subError);
      }
    }

    // Broadcast via the Realtime HTTP API so it works from Cloudflare Workers
    // without needing an established WebSocket connection.
    if (comment.is_approved) {
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (supabaseUrl && serviceKey) {
          await fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey: serviceKey,
              Authorization: `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({
              messages: [
                {
                  topic: 'view-comments',
                  event: 'new',
                  payload: {
                    viewSlug: view.slug,
                    issueId,
                  },
                },
              ],
            }),
          });
        }
      } catch (broadcastError) {
        console.error('Failed to broadcast view comment:', broadcastError);
      }
    }

    // Email the view owner about the new comment. Best-effort: mail failures
    // never break the comment response.
    try {
      const ownerEmail = await getOwnerEmail(view.user_id);
      if (ownerEmail) {
        const { subject, html, text } = renderCommentEmail({
          authorName: authorName.trim(),
          content: trimmedContent,
          viewName: view.name,
          viewSlug: view.slug,
          issueIdentifier,
        });
        await sendEmail({ to: ownerEmail, subject, html, text });
      }
    } catch (mailError) {
      console.error('Failed to email owner about new comment:', mailError);
    }

    await createNotification({
      userId: view.user_id,
      viewId: view.id,
      issueId,
      issueIdentifier,
      kind: 'comment',
      title: `New comment on ${issueIdentifier ?? view.name}`,
      body: `${authorName.trim()}: ${trimmedContent.slice(0, 200)}`,
      viewSlug: view.slug,
    });

    // Sync comment to Linear
    try {
      const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || 'linear.dude.fi';
      const urlSuffix = issueIdentifier || issueId;
      const viewUrl = `https://${appDomain}/view/${view.slug}/${urlSuffix}`;

      // Get personal API token from profiles
      const { data: profileData } = await supabaseAdmin
        .from('profiles')
        .select('linear_api_token')
        .eq('id', view.user_id)
        .single();

      // Get OAuth token from workspace_settings
      const { data: workspaceSettings } = await supabaseAdmin
        .from('workspace_settings')
        .select('linear_oauth_token')
        .limit(1)
        .single();

      const personalToken = profileData?.linear_api_token
        ? decryptToken(profileData.linear_api_token)
        : null;

      const oauthToken = workspaceSettings?.linear_oauth_token
        ? decryptToken(workspaceSettings.linear_oauth_token)
        : null;

      // Build comment body
      const commentBody = `${trimmedContent}\n\n---\nCommented via [${appDomain}](${viewUrl})`;

      // Post comment to Linear
      const commentToken = oauthToken || personalToken;
      if (commentToken) {
        const commentMutation = `
          mutation CommentCreate($input: CommentCreateInput!) {
            commentCreate(input: $input) {
              success
              comment { id }
            }
          }
        `;

        // Build the comment input
        const commentInput: Record<string, string> = {
          issueId,
          body: commentBody,
        };

        // When using OAuth token, use createAsUser and displayIconUrl
        if (oauthToken) {
          commentInput.createAsUser = authorName.trim();
          commentInput.displayIconUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(authorName.trim())}&background=random&size=128`;
        }

        // Linear requires a `Bearer` prefix for OAuth tokens but rejects it on
        // personal API keys. Pick the correct header shape for whichever we
        // ended up using.
        const cleanCommentToken = commentToken.replace(/[^\x00-\xFF]/g, '');
        const commentAuthHeader = oauthToken
          ? `Bearer ${cleanCommentToken}`
          : cleanCommentToken;

        const commentRes = await fetch('https://api.linear.app/graphql', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: commentAuthHeader,
          },
          body: JSON.stringify({
            query: commentMutation,
            variables: { input: commentInput },
          }),
        });

        // Persist the created comment's Linear ID so the public thread can later
        // surface team replies nested under it and detect its deletion.
        try {
          const commentJson = await commentRes.json() as {
            data?: { commentCreate?: { success?: boolean; comment?: { id?: string } } };
            errors?: unknown[];
          };
          const linearCommentId = commentJson.data?.commentCreate?.comment?.id;
          if (!commentRes.ok || commentJson.errors || !commentJson.data?.commentCreate?.success || !linearCommentId) {
            console.error('Linear commentCreate did not return a comment id:', {
              status: commentRes.status,
              hasErrors: Boolean(commentJson.errors),
              errors: commentJson.errors,
              success: commentJson.data?.commentCreate?.success,
              tokenSource: oauthToken ? 'oauth' : 'personal',
            });
          }
          if (linearCommentId) {
            await supabaseAdmin
              .from('view_comments')
              .update({ linear_comment_id: linearCommentId })
              .eq('id', comment.id);
          }
        } catch (idError) {
          console.error('Failed to capture Linear comment id:', idError);
        }
      }

      // Create attachment using personal API key (always, if available)
      if (personalToken) {
        const attachmentMutation = `
          mutation AttachmentCreate($input: AttachmentCreateInput!) {
            attachmentCreate(input: $input) {
              success
            }
          }
        `;

        await fetch('https://api.linear.app/graphql', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `${personalToken.replace(/[^\x00-\xFF]/g, '')}`,
          },
          body: JSON.stringify({
            query: attachmentMutation,
            variables: {
              input: {
                issueId,
                title: 'Customer discussion',
                subtitle: `${view.name} - ${appDomain}`,
                url: viewUrl,
              },
            },
          }),
        });
      }
    } catch (linearError) {
      // Don't fail the comment if Linear sync fails
      console.error('Failed to sync comment to Linear:', linearError);
    }

    return NextResponse.json({
      success: true,
      comment: {
        id: comment.id,
        author_name: comment.author_name,
        content: comment.content,
        created_at: comment.created_at,
      },
      pending: !comment.is_approved,
      message: comment.is_approved
        ? 'Comment posted successfully'
        : 'Comment submitted and pending moderation',
    });
  } catch (error) {
    console.error('View comments POST error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
