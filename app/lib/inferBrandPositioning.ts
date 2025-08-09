import OpenAI from 'openai'
import { tryOpenAIChatJson } from './aiModel'
import { PageContent } from '../types/analysis'
import { DigitalSource } from './gatherDigitalSources'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function inferBrandPositioning(
  pageContents: PageContent[], 
  digitalSources: DigitalSource[] = []
): Promise<string> {
  const websiteContent = pageContents
    .map(page => `${page.pageType.toUpperCase()} PAGE - ${page.url}:\n${page.content}`)
    .join('\n\n---\n\n')
    .slice(0, 8000)

  const digitalContent = digitalSources
    .map(source => `${source.type.toUpperCase()} - ${source.source}:\n${source.content}`)
    .join('\n\n---\n\n')
    .slice(0, 4000)

  const totalSources = pageContents.length + digitalSources.length

  const prompt = `You are analyzing a brand's positioning based on comprehensive PRODUCT CONTENT from ${totalSources} sources (${pageContents.length} website pages + ${digitalSources.length} external digital sources).

Your task is to infer the core brand positioning from PRODUCT CONTENT - what makes this brand unique, who they serve, and what value they provide.

WEBSITE PRODUCT CONTENT:
${websiteContent}

${digitalSources.length > 0 ? `
EXTERNAL DIGITAL SOURCES:
${digitalContent}

IMPORTANT: Consider both internal product messaging and external perception (reviews, social media, press coverage). Look for consistency or gaps between how the brand presents its products vs. how they're perceived externally.
` : ''}

Based on this comprehensive PRODUCT CONTENT analysis, provide a clear, concise brand positioning statement (2-4 sentences) that captures:

1. WHO they serve (target audience)
2. WHAT they offer (category/products)  
3. HOW they're different (unique value proposition)
4. WHY customers should choose them (key benefits)

Focus on the core brand identity that emerges from PRODUCT CONTENT. DO NOT comment on technical implementation, JavaScript, HTML, or CSS. If there are inconsistencies between internal and external sources, acknowledge the most authentic positioning based on the evidence.`

  const { result, modelUsed } = await tryOpenAIChatJson<{positioning: string}>(
    openai,
    [
      {
        role: "system",
        content: "You are an expert at analyzing brand positioning from PRODUCT CONTENT. Focus exclusively on product messaging, descriptions, and customer-facing content. DO NOT comment on technical implementation, JavaScript, HTML, or CSS. Respond with JSON containing a 'positioning' field."
      },
      {
        role: "user",
        content: prompt + "\n\nYou MUST respond with valid JSON in this format: {\"positioning\": \"your 2-4 sentence brand positioning statement\"}"
      }
    ],
    { response_format: { type: 'json_object' }, temperature: 0.3 }
  )

  return result?.positioning || 'Unable to infer brand positioning'
}