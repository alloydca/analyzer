import { NextRequest } from 'next/server'
import { JSDOM } from 'jsdom'
import { PageContent } from '../../types/analysis'
import { inferBrandPositioning } from '../../lib/inferBrandPositioning'
import { analyzeConsolidatedStreaming } from '../../lib/analyzeConsolidated'
import { createDigitalSource, DigitalSource } from '../../lib/gatherDigitalSources'
import { tryOpenAIChatJson } from '../../lib/aiModel'

// Function to extract the main product image from HTML
function extractProductImage(html: string, baseUrl: string): string | null {
  try {
    const dom = new JSDOM(html, { url: baseUrl })
    const document = dom.window.document
    
    // Common selectors for product images (ordered by priority)
    const selectors = [
      'img[data-src*="product"]',
      'img[src*="product"]',
      '.product-image img',
      '.product-photo img',
      '.product-gallery img:first-child',
      '.main-image img',
      '.hero-image img',
      '.featured-image img',
      'img[alt*="product"]',
      'img[class*="product"]',
      'picture img',
      '.image-container img:first-child',
      'main img:first-child',
      'img[data-src]:first-of-type',
      'img[src]:first-of-type'
    ]
    
    for (const selector of selectors) {
      const img = document.querySelector(selector) as HTMLImageElement
      if (img) {
        // Get the image URL (prefer data-src for lazy-loaded images, fallback to src)
        let imageUrl = img.getAttribute('data-src') || img.getAttribute('src')
        if (imageUrl) {
          // Convert relative URLs to absolute
          if (imageUrl.startsWith('//')) {
            imageUrl = 'https:' + imageUrl
          } else if (imageUrl.startsWith('/')) {
            const base = new URL(baseUrl)
            imageUrl = base.origin + imageUrl
          } else if (!imageUrl.startsWith('http')) {
            imageUrl = new URL(imageUrl, baseUrl).toString()
          }
          
          // Validate it looks like an image URL
          if (/\.(jpg|jpeg|png|webp|gif|svg)(\?|$)/i.test(imageUrl)) {
            return imageUrl
          }
        }
      }
    }
    
    return null
  } catch (error) {
    console.error('Error extracting product image:', error)
    return null
  }
}

interface Link { url: string; text: string }
interface CollectionGroup { collection: Link; products: Link[] }

const COLLECTION_PATTERNS = ['/collections/', '/category/', '/categories/', '/shop/', '/browse/']
const PRODUCT_PATTERNS = ['/products/', '/product/', '/item/', '/items/', '/p/']

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; ProductAnalyzer/1.0; +https://analyzer.com/bot)'
    }
  })
  
  if (!res.ok) {
    let errorMessage = `Unable to access ${url}`
    
    switch (res.status) {
      case 403:
        errorMessage = `This website (${new URL(url).hostname}) is blocking automated requests. This is common with sites that have bot protection enabled. Please try a different e-commerce website.`
        break
      case 404:
        errorMessage = `The page at ${url} was not found. The website may have changed its structure.`
        break
      case 429:
        errorMessage = `This website is rate-limiting our requests. Please wait a few minutes and try again.`
        break
      case 500:
      case 502:
      case 503:
      case 504:
        errorMessage = `The website ${new URL(url).hostname} appears to be experiencing technical difficulties. Please try again later.`
        break
      case 401:
        errorMessage = `This website requires authentication that we cannot provide. Please try a publicly accessible e-commerce site.`
        break
      default:
        errorMessage = `Unable to access ${new URL(url).hostname} (Error ${res.status}). The website may be blocking automated requests or experiencing issues.`
    }
    
    throw new Error(errorMessage)
  }
  return res.text()
}

