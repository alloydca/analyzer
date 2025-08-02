'use client'

import { useState } from 'react'
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
    analysis: ConsolidatedAnalysis;
    stats?: {
      collections: number;
      productsFetched: number;
    };
  } | null>(null)
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
    
    if (!url.trim()) {
      setError('Please enter a website URL')
      return
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
          body: JSON.stringify({ url: url.trim() })
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Analysis failed')
        }

        const data = await response.json()
        setResults(data)
      } else {
        // Parse homepage approach (collections and products)
        const response = await fetch('/api/parse-and-analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ url: url.trim() })
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to parse homepage')
        }

        const data = await response.json()
        setParseResults(data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container">
      <div className="form">
        <h1>SEO Website Analyzer</h1>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="url">Website URL</label>
            <input
              type="url"
              id="url"
              value={url}
              onChange={handleUrlChange}
              onBlur={handleUrlBlur}
              placeholder="example.com"
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

      {results && (
        <AnalysisResults
          initialResults={results.initialResults}
          analysis={results.analysis}
          error={error || undefined}
          stats={results.stats}
        />
      )}
    </div>
  )
} 