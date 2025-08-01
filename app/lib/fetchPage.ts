import { JSDOM } from 'jsdom'

export async function fetchPageContent(url: string): Promise<string> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.statusText}`)
    }

    const html = await response.text()
    const dom = new JSDOM(html)
    const document = dom.window.document

    // Remove scripts, styles, and other non-content elements
    const scripts = document.getElementsByTagName('script')
    const styles = document.getElementsByTagName('style')
    const links = document.getElementsByTagName('link')
    
    Array.from(scripts).forEach((script: Element) => script.remove())
    Array.from(styles).forEach((style: Element) => style.remove())
    Array.from(links).forEach((link: Element) => link.remove())

    // Get the main content
    const body = document.body
    const content = body.textContent || ''

    // Clean up the content
    return content
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 8000) // Limit content length to avoid token limits
  } catch (error) {
    console.error(`Error fetching ${url}:`, error)
    throw error
  }
} 