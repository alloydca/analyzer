import OpenAI from 'openai'
import { PageContent, ConsolidatedAnalysis } from '../types/analysis'
import { DigitalSource } from './gatherDigitalSources'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function analyzeConsolidated(
  pageContents: PageContent[], 
  digitalSources: DigitalSource[], 
  brandPositioning: string
): Promise<Omit<ConsolidatedAnalysis, 'inferredBrandPositioning'>> {
  const websiteContent = pageContents
    .map(page => `${page.pageType.toUpperCase()} PAGE - ${page.url}:\n${page.content}`)
    .join('\n\n---\n\n')
    .slice(0, 8000)

  const digitalContent = digitalSources
    .map(source => `${source.type.toUpperCase()} - ${source.source}:\n${source.content}`)
    .join('\n\n---\n\n')
    .slice(0, 4000)

  const totalSources = pageContents.length + digitalSources.length

  const prompt = `You are analyzing an e-commerce business across 3 key business dimensions using comprehensive digital intelligence. The inferred brand positioning is: "${brandPositioning}"

Analyze the following content from ${totalSources} digital sources (${pageContents.length} website pages + ${digitalSources.length} external sources including social media, reviews, press coverage, and company information) and provide an executive summary plus scores (1-100) and summaries (1-3 sentences) for each category:

**Executive Summary:** Provide a high-level overview (3-5 sentences) of the brand's overall digital performance, key strengths, main areas for improvement, and strategic recommendations based on comprehensive digital intelligence.

**1. Brand Alignment (1-100):** How consistently does content across ALL digital touchpoints reflect and reinforce the core brand positioning? Consider website content, social media presence, customer reviews, press coverage, and external perception alignment.

**2. Conversion Effectiveness (1-100):** How compellingly do digital touchpoints drive urgency and action? Evaluate website conversion elements, social proof from reviews, brand reputation, and overall market positioning for conversion.

**3. SEO and AI Best Practices (1-100):** How well are digital assets optimized for both traditional search engines AND discovery by AI systems? Evaluate traditional SEO plus how easily AI assistants (ChatGPT, Claude, etc.) can discover, understand, and feature these products when users ask for recommendations in generative chat sessions.

WEBSITE CONTENT:
${websiteContent}

${digitalSources.length > 0 ? `
EXTERNAL DIGITAL SOURCES:
${digitalContent}

IMPORTANT: Consider the full digital ecosystem - website performance, external reputation, customer sentiment, press coverage, and social media presence. Look for consistency or gaps between internal messaging and external perception.

For AI optimization specifically: Evaluate how well structured and discoverable the content is for AI systems that crawl and analyze web content. Consider: clear product descriptions, structured data, schema markup, content organization that AI can parse and understand, and information architecture that makes products easily discoverable when AI assistants search for recommendations to give users.
` : ''}

Return your analysis in the following JSON format:
{
  "executiveSummary": "3-5 sentences providing high-level overview and strategic recommendations",
  "brandAlignment": {
    "score": number (1-100),
    "summary": "1-3 sentences summarizing brand alignment across all pages"
  },
  "conversionEffectiveness": {
    "score": number (1-100),
    "summary": "1-3 sentences summarizing conversion effectiveness across all pages"
  },
  "seoAiBestPractices": {
    "score": number (1-100),
    "summary": "1-3 sentences summarizing traditional SEO and AI discoverability - how well AI assistants can find, understand, and feature these products in chat recommendations"
  }
}

Be specific about what drives each score and reference patterns you see across multiple pages in your summaries.`

  const completion = await openai.chat.completions.create({
    model: "gpt-4-turbo-preview",
    messages: [
      {
        role: "system",
        content: "You are an expert e-commerce analyst who evaluates websites across brand consistency, conversion optimization, and discoverability optimization. For AI optimization, focus on how well AI assistants (ChatGPT, Claude, etc.) can discover, understand, and feature these products when users ask for recommendations. Provide actionable insights with specific scoring rationale."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
  })

  const analysis = JSON.parse(completion.choices[0].message.content || '{}')

  return {
    executiveSummary: analysis.executiveSummary || 'Unable to generate executive summary',
    brandAlignment: analysis.brandAlignment || { score: 0, summary: 'Unable to analyze brand alignment' },
    conversionEffectiveness: analysis.conversionEffectiveness || { score: 0, summary: 'Unable to analyze conversion effectiveness' },
    seoAiBestPractices: analysis.seoAiBestPractices || { score: 0, summary: 'Unable to analyze SEO and AI discoverability' }
  }
}