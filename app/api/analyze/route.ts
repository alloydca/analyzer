import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { fetchPageContent } from '../../lib/fetchPage'
import { analyzePage } from '../../lib/analyzePage'
import { generateSummary } from '../../lib/generateSummary'
import { InitialAnalysis, PageAnalysis, AnalysisSummary } from '../../types/analysis'

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
          content: `You are an expert at analyzing e-commerce websites. Your task is to identify the top 10 product URLs and 2 category URLs from the given website content. 
          
          IMPORTANT: Only return URLs that actually exist in the provided content. Do not make up or invent URLs.
          
          Return the results in a structured JSON format with the following structure:
          {
            "products": [
              {
                "url": "https://actualwebsite.com/actual-product-path",
                "title": "Actual Product Title",
                "description": "Brief description based on content"
              }
            ],
            "categories": [
              {
                "url": "https://actualwebsite.com/actual-category-path",
                "title": "Actual Category Title",
                "description": "Brief description based on content"
              }
            ]
          }
          
          If you cannot find enough products or categories, return fewer items rather than making up URLs.`
        },
        {
          role: "user",
          content: `Analyze this website content and identify the top product URLs and category URLs. Base URL: ${url}

Website Content:
${mainPageContent.slice(0, 8000)}`
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

    // Fetch and analyze each page
    const pageAnalyses: PageAnalysis[] = []
    let successfulAnalyses = 0
    let failedAnalyses = 0
    
    // Process products
    for (const product of initialResults.products) {
      try {
        console.log(`Analyzing product page: ${product.url}`)
        const content = await fetchPageContent(product.url)
        const analysis = await analyzePage(product.url, content, 'product')
        pageAnalyses.push(analysis)
        successfulAnalyses++
        console.log(`✓ Successfully analyzed: ${product.url}`)
        // Add a small delay between requests
        await new Promise(resolve => setTimeout(resolve, 500))
      } catch (error) {
        failedAnalyses++
        console.error(`✗ Failed to analyze product page ${product.url}:`, error instanceof Error ? error.message : 'Unknown error')
        // Continue to next page instead of stopping
      }
    }

    // Process categories
    for (const category of initialResults.categories) {
      try {
        console.log(`Analyzing category page: ${category.url}`)
        const content = await fetchPageContent(category.url)
        const analysis = await analyzePage(category.url, content, 'category')
        pageAnalyses.push(analysis)
        successfulAnalyses++
        console.log(`✓ Successfully analyzed: ${category.url}`)
        // Add a small delay between requests
        await new Promise(resolve => setTimeout(resolve, 500))
      } catch (error) {
        failedAnalyses++
        console.error(`✗ Failed to analyze category page ${category.url}:`, error instanceof Error ? error.message : 'Unknown error')
        // Continue to next page instead of stopping
      }
    }

    console.log(`Analysis complete: ${successfulAnalyses} successful, ${failedAnalyses} failed`)

    // Only generate summary if we have at least one successful analysis
    if (pageAnalyses.length === 0) {
      throw new Error('No pages could be analyzed successfully')
    }

    // Generate summary
    const summary = await generateSummary(pageAnalyses)

    return NextResponse.json({
      initialResults,
      pageAnalyses,
      summary,
      stats: {
        successful: successfulAnalyses,
        failed: failedAnalyses,
        total: initialResults.products.length + initialResults.categories.length
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