function parseLinks(html: string, base: string): Link[] {
  // Preprocess HTML to remove style elements that cause CSS parsing issues
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
      if (url.startsWith('http') && text) {
        links.push({ url, text })
      }
    } catch (e) {
      // Skip invalid URLs
    }
  }
  
  return links
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')
  
  if (!url) {
    return new Response('Missing URL parameter', { status: 400 })
  }

  const encoder = new TextEncoder()
  
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Send headers
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'start',
          message: 'Starting analysis...'
        })}\n\n`))

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
            return { collection: col, products }
          })
        )
        const collectionGroups: CollectionGroup[] = collectionResults
          .filter((r): r is PromiseFulfilledResult<CollectionGroup> => r.status === 'fulfilled')
          .map(r => r.value)

        // Flatten product URLs
        const productLinks: Link[] = collectionGroups.flatMap(g => g.products)
        
        if (productLinks.length === 0) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'error',
            error: 'No product URLs found on this website'
          })}\n\n`))
          controller.close()
          return
        }

        // 3) Ask OpenAI for top 10 popular products
        const urlList = productLinks.map(p => p.url).slice(0, 100).join('\n')
        const prompt = `CRITICAL: You must ONLY select URLs from the exact list provided below. Do NOT generate, create, or invent any URLs.

You are given a list of product page URLs from an e-commerce website. Pick UP TO 10 products that seem most popular/important based on the URL structure and patterns. 

REQUIREMENTS:
- ONLY use URLs from the provided list
- Do NOT create example.com or any fictional URLs
- If no suitable URLs exist in the list, return empty array
- Output JSON with key "topProducts" containing array of objects with url, title, reason

PROVIDED URLs:`

        const { default: OpenAI } = await import('openai')
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
        const { result } = await tryOpenAIChatJson<{ topProducts: Array<{ url: string; title: string; reason?: string }> }>(
          openai,
          [
            { role: 'system', content: 'You are an expert e-commerce analyst. You must NEVER generate fictional URLs. Only use URLs provided in the prompt.' },
            { role: 'user', content: `${prompt}\n\n${urlList}` }
          ],
          { response_format: { type: 'json_object' }, temperature: 0.2 }
        )
        const rawTopProducts = (result?.topProducts || []).slice(0, 10)
        
        // Validate URLs
        const originalUrls = new Set(productLinks.map(p => p.url))
        const validatedTopProducts = rawTopProducts.filter(product => originalUrls.has(product.url))
        
        const formattedTopProducts = validatedTopProducts.map(product => ({
          url: product.url,
          title: product.title,
          reason: product.reason
        }))

        // Send initial data
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'initial',
          collections: collectionGroups,
          topProducts: formattedTopProducts,
          stats: { collections: collectionGroups.length, productsFetched: 0 }
        })}\n\n`))

        // 4) Fetch HTML for each top product (parallel) and extract images
        const pageFetchResults = await Promise.allSettled(
          validatedTopProducts.map(async (product) => {
            const html = await fetchHtml(product.url)
            const image = extractProductImage(html, product.url)
            return { 
              url: product.url, 
              pageType: 'product', 
              content: html,
              image: image
            } as PageContent & { image: string | null }
          })
        )
        const pageContents: (PageContent & { image: string | null })[] = pageFetchResults
          .filter((r): r is PromiseFulfilledResult<PageContent & { image: string | null }> => r.status === 'fulfilled')
          .map(r => r.value)

        // Update formattedTopProducts with images
        const productsWithImages = formattedTopProducts.map(product => {
          const pageContent = pageContents.find(p => p.url === product.url)
          return {
            ...product,
            image: pageContent?.image || null
          }
        })

        if (pageContents.length === 0) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'error',
            error: 'No product pages could be analyzed successfully'
          })}\n\n`))
          controller.close()
          return
        }

        // Notify client that product pages have been fetched
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'products_fetched',
          count: pageContents.length
        })}\n\n`))

        // 5) Consolidated analysis with streaming
        const digitalSources: DigitalSource[] = [createDigitalSource('website', url, homeHtml, url)]
        const brandPos = await inferBrandPositioning(pageContents, digitalSources)
        
        // Stream the analysis
        await analyzeConsolidatedStreaming(pageContents, digitalSources, brandPos, (update) => {
          // If this is the complete event, add the products with images
          if (update.type === 'complete') {
            update.topProducts = productsWithImages
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(update)}\n\n`))
        })
        
        controller.close()

      } catch (error) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'error',
          error: error instanceof Error ? error.message : 'Analysis failed'
        })}\n\n`))
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  })
}
