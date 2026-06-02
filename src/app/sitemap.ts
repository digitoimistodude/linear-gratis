import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://linear.dude.fi'

  // Static pages
  const staticPages = [
    '',
    '/login',
    '/features',
    '/forms',
    '/profile',
    '/views',
  ]

  // Template pages
  const templates = [
    'bug-reports',
    'feature-requests',
    'customer-feedback',
    'support-tickets',
    'improvement-suggestions',
    'user-interviews'
  ]
  const templatePages = templates.map(template => `/templates/${template}`)

  // Workflow guide pages
  const workflows = [
    'customer-feedback-workflow',
    'bug-tracking-workflow',
    'feature-request-workflow',
    'support-ticket-workflow',
    'public-roadmap-workflow'
  ]
  const workflowPages = workflows.map(workflow => `/guides/${workflow}`)

  // Combine all pages
  const allPages = [
    ...staticPages,
    ...templatePages,
    ...workflowPages,
  ]

  return allPages.map(page => ({
    url: `${baseUrl}${page}`,
    lastModified: new Date(),
    changeFrequency: page === '' ? 'weekly' : 'monthly',
    priority: getPriority(page),
  }))
}

function getPriority(page: string): number {
  // Homepage
  if (page === '') return 1.0

  // Main features
  if (['/features', '/login'].includes(page)) return 0.9

  // Template pages
  if (page.startsWith('/templates/')) return 0.7

  // Workflow guides
  if (page.startsWith('/guides/')) return 0.6

  // Other pages
  return 0.5
}
