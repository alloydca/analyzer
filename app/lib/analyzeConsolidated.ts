import OpenAI from 'openai'
import { tryOpenAIChatJson } from './aiModel'
import { PageContent, ConsolidatedAnalysis } from '../types/analysis'
import { DigitalSource } from './gatherDigitalSources'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Individual scoring function for each category
async function scoreCategory(
  categoryKey: string,
  categoryTitle: string, 
  categoryDescription: string,
  websiteContent: string,
  digitalContent: string,
  brandPositioning: string,
  totalSources: number,
  pageCount: number,
  digitalSourceCount: number
): Promise<{ score: number; summary: string }> {
  const prompt = `You are analyzing an e-commerce business for ${categoryTitle} using comprehensive digital intelligence. The inferred brand positioning is: "${brandPositioning}"

FOCUS EXCLUSIVELY ON: ${categoryDescription}

Analyze the following PRODUCT CONTENT from ${totalSources} digital sources (${pageCount} website pages + ${digitalSourceCount} external sources) and provide ONLY a score (1-100) and summary (1-3 sentences) for ${categoryTitle}:

WEBSITE PRODUCT CONTENT:
${websiteContent}

${digitalContent ? `
EXTERNAL DIGITAL SOURCES:
${digitalContent}
` : ''}

CRITICAL INSTRUCTIONS:
- Focus ONLY on PRODUCT CONTENT and ${categoryTitle} - ignore technical implementation details like JavaScript, HTML, or CSS
- Score based solely on evidence for this specific category found in product descriptions, messaging, and content
- Be objective and evidence-based in your scoring
- Provide specific examples from the PRODUCT CONTENT to justify your score
- DO NOT comment on technical aspects, code, or website implementation

Return your analysis in this JSON format:
{
  "score": number (1-100),
  "summary": "1-3 sentences with specific evidence from PRODUCT CONTENT for ${categoryTitle} score"
}`

  const { result: resultParsed, modelUsed } = await tryOpenAIChatJson<any>(openai, [
    {
      role: 'system',
      content: `You are an expert e-commerce analyst specializing in ${categoryTitle}. Focus exclusively on PRODUCT CONTENT analysis. Provide objective, evidence-based scoring with specific examples from product descriptions, messaging, and content. DO NOT comment on technical implementation, JavaScript, HTML, or CSS code.`
    },
    { role: 'user', content: prompt }
  ], { response_format: { type: 'json_object' }, temperature: 0.7 })
  const result = (resultParsed || {}) as any
  if (!resultParsed) {
    // eslint-disable-next-line no-console
    console.error('[analyzeConsolidated] No JSON result for category', { categoryTitle, modelUsed })
  }
  return {
    score: result.score || 0,
    summary: result.summary || `Unable to analyze ${categoryTitle}`
  }
}

