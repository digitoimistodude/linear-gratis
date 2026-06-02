'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Send, User } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Comment {
  id: string
  author_name: string
  content: string
  created_at: string
  isPending?: boolean
  isFailed?: boolean
}

interface ViewCommentSectionProps {
  viewSlug: string
  issueId: string
  issueIdentifier?: string
  allowComments: boolean
}

export function ViewCommentSection({
  viewSlug,
  issueId,
  issueIdentifier,
  allowComments,
}: ViewCommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  const [authorName, setAuthorName] = useState('')
  const [authorEmail, setAuthorEmail] = useState('')
  const [content, setContent] = useState('')

  useEffect(() => {
    const savedName = localStorage.getItem('view_comment_name')
    if (savedName) setAuthorName(savedName)
    const savedEmail = localStorage.getItem('view_comment_email')
    if (savedEmail) setAuthorEmail(savedEmail)
  }, [])

  const fetchComments = useCallback(async (showSpinner = true) => {
    try {
      if (showSpinner) setLoading(true)
      const response = await fetch(
        `/api/public-view/${viewSlug}/issue/${issueId}/comments`,
      )
      if (response.ok) {
        const data = await response.json() as { comments: Comment[] }
        // Preserve any locally-optimistic or failed comments that haven't
        // been persisted yet, merging them on top of the server list.
        setComments((prev) => {
          const pending = prev.filter((c) => c.isPending || c.isFailed)
          const ids = new Set(pending.map((c) => c.id))
          const server = (data.comments || []).filter((c) => !ids.has(c.id))
          return [...server, ...pending]
        })
      }
    } catch (err) {
      console.error('Error fetching comments:', err)
    } finally {
      if (showSpinner) setLoading(false)
    }
  }, [viewSlug, issueId])

  useEffect(() => {
    fetchComments()
  }, [fetchComments])

  // Subscribe to the Realtime 'view-comments' channel so discussion panes
  // update live when another visitor posts a comment on this same view/issue.
  useEffect(() => {
    const channel = supabase.channel('view-comments')
    channel
      .on('broadcast', { event: 'new' }, ({ payload }) => {
        const p = payload as { viewSlug?: string; issueId?: string }
        if (p.viewSlug === viewSlug && p.issueId === issueId) {
          fetchComments(false)
        }
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [viewSlug, issueId, fetchComments])

  // Also refetch when a Linear webhook reports a comment change on this issue,
  // so team replies made inside Linear (and deletions) appear live - same path
  // as status changes.
  useEffect(() => {
    const channel = supabase.channel('linear-updates')
    channel
      .on('broadcast', { event: 'update' }, ({ payload }) => {
        const p = payload as { type?: string; issueId?: string }
        if (p.type === 'Comment' && p.issueId === issueId) {
          fetchComments(false)
        }
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [issueId, fetchComments])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!authorName.trim() || !content.trim()) {
      setError('Please fill in all required fields')
      return
    }

    setSubmitting(true)
    setError(null)
    setSuccess(null)

    const tempId = `temp-${Date.now()}`
    const optimisticComment: Comment = {
      id: tempId,
      author_name: authorName.trim(),
      content: content.trim(),
      created_at: new Date().toISOString(),
      isPending: true,
    }

    setComments((prev) => [...prev, optimisticComment])

    const submittedContent = content.trim()
    const submittedName = authorName.trim()
    const submittedEmail = authorEmail.trim()
    setContent('')

    localStorage.setItem('view_comment_name', submittedName)
    if (submittedEmail) {
      localStorage.setItem('view_comment_email', submittedEmail)
    }

    try {
      const response = await fetch(
        `/api/public-view/${viewSlug}/issue/${issueId}/comments`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            authorName: submittedName,
            authorEmail: submittedEmail || undefined,
            content: submittedContent,
            issueIdentifier,
          }),
        }
      )

      const data = await response.json() as {
        success: boolean
        comment?: Comment
        pending?: boolean
        message?: string
        error?: string
      }

      if (data.success) {
        if (data.comment && !data.pending) {
          // Race-safe replace: the Realtime broadcast may have already brought
          // in the server-side row before this response handler runs. If so,
          // just drop the optimistic placeholder instead of inserting a second
          // copy of the same comment.
          setComments((prev) => {
            const serverId = data.comment!.id
            if (prev.some((c) => c.id === serverId)) {
              return prev.filter((c) => c.id !== tempId)
            }
            return prev.map((c) => (c.id === tempId ? { ...data.comment!, isPending: false } : c))
          })
        } else if (data.pending) {
          setComments((prev) => prev.filter((c) => c.id !== tempId))
          setSuccess(data.message || 'Comment submitted for review')
          setTimeout(() => setSuccess(null), 5000)
        } else {
          setComments((prev) =>
            prev.map((c) => (c.id === tempId ? { ...c, isPending: false } : c))
          )
        }
      } else {
        setComments((prev) =>
          prev.map((c) => (c.id === tempId ? { ...c, isPending: false, isFailed: true } : c))
        )
        setError(data.error || 'Failed to post comment')
      }
    } catch (err) {
      console.error('Error posting comment:', err)
      setComments((prev) =>
        prev.map((c) => (c.id === tempId ? { ...c, isPending: false, isFailed: true } : c))
      )
      setError('Failed to post comment. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const retryComment = (failedComment: Comment) => {
    setComments((prev) => prev.filter((c) => c.id !== failedComment.id))
    setContent(failedComment.content)
    setError(null)
  }

  const dismissFailedComment = (commentId: string) => {
    setComments((prev) => prev.filter((c) => c.id !== commentId))
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`

    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {loading ? (
          <div className="py-8 text-center">
            <div className="w-5 h-5 mx-auto mb-2 animate-spin">
              <svg fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
            <p className="text-xs text-muted-foreground">Loading discussion...</p>
          </div>
        ) : comments.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            No comments yet. Be the first to share your feedback!
          </div>
        ) : (
          comments.map((comment) => (
            <div
              key={comment.id}
              className={`bg-muted/30 rounded-lg p-3 space-y-1.5 transition-opacity duration-200 ${
                comment.isPending ? 'opacity-60' : ''
              } ${comment.isFailed ? 'border border-destructive/30 bg-destructive/5' : ''}`}
            >
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                  comment.isFailed ? 'bg-destructive/10' : 'bg-primary/10'
                }`}>
                  <User className={`h-3 w-3 ${comment.isFailed ? 'text-destructive' : 'text-primary'}`} />
                </div>
                <span className="text-sm font-medium">{comment.author_name}</span>
                <span className="text-xs text-muted-foreground">
                  {comment.isPending ? 'Posting...' : formatDate(comment.created_at)}
                </span>
              </div>
              <p className="text-sm text-foreground/90 pl-8 whitespace-pre-wrap">
                {comment.content}
              </p>
              {comment.isFailed && (
                <div className="pl-8 flex items-center gap-2 pt-1">
                  <span className="text-xs text-destructive">Failed to post</span>
                  <button onClick={() => retryComment(comment)} className="text-xs text-primary hover:underline">
                    Retry
                  </button>
                  <button onClick={() => dismissFailedComment(comment.id)} className="text-xs text-muted-foreground hover:underline">
                    Dismiss
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {allowComments && (
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-3 pt-2 border-t border-border/50">
          <input
            type="text"
            placeholder="Your name"
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            disabled={submitting}
            className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors disabled:opacity-50"
            required
          />

          <div className="space-y-1">
            <input
              type="email"
              placeholder="Email (optional, get notified of replies)"
              value={authorEmail}
              onChange={(e) => setAuthorEmail(e.target.value)}
              disabled={submitting}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors disabled:opacity-50"
            />
          </div>

          <div className="relative">
            <textarea
              placeholder="Share your feedback..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={submitting}
              rows={3}
              maxLength={2000}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors resize-none disabled:opacity-50"
              required
            />
            <div className="absolute bottom-2 right-2 text-xs text-muted-foreground">
              {content.length}/2000
            </div>
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-md p-2">
              {error}
            </div>
          )}

          {success && (
            <div className="text-sm text-green-600 bg-green-50 border border-green-200 rounded-md p-2">
              {success}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting || !authorName.trim() || !content.trim()}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 active:scale-[0.98]"
            >
              <Send className="h-4 w-4" />
              Post comment
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
