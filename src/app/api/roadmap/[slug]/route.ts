import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import type { Roadmap, KanbanColumn } from '@/lib/supabase';
import { getLinearToken } from '@/lib/linear-token';
import { fetchRoadmapIssues, type RoadmapIssue } from '@/lib/linear';
import { redactRoadmapIssue } from '@/lib/public-redaction';
import { authoriseRoadmap, setRoadmapAccessCookie } from '@/lib/roadmap-auth';
import bcrypt from 'bcryptjs';

type VoteCount = {
  issue_id: string;
  count: number;
};

type CommentCount = {
  issue_id: string;
  count: number;
};

export type RoadmapResponse = {
  success: true;
  roadmap: {
    id: string;
    user_id: string;
    name: string;
    slug: string;
    title: string;
    description?: string;
    layout_type: 'kanban' | 'timeline';
    timeline_granularity: 'month' | 'quarter';
    kanban_columns: KanbanColumn[];
    show_item_descriptions: boolean;
    show_item_dates: boolean;
    show_vote_counts: boolean;
    show_comment_counts: boolean;
    allow_voting: boolean;
    allow_comments: boolean;
    require_email_for_comments: boolean;
    password_protected: boolean;
  };
  issues: RoadmapIssue[];
  voteCounts: Record<string, number>;
  commentCounts: Record<string, number>;
  projects: Array<{ id: string; name: string; color?: string }>;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    if (!slug) {
      return NextResponse.json(
        { error: 'Slug parameter is required' },
        { status: 400 }
      );
    }

    // Existence, expiry and password cookie checks. A browser that already
    // proved the password (via POST below) carries a signed access cookie, so
    // reloads load straight away instead of prompting again. Without a valid
    // cookie this is the same 401 as before.
    const auth = await authoriseRoadmap(slug, request);
    if (!auth.ok) return auth.response;
    const roadmap = auth.roadmap;

    const response = await fetchRoadmapData(roadmap);
    // Slide the cookie's expiry forward on every authenticated load so an
    // active viewer is not logged out mid-session. Lifetime stays the same.
    if (roadmap.password_protected && response.ok) {
      setRoadmapAccessCookie(response, roadmap);
    }
    return response;

  } catch (error) {
    console.error('Roadmap API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { password } = await request.json() as { password?: string };

    if (!slug) {
      return NextResponse.json(
        { error: 'Slug parameter is required' },
        { status: 400 }
      );
    }

    // Check if roadmap exists and is active
    const { data: roadmapData, error: roadmapError } = await supabaseAdmin
      .from('roadmaps')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (roadmapError || !roadmapData) {
      return NextResponse.json(
        { error: 'Roadmap not found or inactive' },
        { status: 404 }
      );
    }

    const roadmap = roadmapData as Roadmap;

    // Check password if roadmap is password protected
    if (roadmap.password_protected) {
      if (!password) {
        return NextResponse.json(
          { error: 'Password required', requiresPassword: true },
          { status: 401 }
        );
      }

      // Check password against hash
      const isPasswordValid = await bcrypt.compare(password, roadmap.password_hash || '');
      if (!isPasswordValid) {
        return NextResponse.json(
          { error: 'Invalid password', requiresPassword: true },
          { status: 401 }
        );
      }
    }

    // Check if roadmap has expired
    if (roadmap.expires_at && new Date(roadmap.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'This roadmap has expired' },
        { status: 410 }
      );
    }

    const response = await fetchRoadmapData(roadmap);
    // Only vouch for the browser if the payload actually built.
    if (response.ok) {
      setRoadmapAccessCookie(response, roadmap);
    }
    return response;

  } catch (error) {
    console.error('Roadmap password validation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}

async function fetchRoadmapData(roadmap: Roadmap) {
  // Get the Linear token (workspace-shared, falling back to user's personal)
  const decryptedToken = await getLinearToken(roadmap.user_id);
  if (!decryptedToken) {
    return NextResponse.json(
      { error: 'Unable to load data - Linear API token not found' },
      { status: 500 }
    );
  }

  if (!roadmap.project_ids || roadmap.project_ids.length === 0) {
    return NextResponse.json(
      { error: 'No projects configured for this roadmap' },
      { status: 400 }
    );
  }

  const issuesResult = await fetchRoadmapIssues(decryptedToken, roadmap.project_ids);

  if (!issuesResult.success) {
    throw new Error(`Failed to fetch issues from Linear: ${issuesResult.error}`);
  }

  // Fetch vote counts for all issues
  const issueIds = issuesResult.issues.map((issue) => issue.id);
  const voteCounts: Record<string, number> = {};
  const commentCounts: Record<string, number> = {};

  if (issueIds.length > 0) {
    // Get vote counts
    const { data: voteData } = await supabaseAdmin
      .from('roadmap_votes')
      .select('issue_id')
      .eq('roadmap_id', roadmap.id)
      .in('issue_id', issueIds);

    if (voteData) {
      // Count votes per issue
      const votes = voteData as VoteCount[];
      votes.forEach((vote) => {
        voteCounts[vote.issue_id] = (voteCounts[vote.issue_id] || 0) + 1;
      });
    }

    // Get comment counts (only approved, non-hidden)
    const { data: commentData } = await supabaseAdmin
      .from('roadmap_comments')
      .select('issue_id')
      .eq('roadmap_id', roadmap.id)
      .eq('is_approved', true)
      .eq('is_hidden', false)
      .in('issue_id', issueIds);

    if (commentData) {
      // Count comments per issue
      const comments = commentData as CommentCount[];
      comments.forEach((comment) => {
        commentCounts[comment.issue_id] = (commentCounts[comment.issue_id] || 0) + 1;
      });
    }
  }

  // Extract unique projects from issues
  const projectMap = new Map<string, { id: string; name: string; color?: string }>();
  issuesResult.issues.forEach((issue) => {
    if (issue.project && !projectMap.has(issue.project.id)) {
      projectMap.set(issue.project.id, issue.project);
    }
  });

  const response: RoadmapResponse = {
    success: true,
    roadmap: {
      id: roadmap.id,
      user_id: roadmap.user_id,
      name: roadmap.name,
      slug: roadmap.slug,
      title: roadmap.title,
      description: roadmap.description,
      layout_type: roadmap.layout_type,
      timeline_granularity: roadmap.timeline_granularity,
      kanban_columns: roadmap.kanban_columns,
      show_item_descriptions: roadmap.show_item_descriptions,
      show_item_dates: roadmap.show_item_dates,
      show_vote_counts: roadmap.show_vote_counts,
      show_comment_counts: roadmap.show_comment_counts,
      allow_voting: roadmap.allow_voting,
      allow_comments: roadmap.allow_comments,
      require_email_for_comments: roadmap.require_email_for_comments,
      password_protected: roadmap.password_protected,
    },
    issues: issuesResult.issues.map((issue) => redactRoadmapIssue(issue, roadmap)),
    voteCounts,
    commentCounts,
    projects: Array.from(projectMap.values()),
  };

  const json = NextResponse.json(response);
  // The payload is per-viewer (password gated, owner token), so nothing in
  // front of the Worker may cache it for another visitor.
  json.headers.set('Cache-Control', 'private, no-store');
  return json;
}
