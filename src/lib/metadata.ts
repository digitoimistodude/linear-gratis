import { Metadata } from 'next'

export interface SeoData {
  title: string
  description: string
  keywords?: string[]
  canonical?: string
  openGraph?: {
    title?: string
    description?: string
    type?: 'website' | 'article'
    images?: string[]
  }
  twitter?: {
    title?: string
    description?: string
  }
}

export function generateMetadata(seoData: SeoData): Metadata {
  const baseUrl = 'https://linear.dude.fi'

  return {
    title: seoData.title,
    description: seoData.description,
    keywords: seoData.keywords,
    alternates: seoData.canonical ? {
      canonical: `${baseUrl}${seoData.canonical}`
    } : undefined,
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    openGraph: {
      title: seoData.openGraph?.title || seoData.title,
      description: seoData.openGraph?.description || seoData.description,
      type: seoData.openGraph?.type || 'website',
      url: seoData.canonical ? `${baseUrl}${seoData.canonical}` : baseUrl,
      siteName: 'linear.dude.fi',
      images: seoData.openGraph?.images || [`${baseUrl}/og-image.png`],
    },
    twitter: {
      card: 'summary_large_image',
      title: seoData.twitter?.title || seoData.title,
      description: seoData.twitter?.description || seoData.description,
      images: seoData.openGraph?.images || [`${baseUrl}/og-image.png`],
      creator: '@curiousgeorgios',
    },
  }
}

// Template page metadata
export function generateTemplateMetadata(templateType: string): SeoData {
  const title = `${templateType} template for Linear: Free forms | linear.dude.fi`
  const description = `Free ${templateType} template for Linear. Pre-built forms and workflows. Get started instantly with linear.dude.fi.`
  const ogImageUrl = `/api/og?type=template&title=${encodeURIComponent(`${templateType} Template`)}&subtitle=${encodeURIComponent(`Ready-to-use Linear form template`)}&category=${encodeURIComponent('Form Template')}`

  return {
    title,
    description,
    keywords: [
      `${templateType} template`,
      `Linear ${templateType}`,
      'Linear templates',
      'Linear forms',
      'linear.dude.fi',
      'free Linear templates',
    ],
    canonical: `/templates/${templateType.toLowerCase().replace(/\s+/g, '-')}`,
    openGraph: {
      title,
      description,
      type: 'article',
      images: [ogImageUrl],
    },
  }
}