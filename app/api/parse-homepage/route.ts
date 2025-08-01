import { NextResponse } from 'next/server'
import { JSDOM } from 'jsdom'

interface ExtractedLink {
  url: string
  text: string
  category: 'likely-category' | 'likely-product' | 'other'
}

export async function POST(request: Request) {
  try {
    const { url } = await request.json()

    // Fetch raw HTML directly (we don't want truncated/cleaned content)
    const res = await fetch(url)
    if (!res.ok) {
      throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`)
    }

    const html = await res.text()
    const dom = new JSDOM(html, { url }) // base URL ensures absolute hrefs
    const document = dom.window.document

    // Collect anchor tags
    const anchors = Array.from(document.querySelectorAll('a')) as HTMLAnchorElement[]

    const links: ExtractedLink[] = []

    // Helper lists for categorisation
    const categoryKeywords = [
      'collection', 'category', 'shop', 'browse', 'products', 'catalog',
      'men', 'women', 'kids', 'baby', 'home', 'kitchen', 'bedroom',
      'clothing', 'shoes', 'accessories', 'electronics', 'books',
      'outdoor', 'sports', 'beauty', 'health', 'jewelry', 'watches',
      'bags', 'furniture', 'decor', 'garden', 'tools', 'automotive'
    ]

    const categoryUrlPatterns = [
      '/collections/', '/categories/', '/category/', '/shop/', '/browse/',
      '/men/', '/women/', '/kids/', '/baby/', '/home/', '/kitchen/',
      '/clothing/', '/shoes/', '/accessories/', '/electronics/', '/books/'
    ]

    const productUrlPatterns = [
      '/products/', '/product/', '/item/', '/items/', '/p/'
    ]

    anchors.slice(0, 500).forEach(anchor => {
      const href = anchor.href.trim()
      const text = anchor.textContent?.trim() || ''
      if (!href || !text) return
      if (!href.startsWith('http')) return // skip javascript: / mailto:

      let category: ExtractedLink['category'] = 'other'
      const lowerText = text.toLowerCase()
      const lowerHref = href.toLowerCase()

      if (categoryKeywords.some(k => lowerText.includes(k) || lowerHref.includes(k)) ||
          categoryUrlPatterns.some(p => lowerHref.includes(p))) {
        category = 'likely-category'
      } else if (productUrlPatterns.some(p => lowerHref.includes(p))) {
        category = 'likely-product'
      }

      links.push({ url: href, text, category })
    })

    // Sort links by category priority then alphabetically
    const categoryPriority: Record<ExtractedLink['category'], number> = {
      'likely-category': 0,
      'likely-product': 1,
      'other': 2
    }

    const sortedLinks = links.sort((a, b) => {
      const diff = categoryPriority[a.category] - categoryPriority[b.category]
      return diff !== 0 ? diff : a.text.localeCompare(b.text)
    })

    console.log(`Extracted ${sortedLinks.length} links from homepage`)

    return NextResponse.json({
      links: sortedLinks,
      stats: {
        total: sortedLinks.length,
        categories: sortedLinks.filter(l => l.category === 'likely-category').length,
        products: sortedLinks.filter(l => l.category === 'likely-product').length,
        other: sortedLinks.filter(l => l.category === 'other').length
      }
    })
  } catch (error) {
    console.error('Parse homepage error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to parse homepage' },
      { status: 500 }
    )
  }
}