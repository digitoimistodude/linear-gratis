'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function ProfilePage() {
  const { user, signOut, loading: authLoading } = useAuth()
  const [linearToken, setLinearToken] = useState('')
  const [tokenConfigured, setTokenConfigured] = useState(false)
  const [hideOnboarding, setHideOnboarding] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const router = useRouter()

  const loadProfile = useCallback(async () => {
    if (!user) return

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('hide_onboarding')
        .eq('id', user.id)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error loading profile:', error)
      } else if (data) {
        setHideOnboarding(data.hide_onboarding ?? false)
      }

      // The token itself is write-only: the server reports only whether one
      // is configured, so no plaintext token is ever sent to the browser.
      const response = await fetch('/api/profile/linear-token')
      if (response.ok) {
        const status = await response.json() as { configured: boolean }
        setTokenConfigured(status.configured)
      }
    } catch (error) {
      console.error('Error loading profile:', error)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (authLoading) return // Wait for auth to finish loading

    if (!user) {
      router.push('/login')
      return
    }

    // Load existing token
    loadProfile()
  }, [user, authLoading, router, loadProfile])

  const saveProfile = async () => {
    if (!user) return

    setSaving(true)
    setMessage(null)

    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          email: user.email!,
          hide_onboarding: hideOnboarding,
          updated_at: new Date().toISOString()
        })

      if (error) {
        setMessage({ type: 'error', text: 'Failed to save profile. Please try again.' })
        console.error('Error saving profile:', error)
        return
      }

      if (linearToken.trim()) {
        const response = await fetch('/api/profile/linear-token', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: linearToken.trim() }),
        })

        if (!response.ok) {
          setMessage({ type: 'error', text: 'Failed to save token. Please try again.' })
          return
        }

        setTokenConfigured(true)
        setLinearToken('')
      }

      setMessage({ type: 'success', text: 'Profile saved successfully!' })
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save profile. Please try again.' })
      console.error('Error saving profile:', error)
    } finally {
      setSaving(false)
    }
  }

  const removeToken = async () => {
    setRemoving(true)
    setMessage(null)

    try {
      const response = await fetch('/api/profile/linear-token', { method: 'DELETE' })

      if (!response.ok) {
        setMessage({ type: 'error', text: 'Failed to remove token. Please try again.' })
        return
      }

      setTokenConfigured(false)
      setLinearToken('')
      setMessage({ type: 'success', text: 'Linear token removed.' })
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to remove token. Please try again.' })
      console.error('Error removing token:', error)
    } finally {
      setRemoving(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Loading...</h2>
        </div>
      </div>
    )
  }

  if (!user) {
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
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Profile settings</h1>
          <Button variant="outline" onClick={handleSignOut}>
            Sign out
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Account information</CardTitle>
            <CardDescription>
              Your account details and preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Email address</Label>
              <Input value={user.email || ''} disabled />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Display preferences</CardTitle>
            <CardDescription>
              Customize how the dashboard looks
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Hide onboarding section</Label>
                <p className="text-sm text-muted-foreground">
                  Hide the hero section and action cards on the dashboard
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={hideOnboarding}
                onClick={() => setHideOnboarding(!hideOnboarding)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  hideOnboarding ? 'bg-primary' : 'bg-muted'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    hideOnboarding ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Linear integration</CardTitle>
            <CardDescription>
              Connect your Linear workspace to start collecting customer feedback directly in your issues.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {loading && (
              <div className="text-center py-4">
                <p className="text-gray-600">Loading profile...</p>
              </div>
            )}

            {!loading && (
              <>
                {/* Instructions */}
                <div className="bg-muted/50 rounded-lg p-4 border border-border/50">
                  <h3 className="font-semibold mb-3">How to get your Linear API token:</h3>
                  <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                    <li>
                      <span className="font-medium">Open Linear</span> and go to{' '}
                      <span className="bg-muted px-2 py-1 rounded text-xs font-mono">Settings → API</span>
                    </li>
                    <li>
                      <span className="font-medium">Click &quot;Create personal API key&quot;</span>
                    </li>
                    <li>
                      <span className="font-medium">Give it a name</span> like &quot;Linear Integration&quot; or &quot;Customer Feedback&quot;
                    </li>
                    <li>
                      <span className="font-medium">Copy the generated token</span> and paste it below
                    </li>
                  </ol>
                  <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800/30 rounded text-xs text-yellow-800 dark:text-yellow-400">
                    <strong>Important:</strong> Keep this token secure. It provides access to your Linear workspace.
                  </div>
                </div>

                <form onSubmit={(e) => { e.preventDefault(); saveProfile(); }} className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="linear-token">Linear API token</Label>
                      <span className={`text-xs font-medium ${tokenConfigured ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                        {tokenConfigured ? 'Configured' : 'Not configured'}
                      </span>
                    </div>
                    <Input
                      id="linear-token"
                      type="password"
                      placeholder={tokenConfigured ? 'Enter a new token to replace the current one' : 'Paste your Linear API token here'}
                      value={linearToken}
                      onChange={(e) => setLinearToken(e.target.value)}
                      autoComplete="new-password"
                    />
                    <p className="text-sm text-muted-foreground">
                      This token is encrypted and stored securely. It&apos;s used to create customer requests in your Linear workspace. Once saved it is never shown again, so replace it by entering a new one.
                    </p>
                    {tokenConfigured && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={removeToken}
                        disabled={removing}
                      >
                        {removing ? 'Removing token...' : 'Remove token'}
                      </Button>
                    )}
                  </div>

                  {message && (
                    <div className={`p-3 rounded-lg text-sm ${
                      message.type === 'success'
                        ? 'bg-green-50 border border-green-200 text-green-800 dark:bg-green-950/20 dark:border-green-800/30 dark:text-green-400'
                        : 'bg-red-50 border border-red-200 text-red-800 dark:bg-red-950/20 dark:border-red-800/30 dark:text-red-400'
                    }`}>
                      {message.text}
                      {message.type === 'success' && (
                        <div className="mt-2">
                          <Button variant="link" className="h-auto p-0 text-sm" onClick={() => router.push('/')}>
                            → Go to Linear integration
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={saving || (!linearToken.trim() && !tokenConfigured)}
                    className="w-full"
                  >
                    {saving
                      ? 'Saving...'
                      : linearToken.trim()
                        ? 'Save Linear token'
                        : tokenConfigured
                          ? 'Save settings'
                          : 'Enter token to continue'}
                  </Button>
                </form>
              </>
            )}
          </CardContent>
        </Card>

        <div className="text-center">
          <Button variant="link" onClick={() => router.push('/')}>
            ← Back to Linear integration
          </Button>
        </div>
      </div>
    </div>
  )
}