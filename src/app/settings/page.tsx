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
  const [tokenConfigured, setTokenConfigured] = useState(false)
  const [tokenInput, setTokenInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const loadStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/workspace/linear-token')
      if (response.ok) {
        const data = await response.json() as { configured: boolean }
        setTokenConfigured(data.configured)
      }
    } catch (error) {
      console.error('Error loading workspace token status:', error)
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

  const saveToken = async () => {
    if (!tokenInput.trim()) {
      setMessage({ type: 'error', text: 'Linear API token is required' })
      return
    }

    setSaving(true)
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
      setSaving(false)
    }
  }

  const removeToken = async () => {
    setSaving(true)
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
            <CardTitle>Shared Linear API token</CardTitle>
            <CardDescription>
              Set a workspace-wide Linear API token so all team members can use linear.gratis without configuring their own personal token. When set, this token is used instead of per-user tokens for all Linear API calls (fetching issues, creating issues, syncing comments, etc).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {tokenConfigured ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-sm text-foreground">Configured - shared with all team members</span>
                </div>
                <Button variant="outline" size="sm" onClick={removeToken} disabled={saving}>
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
                    <li>Give it a name (e.g. &quot;linear.gratis shared&quot;)</li>
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

                <Button onClick={saveToken} disabled={saving || !tokenInput.trim()}>
                  {saving ? 'Saving...' : 'Save workspace token'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
