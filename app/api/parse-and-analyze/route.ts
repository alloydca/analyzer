import { NextResponse } from 'next/server'
import { JSDOM } from 'jsdom'
import { PageContent, ConsolidatedAnalysis } from '../../types/analysis'
import { inferBrandPositioning } from '../../lib/inferBrandPositioning'
import { analyzeConsolidated } from '../../lib/analyzeConsolidated'
import { createDigitalSource, DigitalSource } from '../../lib/gatherDigitalSources'
import { tryOpenAIChatJson } from '../../lib/aiModel'

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
      .map(a => ({
        url: a.href.trim(),
        text: (
          (a.textContent || '') ||
          a.getAttribute('aria-label') ||
          a.getAttribute('title') ||
          ''
        ).toString().trim()
      }))
      .filter(l => l.url.startsWith('http'))
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
      if (url.startsWith('http')) {
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
  console.log('[parse] homepage parsed', {
    url,
    totalAnchors: allLinks.length,
    sample: allLinks.slice(0, 10)
  })

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
  console.log('[parse] collections selected', {
    count: collections.length,
    collections: collections.map(c => c.url)
  })

    // 2) Fetch each collection page → gather product links (parallel)
    const collectionResults = await Promise.allSettled(
      collections.map(async (col) => {
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
        console.log('[parse] collection scanned', {
          collection: col.url,
          anchors: colLinks.length,
          productsFound: products.length,
          productSample: products.slice(0, 10).map(p => p.url)
        })
        return { collection: col, products }
      })
    )
    const collectionGroups: CollectionGroup[] = collectionResults
      .filter((r): r is PromiseFulfilledResult<CollectionGroup> => r.status === 'fulfilled')
      .map(r => r.value)

    // Flatten product URLs
    const productLinks: Link[] = collectionGroups.flatMap(g => g.products)
    
    console.log(`Found ${collections.length} collections:`, collections.map(c => c.url))
    console.log(`Found ${productLinks.length} total product URLs:`)
    productLinks.slice(0, 10).forEach((p, i) => console.log(`  ${i+1}. ${p.url}`))
  console.log('[parse] product link aggregation', {
    totalProducts: productLinks.length,
    sample: productLinks.slice(0, 20).map(p => p.url)
  })

    // 3) Ask OpenAI for top 10 popular products (only if we have URLs to work with)
    if (productLinks.length === 0) {
      console.log('No product URLs found - collections may be empty or not contain product links')
      console.log('[parse] RETURN (no products)', {
        collections: collectionGroups.length,
        topProductsLength: 0,
        hasAnalysis: false
      })
      console.log('[parse] RENDER topProducts (none) []')
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
  console.log('[parse] openai request sample', {
    sendingCount: Math.min(productLinks.length, 100),
    sample: productLinks.slice(0, 10).map(p => p.url)
  })
    const prompt = `CRITICAL: You must ONLY select URLs from the exact list provided below. Do NOT generate, create, or invent any URLs. If the provided list is empty or contains no valid product URLs, return an empty array.

You are given a list of product page URLs from an e-commerce website. Pick UP TO 10 products that seem most popular/important based on the URL structure and patterns. 

REQUIREMENTS:
- ONLY use URLs from the provided list
- Do NOT create example.com or any fictional URLs
- If no suitable URLs exist in the list, return empty array
- Output JSON with key "topProducts" containing array of objects with url, title, reason

PROVIDED URLs:`;

    // Helper to derive a readable title from URL
    const deriveTitleFromUrl = (productUrl: string) => {
      try {
        const u = new URL(productUrl)
        const last = u.pathname.split('/').filter(Boolean).pop() || ''
        return decodeURIComponent(last.replace(/[-_]+/g, ' ').trim()) || productUrl
      } catch {
        return productUrl
      }
    }

    // Ask OpenAI to pick top products, but fall back if it fails
    let rawTopProducts: Array<{ url: string; title: string; reason?: string }> = []
    try {
      const { default: OpenAI } = await import('openai')
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
      const { result, modelUsed, error } = await tryOpenAIChatJson<{ topProducts: Array<{ url: string; title: string; reason?: string }> }>(
        openai,
        [
          { role: 'system', content: 'You are an expert e-commerce analyst. You must NEVER generate fictional URLs. Only use URLs provided in the prompt.' },
          { role: 'user', content: `${prompt}\n\n${urlList}` }
        ],
        { response_format: { type: 'json_object' }, temperature: 0.2 }
      )
      if (!result) throw error || new Error('No result from OpenAI')
      rawTopProducts = (result.topProducts || []).slice(0, 10)
      console.log(`[parse] OpenAI(${modelUsed}) returned ${rawTopProducts.length} products`)
      rawTopProducts.forEach((p, i) => console.log(`  ${i + 1}. ${p.url}`))
    } catch (err) {
      console.error('OpenAI selection failed, using fallback:', err instanceof Error ? err.message : err)
      rawTopProducts = productLinks.slice(0, 10).map(p => ({
        url: p.url,
        title: p.text || deriveTitleFromUrl(p.url),
        reason: 'Fallback selection (first discovered products)'
      }))
    }
  console.log('[parse] openai raw selection', {
    returnedCount: rawTopProducts.length,
    sample: rawTopProducts.slice(0, 5)
  })
    
    // CRITICAL: Validate that all returned URLs were actually in our original list
    const originalUrls = new Set(productLinks.map(p => p.url))
    let validatedTopProducts = rawTopProducts.filter(product => {
      if (!originalUrls.has(product.url)) {
        console.warn(`❌ OpenAI returned URL not in original list: ${product.url} - FILTERING OUT`)
        return false
      }
      console.log(`✅ Valid URL: ${product.url}`)
      return true
    })
    // If validation eliminates everything, fall back to first discovered products
    if (validatedTopProducts.length === 0) {
      console.warn('Validation produced 0 products. Falling back to first discovered products.')
      validatedTopProducts = productLinks.slice(0, 10).map(p => ({
        url: p.url,
        title: p.text || deriveTitleFromUrl(p.url),
        reason: 'Fallback selection after validation'
      }))
    }

    console.log(`After validation: ${validatedTopProducts.length} valid products`)
  console.log('[parse] validated selection', {
    validatedCount: validatedTopProducts.length,
    validatedSample: validatedTopProducts.slice(0, 10)
  })
    
    // Ensure topProducts have the correct structure for the component
    const formattedTopProducts = validatedTopProducts.map(product => ({
      url: product.url,
      title: product.title,
      reason: product.reason
    }))


    // 4) Fetch HTML for each top product (parallel)
    const pageFetchResults = await Promise.allSettled(
      validatedTopProducts.map(async (product) => {
        const html = await fetchHtml(product.url)
        console.log('[parse] product fetched OK', { url: product.url, contentLength: html.length })
        return { url: product.url, pageType: 'product', content: html } as PageContent
      })
    )
    const pageContents: PageContent[] = pageFetchResults
      .filter((r): r is PromiseFulfilledResult<PageContent> => r.status === 'fulfilled')
      .map(r => r.value)
  console.log('[parse] product fetch summary', {
    fetched: pageContents.length,
    fetchedSample: pageContents.slice(0, 10).map(p => p.url)
  })

    // 5) Only run analysis if we actually have product content
    if (pageContents.length === 0) {
      console.log('[parse] RETURN (no page contents)', {
        collections: collectionGroups.length,
        topProductsLength: formattedTopProducts.length,
        hasAnalysis: false
      })
      console.log('[parse] RENDER topProducts (no analysis)', formattedTopProducts)
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

    console.log('[parse] RETURN (success)', {
      collections: collectionGroups.length,
      topProductsLength: formattedTopProducts.length,
      productsFetched: pageContents.length,
      hasAnalysis: true
    })
    console.log('[parse] RENDER topProducts (success)', formattedTopProducts)
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
    console.error('parse-and-analyze error:', e)
    const message = e instanceof Error ? e.message : 'Failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}