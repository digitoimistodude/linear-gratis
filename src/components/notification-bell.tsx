'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { formatRelativeDate, formatTooltipDate } from '@/lib/relative-date'

type Notification = {
  id: string
  view_id: string | null
  issue_id: string | null
  issue_identifier: string | null
  kind: 'comment' | 'issue_created' | 'reply'
  title: string
  body: string | null
  url: string
  read_at: string | null
  created_at: string
}

export function NotificationBell({ userId }: { userId: string | null }) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications')
      if (!res.ok) return
      const data = await res.json() as { notifications: Notification[]; unreadCount: number }
      setNotifications(data.notifications)
      setUnreadCount(data.unreadCount)
    } catch (err) {
      console.error('Failed to load notifications:', err)
    }
  }, [])

  useEffect(() => {
    if (!userId) return
    fetchNotifications()
  }, [userId, fetchNotifications])

  // Live updates: refetch on inserts to the notifications table for this user.
  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => { fetchNotifications() },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, fetchNotifications])

  // Close on outside click.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        panelRef.current
        && !panelRef.current.contains(target)
        && !buttonRef.current?.contains(target)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const markAllRead = useCallback(async () => {
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      })
      setUnreadCount(0)
      setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })))
    } catch (err) {
      console.error('Failed to mark all read:', err)
    }
  }, [])

  const markOneRead = useCallback(async (id: string) => {
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id] }),
      })
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read_at: n.read_at ?? new Date().toISOString() } : n))
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch (err) {
      console.error('Failed to mark notification read:', err)
    }
  }, [])

  if (!userId) return null

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        className="relative p-2 rounded-md hover:bg-accent transition-colors"
      >
        <Bell className="h-4 w-4 text-muted-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-medium flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div
          ref={panelRef}
          className="absolute top-full right-0 mt-2 w-[360px] max-h-[480px] overflow-y-auto bg-card border border-border rounded-md shadow-lg z-50"
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-border/50 sticky top-0 bg-card">
            <span className="text-sm font-medium">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Mark all read
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No notifications yet.
            </div>
          ) : (
            <ul className="divide-y divide-border/50">
              {notifications.map((n) => (
                <li key={n.id}>
                  <Link
                    href={n.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => { markOneRead(n.id); setOpen(false) }}
                    className={`block px-3 py-2 hover:bg-accent/50 transition-colors ${
                      !n.read_at ? 'bg-primary/5' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium leading-tight">{n.title}</span>
                      {!n.read_at && <span className="mt-1 w-2 h-2 bg-primary rounded-full flex-shrink-0" />}
                    </div>
                    {n.body && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                    )}
                    <p
                      className="text-xs text-muted-foreground mt-1"
                      title={formatTooltipDate(n.created_at)}
                    >
                      {formatRelativeDate(n.created_at)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
