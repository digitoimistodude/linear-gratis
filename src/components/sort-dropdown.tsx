'use client'

import React, { useEffect, useRef } from 'react'

export type SortKey =
  | 'createdAt-desc'
  | 'createdAt-asc'
  | 'updatedAt-desc'
  | 'updatedAt-asc'
  | 'priority-asc'
  | 'title-asc'

export const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: 'createdAt-desc', label: 'Last created' },
  { key: 'createdAt-asc', label: 'First created' },
  { key: 'updatedAt-desc', label: 'Last updated' },
  { key: 'updatedAt-asc', label: 'First updated' },
  { key: 'priority-asc', label: 'Priority' },
  { key: 'title-asc', label: 'Title' },
]

export const DEFAULT_SORT: SortKey = 'createdAt-desc'

interface SortDropdownProps {
  isOpen: boolean
  onClose: () => void
  sort: SortKey
  onSortChange: (sort: SortKey) => void
  triggerRef: React.RefObject<HTMLButtonElement | null>
}

export function SortDropdown({
  isOpen,
  onClose,
  sort,
  onSortChange,
  triggerRef,
}: SortDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        dropdownRef.current
        && !dropdownRef.current.contains(target)
        && !triggerRef.current?.contains(target)
      ) {
        onClose()
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [isOpen, onClose, triggerRef])

  if (!isOpen) return null

  return (
    <div
      ref={dropdownRef}
      className="absolute top-full left-0 mt-1 w-56 bg-card border border-border rounded-md shadow-lg z-50 py-1"
    >
      {SORT_OPTIONS.map((option) => {
        const active = sort === option.key
        return (
          <button
            key={option.key}
            onClick={() => {
              onSortChange(option.key)
              onClose()
            }}
            className={`w-full flex items-center justify-between px-3 py-1.5 text-sm transition-colors ${
              active
                ? 'bg-accent text-accent-foreground'
                : 'text-foreground hover:bg-accent/50'
            }`}
          >
            <span>{option.label}</span>
            {active && (
              <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor">
                <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 1 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"/>
              </svg>
            )}
          </button>
        )
      })}
    </div>
  )
}

export function sortIssues<T extends {
  createdAt: string
  updatedAt: string
  priority: number
  title: string
}>(issues: T[], sort: SortKey): T[] {
  const arr = issues.slice()
  switch (sort) {
    case 'createdAt-desc':
      return arr.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    case 'createdAt-asc':
      return arr.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    case 'updatedAt-desc':
      return arr.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    case 'updatedAt-asc':
      return arr.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
    case 'priority-asc':
      // Linear priority: 0 = none, 1 = urgent, 2 = high, 3 = medium, 4 = low.
      // Sort urgent first, treat 0 (none) as lowest so it sinks to the bottom.
      return arr.sort((a, b) => {
        const pa = a.priority === 0 ? 99 : a.priority
        const pb = b.priority === 0 ? 99 : b.priority
        return pa - pb
      })
    case 'title-asc':
      return arr.sort((a, b) => a.title.localeCompare(b.title))
  }
}
