import { ComparisonTool } from '@/data/comparisons'
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

// Article schema for comparison pages
export function generateComparisonArticleSchema(tool: ComparisonTool): StructuredData {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: `${tool.name} vs linear.dude.fi: Complete comparison 2025`,
    description: `Compare ${tool.name} and linear.dude.fi for Linear customer feedback collection. Features, pricing, pros & cons analysis.`,
    author: {
      '@type': 'Organization',
      name: 'linear.dude.fi'
    },
    publisher: {
      '@type': 'Organization',
      name: 'linear.dude.fi',
      logo: {
        '@type': 'ImageObject',
        url: 'https://linear.dude.fi/logo.png'
      }
    },
    datePublished: '2024-01-01',
    dateModified: new Date().toISOString(),
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `https://linear.dude.fi/comparison/${tool.slug}`
    },
    image: `https://linear.dude.fi/og-comparison-${tool.slug}.png`,
    articleSection: 'Tool Comparison',
    keywords: [
      `${tool.name} vs Linear`,
      `${tool.name} alternative`,
      'Linear feedback tools',
      'customer feedback comparison',
      'linear.dude.fi'
    ]
  }
}

// Product comparison schema
export function generateProductComparisonSchema(tool: ComparisonTool): StructuredData {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: tool.name,
    description: tool.description,
    brand: {
      '@type': 'Brand',
      name: tool.name
    },
    offers: {
      '@type': 'Offer',
      price: tool.pricing.free ? '0' : tool.pricing.startingPrice.replace(/[^0-9]/g, ''),
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock'
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.0',
      reviewCount: '50'
    },
    review: [
      {
        '@type': 'Review',
        author: {
          '@type': 'Organization',
          name: 'linear.dude.fi'
        },
        reviewRating: {
          '@type': 'Rating',
          ratingValue: '4',
          bestRating: '5'
        },
        reviewBody: `${tool.name} is ${tool.bestFor[0]?.toLowerCase() || 'a good choice for teams'} but consider linear.dude.fi for a free alternative.`
      }
    ]
  }
}

// FAQ schema for comparison pages
export function generateFAQSchema(tool: ComparisonTool): StructuredData {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: `Is ${tool.name} better than linear.dude.fi?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `${tool.name} ${tool.pros[0]?.toLowerCase() || 'has its strengths'}, but linear.dude.fi is completely free and open source, making it ideal for budget-conscious teams.`
        }
      },
      {
        '@type': 'Question',
        name: `How much does ${tool.name} cost compared to linear.dude.fi?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `${tool.name} costs ${tool.pricing.startingPrice} while linear.dude.fi is completely free forever with no hidden costs or limits.`
        }
      },
      {
        '@type': 'Question',
        name: 'What are the main differences?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: `The main differences are pricing (${tool.name}: ${tool.pricing.startingPrice}, linear.dude.fi: free), features, and target audience. linear.dude.fi focuses on Linear integration specifically.`
        }
      }
    ]
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