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
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('parse')
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
  // Lead capture gating
  const [leadSubmitted, setLeadSubmitted] = useState(false)
  const [leadName, setLeadName] = useState('')
  const [leadEmail, setLeadEmail] = useState('')
  const [leadWebsite, setLeadWebsite] = useState('')

  const normalizeUrlValue = (value: string) => {
    const trimmed = (value || '').trim()
    if (!trimmed) return ''
    return trimmed.startsWith('http://') || trimmed.startsWith('https://')
      ? trimmed
      : `https://${trimmed}`
  }

  const resetForNewRun = () => {
    setIsLoading(true)
    setError(null)
    setResults(null)
    setParseResults(null)
    setExtractedLinks(null)
    setSseMessages([])
  }

  const openParseSSE = (normalizedUrl: string) => {
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
          setParseResults({
            collections: data.collections || [],
            topProducts: data.topProducts || [],
            analysis: null,
            stats: data.stats || undefined,
          })
          setSseMessages(prev => [...prev, { type: 'initial', message: 'Top products selected' }])
        }
        if (data.type === 'products_fetched') {
          setSseMessages(prev => [...prev, { type: 'products_fetched', message: `Fetched ${data.count} product pages` }])
          // Update stats with the actual number of products fetched
          setParseResults(prev => prev ? { 
            ...prev, 
            stats: { 
              ...prev.stats,
              productsFetched: data.count 
            }
          } : prev)
        }
        if (data.type === 'progress') {
          setSseMessages(prev => [...prev, { type: 'progress', message: data.message, category: data.category, step: data.step, total: data.total }])
        }
        if (data.type === 'category_complete') {
          setSseMessages(prev => [...prev, { type: 'category_complete', message: `${data.category} complete`, category: data.category, step: data.step, total: data.total }])
        }
        if (data.type === 'complete') {
          setParseResults(prev => prev ? { ...prev, analysis: data.analysis || null } : prev)
          setSseMessages(prev => [...prev, { type: 'complete', message: 'Analysis complete' }])
          // Send analysis to Brevo with the URL that was analyzed
          sendAnalysisToBrevo(data.analysis, normalizedUrl)
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
  }

  const handleLeadSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Basic validation
    if (!leadName.trim()) {
      setError('Please enter your name')
      return
    }
    if (!leadEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(leadEmail)) {
      setError('Please enter a valid email address')
      return
    }
    const normalized = normalizeUrlValue(leadWebsite)
    if (!normalized) {
      setError('Please enter a website URL')
      return
    }
    // Post lead to backend which forwards to Brevo
    ;(async () => {
      try {
        const resp = await fetch('/api/lead', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: leadName.trim(), email: leadEmail.trim(), url: normalized })
        })
        if (!resp.ok) {
          const txt = await resp.text()
          setError(txt || 'Failed to submit your info')
          return
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to submit your info')
        return
      }
      setUrl(normalized)
      setLeadSubmitted(true)
      resetForNewRun()
      openParseSSE(normalized)
    })()
  }


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
    
    const normalizedUrl = normalizeUrlValue(url)
    if (!normalizedUrl) {
      setError('Please enter a website URL')
      return
    }
    // Ensure state reflects the normalized URL for subsequent interactions
    if (normalizedUrl !== url) {
      setUrl(normalizedUrl)
    }

    resetForNewRun()

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
        openParseSSE(normalizedUrl)
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

  const sendAnalysisToBrevo = async (analysis: any, analysisUrl?: string) => {
    if (!analysis || !leadEmail) return
    
    const websiteUrl = analysisUrl || url
    
    try {
      // Send structured JSON instead of unstructured text
      const structuredAnalysis = {
        type: 'product-content-analysis',
        websiteUrl: websiteUrl,
        analysisDate: new Date().toISOString().split('T')[0],
        executiveSummary: analysis.executiveSummary || '',
        brandPositioning: analysis.inferredBrandPositioning || '',
        scores: {
          brandAlignment: {
            score: analysis.brandAlignment?.score || 0,
            summary: analysis.brandAlignment?.summary || ''
          },
          conversionEffectiveness: {
            score: analysis.conversionEffectiveness?.score || 0,
            summary: analysis.conversionEffectiveness?.summary || ''
          },
          seoAiBestPractices: {
            score: analysis.seoAiBestPractices?.score || 0,
            summary: analysis.seoAiBestPractices?.summary || ''
          }
        },
        overallScore: Math.round(((analysis.brandAlignment?.score || 0) + 
                                 (analysis.conversionEffectiveness?.score || 0) + 
                                 (analysis.seoAiBestPractices?.score || 0)) / 3)
      }

      await fetch('/api/brevo-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactEmail: leadEmail,
          message: JSON.stringify(structuredAnalysis, null, 2),
          noteType: 'product-analysis-json',
          additionalData: structuredAnalysis
        })
      })
    } catch (error) {
      console.error('Failed to send analysis to Brevo:', error)
      // Don't show error to user - this is background operation
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
      
      {!leadSubmitted ? (
        <div className="form">
          <h1>Product Content Analyzer</h1>
          <p style={{ marginBottom: '20px', color: '#555' }}>Get a comprehensive analysis of your product pages for brand alignment, conversion effectiveness, and SEO/AI best practices.</p>
          <form onSubmit={handleLeadSubmit}>
            <div className="form-group">
              <label htmlFor="leadName">Your Name</label>
              <input
                type="text"
                id="leadName"
                value={leadName}
                onChange={(e) => setLeadName(e.target.value)}
                placeholder="Enter your full name"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="leadEmail">Email Address</label>
              <input
                type="email"
                id="leadEmail"
                value={leadEmail}
                onChange={(e) => setLeadEmail(e.target.value)}
                placeholder="Enter your email address"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="leadWebsite">Website URL</label>
              <input
                type="text"
                id="leadWebsite"
                value={leadWebsite}
                onChange={(e) => setLeadWebsite(e.target.value)}
                placeholder="example.com or https://example.com"
                required
              />
            </div>
            {error && <div className="error">{error}</div>}
            <button type="submit" className="btn">
              Get Free Analysis
            </button>
          </form>
        </div>
      ) : (
        <>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <h1>Product Content Analyzer</h1>
            <p style={{ color: '#555' }}>Analysis in progress for {url}</p>
          </div>
        </>
      )}



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
                successful: parseResults.stats.productsFetched + parseResults.stats.collections,
                failed: 0,
                total: parseResults.stats.productsFetched + parseResults.stats.collections,
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
            {/* Step checklist */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
              {[
                { key: 'start', label: 'Start analysis' },
                { key: 'initial', label: 'Select top products' },
                { key: 'products_fetched', label: 'Fetch product pages' },
                { key: 'progress-brand', label: 'Analyze Brand Alignment' },
                { key: 'progress-conv', label: 'Analyze Conversion Effectiveness' },
                { key: 'progress-seo', label: 'Analyze SEO and AI Best Practices' },
                { key: 'complete', label: 'Finalize report' }
              ].map((step) => {
                const hasStep = sseMessages.some(m => 
                  m.type === step.key ||
                  (step.key.startsWith('progress-') && m.type === 'category_complete' && (
                    (step.key === 'progress-brand' && m.category === 'Brand Alignment') ||
                    (step.key === 'progress-conv' && m.category === 'Conversion Effectiveness') ||
                    (step.key === 'progress-seo' && m.category === 'SEO and AI Best Practices')
                  ))
                )
                const isCurrent = !hasStep && (
                  step.key === 'start' ||
                  (step.key === 'initial' && sseMessages.some(m => m.type === 'start')) ||
                  (step.key === 'products_fetched' && sseMessages.some(m => m.type === 'initial')) ||
                  (step.key === 'progress-brand' && sseMessages.some(m => m.type === 'products_fetched')) ||
                  (step.key === 'progress-conv' && sseMessages.some(m => m.type === 'category_complete' && m.category === 'Brand Alignment')) ||
                  (step.key === 'progress-seo' && sseMessages.some(m => m.type === 'category_complete' && m.category === 'Conversion Effectiveness')) ||
                  (step.key === 'complete' && sseMessages.some(m => m.type === 'category_complete' && m.category === 'SEO and AI Best Practices'))
                )
                return (
                  <div key={step.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
                    <div style={{ width: 18, height: 18, borderRadius: 9999, border: '2px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', background: hasStep ? '#22c55e' : (isCurrent ? '#dbeafe' : '#fff') }}>
                      {hasStep ? (
                        <span style={{ color: '#fff', fontSize: 12 }}>✓</span>
                      ) : (
                        <span style={{ color: isCurrent ? '#1d4ed8' : '#9ca3af', fontSize: 10 }}>•</span>
                      )}
                    </div>
                    <div style={{ fontSize: 14, color: '#111827', fontWeight: hasStep ? 600 : 400 }}>{step.label}</div>
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button onClick={cancelStreaming} className="btn" style={{ background: '#ef4444' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 