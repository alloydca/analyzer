'use client'

import { useEffect, useRef, useState } from 'react'
import AnalysisResults from './components/AnalysisResults'
import { ConsolidatedAnalysis, InitialAnalysis } from './types/analysis'

// Development mode - set to true to use mock data for UI iteration
const DEV_MODE = false

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
  // Lead capture gating - start with false to match server render
  const [leadSubmitted, setLeadSubmitted] = useState(DEV_MODE)
  const [isHydrated, setIsHydrated] = useState(false)
  const [leadName, setLeadName] = useState('')
  const [leadEmail, setLeadEmail] = useState('')
  const [leadWebsite, setLeadWebsite] = useState('')
  const [honeypot, setHoneypot] = useState('')
  
  // Shared link state
  const [showSharedLinkModal, setShowSharedLinkModal] = useState(false)
  const [sharedLinkData, setSharedLinkData] = useState({ email: '', url: '' })

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

    // Set timeout for initial response (5 seconds) - shopping sites should respond very quickly
    const initialTimeout = setTimeout(() => {
      if (eventSourceRef.current === es) {
        setError('This website is not responding quickly enough. It may not be a standard e-commerce site, may be blocking automated requests, or may have technical issues.')
        setSseMessages(prev => [...prev, { type: 'error', message: 'Timeout: Website not responding quickly enough' }])
        es.close()
        eventSourceRef.current = null
        setIsLoading(false)
      }
    }, 5000)

    // Set overall timeout (2 minutes)
    const overallTimeout = setTimeout(() => {
      if (eventSourceRef.current === es) {
        setError('Analysis timeout. This website might be too complex to analyze or may have content restrictions.')
        setSseMessages(prev => [...prev, { type: 'error', message: 'Analysis timed out after 2 minutes' }])
        es.close()
        eventSourceRef.current = null
        setIsLoading(false)
      }
    }, 120000)

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (!data || !data.type) return

        // Clear timeouts on first meaningful response
        clearTimeout(initialTimeout)
        
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
          clearTimeout(overallTimeout)
          setParseResults(prev => {
            const updated = prev ? { 
              ...prev, 
              analysis: data.analysis || null,
              // Update topProducts with images if provided
              topProducts: data.topProducts || prev.topProducts
            } : prev
            // Cache the completed analysis
            if (updated) {
              localStorage.setItem('analysisResults', JSON.stringify({
                parseResults: updated,
                url: normalizedUrl,
                leadEmail: leadEmail,
                timestamp: Date.now()
              }))
            }
            return updated
          })
          setSseMessages(prev => [...prev, { type: 'complete', message: 'Analysis complete' }])
          // Send analysis to Brevo with the URL that was analyzed
          sendAnalysisToBrevo(data.analysis, normalizedUrl)
          // Set window variables for sharing
          window.leadEmail = leadEmail
          window.analyzedUrl = normalizedUrl
          
          es.close()
          eventSourceRef.current = null
          setIsLoading(false)
        }
        if (data.type === 'error') {
          clearTimeout(initialTimeout)
          clearTimeout(overallTimeout)
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
      clearTimeout(initialTimeout)
      clearTimeout(overallTimeout)
      setError('Unable to analyze this website. It may be blocking our requests or have content that cannot be processed.')
      setSseMessages(prev => [...prev, { type: 'error', message: 'Connection error: Unable to analyze website' }])
      es.close()
      eventSourceRef.current = null
      setIsLoading(false)
    }
  }

  const handleLeadSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Honeypot check - if filled, it's likely a bot
    if (honeypot.trim() !== '') {
      console.log('Bot detected via honeypot')
      setError('Please try again')
      return
    }
    
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

  const rerunAnalysis = () => {
    // Clear localStorage cache
    localStorage.removeItem('analysisResults')
    
    // Reset all state to initial form
    setLeadSubmitted(false)
    setLeadName('')
    setLeadEmail('')
    setLeadWebsite('')
    setHoneypot('')
    setUrl('')
    setResults(null)
    setParseResults(null)
    setError(null)
    setExtractedLinks(null)
    setSseMessages([])
    setShowSharedLinkModal(false)
    setSharedLinkData({ email: '', url: '' })
    
    // Clear window variables
    if (typeof window !== 'undefined') {
      delete window.leadEmail
      delete window.analyzedUrl
    }
    
    // Clear URL parameters
    window.history.replaceState({}, document.title, window.location.pathname)
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

  // Handle hydration and check for cached data/shared links
  useEffect(() => {
    setIsHydrated(true)
    
    // Check for shared link
    const urlParams = new URLSearchParams(window.location.search)
    const sharedData = urlParams.get('s')
    if (sharedData) {
      setLeadSubmitted(true)
      return // Let the shared link useEffect handle the rest
    }
    
    // Check for cached analysis
    const cachedAnalysis = localStorage.getItem('analysisResults')
    if (cachedAnalysis) {
      try {
        const parsed = JSON.parse(cachedAnalysis)
        if (parsed.parseResults && parsed.url && parsed.leadEmail) {
          setParseResults(parsed.parseResults)
          setUrl(parsed.url)
          setLeadSubmitted(true)
          window.leadEmail = parsed.leadEmail
          window.analyzedUrl = parsed.url
        }
      } catch (error) {
        console.error('Failed to load cached analysis:', error)
        localStorage.removeItem('analysisResults')
      }
    }
  }, [])

  // Check for shared link on page load
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const sharedData = urlParams.get('s')
    
    if (sharedData) {
      try {
        const decoded = JSON.parse(atob(sharedData))
        const { email, url } = decoded
        
        if (email && url) {
          // Check if we have cached results for this URL
          const cachedAnalysis = localStorage.getItem('analysisResults')
          let shouldRunAnalysis = true
          
          if (cachedAnalysis) {
            try {
              const parsed = JSON.parse(cachedAnalysis)
              if (parsed.url === url && parsed.parseResults && parsed.parseResults.analysis) {
                // Use cached results
                setParseResults(parsed.parseResults)
                setUrl(url)
                setLeadSubmitted(true)
                window.leadEmail = email
                window.analyzedUrl = url
                shouldRunAnalysis = false
              }
            } catch (error) {
              console.error('Failed to load cached analysis for shared link:', error)
            }
          }
          
          if (shouldRunAnalysis) {
            // Show shared link modal and start processing
            setSharedLinkData({ email, url })
            setShowSharedLinkModal(true)
            setUrl(url)
            setLeadSubmitted(true)
            window.leadEmail = email
            window.analyzedUrl = url
            
            // Start analysis immediately (don't wait for OK)
            resetForNewRun()
            openParseSSE(url)
          } else {
            // Using cached results - just set up the state
            setUrl(url)
            setLeadSubmitted(true)
            window.leadEmail = email
            window.analyzedUrl = url
          }
          
          // Add note to original user's Brevo record that link was used
          fetch('/api/brevo-notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contactEmail: email,
              message: `Shared analysis link was accessed for ${url}`,
              noteType: 'shared-link-accessed'
            })
          })
        }
      } catch (error) {
        console.error('Invalid share link:', error)
      }
    }
  }, [])

  // Load mock data in dev mode
  useEffect(() => {
    if (DEV_MODE) {
      const mockData = {
        analysis: {
          executiveSummary: "This e-commerce site demonstrates strong product presentation with high-quality visuals and detailed descriptions. The brand positioning is clear and consistent across product pages, though there are opportunities to improve conversion elements and SEO optimization.",
          brandAlignment: {
            score: 85,
            summary: "Brand messaging is consistent and professional. Product descriptions align well with the premium positioning, though some pages could benefit from stronger brand voice integration."
          },
          conversionEffectiveness: {
            score: 72,
            summary: "Product pages have clear CTAs and good product information, but could improve with better urgency indicators, customer reviews integration, and streamlined checkout flow."
          },
          seoAiBestPractices: {
            score: 68,
            summary: "Basic SEO elements are present but could be enhanced. Product titles and descriptions need optimization for search visibility and AI understanding."
          },
          inferredBrandPositioning: "Premium outdoor gear focused on quality and durability",
          problematicContent: [
            {
              content: "Buy now before it's gone!",
              issue: "Generic urgency language that doesn't align with premium brand positioning",
              location: "Product page CTA section"
            }
          ]
        },
        topProducts: [
          {
            url: "https://example.com/products/premium-backpack",
            title: "Premium Hiking Backpack - 40L",
            reason: "High-traffic product with strong conversion metrics"
          },
          {
            url: "https://example.com/products/camping-tent",
            title: "4-Season Camping Tent",
            reason: "Featured product with comprehensive product information"
          },
          {
            url: "https://example.com/products/sleeping-bag",
            title: "Ultra-Light Sleeping Bag",
            reason: "Best-selling item with detailed specifications"
          }
        ],
        stats: {
          successful: 8,
          failed: 0,
          total: 8,
          productsCollected: 5,
          categoriesCollected: 3
        }
      }
      
      setParseResults({
        collections: [],
        topProducts: mockData.topProducts,
        analysis: mockData.analysis,
        stats: { collections: 3, productsFetched: 5 }
      })
      setUrl("https://example.com")
    }
  }, [])

  // Cleanup SSE on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
  }, [])

  // Show loading until hydrated to prevent hydration mismatch
  if (!isHydrated) {
    return (
      <div className="container">
        <div style={{
          maxWidth: '600px',
          margin: '0 auto',
          padding: '40px 20px',
          textAlign: 'center',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
        }}>
          <h1 style={{
            fontSize: '48px',
            fontWeight: '700',
            color: '#1a1a1a',
            marginBottom: '16px',
            lineHeight: '1.1'
          }}>Loading...</h1>
        </div>
      </div>
    )
  }

  return (
    <div className="container">
      
      {!leadSubmitted ? (
        <div style={{
          maxWidth: '600px',
          margin: '0 auto',
          padding: '40px 20px',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
        }}>
          <div style={{ marginBottom: '40px' }}>
            <h1 style={{
              fontSize: '48px',
              fontWeight: '700',
              color: '#1a1a1a',
              marginBottom: '24px',
              lineHeight: '1.1'
            }}>Let us help you out.</h1>
            <p style={{
              fontSize: '18px',
              color: '#6b7280',
              lineHeight: '1.6',
              marginBottom: '24px'
            }}>If you are looking for a quick review of your site, enter your information below and we'll do a quick analysis of your product content for brand alignment, conversion effectiveness, and SEO/AI best practices.</p>
            <p style={{
              fontSize: '16px',
              color: '#4b5563',
              lineHeight: '1.6'
            }}>Or, if you are looking for a deeper analysis of all your content you can{' '}
              <a 
                href="https://www.brandfuel.ai/contact" 
                target="_blank" 
                rel="noopener noreferrer"
                style={{ 
                  color: '#3b82f6', 
                  textDecoration: 'none',
                  fontWeight: '600'
                }}
                
              >
                contact us
              </a>
              {' or you can '}
              <a 
                href="https://app.brandfuel.ai/auth/signup" 
                target="_blank" 
                rel="noopener noreferrer"
                style={{ 
                  color: '#3b82f6', 
                  textDecoration: 'none',
                  fontWeight: '600'
                }}
                
              >
                sign up for our product today
              </a>
              {' and we\'ll analyze all of your Shopify product content.'}
            </p>
          </div>
          
          <p style={{
            fontSize: '14px',
            color: '#6b7280',
            lineHeight: '1.5',
            fontStyle: 'italic',
            marginBottom: '32px'
          }}>
            Please note: Our product content collector only works with sites that allow automatic browsing. Some sites block our analysis tools, but don't worry – we have other ways to help you improve your content!
          </p>
          
          <form onSubmit={handleLeadSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div>
              <label htmlFor="leadName" style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '8px'
              }}>Your Name *</label>
              <input
                type="text"
                id="leadName"
                value={leadName}
                onChange={(e) => setLeadName(e.target.value)}
                placeholder="Enter your full name"
                required
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontSize: '16px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  backgroundColor: '#ffffff',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => {
                  const target = e.target as HTMLInputElement
                  target.style.borderColor = '#3b82f6'
                  target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)'
                }}
                onBlur={(e) => {
                  const target = e.target as HTMLInputElement
                  target.style.borderColor = '#d1d5db'
                  target.style.boxShadow = 'none'
                }}
              />
            </div>
            
            <div>
              <label htmlFor="leadEmail" style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '8px'
              }}>Email Address *</label>
              <input
                type="email"
                id="leadEmail"
                value={leadEmail}
                onChange={(e) => setLeadEmail(e.target.value)}
                placeholder="Enter your email address"
                required
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontSize: '16px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  backgroundColor: '#ffffff',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => {
                  const target = e.target as HTMLInputElement
                  target.style.borderColor = '#3b82f6'
                  target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)'
                }}
                onBlur={(e) => {
                  const target = e.target as HTMLInputElement
                  target.style.borderColor = '#d1d5db'
                  target.style.boxShadow = 'none'
                }}
              />
            </div>
            
            <div>
              <label htmlFor="leadWebsite" style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '8px'
              }}>Website URL *</label>
              <input
                type="text"
                id="leadWebsite"
                value={leadWebsite}
                onChange={(e) => setLeadWebsite(e.target.value)}
                placeholder="example.com or https://example.com"
                required
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontSize: '16px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  backgroundColor: '#ffffff',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => {
                  const target = e.target as HTMLInputElement
                  target.style.borderColor = '#3b82f6'
                  target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)'
                }}
                onBlur={(e) => {
                  const target = e.target as HTMLInputElement
                  target.style.borderColor = '#d1d5db'
                  target.style.boxShadow = 'none'
                }}
              />
            </div>
            
            {/* Honeypot field - hidden with CSS */}
            <div className="hp-field">
              <label htmlFor="website_url">Website</label>
              <input
                type="text"
                id="website_url"
                name="website_url"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
                tabIndex={-1}
                autoComplete="off"
              />
            </div>
            
            {error && (
              <div style={{
                padding: '12px 16px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                color: '#dc2626',
                fontSize: '14px',
                fontWeight: '500'
              }}>
                {error}
              </div>
            )}
            
            <button 
              type="submit" 
              style={{
                width: '100%',
                padding: '16px 24px',
                fontSize: '16px',
                fontWeight: '600',
                color: '#ffffff',
                backgroundColor: '#3b82f6',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'background-color 0.2s, transform 0.1s',
                outline: 'none'
              }}
              
            >
              Get Free Analysis
            </button>
          </form>
        </div>
      ) : (
        <>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <h1>Product Content Analyzer</h1>
            <p style={{ color: '#555' }}>Analysis in progress for {url}</p>
            {error && (
              <div style={{ 
                maxWidth: '600px',
                margin: '40px auto',
                padding: '32px',
                backgroundColor: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: '16px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
              }}>
                {error.includes('blocking automated requests') ? (
                  <>
                    <div style={{ 
                      textAlign: 'center',
                      marginBottom: '32px'
                    }}>
                      <div style={{ 
                        fontSize: '48px',
                        marginBottom: '16px'
                      }}>🚫</div>
                      <h2 style={{ 
                        fontSize: '28px', 
                        fontWeight: '700', 
                        color: '#1a1a1a',
                        marginBottom: '12px',
                        lineHeight: '1.2'
                      }}>
                        Site Access Blocked
                      </h2>
                    </div>
                    
                    <div style={{ 
                      fontSize: '16px',
                      lineHeight: '1.6', 
                      color: '#4b5563',
                      marginBottom: '24px',
                      textAlign: 'center'
                    }}>
                      It looks like the site you would like us to analyze is blocking us from accessing the content.
                    </div>
                    
                    <div style={{ 
                      fontSize: '16px',
                      lineHeight: '1.6', 
                      color: '#4b5563',
                      marginBottom: '32px',
                      textAlign: 'center'
                    }}>
                      But don't worry! If you want help analyzing and improving your product content we have a lot of ways we can help.
                    </div>
                    
                    <div style={{
                      backgroundColor: '#f8fafc',
                      padding: '24px',
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      marginBottom: '32px'
                    }}>
                      <p style={{ 
                        fontSize: '16px',
                        lineHeight: '1.6', 
                        color: '#374151',
                        marginBottom: '16px',
                        fontWeight: '500'
                      }}>
                        If you want to speak to someone about how Brandfuel can help:
                      </p>
                      <div style={{ marginBottom: '12px' }}>
                        <a 
                          href="https://www.brandfuel.ai/contact" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          style={{ 
                            color: '#3b82f6', 
                            textDecoration: 'none',
                            fontWeight: '600',
                            fontSize: '16px'
                          }}
                          
                        >
                          Contact us here
                        </a>
                        <span style={{ color: '#6b7280', margin: '0 8px' }}>or email</span>
                        <a 
                          href="mailto:sales@brandfuel.ai"
                          style={{ 
                            color: '#3b82f6', 
                            textDecoration: 'none',
                            fontWeight: '600',
                            fontSize: '16px'
                          }}
                          
                        >
                          sales@brandfuel.ai
                        </a>
                      </div>
                    </div>
                    
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ 
                        fontSize: '16px',
                        lineHeight: '1.6', 
                        color: '#374151',
                        marginBottom: '20px'
                      }}>
                        Or if you want us to evaluate your full Shopify catalog:
                      </p>
                      <a 
                        href="https://app.brandfuel.ai/auth/signup" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        style={{ 
                          display: 'inline-block',
                          padding: '16px 32px',
                          fontSize: '16px',
                          fontWeight: '600',
                          color: '#ffffff',
                          backgroundColor: '#3b82f6',
                          textDecoration: 'none',
                          borderRadius: '8px',
                          transition: 'background-color 0.2s, transform 0.1s'
                        }}
                        
                      >
                        Sign Up for Our Product Today!
                      </a>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ 
                      textAlign: 'center',
                      marginBottom: '24px'
                    }}>
                      <div style={{ 
                        fontSize: '48px',
                        marginBottom: '16px'
                      }}>⚠️</div>
                      <h2 style={{ 
                        fontSize: '24px', 
                        fontWeight: '700', 
                        color: '#1a1a1a',
                        marginBottom: '12px'
                      }}>
                        Analysis Failed
                      </h2>
                    </div>
                    <div style={{ 
                      fontSize: '16px',
                      lineHeight: '1.6', 
                      color: '#4b5563',
                      marginBottom: '24px',
                      textAlign: 'center'
                    }}>
                      {error}
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <button 
                        onClick={() => window.location.reload()} 
                        style={{ 
                          padding: '12px 24px',
                          fontSize: '16px',
                          fontWeight: '600',
                          color: '#ffffff',
                          backgroundColor: '#dc2626',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          transition: 'background-color 0.2s'
                        }}
                        
                      >
                        Try Again
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
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
            <>
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
              <div style={{ 
                textAlign: 'center', 
                marginTop: '40px', 
                paddingTop: '20px', 
                borderTop: '1px solid #e5e7eb' 
              }}>
                <button 
                  onClick={rerunAnalysis}
                  style={{
                    padding: '12px 24px',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#6b7280',
                    backgroundColor: 'transparent',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  
                >
                  Re-run Analysis
                </button>
              </div>
            </>
          )}
        </>
      )}

      {results && (
        <>
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
          <div style={{ 
            textAlign: 'center', 
            marginTop: '40px', 
            paddingTop: '20px', 
            borderTop: '1px solid #e5e7eb' 
          }}>
            <button 
              onClick={rerunAnalysis}
              style={{
                padding: '12px 24px',
                fontSize: '14px',
                fontWeight: '600',
                color: '#6b7280',
                backgroundColor: 'transparent',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              
            >
              Re-run Analysis
            </button>
          </div>
        </>
      )}

      {/* Shared Link Modal */}
      {showSharedLinkModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001 }}>
          <div style={{ background: '#ffffff', borderRadius: 12, padding: 32, width: 'min(500px, 90vw)', boxShadow: '0 10px 30px rgba(0,0,0,0.2)', textAlign: 'center' }}>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16, color: '#1a1a1a' }}>You've Been Invited!</h2>
            <p style={{ fontSize: 16, color: '#6b7280', lineHeight: 1.6, marginBottom: 24 }}>
              <strong>{sharedLinkData.email}</strong> invited you to review the content from <strong>{new URL(sharedLinkData.url).hostname}</strong>. Click below to see the analysis.
            </p>
            <button 
              onClick={() => setShowSharedLinkModal(false)}
              style={{
                padding: '12px 24px',
                fontSize: 16,
                fontWeight: 600,
                color: '#ffffff',
                backgroundColor: '#ff4500',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              
            >
              Continue to Analysis
            </button>
          </div>
        </div>
      )}

      {/* Progress Modal for Parse Mode (SSE) */}
      {isLoading && analysisMode === 'parse' && !showSharedLinkModal && (
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