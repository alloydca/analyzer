import OpenAI from 'openai'
import { AnalysisSummary, PageAnalysis } from '../types/analysis'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function generateSummary(analyses: PageAnalysis[]): Promise<AnalysisSummary> {
  const prompt = `Based on the following page analyses, generate an executive summary and identify the most critical issues and recommendations.

Page Analyses:
${JSON.stringify(analyses, null, 2)}

Return the analysis in a structured JSON format with the following structure:
{
  "executiveSummary": string,
  "topIssues": {
    "generalQuality": string[],
    "seo": string[],
    "aiOptimization": string[]
  },
  "recommendations": string[]
}

Focus on the most critical issues first and provide actionable recommendations.`

  const completion = await openai.chat.completions.create({
    model: "gpt-4-turbo-preview",
    messages: [
      {
        role: "system",
        content: "You are an expert at analyzing web content and providing actionable recommendations."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    response_format: { type: "json_object" }
  })

  return JSON.parse(completion.choices[0].message.content || '{}')
} 