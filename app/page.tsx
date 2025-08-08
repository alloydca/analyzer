'use client'

import { useEffect, useRef, useState } from 'react'
import AnalysisResults from './components/AnalysisResults'
import { ConsolidatedAnalysis, InitialAnalysis } from './types/analysis'

type AnalysisMode = 'openai' | 'parse'

interface ExtractedLink {
  url: string
  text: string
  category: 'likely-category' | 'likely-product' | 'other'
}

export default function Home() {
  const [url, setUrl] = useState('')
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('openai')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [extractedLinks, setExtractedLinks] = useState<ExtractedLink[] | null>(null)
  interface CollectionGroup {
    collection: ExtractedLink;
    products: ExtractedLink[];
  }

  const [parseResults, setParseResults] = useState<{
    collections: CollectionGroup[];
    topProducts: Array<{
      url: string;
      title: string;
      reason?: string;
    }>;
    analysis: ConsolidatedAnalysis | null;
    stats?: {
      collections: number;
      productsFetched: number;
    };
  } | null>(null)

  // SSE progress state
  const [sseMessages, setSseMessages] = useState<Array<{ type: string; message?: string; category?: string; step?: number; total?: number }>>([])
  const eventSourceRef = useRef<EventSource | null>(null)


  const [results, setResults] = useState<{
    initialResults: InitialAnalysis;
    analysis: ConsolidatedAnalysis;
    stats?: {
      successful: number;
      failed: number;
      total: number;
      productsCollected?: number;
      categoriesCollected?: number;
    };
  } | null>(null)

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(e.target.value)
    setError(null)
  }

  const handleUrlBlur = () => {
    if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
      setUrl('https://' + url)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const normalizeUrl = (value: string) => {
      const trimmed = value.trim()
      if (!trimmed) return ''
      return trimmed.startsWith('http://') || trimmed.startsWith('https://')
        ? trimmed
        : `https://${trimmed}`
    }

    const normalizedUrl = normalizeUrl(url)
    if (!normalizedUrl) {
      setError('Please enter a website URL')
      return
    }
    // Ensure state reflects the normalized URL for subsequent interactions
    if (normalizedUrl !== url) {
      setUrl(normalizedUrl)
    }

    setIsLoading(true)
    setError(null)
    setResults(null)
    setParseResults(null)
    setExtractedLinks(null)

    try {
      if (analysisMode === 'openai') {
        // Current OpenAI approach
        const response = await fetch('/api/analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ url: normalizedUrl })
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Analysis failed')
        }

        const data = await response.json()
        setResults(data)
      } else {
        // Parse homepage approach with SSE streaming
        try {
          // Close any existing stream
          if (eventSourceRef.current) {
            eventSourceRef.current.close()
            eventSourceRef.current = null
          }

          const sseUrl = `/api/parse-and-analyze-stream?url=${encodeURIComponent(normalizedUrl)}`
          const es = new EventSource(sseUrl)
          eventSourceRef.current = es
          setSseMessages([{ type: 'start', message: 'Starting analysis…' }])

          es.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data)
              if (!data || !data.type) return

              if (data.type === 'start') {
                setSseMessages(prev => [...prev, { type: 'start', message: data.message }])
              }
              if (data.type === 'initial') {
                // Show top products immediately
                setParseResults({
                  collections: data.collections || [],
                  topProducts: data.topProducts || [],
                  analysis: null,
                  stats: data.stats || undefined,
                })
                setSseMessages(prev => [...prev, { type: 'initial', message: 'Top products selected' }])
              }
              if (data.type === 'progress') {
                setSseMessages(prev => [...prev, { type: 'progress', message: data.message, category: data.category, step: data.step, total: data.total }])
              }
              if (data.type === 'category_complete') {
                setSseMessages(prev => [...prev, { type: 'category_complete', message: `${data.category} complete`, category: data.category, step: data.step, total: data.total }])
              }
              if (data.type === 'complete') {
                // Final analysis
                setParseResults(prev => prev ? { ...prev, analysis: data.analysis || null } : prev)
                setSseMessages(prev => [...prev, { type: 'complete', message: 'Analysis complete' }])
                es.close()
                eventSourceRef.current = null
                setIsLoading(false)
              }
              if (data.type === 'error') {
                setError(data.error || 'Streaming failed')
                setSseMessages(prev => [...prev, { type: 'error', message: data.error }])
                es.close()
                eventSourceRef.current = null
                setIsLoading(false)
              }
            } catch (_) {
              // ignore malformed events
            }
          }

          es.onerror = () => {
            setError('Streaming connection error')
            setSseMessages(prev => [...prev, { type: 'error', message: 'Streaming connection error' }])
            es.close()
            eventSourceRef.current = null
            setIsLoading(false)
          }
        } catch (streamErr) {
          throw streamErr
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      // If streaming parse mode fails before SSE starts, close loading state
      if (analysisMode === 'parse') {
        setIsLoading(false)
      }
    } finally {
      // Do not auto-stop loading for SSE; it will stop on complete/error events
      if (analysisMode === 'openai') {
        setIsLoading(false)
      }
    }
  }

  const cancelStreaming = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    setIsLoading(false)
    setSseMessages(prev => [...prev, { type: 'error', message: 'Cancelled by user' }])
  }

  // Debug: observe parseResults state changes
  useEffect(() => {
    if (parseResults) {
      console.log('[client] parseResults state updated', {
        hasTopProducts: !!parseResults.topProducts,
        topProductsLength: parseResults.topProducts?.length || 0,
        firstProduct: parseResults.topProducts?.[0],
        hasAnalysis: !!parseResults.analysis,
        stats: parseResults.stats
      })
    }
  }, [parseResults])

  // Cleanup SSE on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
  }, [])

  return (
    <div className="container">
      
      <div className="form">
        <h1>SEO Website Analyzer</h1>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="url">Website URL</label>
            <input
              type="text"
              id="url"
              value={url}
              onChange={handleUrlChange}
              onBlur={handleUrlBlur}
              placeholder="example.com or https://example.com"
              required
            />
          </div>

          <div className="form-group">
            <label>Analysis Approach</label>
            <div style={{ display: 'flex', gap: '20px', marginTop: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="analysisMode"
                  value="openai"
                  checked={analysisMode === 'openai'}
                  onChange={(e) => setAnalysisMode(e.target.value as AnalysisMode)}
                  style={{ marginRight: '8px' }}
                />
                Start with OpenAI
              </label>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="analysisMode"
                  value="parse"
                  checked={analysisMode === 'parse'}
                  onChange={(e) => setAnalysisMode(e.target.value as AnalysisMode)}
                  style={{ marginRight: '8px' }}
                />
                Parse the home page
              </label>
            </div>
          </div>

          {error && <div className="error">{error}</div>}

          <button
            type="submit"
            disabled={isLoading}
            className="btn"
          >
            {isLoading ? (analysisMode === 'openai' ? 'Analyzing...' : 'Parsing...') : (analysisMode === 'openai' ? 'Analyze Website' : 'Parse Homepage')}
          </button>
        </form>
      </div>



      {extractedLinks && (
        <div>
          <div className="section">
            <h2>Extracted Links from Homepage</h2>
            <p>Found {extractedLinks.length} links. Click on likely category pages to analyze:</p>
            
            <div style={{ marginTop: '20px' }}>
              <h3>Likely Category Pages</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                {extractedLinks
                  .filter(link => link.category === 'likely-category')
                  .map((link, index) => (
                    <a
                      key={index}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'block',
                        padding: '12px',
                        border: '1px solid #ddd',
                        borderRadius: '8px',
                        textDecoration: 'none',
                        color: '#333',
                        backgroundColor: '#f9f9f9',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#f9f9f9'}
                    >
                      <strong>{link.text}</strong>
                      <br />
                      <small style={{ color: '#666' }}>{link.url}</small>
                    </a>
                  ))}
              </div>
            </div>

            <div style={{ marginTop: '20px' }}>
              <h3>Other Links</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px', maxHeight: '300px', overflowY: 'auto' }}>
                {extractedLinks
                  .filter(link => link.category !== 'likely-category')
                  .slice(0, 20)
                  .map((link, index) => (
                    <a
                      key={index}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'block',
                        padding: '8px',
                        border: '1px solid #eee',
                        borderRadius: '4px',
                        textDecoration: 'none',
                        color: '#666',
                        fontSize: '14px'
                      }}
                    >
                      {link.text} - {link.url}
                    </a>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {parseResults && (
        <>
          {/* Removed DEBUG - API Response block */}
          
          {/* Removed top-level product cards to avoid duplication.
              Products will render inside AnalysisResults only. */}
          
          {parseResults.analysis && (
            <AnalysisResults
              analysis={parseResults.analysis}
              topProducts={parseResults.topProducts}
              stats={parseResults.stats ? {
                successful: parseResults.stats.productsFetched,
                failed: 0,
                total: parseResults.stats.productsFetched,
                productsCollected: parseResults.stats.productsFetched,
                categoriesCollected: parseResults.stats.collections
              } : undefined}
            />
          )}
        </>
      )}

      {results && (
        <AnalysisResults
          initialResults={results.initialResults}
          analysis={results.analysis}
          topProducts={results.initialResults?.products?.map(product => ({
            url: product.url,
            title: product.title,
            description: product.description
          }))}
          error={error || undefined}
          stats={results.stats}
        />
      )}

      {/* Progress Modal for Parse Mode (SSE) */}
      {isLoading && analysisMode === 'parse' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#ffffff', borderRadius: 12, padding: 20, width: 'min(640px, 92vw)', maxHeight: '80vh', overflow: 'auto', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Analyzing website…</h2>
            <p style={{ fontSize: 14, color: '#555', marginBottom: 12 }}>We’re collecting products and generating your analysis. This can take a couple of minutes.</p>
            <div style={{ fontSize: 13, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
              {(sseMessages.slice(-1)[0]?.message || 'Working…')}
            </div>
            {sseMessages.length > 1 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Recent updates</div>
                <ul style={{ listStyle: 'disc', paddingLeft: 18, fontSize: 12, color: '#374151' }}>
                  {sseMessages.slice(-8).map((m, idx) => (
                    <li key={idx}>
                      {m.message || m.type} {m.category ? `- ${m.category}` : ''} {m.step && m.total ? `(${m.step}/${m.total})` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button onClick={cancelStreaming} className="btn" style={{ background: '#ef4444' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 