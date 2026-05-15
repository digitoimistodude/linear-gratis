'use client'

import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { SimpleThemeToggle } from '@/components/theme-toggle'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { BrandingSettings } from '@/lib/supabase'
import { sanitizeSvgMarkup } from '@/lib/svg-sanitize'

export function Navigation() {
  const { user, signOut, loading } = useAuth()
  const [branding, setBranding] = useState<BrandingSettings | null>(null)
  const [brandingLoaded, setBrandingLoaded] = useState(false)

  // Load branding settings for authenticated users
  useEffect(() => {
    if (!user) return

    const loadBranding = async () => {
      try {
        const response = await fetch('/api/branding')
        if (response.ok) {
          const text = await response.text()
          if (!text) return
          const data = JSON.parse(text) as { branding: BrandingSettings | null }
          setBranding(data.branding)
        }
      } catch (err) {
        console.error('Error loading branding:', err)
      } finally {
        setBrandingLoaded(true)
      }
    }

    loadBranding()
  }, [user])

  const renderLogo = () => {
    // Don't show fallback text while branding is loading for authenticated users
    if (user && !brandingLoaded) {
      return <div className="h-6" />
    }

    if (branding?.logo_svg) {
      return (
        <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity duration-200">
          <div
            aria-label={branding.brand_name || 'Logo'}
            style={{ maxHeight: `${branding.logo_height || 32}px` }}
            className="flex-shrink-0 flex items-center"
            dangerouslySetInnerHTML={{ __html: sanitizeSvgMarkup(branding.logo_svg) }}
          />
          {branding.brand_name && (
            <span className="text-base font-semibold">{branding.brand_name}</span>
          )}
        </Link>
      )
    }

    if (branding?.logo_url) {
      return (
        <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity duration-200">
          <img
            src={branding.logo_url}
            alt={branding.brand_name || 'Logo'}
            style={{
              width: 'auto',
              height: 'auto',
              maxHeight: `${branding.logo_height || 32}px`,
              objectFit: 'contain',
            }}
            className="flex-shrink-0"
          />
          {branding.brand_name && (
            <span className="text-base font-semibold">{branding.brand_name}</span>
          )}
        </Link>
      )
    }

    if (branding?.brand_name) {
      return (
        <Link href="/" className="text-base font-semibold hover:text-primary transition-colors duration-200">
          {branding.brand_name}
        </Link>
      )
    }

    return (
      <Link href="/" className="text-base font-semibold hover:text-primary transition-colors duration-200">
        linear.dude.fi
      </Link>
    )
  }

  if (loading) {
    return (
      <nav className="border-b border-border/50 bg-card/80 backdrop-blur-sm px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-semibold">linear.dude.fi</h1>
          <div className="text-sm text-muted-foreground">Loading...</div>
        </div>
      </nav>
    )
  }

  return (
    <nav className="border-b border-border/50 bg-card/80 backdrop-blur-sm px-6 py-4 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        {renderLogo()}

        {/* Center navigation */}
        <div className="flex items-center gap-2" />

        <div className="flex items-center gap-2">
          {user ? (
            <div className="flex items-center gap-2">
              <Link href="/views">
                <Button variant="ghost" size="sm" className="font-medium">
                  Public views
                </Button>
              </Link>
              <Link href="/forms">
                <Button variant="ghost" size="sm" className="font-medium">
                  Forms
                </Button>
              </Link>
              <Link href="/roadmaps">
                <Button variant="ghost" size="sm" className="font-medium">
                  Roadmaps
                </Button>
              </Link>
              <Link href="/profile/branding">
                <Button variant="ghost" size="sm" className="font-medium">
                  Branding
                </Button>
              </Link>
              <Link href="/profile/domains">
                <Button variant="ghost" size="sm" className="font-medium">
                  Domains
                </Button>
              </Link>
              <Link href="/settings">
                <Button variant="ghost" size="sm" className="font-medium">
                  Settings
                </Button>
              </Link>
              <Link href="/profile">
                <Button variant="ghost" size="sm" className="font-medium">
                  Profile
                </Button>
              </Link>
              <span className="text-sm text-muted-foreground hidden sm:block">
                {user.email}
              </span>
              <SimpleThemeToggle />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => signOut()}
                className="text-muted-foreground hover:text-foreground"
              >
                Sign out
              </Button>
            </div>
          ) : (
            <>
              <SimpleThemeToggle />
              <Link href="/login">
                <Button size="sm" className="font-medium">
                  Sign in
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
