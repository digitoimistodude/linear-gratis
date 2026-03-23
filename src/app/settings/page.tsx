'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Navigation } from '@/components/navigation'
import { useRouter } from 'next/navigation'

export default function WorkspaceSettingsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [oauthConnected, setOauthConnected] = useState(false)
  const [oauthConfigured, setOauthConfigured] = useState(false)
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const checkOAuthStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/linear/status')
      if (response.ok) {
        const data = await response.json() as { connected: boolean; oauthConfigured: boolean }
        setOauthConnected(data.connected)
        setOauthConfigured(data.oauthConfigured)
      }
    } catch (error) {
      console.error('Error checking OAuth status:', error)
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

    checkOAuthStatus()

    const params = new URLSearchParams(window.location.search)
    const oauthResult = params.get('linear_oauth')
    if (oauthResult === 'success') {
      setMessage({ type: 'success', text: 'Linear app connected! Customer comments will now appear as a bot in Linear.' })
      setOauthConnected(true)
      window.history.replaceState({}, '', '/settings')
    } else if (oauthResult === 'error') {
      const errorMsg = params.get('message') || 'Failed to connect'
      setMessage({ type: 'error', text: `Linear app connection failed: ${errorMsg}` })
      window.history.replaceState({}, '', '/settings')
    }
  }, [user, authLoading, router, checkOAuthStatus])

  const saveCredentials = async () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      setMessage({ type: 'error', text: 'Both Client ID and Client Secret are required' })
      return
    }

    setSaving(true)
    setMessage(null)

    try {
      const response = await fetch('/api/auth/linear/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: clientId.trim(), clientSecret: clientSecret.trim() }),
      })

      if (response.ok) {
        setOauthConfigured(true)
        setClientId('')
        setClientSecret('')
        setMessage({ type: 'success', text: 'Credentials saved. Click "Connect Linear app" to authorize.' })
      } else {
        const data = await response.json() as { error?: string }
        setMessage({ type: 'error', text: data.error || 'Failed to save credentials' })
      }
    } catch (error) {
      console.error('Error saving credentials:', error)
      setMessage({ type: 'error', text: 'Failed to save credentials' })
    } finally {
      setSaving(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen">
        <Navigation />
        <div className="max-w-2xl mx-auto p-6">
          <div className="text-center py-12">Loading...</div>
        </div>
      </div>
    )
  }

  if (!user) return null

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
              Connect a Linear OAuth app so customer comments on public views appear as a bot in Linear instead of as the view owner.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {oauthConnected ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-sm text-foreground">Connected - customer comments appear as the app in Linear</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    const response = await fetch('/api/auth/linear/status', { method: 'DELETE' })
                    if (response.ok) {
                      setOauthConnected(false)
                      setMessage({ type: 'success', text: 'Linear app disconnected' })
                    }
                  }}
                >
                  Disconnect
                </Button>
              </div>
            ) : oauthConfigured ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Credentials saved. Connect the app to authorize it with your Linear workspace.
                </p>
                <Button
                  onClick={() => {
                    window.location.href = '/api/auth/linear/connect'
                  }}
                >
                  Connect Linear app
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-muted/50 rounded-lg p-4 border border-border/50">
                  <h3 className="font-semibold mb-3">Step 1: Create a Linear OAuth app</h3>
                  <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                    <li>
                      Open{' '}
                      <a
                        href="https://linear.app/settings/api/applications/new"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        Linear - New OAuth application
                      </a>
                    </li>
                    <li>
                      Set the <strong>application name</strong> - this is what appears as the commenter in Linear
                    </li>
                    <li>
                      Set the <strong>callback URL</strong> to:{' '}
                      <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">
                        {typeof window !== 'undefined' ? `${window.location.origin}/api/auth/linear/callback` : '/api/auth/linear/callback'}
                      </code>
                    </li>
                  </ol>
                </div>

                <div className="space-y-3">
                  <h3 className="font-semibold">Step 2: Paste credentials</h3>
                  <div className="space-y-2">
                    <Label htmlFor="client-id">Client ID</Label>
                    <Input
                      id="client-id"
                      placeholder="Paste your Linear OAuth Client ID"
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="client-secret">Client Secret</Label>
                    <Input
                      id="client-secret"
                      type="password"
                      placeholder="Paste your Linear OAuth Client Secret"
                      value={clientSecret}
                      onChange={(e) => setClientSecret(e.target.value)}
                    />
                  </div>
                  <Button
                    onClick={saveCredentials}
                    disabled={saving || !clientId.trim() || !clientSecret.trim()}
                    className="w-full"
                  >
                    {saving ? 'Saving...' : 'Save and continue'}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
