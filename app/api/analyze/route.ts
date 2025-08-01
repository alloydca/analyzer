import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { fetchPageContent } from '../../lib/fetchPage'
import { collectPageContent } from '../../lib/analyzePage'
import { inferBrandPositioning } from '../../lib/inferBrandPositioning'
import { analyzeConsolidated } from '../../lib/analyzeConsolidated'
import { extractBrandName, createDigitalSource, DigitalSource } from '../../lib/gatherDigitalSources'
import { InitialAnalysis, PageContent, ConsolidatedAnalysis } from '../../types/analysis'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: Request) {
  try {
    const { url } = await request.json()

    // First, fetch the main website content
    const mainPageContent = await fetchPageContent(url)
    console.log('Fetched main page content, length:', mainPageContent.length)

    // Initial analysis to get top products and categories using the actual content
    const initialAnalysis = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: `You are an expert at analyzing e-commerce websites. Your task is to identify the top 20 product URLs and 4 category URLs from the given website content, ranked by popularity/prominence on the site.
          
          CRITICAL REQUIREMENTS:
          1. ONLY extract URLs that are explicitly mentioned in the provided content as clickable links
          2. Look for URLs in the "KEY LINKS FOUND:" section - these are the actual working links from the page
          3. Focus on complete, fully-formed URLs (not relative paths)
          4. Prioritize URLs that appear multiple times or are prominently featured
          5. Do NOT construct or invent URLs - only use what's explicitly provided
          
          RANKING CRITERIA (most important first):
          - URLs that appear multiple times in the content
          - URLs with descriptive anchor text indicating products/categories
          - URLs that follow common e-commerce patterns (/products/, /collections/, /category/, etc.)
          
          Return the results in a structured JSON format with the following structure:
          {
            "products": [
              {
                "url": "https://exacturl.com/from/content",
                "title": "Exact Link Text or Product Name",
                "description": "Brief description based on content",
                "confidence": "high|medium|low"
              }
            ],
            "categories": [
              {
                "url": "https://exacturl.com/from/content", 
                "title": "Exact Link Text or Category Name",
                "description": "Brief description based on content",
                "confidence": "high|medium|low"
              }
            ]
          }
          
          Return UP TO 20 products and 4 categories, but ONLY include URLs that actually exist in the content. Better to return fewer accurate URLs than many broken ones.`
        },
        {
          role: "user",
          content: `Analyze this website content and extract the most prominent product and category URLs. Focus especially on the "KEY LINKS FOUND:" section for actual working links. Base URL: ${url}

Website Content:
${mainPageContent.slice(0, 10000)}`
        }
      ],
      response_format: { type: "json_object" }
    })

    console.log('Raw OpenAI response:', initialAnalysis.choices[0].message.content)
    const initialResults = JSON.parse(initialAnalysis.choices[0].message.content || '{}') as InitialAnalysis
    
    // Validate the response structure
    if (!initialResults.products || !Array.isArray(initialResults.products) || 
        !initialResults.categories || !Array.isArray(initialResults.categories)) {
      console.error('Invalid response structure:', initialResults)
      throw new Error('Invalid response structure from OpenAI')
    }

    // Sort URLs by confidence (high -> medium -> low) for better success rate
    const sortedProducts = initialResults.products.sort((a, b) => {
      const confidenceOrder = { 'high': 0, 'medium': 1, 'low': 2 }
      const aConf = confidenceOrder[a.confidence || 'low']
      const bConf = confidenceOrder[b.confidence || 'low']
      return aConf - bConf
    })
    
    const sortedCategories = initialResults.categories.sort((a, b) => {
      const confidenceOrder = { 'high': 0, 'medium': 1, 'low': 2 }
      const aConf = confidenceOrder[a.confidence || 'low']
      const bConf = confidenceOrder[b.confidence || 'low']
      return aConf - bConf
    })

    // Fetch and collect content from each page until we reach targets
    const pageContents: PageContent[] = []
    let successfulProducts = 0
    let successfulCategories = 0
    let failedPages = 0
    
    const TARGET_PRODUCTS = 10
    const TARGET_CATEGORIES = 2
    
    // Process products until we have 10 successful ones
    console.log(`Attempting to collect ${TARGET_PRODUCTS} product pages from ${sortedProducts.length} candidates...`)
    for (const product of sortedProducts) {
      if (successfulProducts >= TARGET_PRODUCTS) {
        console.log(`✓ Reached target of ${TARGET_PRODUCTS} product pages`)
        break
      }
      
      try {
        console.log(`Collecting content from product page: ${product.url} (confidence: ${product.confidence || 'unknown'})`)
        const content = await fetchPageContent(product.url)
        const pageContent = await collectPageContent(product.url, content, 'product')
        pageContents.push(pageContent)
        successfulProducts++
        console.log(`✓ Successfully collected: ${product.url} (${successfulProducts}/${TARGET_PRODUCTS} products)`)
        // Add a small delay between requests
        await new Promise(resolve => setTimeout(resolve, 500))
      } catch (error) {
        failedPages++
        console.error(`✗ Failed to collect content from product page ${product.url}:`, error instanceof Error ? error.message : 'Unknown error')
        // Continue to next page instead of stopping
      }
    }

    // Process categories until we have 2 successful ones
    console.log(`Attempting to collect ${TARGET_CATEGORIES} category pages from ${sortedCategories.length} candidates...`)
    for (const category of sortedCategories) {
      if (successfulCategories >= TARGET_CATEGORIES) {
        console.log(`✓ Reached target of ${TARGET_CATEGORIES} category pages`)
        break
      }
      
      try {
        console.log(`Collecting content from category page: ${category.url} (confidence: ${category.confidence || 'unknown'})`)
        const content = await fetchPageContent(category.url)
        const pageContent = await collectPageContent(category.url, content, 'category')
        pageContents.push(pageContent)
        successfulCategories++
        console.log(`✓ Successfully collected: ${category.url} (${successfulCategories}/${TARGET_CATEGORIES} categories)`)
        // Add a small delay between requests
        await new Promise(resolve => setTimeout(resolve, 500))
      } catch (error) {
        failedPages++
        console.error(`✗ Failed to collect content from category page ${category.url}:`, error instanceof Error ? error.message : 'Unknown error')
        // Continue to next page instead of stopping
      }
    }

    const totalSuccessful = successfulProducts + successfulCategories
    console.log(`Content collection complete: ${totalSuccessful} successful (${successfulProducts} products, ${successfulCategories} categories), ${failedPages} failed`)

    // Only proceed if we have at least one successful page
    if (pageContents.length === 0) {
      throw new Error('No pages could be analyzed successfully')
    }

    // Prepare digital sources for comprehensive brand analysis
    // TODO: In production, this would gather external sources like social media, reviews, press coverage
    const digitalSources: DigitalSource[] = [
      createDigitalSource('website', url, mainPageContent, url)
    ]

    // Infer brand positioning from all collected content
    console.log('Inferring brand positioning...')
    const brandPositioning = await inferBrandPositioning(pageContents, digitalSources)

    // Perform consolidated analysis across business dimensions
    console.log('Performing consolidated analysis...')
    const consolidatedAnalysis = await analyzeConsolidated(pageContents, digitalSources, brandPositioning)

    // Combine results
    const analysis: ConsolidatedAnalysis = {
      ...consolidatedAnalysis,
      inferredBrandPositioning: brandPositioning
    }

    return NextResponse.json({
      initialResults,
      analysis,
      stats: {
        successful: totalSuccessful,
        failed: failedPages, 
        total: initialResults.products.length + initialResults.categories.length,
        productsCollected: successfulProducts,
        categoriesCollected: successfulCategories
      }
    })

  } catch (error) {
    console.error('Analysis error:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to analyze website'
      },
      { status: 500 }
    )
  }
} 