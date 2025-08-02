import { NextResponse } from 'next/server'
import { JSDOM } from 'jsdom'
import { PageContent, ConsolidatedAnalysis } from '../../types/analysis'
import { inferBrandPositioning } from '../../lib/inferBrandPositioning'
import { analyzeConsolidated } from '../../lib/analyzeConsolidated'
import { createDigitalSource, DigitalSource } from '../../lib/gatherDigitalSources'

interface Link { url: string; text: string }
interface CollectionGroup { collection: Link; products: Link[] }

const COLLECTION_PATTERNS = ['/collections/', '/category/', '/categories/', '/shop/', '/browse/']
const PRODUCT_PATTERNS = ['/products/', '/product/', '/item/', '/items/', '/p/']

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Fetch failed ${url}: ${res.status}`)
  return res.text()
}

function parseLinks(html: string, base: string): Link[] {
  // Preprocess HTML to remove style elements that cause CSS parsing issues
  // This prevents JSDOM from trying to parse potentially malformed CSS
  let cleanHtml = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // Remove all <style> blocks
    .replace(/<link[^>]*rel=["\']stylesheet["\'][^>]*>/gi, '') // Remove stylesheet links
  
  try {
    const dom = new JSDOM(cleanHtml, { 
      url: base,
      resources: "usable",
      runScripts: "outside-only"
    })
    
    const anchors = Array.from(dom.window.document.querySelectorAll('a')) as HTMLAnchorElement[]
    return anchors
      .map(a => ({ url: a.href.trim(), text: (a.textContent || '').trim() }))
      .filter(l => l.url.startsWith('http') && l.text)
  } catch (error) {
    console.error('JSDOM parsing error:', error)
    // Fallback: try to extract links using regex if JSDOM fails
    return extractLinksWithRegex(html, base)
  }
}

function extractLinksWithRegex(html: string, base: string): Link[] {
  const linkRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi
  const links: Link[] = []
  let match
  
  while ((match = linkRegex.exec(html)) !== null) {
    try {
      const url = new URL(match[1], base).href
      const text = match[2].replace(/<[^>]*>/g, '').trim() // Strip HTML tags from text
      if (url.startsWith('http') && text) {
        links.push({ url, text })
      }
    } catch (e) {
      // Skip invalid URLs
    }
  }
  
  return links
}

export async function POST(req: Request) {
  try {
    const { url } = await req.json()

    // 1) Homepage → links
    const homeHtml = await fetchHtml(url)
    const allLinks = parseLinks(homeHtml, url)

    // Pick first 3 collection links
    const collections: Link[] = []
    const seen = new Set<string>()
    for (const l of allLinks) {
      if (collections.length >= 3) break
      const lower = l.url.toLowerCase()
      if (COLLECTION_PATTERNS.some(p => lower.includes(p)) && !seen.has(l.url)) {
        collections.push(l)
        seen.add(l.url)
      }
    }

    // 2) Fetch each collection page → gather product links
    const collectionGroups: CollectionGroup[] = []
    for (const col of collections) {
      try {
        const colHtml = await fetchHtml(col.url)
        const colLinks = parseLinks(colHtml, col.url)
        const products: Link[] = []
        const seenProd = new Set<string>()
        for (const l of colLinks) {
          if (PRODUCT_PATTERNS.some(p => l.url.toLowerCase().includes(p)) && !seenProd.has(l.url)) {
            products.push(l)
            seenProd.add(l.url)
          }
        }
        collectionGroups.push({ collection: col, products })
      } catch (e) {
        console.error('Collection fetch failed', e)
      }
    }

    // Flatten product URLs
    const productLinks: Link[] = collectionGroups.flatMap(g => g.products)
    
    console.log(`Found ${collections.length} collections:`, collections.map(c => c.url))
    console.log(`Found ${productLinks.length} total product URLs:`)
    productLinks.slice(0, 10).forEach((p, i) => console.log(`  ${i+1}. ${p.url}`))

    // 3) Ask OpenAI for top 10 popular products (only if we have URLs to work with)
    if (productLinks.length === 0) {
      console.log('No product URLs found - collections may be empty or not contain product links')
      return NextResponse.json({
        collections: collectionGroups,
        topProducts: [],
        analysis: null,
        stats: {
          collections: collectionGroups.length,
          productsFetched: 0,
        },
        error: 'No product URLs found on this website'
      })
    }

    // Build prompt string with URLs
    const urlList = productLinks.map(p => p.url).slice(0, 100).join('\n')
    console.log(`Sending ${Math.min(productLinks.length, 100)} URLs to OpenAI for selection`)
    const prompt = `CRITICAL: You must ONLY select URLs from the exact list provided below. Do NOT generate, create, or invent any URLs. If the provided list is empty or contains no valid product URLs, return an empty array.

