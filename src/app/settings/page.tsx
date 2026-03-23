'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useRouter, useSearchParams } from 'next/navigation'

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Loading...</h2>
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

  const [oauthStatus, setOauthStatus] = useState<{
    connected: boolean
    oauthConfigured: boolean
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [showSetup, setShowSetup] = useState(false)
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/linear/status')
      if (res.ok) {
        const data = await res.json() as { connected: boolean; oauthConfigured: boolean }
        setOauthStatus(data)
      }
    } catch (err) {
      console.error('Failed to load OAuth status:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      router.push('/login')
      return
    }

    loadStatus()
  }, [user, authLoading, router, loadStatus])

  // Handle OAuth callback result from URL params
  useEffect(() => {
    const oauthResult = searchParams.get('linear_oauth')
    if (oauthResult === 'success') {
      setMessage({ type: 'success', text: 'Linear app connected successfully!' })
      loadStatus()
      // Clean the URL
      router.replace('/settings')
    } else if (oauthResult === 'error') {
      setMessage({ type: 'error', text: 'Failed to connect Linear app. Please try again.' })
      router.replace('/settings')
    }
  }, [searchParams, loadStatus, router])

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
        await loadStatus()
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
        await loadStatus()
      } else {
        setMessage({ type: 'error', text: 'Failed to disconnect.' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to disconnect.' })
    } finally {
      setDisconnecting(false)
    }
  }

  const callbackUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/auth/linear/callback`
    : ''

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Loading...</h2>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold">Settings</h1>

        <Card>
          <CardHeader>
            <CardTitle>Linear app connection</CardTitle>
            <CardDescription>
              Connect a Linear OAuth app so customer comments appear as the app identity instead of your personal account.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
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

            {message && (
              <div className={`p-3 rounded-lg text-sm ${
                message.type === 'success'
                  ? 'bg-green-50 border border-green-200 text-green-800 dark:bg-green-950/20 dark:border-green-800/30 dark:text-green-400'
                  : 'bg-red-50 border border-red-200 text-red-800 dark:bg-red-950/20 dark:border-red-800/30 dark:text-red-400'
              }`}>
                {message.text}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="text-center">
          <Button variant="link" onClick={() => router.push('/')}>
            &larr; Back to dashboard
          </Button>
        </div>
      </div>
    </div>
  )
}
