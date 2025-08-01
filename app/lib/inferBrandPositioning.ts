import OpenAI from 'openai'
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

  const prompt = `You are analyzing a brand's positioning based on comprehensive digital intelligence from ${totalSources} sources (${pageContents.length} website pages + ${digitalSources.length} external digital sources).

Your task is to infer the core brand positioning - what makes this brand unique, who they serve, and what value they provide.

WEBSITE CONTENT:
${websiteContent}

${digitalSources.length > 0 ? `
EXTERNAL DIGITAL SOURCES:
${digitalContent}

IMPORTANT: Consider both internal messaging (website) and external perception (reviews, social media, press coverage). Look for consistency or gaps between how the brand presents itself vs. how it's perceived externally.
` : ''}

Based on this comprehensive analysis, provide a clear, concise brand positioning statement (2-4 sentences) that captures:

1. WHO they serve (target audience)
2. WHAT they offer (category/products)  
3. HOW they're different (unique value proposition)
4. WHY customers should choose them (key benefits)

Focus on the core brand identity that emerges from all sources. If there are inconsistencies between internal and external sources, acknowledge the most authentic positioning based on the evidence.`

  const completion = await openai.chat.completions.create({
    model: "gpt-4-turbo-preview",
    messages: [
      {
        role: "system",
        content: "You are an expert at analyzing brand positioning from comprehensive digital content."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    temperature: 0.3,
  })

  return completion.choices[0].message.content || 'Unable to infer brand positioning'
}