export async function analyzeConsolidated(
  pageContents: PageContent[], 
  digitalSources: DigitalSource[], 
  brandPositioning: string
): Promise<Omit<ConsolidatedAnalysis, 'inferredBrandPositioning'>> {
  // Increase content limits significantly and distribute fairly across pages
  const maxContentPerPage = Math.max(2000, Math.floor(20000 / pageContents.length))
  const websiteContent = pageContents
    .map(page => `${page.pageType.toUpperCase()} PAGE - ${page.url}:\n${page.content.slice(0, maxContentPerPage)}`)
    .join('\n\n---\n\n')

  const maxDigitalPerSource = Math.max(1000, Math.floor(8000 / Math.max(1, digitalSources.length)))
  const digitalContent = digitalSources
    .map(source => `${source.type.toUpperCase()} - ${source.source}:\n${source.content.slice(0, maxDigitalPerSource)}`)
    .join('\n\n---\n\n')

  const totalSources = pageContents.length + digitalSources.length

  // Define categories for separate analysis
  const categories = [
    {
      key: 'brandAlignment',
      title: 'Brand Alignment',
      description: 'How consistently does content across ALL digital touchpoints reflect and reinforce the core brand positioning? Consider website content, social media presence, customer reviews, press coverage, and external perception alignment.'
    },
    {
      key: 'conversionEffectiveness', 
      title: 'Conversion Effectiveness',
      description: 'How compellingly do digital touchpoints drive urgency and action? Evaluate website conversion elements, social proof from reviews, brand reputation, and overall market positioning for conversion.'
    },
    {
      key: 'seoAiBestPractices',
      title: 'SEO and AI Best Practices', 
      description: 'How well are digital assets optimized for both traditional search engines AND discovery by AI systems? Evaluate traditional SEO plus how easily AI assistants (ChatGPT, Claude, etc.) can discover, understand, and feature these products when users ask for recommendations in generative chat sessions.'
    }
  ]

  // Randomize order for processing to eliminate any potential bias
  const shuffledCategories = [...categories].sort(() => Math.random() - 0.5)

  console.log('🎲 RANDOMIZED ORDER:', shuffledCategories.map(c => c.title))
  console.log('🎲 This proves each analysis uses a different sequence to eliminate bias!')

  // Process categories in parallel
  const results: Record<string, { score: number; summary: string }> = {}
  const categoryPromises = shuffledCategories.map((category) => {
    console.log(`🚀 Starting analysis for ${category.title}...`)
    return scoreCategory(
      category.key,
      category.title,
      category.description,
      websiteContent,
      digitalContent,
      brandPositioning,
      totalSources,
      pageContents.length,
      digitalSources.length
    ).then(result => {
      console.log(`✓ ${category.title}: ${result.score}/100`)
      results[category.key] = result
      return { category: category.key, result }
    }).catch(error => {
      console.error(`✗ Failed to analyze ${category.title}:`, error)
      const fallbackResult = { score: 0, summary: `Unable to analyze ${category.title}` }
      results[category.key] = fallbackResult
      return { category: category.key, result: fallbackResult }
    })
  })
  
  console.log('⚡ Running all category analyses in parallel...')
  await Promise.allSettled(categoryPromises)
  console.log('✅ All category analyses completed')

  // Generate executive summary based on all results
  console.log('Generating executive summary...')
  const executiveSummaryPrompt = `Based on the following analysis results, provide a comprehensive executive summary (3-5 sentences) of the brand's overall digital performance, key strengths, main areas for improvement, and strategic recommendations:

Brand Positioning: "${brandPositioning}"

Analysis Results:
- Brand Alignment: ${results.brandAlignment?.score || 0}/100 - ${results.brandAlignment?.summary || 'N/A'}
- Conversion Effectiveness: ${results.conversionEffectiveness?.score || 0}/100 - ${results.conversionEffectiveness?.summary || 'N/A'}  
- SEO and AI Best Practices: ${results.seoAiBestPractices?.score || 0}/100 - ${results.seoAiBestPractices?.summary || 'N/A'}

Sources analyzed: ${totalSources} (${pageContents.length} website pages + ${digitalSources.length} external sources)

Return JSON: {"executiveSummary": "3-5 sentences with strategic overview and recommendations"}`

  let executiveSummary = 'Unable to generate executive summary'
  try {
    const { result: summaryJson, modelUsed } = await tryOpenAIChatJson<any>(openai, [
      {
        role: 'system',
        content: 'You are an expert e-commerce strategist. Provide a high-level executive summary with actionable strategic recommendations.'
      },
      { role: 'user', content: executiveSummaryPrompt }
    ], { response_format: { type: 'json_object' }, temperature: 0.7 })

    executiveSummary = summaryJson?.executiveSummary || 'Unable to generate executive summary'
  } catch (error) {
    console.error('Failed to generate executive summary:', error)
  }

  return {
    executiveSummary: executiveSummary || `Analysis completed for ${pageContents.length} product pages using randomized scoring to eliminate bias.`,
    brandAlignment: results.brandAlignment || { score: 0, summary: 'Unable to analyze brand alignment' },
    conversionEffectiveness: results.conversionEffectiveness || { score: 0, summary: 'Unable to analyze conversion effectiveness' },
    seoAiBestPractices: results.seoAiBestPractices || { score: 0, summary: 'Unable to analyze SEO and AI discoverability' },
    problematicContent: [], // Removed for now since we're focusing on independent scoring
    _debugInfo: {
      randomizedOrder: shuffledCategories.map(c => c.title),
      processingSequence: `${shuffledCategories.map(c => c.title).join(' → ')}`,
      message: 'Categories were processed in this randomized order to eliminate bias'
    }
  }
}

