'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { useRouter } from 'next/navigation'
import { Navigation } from '@/components/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Copy, Check } from 'lucide-react'

// Recommended Linear webhook event selection. The backend broadcasts all of
// these; enabling a subset still works, you just get fewer live updates.
const RECOMMENDED_EVENTS = [
  { value: 'Issue', label: 'Issues', description: 'Status changes, priority, assignee, title updates' },
  { value: 'Comment', label: 'Comments', description: 'New / edited / removed comments' },
  { value: 'IssueLabel', label: 'Issue labels', description: 'Label added or removed on an issue' },
  { value: 'Reaction', label: 'Emoji reactions', description: 'Emoji reactions on issues and comments' },
  { value: 'ProjectUpdate', label: 'Project updates', description: 'Project status writeups' },
  { value: 'Project', label: 'Projects', description: 'Project name, state, or archive changes' },
  { value: 'ProjectLabel', label: 'Project labels', description: 'Project-scoped label changes (future-proof)' },
  { value: 'Attachment', label: 'Issue attachments', description: 'Attachments added or removed (future-proof)' },
]

type HealthState = 'unknown' | 'configured' | 'missing-secret' | 'error'

export default function WebhooksSettingsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [webhookUrl, setWebhookUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [health, setHealth] = useState<HealthState>('unknown')
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setWebhookUrl(`${window.location.origin}/api/linear/webhook`)
    }
  }, [])

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.push('/login')
    }
  }, [user, authLoading, router])

  const checkHealth = useCallback(async () => {
    setChecking(true)
    try {
      const res = await fetch('/api/linear/webhook')
      if (!res.ok) {
        setHealth('error')
        return
      }
      const data = await res.json() as { configured?: boolean }
      setHealth(data.configured ? 'configured' : 'missing-secret')
    } catch {
      setHealth('error')
    } finally {
      setChecking(false)
    }
  }, [])

  useEffect(() => {
    if (user) checkHealth()
  }, [user, checkHealth])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard unavailable - user can still select the text
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen">
        <Navigation />
        <div className="max-w-4xl mx-auto p-6 text-center py-12">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen">
      <Navigation />
      <div className="max-w-3xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Linear webhook</h1>
          <p className="text-muted-foreground">
            Connect Linear to push real-time updates to every public view. Without this, visitors need to refresh to see changes.
          </p>
        </div>

        {/* Status card */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    health === 'configured'
                      ? 'bg-green-500'
                      : health === 'unknown'
                        ? 'bg-muted-foreground'
                        : 'bg-orange-500'
                  }`}
                />
                <span className="text-sm text-foreground">
                  {health === 'configured' && 'Configured - endpoint reachable, signing secret set'}
                  {health === 'missing-secret' && 'Not configured - endpoint reachable but signing secret is missing'}
                  {health === 'error' && 'Unreachable - could not contact the webhook endpoint'}
                  {health === 'unknown' && 'Checking endpoint...'}
                </span>
              </div>
              <Button variant="outline" size="sm" onClick={checkHealth} disabled={checking}>
                {checking ? 'Checking...' : 'Re-check'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Step 1: URL */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Step 1: Copy the webhook URL</CardTitle>
            <CardDescription>
              You&apos;ll paste this into Linear&apos;s webhook form below.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input readOnly value={webhookUrl} className="font-mono text-sm" />
              <Button type="button" variant="outline" onClick={copy}>
                {copied ? <><Check className="h-4 w-4 mr-1" /> Copied</> : <><Copy className="h-4 w-4 mr-1" /> Copy</>}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Create webhook in Linear */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Step 2: Create the webhook in Linear</CardTitle>
            <CardDescription>
              Open <a className="text-primary hover:underline" href="https://linear.app/settings/api" target="_blank" rel="noopener noreferrer">Linear Settings → API → Webhooks</a> and click &quot;Create webhook&quot;.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Label</Label>
              <Input readOnly value="Real-time updates for public views" />
              <p className="text-xs text-muted-foreground">Free-form name, used only in Linear&apos;s admin UI.</p>
            </div>

            <div className="space-y-2">
              <Label>URL</Label>
              <Input readOnly value={webhookUrl} className="font-mono text-sm" />
            </div>

            <div className="space-y-2">
              <Label>Data change events</Label>
              <p className="text-xs text-muted-foreground">
                Tick the ones below. Everything else can stay off - the endpoint ignores event types it doesn&apos;t forward.
              </p>
              <ul className="space-y-1.5 text-sm mt-2">
                {RECOMMENDED_EVENTS.map((evt) => (
                  <li key={evt.value} className="flex items-start gap-2">
                    <span className="mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded border border-border bg-muted text-xs">✓</span>
                    <span>
                      <span className="font-medium">{evt.label}</span>
                      <span className="text-muted-foreground"> - {evt.description}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-2">
              <Label>Team</Label>
              <p className="text-xs text-muted-foreground">
                Select the team(s) whose issues appear in your public views. &quot;All teams&quot; is fine.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Signing secret</Label>
              <p className="text-xs text-muted-foreground">
                Linear generates this when you save the webhook. You&apos;ll paste it into your Cloudflare Worker secret in Step 3. Keep the Linear tab open.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Step 3: Store the secret */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Step 3: Install the signing secret</CardTitle>
            <CardDescription>
              The server rejects unsigned requests, so this step is required.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              From the Linear webhook you just created, copy the signing secret. Then on the deploy host run:
            </p>
            <pre className="bg-accent/40 border border-border rounded-md p-3 font-mono text-xs overflow-x-auto">
              {`npx wrangler secret put LINEAR_WEBHOOK_SECRET`}
            </pre>
            <p className="text-muted-foreground text-xs">
              Wrangler prompts for the value - paste the secret from Linear. Re-deploying isn&apos;t required; the next webhook POST will verify against the new secret.
            </p>
          </CardContent>
        </Card>

        {/* Step 4: Verify */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Step 4: Verify</CardTitle>
            <CardDescription>
              Trigger any change in Linear (add a label, move an issue). Connected public views should update within a second. If not, re-check the signing secret and event selection.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  )
}