You are given a list of product page URLs from an e-commerce website. Pick UP TO 10 products that seem most popular/important based on the URL structure and patterns. 

REQUIREMENTS:
- ONLY use URLs from the provided list
- Do NOT create example.com or any fictional URLs
- If no suitable URLs exist in the list, return empty array
- Output JSON with key "topProducts" containing array of objects with url, title, reason

PROVIDED URLs:`;

    const { default: OpenAI } = await import('openai')
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const resp = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: 'You are an expert e-commerce analyst. You must NEVER generate fictional URLs. Only use URLs provided in the prompt.' },
        { role: 'user', content: `${prompt}\n\n${urlList}` }
      ],
      response_format: { type: 'json_object' }
    })

    const parsed = JSON.parse(resp.choices[0].message.content || '{}') as { topProducts: Array<{url: string, title: string, reason?: string}> }
    const rawTopProducts = (parsed.topProducts || []).slice(0, 10)
    
    console.log(`OpenAI returned ${rawTopProducts.length} products:`)
    rawTopProducts.forEach((p, i) => console.log(`  ${i+1}. ${p.url}`))
    
    // CRITICAL: Validate that all returned URLs were actually in our original list
    const originalUrls = new Set(productLinks.map(p => p.url))
    const validatedTopProducts = rawTopProducts.filter(product => {
      if (!originalUrls.has(product.url)) {
        console.warn(`❌ OpenAI returned URL not in original list: ${product.url} - FILTERING OUT`)
        return false
      }
      console.log(`✅ Valid URL: ${product.url}`)
      return true
    })
    
    console.log(`After validation: ${validatedTopProducts.length} valid products`)
    
    // Ensure topProducts have the correct structure for the component
    const formattedTopProducts = validatedTopProducts.map(product => ({
      url: product.url,
      title: product.title,
      reason: product.reason
    }))


    // 4) Fetch HTML for each top product (rate-limit 1/sec)
    const pageContents: PageContent[] = []
    for (const product of validatedTopProducts) {
      try {
        const html = await fetchHtml(product.url)
        pageContents.push({ url: product.url, pageType: 'product', content: html })
        await new Promise(r => setTimeout(r, 1000))
      } catch (e) {
        console.error('Product fetch failed', product.url, e)
      }
    }

    // 5) Only run analysis if we actually have product content
    if (pageContents.length === 0) {
      return NextResponse.json({
        collections: collectionGroups,
        topProducts: formattedTopProducts,
        analysis: null,
        stats: {
          collections: collectionGroups.length,
          productsFetched: 0,
        },
        error: 'No product pages could be analyzed successfully'
      })
    }

    // Consolidated analysis
    const digitalSources: DigitalSource[] = [createDigitalSource('website', url, homeHtml, url)]
    const brandPos = await inferBrandPositioning(pageContents, digitalSources)
    const analysisCore = await analyzeConsolidated(pageContents, digitalSources, brandPos)
    const analysis: ConsolidatedAnalysis = { ...analysisCore, inferredBrandPositioning: brandPos }

    return NextResponse.json({
      collections: collectionGroups,
      topProducts: formattedTopProducts,
      analysis,
      stats: {
        collections: collectionGroups.length,
        productsFetched: pageContents.length,
      }
    })

  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}