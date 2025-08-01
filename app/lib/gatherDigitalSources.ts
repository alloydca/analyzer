export interface DigitalSource {
  type: 'website' | 'social' | 'reviews' | 'press' | 'about'
  source: string
  content: string
  url: string
}

export function extractBrandName(baseUrl: string): string {
  try {
    const domain = new URL(baseUrl).hostname.replace('www.', '')
    return domain.split('.')[0]
  } catch (error) {
    return baseUrl.split('/')[2]?.replace('www.', '').split('.')[0] || 'company'
  }
}

export function createDigitalSource(
  type: DigitalSource['type'], 
  source: string, 
  content: string, 
  url: string
): DigitalSource {
  return { type, source, content, url }
}