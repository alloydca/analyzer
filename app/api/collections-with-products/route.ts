import { NextResponse } from 'next/server'
import { JSDOM } from 'jsdom'

interface Link { url: string; text: string }
interface CollectionWithProducts {
  collection: Link
  products: Link[]
}

// Helper to fetch and parse links from a page
async function extractLinks(pageUrl: string): Promise<Link[]> {
  const res = await fetch(pageUrl)
  if (!res.ok) throw new Error(`Failed to fetch ${pageUrl}: ${res.status}`)
  const html = await res.text()
  const dom = new JSDOM(html, { url: pageUrl })
  const anchors = Array.from(dom.window.document.querySelectorAll('a')) as HTMLAnchorElement[]
  return anchors
    .map(a => ({ url: a.href.trim(), text: a.textContent?.trim() || '' }))
    .filter(l => l.url.startsWith('http') && l.text)
}

export async function POST(request: Request) {
  try {
    const { url } = await request.json()
    // 1. Extract all links from homepage
    const links = await extractLinks(url)

    // 2. Identify up to 3 collection links
    const categoryPatterns = ['/collections/', '/category/', '/categories/', '/shop/', '/browse/']
    const categoryKeywords = ['collection', 'category', 'shop', 'browse']

    const collections: Link[] = []
    for (const link of links) {
      const lower = link.url.toLowerCase()
      const lowerText = link.text.toLowerCase()
      if (
        categoryPatterns.some(p => lower.includes(p)) ||
        categoryKeywords.some(k => lowerText.includes(k))
      ) {
        collections.push(link)
      }
      if (collections.length >= 3) break
    }

    const results: CollectionWithProducts[] = []

    // 3. For each collection, fetch page and extract product links
    const productPatterns = ['/products/', '/product/', '/item/', '/p/']
    for (const collection of collections) {
      try {
        const productLinksRaw = await extractLinks(collection.url)
        const products = productLinksRaw.filter(l =>
          productPatterns.some(p => l.url.toLowerCase().includes(p))
        )
        // remove duplicates and keep top 20
        const uniqueProducts: Link[] = []
        const seen = new Set()
        for (const p of products) {
          if (seen.has(p.url)) continue
          seen.add(p.url)
          uniqueProducts.push(p)
          if (uniqueProducts.length >= 20) break
        }
        results.push({ collection, products: uniqueProducts })
      } catch (err) {
        console.error('Failed to fetch collection', collection.url, err)
      }
    }

    return NextResponse.json({ collections: results })
  } catch (error) {
    console.error('collections-with-products error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed' }, { status: 500 })
  }
}