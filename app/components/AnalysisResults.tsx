import React from 'react'
import { InitialAnalysis, ConsolidatedAnalysis } from '../types/analysis'
import { errorMessages } from '../lib/errorMessages'
import { marketingMessage } from '../lib/marketingMessage'

interface Product {
  url: string
  title: string
  description?: string
  reason?: string
}

interface AnalysisResultsProps {
  initialResults?: InitialAnalysis
  analysis: ConsolidatedAnalysis
  topProducts?: Product[]
  error?: string
  stats?: {
    successful: number
    failed: number
    total: number
    productsCollected?: number
    categoriesCollected?: number
  }
}

export default function AnalysisResults({ initialResults, analysis, topProducts, error, stats }: AnalysisResultsProps) {
  const isForbiddenError = error?.toLowerCase().includes('forbidden')

  if (isForbiddenError) {
    return (
      <div>
        <div className="section">
          <h2 className="error-title">Website Access Restricted</h2>
          <p>{errorMessages.forbidden.message}</p>
          <div className="marketing-message">
            <p>{marketingMessage.message}</p>
          </div>
        </div>
      </div>
    )
  }

  // Helper function to get score color based on score
  const getScoreColor = (score: number) => {
    if (score >= 80) return '#22c55e' // green
    if (score >= 60) return '#f59e0b' // yellow
    if (score >= 40) return '#f97316' // orange
    return '#ef4444' // red
  }

  // Helper function to get score label
  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent'
    if (score >= 60) return 'Good'
    if (score >= 40) return 'Fair'
    return 'Needs Improvement'
  }

  return (
    <div>
      {/* Analysis Statistics */}
      {stats && (
        <div className="section">
          <h2>Analysis Summary</h2>
          <p>
            Successfully analyzed <strong>{stats.successful}</strong> pages
            {stats.productsCollected !== undefined && stats.categoriesCollected !== undefined && (
              <span> ({stats.productsCollected} products, {stats.categoriesCollected} categories)</span>
            )}
          </p>
        </div>
      )}

      {/* Executive Summary */}
      <div className="section">
        <h2>Executive Summary</h2>
        <p>{analysis.executiveSummary}</p>
      </div>

      {/* Inferred Brand Positioning */}
      <div className="section">
        <h2>Inferred Brand Positioning</h2>
        <p style={{ fontStyle: 'italic', backgroundColor: '#f8f9fa', padding: '16px', borderRadius: '8px', border: '1px solid #e9ecef' }}>
          {analysis.inferredBrandPositioning}
        </p>
      </div>

      {/* Brand Alignment Score */}
      <div className="section">
        <h2>Brand Alignment</h2>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ 
            fontSize: '2rem', 
            fontWeight: 'bold', 
            color: getScoreColor(analysis.brandAlignment.score),
            marginRight: '16px'
          }}>
            {analysis.brandAlignment.score}/100
          </div>
          <div style={{ 
            padding: '4px 12px', 
            borderRadius: '16px', 
            backgroundColor: getScoreColor(analysis.brandAlignment.score) + '20',
            color: getScoreColor(analysis.brandAlignment.score),
            fontWeight: '600'
          }}>
            {getScoreLabel(analysis.brandAlignment.score)}
          </div>
        </div>
        <p>{analysis.brandAlignment.summary}</p>
      </div>

      {/* Conversion Effectiveness Score */}
      <div className="section">
        <h2>Conversion Effectiveness</h2>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ 
            fontSize: '2rem', 
            fontWeight: 'bold', 
            color: getScoreColor(analysis.conversionEffectiveness.score),
            marginRight: '16px'
          }}>
            {analysis.conversionEffectiveness.score}/100
          </div>
          <div style={{ 
            padding: '4px 12px', 
            borderRadius: '16px', 
            backgroundColor: getScoreColor(analysis.conversionEffectiveness.score) + '20',
            color: getScoreColor(analysis.conversionEffectiveness.score),
            fontWeight: '600'
          }}>
            {getScoreLabel(analysis.conversionEffectiveness.score)}
          </div>
        </div>
        <p>{analysis.conversionEffectiveness.summary}</p>
      </div>

      {/* SEO and AI Best Practices Score */}
      <div className="section">
        <h2>SEO and AI Best Practices</h2>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ 
            fontSize: '2rem', 
            fontWeight: 'bold', 
            color: getScoreColor(analysis.seoAiBestPractices.score),
            marginRight: '16px'
          }}>
            {analysis.seoAiBestPractices.score}/100
          </div>
          <div style={{ 
            padding: '4px 12px', 
            borderRadius: '16px', 
            backgroundColor: getScoreColor(analysis.seoAiBestPractices.score) + '20',
            color: getScoreColor(analysis.seoAiBestPractices.score),
            fontWeight: '600'
          }}>
            {getScoreLabel(analysis.seoAiBestPractices.score)}
          </div>
        </div>
        <p>{analysis.seoAiBestPractices.summary}</p>
      </div>

      {/* Products Analyzed */}
      {(topProducts?.length > 0 || initialResults?.products?.length > 0) && (
        <div className="section">
          <h2>Products Analyzed ({(topProducts || initialResults?.products || []).length})</h2>
          <p>These are the products that were actually analyzed to generate the above insights:</p>
          <div style={{ 
            display: 'grid', 
            gap: '16px', 
            marginTop: '16px',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))'
          }}>
            {(topProducts || initialResults?.products || []).map((product, index) => (
              <div 
                key={index} 
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  padding: '16px',
                  backgroundColor: '#f9fafb'
                }}
              >
                <h3 style={{
                  margin: '0 0 8px 0',
                  fontSize: '1.1rem',
                  fontWeight: '600'
                }}>
                  <a 
                    href={product.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{
                      color: '#1f2937',
                      textDecoration: 'none'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.textDecoration = 'underline'}
                    onMouseOut={(e) => e.currentTarget.style.textDecoration = 'none'}
                  >
                    {product.title}
                  </a>
                </h3>
                {(product.description || product.reason) && (
                  <p style={{
                    margin: '0 0 8px 0',
                    color: '#6b7280',
                    fontSize: '0.9rem'
                  }}>
                    {product.description || product.reason}
                  </p>
                )}
                <div style={{
                  fontSize: '0.8rem',
                  color: '#9ca3af',
                  wordBreak: 'break-all'
                }}>
                  {product.url}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
} 