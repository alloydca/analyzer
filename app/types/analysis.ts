export interface InitialAnalysis {
  products: Array<{
    url: string
    title: string
    description: string
    confidence?: 'high' | 'medium' | 'low'
  }>
  categories: Array<{
    url: string
    title: string
    description: string
    confidence?: 'high' | 'medium' | 'low'
  }>
}

export interface PageAnalysis {
  url: string
  pageType: 'product' | 'category'
  generalQuality: {
    issues: string[]
    severity: number
  }
  seo: {
    issues: string[]
    severity: number
  }
  aiOptimization: {
    issues: string[]
    severity: number
  }
}

export interface AnalysisSummary {
  executiveSummary: string
  topIssues: {
    generalQuality: string[]
    seo: string[]
    aiOptimization: string[]
  }
  recommendations: string[]
}

export interface PageContent {
  url: string
  pageType: 'product' | 'category'
  content: string
}

export interface ConsolidatedAnalysis {
  executiveSummary: string
  inferredBrandPositioning: string
  brandAlignment: {
    score: number // 1-100
    summary: string // 1-3 sentences
  }
  conversionEffectiveness: {
    score: number // 1-100
    summary: string // 1-3 sentences
  }
  seoAiBestPractices: {
    score: number // 1-100
    summary: string // 1-3 sentences
  }
  problematicContent: Array<{
    content: string // The specific problematic content
    issue: string // Why it's problematic
    location: string // Where it was found (URL or section)
  }>
  _debugInfo?: {
    randomizedOrder: string[]
    processingSequence: string
    message: string
  }
} 