'use client'

import { useAuth } from '@/contexts/auth-context'
import { Github } from 'lucide-react'

const version = process.env.NEXT_PUBLIC_APP_VERSION ?? ''
const commit = process.env.NEXT_PUBLIC_COMMIT_SHA ?? ''

const versionString = commit ? `v${version}-${commit}` : `v${version}`

export function AppFooter() {
  const { user, loading } = useAuth()

  if (loading) return null

  return (
    <footer className="border-t border-border/40 mt-12 py-4 px-6">
      <div className="max-w-7xl mx-auto flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <span>{versionString}</span>
        <span aria-hidden="true">·</span>
        {user ? (
          <span>
            Self-hosted by Dude
          </span>
        ) : (
          <span className="inline-flex items-center gap-1">
            Forked by
            <a
              href="https://github.com/digitoimistodude/linear-gratis"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
            >
              digitoimistodude
              <Github className="h-3 w-3" />
            </a>
          </span>
        )}
      </div>
    </footer>
  )
}
