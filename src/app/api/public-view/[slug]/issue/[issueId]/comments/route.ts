import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { decryptToken } from '@/lib/encryption';
import type { PublicView, ViewComment } from '@/lib/supabase';
import crypto from 'crypto';

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
      .select('id, is_active')
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
    const { data: comments, error: commentsError } = await supabaseAdmin
      .from('view_comments')
      .select('id, author_name, content, created_at')
      .eq('view_id', viewData.id)
      .eq('issue_id', issueId)
      .eq('is_approved', true)
      .eq('is_hidden', false)
      .order('created_at', { ascending: true });

    if (commentsError) {
      throw commentsError;
    }

    return NextResponse.json({
      success: true,
      comments: comments || [],
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
      content?: string;
      issueIdentifier?: string;
    };

    const { authorName, content, issueIdentifier } = body;

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

    // Sync comment to Linear as a bot-identity comment
    try {
      const { data: profileData } = await supabaseAdmin
        .from('profiles')
        .select('linear_api_token')
        .eq('id', view.user_id)
        .single();

      if (profileData?.linear_api_token) {
        const decryptedToken = decryptToken(profileData.linear_api_token);
        const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || 'linear.gratis';
        const urlSuffix = issueIdentifier || issueId;
        const viewUrl = `https://${appDomain}/view/${view.slug}/${urlSuffix}`;

        const headers = {
          'Content-Type': 'application/json',
          Authorization: `${decryptedToken.replace(/[^\x00-\xFF]/g, '')}`,
        };

        // Create a comment with bot identity using createAsUser
        const commentMutation = `
          mutation CommentCreate($input: CommentCreateInput!) {
            commentCreate(input: $input) {
              success
              comment { id }
            }
          }
        `;

        await fetch('https://api.linear.app/graphql', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            query: commentMutation,
            variables: {
              input: {
                issueId,
                body: `**${authorName.trim()}** commented via [${view.name}](${viewUrl}):\n\n> ${trimmedContent}`,
                createAsUser: authorName.trim(),
                displayIconUrl: `https://${appDomain}/favicon-32x32.png`,
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
