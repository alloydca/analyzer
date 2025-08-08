export function getOpenAIModelCandidates(): string[] {
  const raw = process.env.AI_MODEL || ''
  if (!raw.trim()) {
    return ['gpt-4o']
  }

  const models = raw
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)
    .map(entry => {
      // Accept formats like "openai:gpt-4o" or just "gpt-4o"
      const colon = entry.indexOf(':')
      return colon >= 0 ? entry.slice(colon + 1).trim() : entry
    })

  // Fallback safety
  if (models.length === 0) {
    models.push('gpt-4o')
  }

  return models
}

// Cache the first model that succeeds so subsequent calls don't retry failing ones
let cachedPreferredModel: string | null = null
const failedModels = new Set<string>()

export async function tryOpenAIChatJson<T = any>(
  openai: any,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  extra: { temperature?: number; response_format?: { type: 'json_object' } }
): Promise<{ result: T | null; modelUsed?: string; error?: unknown }> {
  const baseModels = getOpenAIModelCandidates().filter(m => !failedModels.has(m))
  const models = cachedPreferredModel
    ? [cachedPreferredModel, ...baseModels.filter(m => m !== cachedPreferredModel)]
    : baseModels

  for (const model of models) {
    try {
      const completion = await openai.chat.completions.create({
        model,
        messages,
        response_format: extra.response_format || { type: 'json_object' },
        temperature: typeof extra.temperature === 'number' ? extra.temperature : 0.7,
      })
      const content = completion?.choices?.[0]?.message?.content || ''
      const parsed = content ? JSON.parse(content) as T : ({} as T)
      // Remember the model that worked
      cachedPreferredModel = model
      return { result: parsed, modelUsed: model }
    } catch (error) {
      // Try next model
      // eslint-disable-next-line no-console
      console.error('[aiModel] model failed, trying next', { model, error: error instanceof Error ? error.message : String(error) })
      failedModels.add(model)
    }
  }
  return { result: null, error: new Error('All models failed') }
}


