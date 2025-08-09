import OpenAI from 'openai'
import { tryOpenAIChatJson } from './aiModel'
import { AnalysisSummary, PageAnalysis } from '../types/analysis'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function generateSummary(analyses: PageAnalysis[]): Promise<AnalysisSummary> {
  const prompt = `Based on the following PRODUCT CONTENT analyses, generate an executive summary and identify the most critical issues and recommendations.

Product Content Analyses:
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

Focus on PRODUCT CONTENT quality and the most critical issues first. Provide actionable recommendations for improving product messaging and content. DO NOT comment on technical implementation, JavaScript, HTML, or CSS.`

  const { result } = await tryOpenAIChatJson<AnalysisSummary>(
    openai,
    [
      {
        role: "system",
        content: "You are an expert at analyzing PRODUCT CONTENT and providing actionable recommendations. Focus exclusively on product messaging, descriptions, and customer-facing content. DO NOT comment on technical implementation, JavaScript, HTML, or CSS."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    { response_format: { type: "json_object" }, temperature: 0.7 }
  )

  return result || { executiveSummary: '', topIssues: { generalQuality: [], seo: [], aiOptimization: [] }, recommendations: [] }
} 