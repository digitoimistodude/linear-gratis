'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Navigation } from '@/components/navigation'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Webhook, ChevronRight } from 'lucide-react'

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen">
        <Navigation />
        <div className="max-w-2xl mx-auto p-6">
          <div className="text-center py-12">Loading...</div>
        </div>
      </div>
    }>
      <SettingsContent />
    </Suspense>
  )
}

function SettingsContent() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  // OAuth connection state
  const [oauthStatus, setOauthStatus] = useState<{
    connected: boolean
    oauthConfigured: boolean
  } | null>(null)
  const [loadingOauth, setLoadingOauth] = useState(true)
  const [saving, setSaving] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [showSetup, setShowSetup] = useState(false)
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Workspace shared Linear API token state
  const [tokenConfigured, setTokenConfigured] = useState(false)
  const [tokenInput, setTokenInput] = useState('')
  const [tokenSaving, setTokenSaving] = useState(false)
  const [loadingToken, setLoadingToken] = useState(true)

  const loadOauthStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/linear/status')
      if (res.ok) {
        const data = await res.json() as { connected: boolean; oauthConfigured: boolean }
        setOauthStatus(data)
      }
    } catch (err) {
      console.error('Failed to load OAuth status:', err)
    } finally {
      setLoadingOauth(false)
    }
  }, [])

  const loadTokenStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/workspace/linear-token')
      if (response.ok) {
        const data = await response.json() as { configured: boolean }
        setTokenConfigured(data.configured)
      }
    } catch (error) {
      console.error('Error loading workspace token status:', error)
    } finally {
      setLoadingToken(false)
    }
  }, [])

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      router.push('/login')
      return
    }

    loadOauthStatus()
    loadTokenStatus()
  }, [user, authLoading, router, loadOauthStatus, loadTokenStatus])

  // Handle OAuth callback result from URL params
  useEffect(() => {
    const oauthResult = searchParams.get('linear_oauth')
    if (oauthResult === 'success') {
      setMessage({ type: 'success', text: 'Linear app connected successfully!' })
      loadOauthStatus()
      // Clean the URL
      router.replace('/settings')
    } else if (oauthResult === 'error') {
      setMessage({ type: 'error', text: 'Failed to connect Linear app. Please try again.' })
      router.replace('/settings')
    }
  }, [searchParams, loadOauthStatus, router])

  const saveCredentials = async () => {
    if (!clientId.trim() || !clientSecret.trim()) return

    setSaving(true)
    setMessage(null)

    try {
      const res = await fetch('/api/auth/linear/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: clientId.trim(), clientSecret: clientSecret.trim() }),
      })

      if (res.ok) {
        setMessage({ type: 'success', text: 'Credentials saved. You can now connect your Linear app.' })
        setShowSetup(false)
        setClientId('')
        setClientSecret('')
        await loadOauthStatus()
      } else {
        const data = await res.json() as { error?: string }
        setMessage({ type: 'error', text: data.error || 'Failed to save credentials.' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to save credentials.' })
    } finally {
      setSaving(false)
    }
  }

  const disconnectOAuth = async () => {
    setDisconnecting(true)
    setMessage(null)

    try {
      const res = await fetch('/api/auth/linear/status', { method: 'DELETE' })

      if (res.ok) {
        setMessage({ type: 'success', text: 'Linear app disconnected.' })
        await loadOauthStatus()
      } else {
        setMessage({ type: 'error', text: 'Failed to disconnect.' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to disconnect.' })
    } finally {
      setDisconnecting(false)
    }
  }

  const saveToken = async () => {
    if (!tokenInput.trim()) {
      setMessage({ type: 'error', text: 'Linear API token is required' })
      return
    }

    setTokenSaving(true)
    setMessage(null)

    try {
      const response = await fetch('/api/workspace/linear-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenInput.trim() }),
      })

      if (response.ok) {
        setTokenConfigured(true)
        setTokenInput('')
        setMessage({ type: 'success', text: 'Workspace Linear API token saved. All team members will use it automatically.' })
      } else {
        const data = await response.json() as { error?: string }
        setMessage({ type: 'error', text: data.error || 'Failed to save token' })
      }
    } catch (error) {
      console.error('Error saving token:', error)
      setMessage({ type: 'error', text: 'Failed to save token' })
    } finally {
      setTokenSaving(false)
    }
  }

  const removeToken = async () => {
    setTokenSaving(true)
    setMessage(null)

    try {
      const response = await fetch('/api/workspace/linear-token', { method: 'DELETE' })
      if (response.ok) {
        setTokenConfigured(false)
        setMessage({ type: 'success', text: 'Workspace Linear API token removed. Team members will now use their personal tokens.' })
      } else {
        setMessage({ type: 'error', text: 'Failed to remove token' })
      }
    } catch (error) {
      console.error('Error removing token:', error)
      setMessage({ type: 'error', text: 'Failed to remove token' })
    } finally {
      setTokenSaving(false)
    }
  }

  const callbackUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/auth/linear/callback`
    : ''

  if (authLoading || !user) {
    return (
      <div className="min-h-screen">
        <Navigation />
        <div className="max-w-2xl mx-auto p-6">
          <div className="text-center py-12">Loading...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <Navigation />
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <h1 className="text-2xl font-bold">Workspace settings</h1>

        {message && (
          <div className={`p-3 rounded-lg text-sm ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800 dark:bg-green-950/20 dark:border-green-800/30 dark:text-green-400'
              : 'bg-red-50 border border-red-200 text-red-800 dark:bg-red-950/20 dark:border-red-800/30 dark:text-red-400'
          }`}>
            {message.text}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Linear app connection</CardTitle>
            <CardDescription>
              Connect a Linear OAuth app so customer comments appear as the app identity instead of your personal account.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingOauth ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : oauthStatus?.connected ? (
              /* Connected state */
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-sm font-medium text-green-700 dark:text-green-400">Connected</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Your Linear app is connected. Customer comments will be posted using the app identity.
                </p>
                <Button
                  variant="outline"
                  onClick={disconnectOAuth}
                  disabled={disconnecting}
                >
                  {disconnecting ? 'Disconnecting...' : 'Disconnect'}
                </Button>
              </div>
            ) : oauthStatus?.oauthConfigured && !showSetup ? (
              /* Configured but not connected */
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  OAuth credentials are configured but the app is not yet connected.
                </p>
                <div className="flex items-center gap-2">
                  <a href="/api/auth/linear/connect">
                    <Button>Connect Linear app</Button>
                  </a>
                  <Button variant="outline" onClick={() => setShowSetup(true)}>
                    Edit credentials
                  </Button>
                </div>
              </div>
            ) : (
              /* Not configured / Setup mode */
              <div className="space-y-6">
                <div className="bg-muted/50 rounded-lg p-4 border border-border/50">
                  <h3 className="font-semibold mb-3">Setup instructions</h3>
                  <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                    <li>
                      Go to{' '}
                      <a
                        href="https://linear.app/settings/api/applications/new"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline"
                      >
                        Linear &rarr; Settings &rarr; API &rarr; Create OAuth application
                      </a>
                    </li>
                    <li>
                      Set the <strong>application name</strong> to whatever you want customers to see as the commenter (e.g. &quot;Customer Feedback Bot&quot;)
                    </li>
                    <li>
                      Set the <strong>callback URL</strong> to:
                      {callbackUrl && (
                        <code className="block mt-1 px-2 py-1 bg-muted rounded text-xs font-mono break-all">
                          {callbackUrl}
                        </code>
                      )}
                    </li>
                    <li>Copy the <strong>Client ID</strong> and <strong>Client Secret</strong> and paste them below</li>
                  </ol>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="client-id">Client ID</Label>
                    <Input
                      id="client-id"
                      type="text"
                      placeholder="Your Linear OAuth Client ID"
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="client-secret">Client Secret</Label>
                    <Input
                      id="client-secret"
                      type="password"
                      placeholder="Your Linear OAuth Client Secret"
                      value={clientSecret}
                      onChange={(e) => setClientSecret(e.target.value)}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      onClick={saveCredentials}
                      disabled={saving || !clientId.trim() || !clientSecret.trim()}
                    >
                      {saving ? 'Saving...' : 'Save and continue'}
                    </Button>
                    {oauthStatus?.oauthConfigured && (
                      <Button variant="ghost" onClick={() => setShowSetup(false)}>
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Shared Linear API token</CardTitle>
            <CardDescription>
              Set a workspace-wide Linear API token so all team members can use linear.dude.fi without configuring their own personal token. When set, this token is used instead of per-user tokens for all Linear API calls (fetching issues, creating issues, syncing comments, etc).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingToken ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : tokenConfigured ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-sm text-foreground">Configured - shared with all team members</span>
                </div>
                <Button variant="outline" size="sm" onClick={removeToken} disabled={tokenSaving}>
                  Remove
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-muted/50 rounded-lg p-4 border border-border/50">
                  <h3 className="font-semibold mb-3">How to get your Linear API token</h3>
                  <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                    <li>
                      Open{' '}
                      <a
                        href="https://linear.app/settings/api"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        Linear - API settings
                      </a>
                    </li>
                    <li>Click &quot;Create personal API key&quot;</li>
                    <li>Give it a name (e.g. &quot;linear.dude.fi shared&quot;)</li>
                    <li>Copy the token and paste it below</li>
                  </ol>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="workspace-token">Linear API token</Label>
                  <Input
                    id="workspace-token"
                    type="password"
                    placeholder="lin_api_..."
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    autoComplete="off"
                  />
                </div>

                <Button onClick={saveToken} disabled={tokenSaving || !tokenInput.trim()}>
                  {tokenSaving ? 'Saving...' : 'Save workspace token'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Real-time updates - links into the webhook setup wizard. */}
        <Link href="/settings/webhooks" className="block group">
          <Card className="transition-colors hover:bg-accent/40 cursor-pointer">
            <CardContent>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-md bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                    <Webhook className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="text-base font-semibold">
                      Real-time updates
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Configure the Linear webhook so public views update instantly when issues change. Step-by-step wizard inside.
                    </CardDescription>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0 transition-transform group-hover:translate-x-0.5" />
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}