// Streaming version that sends updates as each category completes
export async function analyzeConsolidatedStreaming(
  pageContents: PageContent[], 
  digitalSources: DigitalSource[], 
  brandPositioning: string,
  onUpdate: (update: any) => void
): Promise<void> {
  // Increase content limits significantly and distribute fairly across pages
  const maxContentPerPage = Math.max(2000, Math.floor(20000 / pageContents.length))
  const websiteContent = pageContents
    .map(page => `${page.pageType.toUpperCase()} PAGE - ${page.url}:\n${page.content.slice(0, maxContentPerPage)}`)
    .join('\n\n---\n\n')

  const maxDigitalPerSource = Math.max(1000, Math.floor(8000 / Math.max(1, digitalSources.length)))
  const digitalContent = digitalSources
    .map(source => `${source.type.toUpperCase()} - ${source.source}:\n${source.content.slice(0, maxDigitalPerSource)}`)
    .join('\n\n---\n\n')

  const totalSources = pageContents.length + digitalSources.length

  // Define categories for separate analysis
  const categories = [
    {
      key: 'brandAlignment',
      title: 'Brand Alignment',
      description: 'How consistently does content across ALL digital touchpoints reflect and reinforce the core brand positioning? Consider website content, social media presence, customer reviews, press coverage, and external perception alignment.'
    },
    {
      key: 'conversionEffectiveness', 
      title: 'Conversion Effectiveness',
      description: 'How compellingly do digital touchpoints drive urgency and action? Evaluate website conversion elements, social proof from reviews, brand reputation, and overall market positioning for conversion.'
    },
    {
      key: 'seoAiBestPractices',
      title: 'SEO and AI Best Practices', 
      description: 'How well are digital assets optimized for both traditional search engines AND discovery by AI systems? Evaluate traditional SEO plus how easily AI assistants (ChatGPT, Claude, etc.) can discover, understand, and feature these products when users ask for recommendations in generative chat sessions.'
    }
  ]

  // Randomize order for processing to eliminate any potential bias
  const shuffledCategories = [...categories].sort(() => Math.random() - 0.5)

  console.log('🎲 RANDOMIZED ORDER:', shuffledCategories.map(c => c.title))
  
  // Send randomization info to client
  onUpdate({
    type: 'randomization',
    order: shuffledCategories.map(c => c.title),
    message: `Categories will be analyzed in this randomized order: ${shuffledCategories.map(c => c.title).join(' → ')}`
  })

  // Process each category independently with separate API calls
  const results: Record<string, { score: number; summary: string }> = {}

  // Process categories in parallel with streaming updates
  let completedCount = 0

  // Send initial progress update
  onUpdate({
    type: 'progress',
    step: 1,
    total: 4,
    message: 'Starting parallel analysis of all categories...'
  })

  const categoryPromises = shuffledCategories.map(async (category, index) => {
    console.log(`🚀 Starting parallel analysis for ${category.title}...`)
    
    try {
      const result = await scoreCategory(
        category.key,
        category.title,
        category.description,
        websiteContent,
        digitalContent,
        brandPositioning,
        totalSources,
        pageContents.length,
        digitalSources.length
      )
      
      results[category.key] = result
      completedCount++
      
      console.log(`✅ COMPLETED: ${category.title} = ${result.score}/100 (${completedCount}/3 done)`)
      
      // Send completed category result immediately
      onUpdate({
        type: 'category_complete',
        category: category.title,
        categoryKey: category.key,
        score: result.score,
        summary: result.summary,
        step: 1,
        total: 4,
        message: `${category.title} completed: ${result.score}/100 (${completedCount}/3 categories done)`
      })
      
      return { category: category.key, result }
    } catch (error) {
      console.error(`❌ FAILED: ${category.title}`, error)
      const fallbackResult = { score: 0, summary: `Unable to analyze ${category.title}` }
      results[category.key] = fallbackResult
      completedCount++
      
      onUpdate({
        type: 'category_error',
        category: category.title,
        categoryKey: category.key,
        error: error instanceof Error ? error.message : 'Unknown error',
        step: 1,
        total: 4,
        message: `${category.title} failed: Unable to analyze (${completedCount}/3 categories done)`
      })
      
      return { category: category.key, result: fallbackResult }
    }
  })

  console.log('⚡ Running all category analyses in parallel...')
  await Promise.allSettled(categoryPromises)
  console.log('✅ All category analyses completed in parallel')

  // Generate executive summary
  console.log('📋 GENERATING EXECUTIVE SUMMARY...')
  onUpdate({
    type: 'progress',
    category: 'Executive Summary',
    step: 4,
    total: 4,
    message: 'Generating executive summary...'
  })

  const executiveSummaryPrompt = `Based on the following analysis results, provide a comprehensive executive summary (3-5 sentences) of the brand's overall digital performance, key strengths, main areas for improvement, and strategic recommendations:

Brand Positioning: "${brandPositioning}"

Analysis Results:
- Brand Alignment: ${results.brandAlignment?.score || 0}/100 - ${results.brandAlignment?.summary || 'N/A'}
- Conversion Effectiveness: ${results.conversionEffectiveness?.score || 0}/100 - ${results.conversionEffectiveness?.summary || 'N/A'}  
- SEO and AI Best Practices: ${results.seoAiBestPractices?.score || 0}/100 - ${results.seoAiBestPractices?.summary || 'N/A'}

Sources analyzed: ${totalSources} (${pageContents.length} website pages + ${digitalSources.length} external sources)

You MUST respond with valid JSON in exactly this format:
{"executiveSummary": "3-5 sentences with strategic overview and recommendations"}`

  let executiveSummary = 'Unable to generate executive summary'
  try {
    const summaryResponse = await tryOpenAIChatJson<{executiveSummary: string}>(
      openai,
      [
        {
          role: "system",
          content: "You are an expert e-commerce strategist analyzing PRODUCT CONTENT. You MUST respond with valid JSON containing an executiveSummary field. Focus exclusively on product messaging, content quality, and customer experience. DO NOT comment on technical implementation, JavaScript, HTML, or CSS. Do not include any text outside the JSON response."
        },
        {
          role: "user", 
          content: executiveSummaryPrompt
        }
      ],
      {
        response_format: { type: "json_object" },
        temperature: 0.7,
      }
    )

    if (summaryResponse.result?.executiveSummary) {
      executiveSummary = summaryResponse.result.executiveSummary
    } else {
      console.error('Executive summary response missing executiveSummary field:', summaryResponse)
    }
  } catch (error) {
    console.error('Failed to generate executive summary:', error)
  }

  // Send final complete analysis
  const finalAnalysis = {
    executiveSummary,
    inferredBrandPositioning: brandPositioning,
    brandAlignment: results.brandAlignment || { score: 0, summary: 'Unable to analyze brand alignment' },
    conversionEffectiveness: results.conversionEffectiveness || { score: 0, summary: 'Unable to analyze conversion effectiveness' },
    seoAiBestPractices: results.seoAiBestPractices || { score: 0, summary: 'Unable to analyze SEO and AI discoverability' },
    problematicContent: []
  }

  onUpdate({
    type: 'complete',
    analysis: finalAnalysis
  })

  console.log('🎉 ANALYSIS COMPLETE')
}