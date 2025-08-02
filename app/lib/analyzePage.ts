import { PageContent, PageAnalysis } from '../types/analysis'

export async function collectPageContent(url: string, content: string, pageType: 'product' | 'category'): Promise<PageContent> {
  return {
    url,
    pageType,
    content
  }
}

export async function analyzePage(url: string, content: string, pageType: 'product' | 'category'): Promise<PageAnalysis> {
  const generalQualityIssues: string[] = []
  const seoIssues: string[] = []
  const aiOptimizationIssues: string[] = []

  // Convert content to lowercase for case-insensitive checks
  const lowerContent = content.toLowerCase()

  // General Quality Analysis
  if (lowerContent.length < 1000) {
    generalQualityIssues.push('Page content is very short, may lack sufficient information')
  }
  
  if (!lowerContent.includes('<h1')) {
    generalQualityIssues.push('Missing H1 heading tag')
  }
  
  if (pageType === 'product') {
    if (!lowerContent.includes('price') && !lowerContent.includes('$')) {
      generalQualityIssues.push('Product page missing clear pricing information')
    }
    if (!lowerContent.includes('add to cart') && !lowerContent.includes('buy')) {
      generalQualityIssues.push('Product page missing clear purchase options')
    }
  }

  // SEO Analysis
  if (!lowerContent.includes('<title')) {
    seoIssues.push('Missing page title tag')
  }
  
  if (!lowerContent.includes('meta name="description"')) {
    seoIssues.push('Missing meta description')
  }
  
  if (!lowerContent.includes('<img') || !lowerContent.includes('alt=')) {
    seoIssues.push('Images missing alt text for accessibility and SEO')
  }

  // AI Optimization Analysis
  if (!lowerContent.includes('application/ld+json') && !lowerContent.includes('schema.org')) {
    aiOptimizationIssues.push('Missing structured data (JSON-LD or Schema.org) for AI discoverability')
  }
  
  if (pageType === 'product') {
    if (!lowerContent.includes('product') || !lowerContent.includes('description')) {
      aiOptimizationIssues.push('Product page lacks clear product description for AI understanding')
    }
    if (!lowerContent.includes('brand') && !lowerContent.includes('manufacturer')) {
      aiOptimizationIssues.push('Product page missing brand information for AI context')
    }
  }

  // Calculate severity scores (0-100, higher = more severe)
  const generalSeverity = Math.min(generalQualityIssues.length * 25, 100)
  const seoSeverity = Math.min(seoIssues.length * 20, 100)
  const aiSeverity = Math.min(aiOptimizationIssues.length * 30, 100)

  return {
    url,
    pageType,
    generalQuality: {
      issues: generalQualityIssues,
      severity: generalSeverity
    },
    seo: {
      issues: seoIssues,
      severity: seoSeverity
    },
    aiOptimization: {
      issues: aiOptimizationIssues,
      severity: aiSeverity
    }
  }
} 