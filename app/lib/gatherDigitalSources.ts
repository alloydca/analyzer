export interface DigitalSource {
  type: string
  source: string
  content: string
  url: string
}

export function createDigitalSource(
  type: string, 
  source: string, 
  content: string, 
  url: string
): DigitalSource {
  return {
    type,
    source,
    content,
    url
  }
}
