import { PageContent } from '../types/analysis'

export async function collectPageContent(url: string, content: string, pageType: 'product' | 'category'): Promise<PageContent> {
  return {
    url,
    pageType,
    content
  }
} 