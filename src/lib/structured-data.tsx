import { ReactElement } from 'react'

export interface StructuredData {
  '@context': string
  '@type': string
  [key: string]: unknown
}

// Website/Organization schema
export function generateOrganizationSchema(): StructuredData {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'linear.dude.fi',
    alternateName: 'Linear Gratis',
    url: 'https://linear.dude.fi',
    logo: 'https://linear.dude.fi/logo.png',
    description: 'Free Linear customer feedback forms and public views. Open source alternative to SteelSync and Lindie.',
    foundingDate: '2024',
    sameAs: [
      'https://github.com/curiousgeorgios/linear-gratis'
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'Customer Service',
      url: 'https://linear.dude.fi/contact'
    }
  }
}

// WebSite schema for homepage
export function generateWebsiteSchema(): StructuredData {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'linear.dude.fi',
    url: 'https://linear.dude.fi',
    description: 'Free Linear customer feedback forms. Open source alternative to paid Linear integrations.',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: 'https://linear.dude.fi/search?q={search_term_string}'
      },
      'query-input': 'required name=search_term_string'
    }
  }
}

// SoftwareApplication schema for the tool
export function generateSoftwareApplicationSchema(): StructuredData {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'linear.dude.fi',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web Browser',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      description: 'Free forever'
    },
    description: 'Free Linear customer feedback forms and public Linear views. Create shareable forms that automatically turn feedback into trackable Linear issues.',
    featureList: [
      'Linear integration',
      'Customer feedback forms',
      'Public Linear views',
      'Unlimited forms',
      'No user limits',
      'Open source'
    ],
    screenshot: 'https://linear.dude.fi/screenshot.png',
    softwareVersion: '1.0',
    datePublished: '2024-01-01',
    author: {
      '@type': 'Person',
      name: 'Curious George',
      url: 'https://curiousgeorge.dev'
    }
  }
}

// BreadcrumbList schema
export function generateBreadcrumbSchema(path: string): StructuredData {
  const pathSegments = path.split('/').filter(Boolean)
  const breadcrumbs = [
    { name: 'Home', url: 'https://linear.dude.fi' }
  ]

  let currentPath = ''
  pathSegments.forEach((segment) => {
    currentPath += `/${segment}`

    let name = segment.charAt(0).toUpperCase() + segment.slice(1)
    if (segment === 'comparison') name = 'Comparisons'
    if (segment === 'use-cases') name = 'Use Cases'
    if (segment === 'templates') name = 'Templates'
    if (segment === 'integrations') name = 'Integrations'
    if (segment === 'guides') name = 'Guides'

    breadcrumbs.push({
      name,
      url: `https://linear.dude.fi${currentPath}`
    })
  })

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: crumb.url
    }))
  }
}

// Structured data component props
interface StructuredDataScriptProps {
  data: StructuredData | StructuredData[]
}

// Structured data component
export function StructuredDataScript({ data }: StructuredDataScriptProps): ReactElement {
  const jsonLd = Array.isArray(data) ? data : [data]

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(jsonLd, null, 2)
      }}
    />
  )
}