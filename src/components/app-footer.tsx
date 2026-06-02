'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Github } from 'lucide-react'

const version = process.env.NEXT_PUBLIC_APP_VERSION ?? ''
const commit = process.env.NEXT_PUBLIC_COMMIT_SHA ?? ''
const versionString = commit ? `v${version}-${commit}` : `v${version}`

const NAV_LINKS = [
  { href: '/features', label: 'Features' },
  {
    href: 'https://github.com/digitoimistodude/linear-gratis/blob/dude/CHANGELOG.md',
    label: 'Changelog',
    external: true,
  },
]

const CHANGELOG_URL = 'https://github.com/digitoimistodude/linear-gratis/blob/dude/CHANGELOG.md'

function Dot() {
  return <span aria-hidden="true" className="mx-2 text-muted-foreground/60">·</span>
}

function NavList() {
  return (
    <nav className="flex flex-wrap items-center justify-center">
      {NAV_LINKS.map((link, i) => (
        <span key={link.href} className="inline-flex items-center">
          {link.external ? (
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              {link.label}
            </a>
          ) : (
            <Link href={link.href} className="hover:text-foreground transition-colors">
              {link.label}
            </Link>
          )}
          {i < NAV_LINKS.length - 1 && <Dot />}
        </span>
      ))}
    </nav>
  )
}

export function AppFooter() {
  const pathname = usePathname()

  // Public view pages render their own branded footer; the app footer would
  // clash with view-owner branding and leak app chrome to customers.
  if (pathname?.startsWith('/view/')) return null

  return (
    <footer className="border-t border-border/40 mt-12 py-4 px-6 text-xs text-muted-foreground">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <NavList />
        <span className="inline-flex flex-wrap items-center justify-center">
          <a
            href={CHANGELOG_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors"
          >
            {versionString}
          </a>
          <Dot />
          <span className="inline-flex items-center gap-1">
            Forked by{' '}
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
        </span>
      </div>
    </footer>
  )
}
