import React from 'react'
import { InitialAnalysis, ConsolidatedAnalysis } from '../types/analysis'
import { errorMessages } from '../lib/errorMessages'
import { marketingMessage } from '../lib/marketingMessage'

interface Product {
  url: string
  title: string
  description?: string
  reason?: string
  image?: string
}

interface AnalysisResultsProps {
  initialResults?: InitialAnalysis
  analysis: ConsolidatedAnalysis | null
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
    if (score >= 90) return '#22c55e' // green - Excellent
    if (score >= 80) return '#f59e0b' // yellow - Good
    return '#ef4444' // red - Poor
  }

  // Helper function to get score label
  const getScoreLabel = (score: number) => {
    if (score >= 90) return 'Excellent'
    if (score >= 80) return 'Good'
    return 'Poor'
  }

  // If analysis is missing, still show products if present
  if (!analysis) {
    return (
      <div>
        {topProducts && topProducts.length > 0 ? (
          <div className="section">
            <h2>Products Analyzed</h2>
            <p>The following {topProducts.length} products were analyzed for this report:</p>
            <div style={{ display: 'grid', gap: '12px', marginTop: '16px' }}>
              {topProducts.map((product, index) => (
                <div 
                  key={index}
                  style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    padding: '16px',
                    backgroundColor: '#f9fafb'
                  }}
                >
                  {product.image && (
                    <div style={{ marginBottom: '8px' }}>
                      <img
                        src={product.image}
                        alt={product.title}
                        style={{ width: '100%', maxWidth: '300px', borderRadius: '6px', border: '1px solid #e5e7eb' }}
                      />
                    </div>
                  )}
                  <div style={{ marginBottom: '8px' }}>
                    <strong style={{ color: '#374151' }}>{product.title}</strong>
                  </div>
                  <div style={{ marginBottom: '8px' }}>
                    <a 
                      href={product.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ 
                        color: '#3b82f6', 
                        textDecoration: 'none',
                        fontSize: '0.9rem'
                      }}
                    >
                      {product.url}
                    </a>
                  </div>
                  {product.reason && (
                    <div style={{ 
                      fontSize: '0.85rem', 
                      color: '#6b7280',
                      fontStyle: 'italic'
                    }}>
                      Selected because: {product.reason}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="section">
            <h2>No Analysis Available</h2>
            <p>No product pages could be analyzed from this website. Please ensure the website has accessible product pages and try again.</p>
          </div>
        )}
      </div>
    )
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

      {/* Removed randomization verification section */}

      {/* Executive Summary */}
      <div className="section">
        <h2>Executive Summary</h2>
        <p>{analysis.executiveSummary}</p>
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
      {topProducts && topProducts.length > 0 && (
        <div className="section">
          <h2>Products Analyzed</h2>
          <p>The following {topProducts.length} products were analyzed for this report:</p>
          <div style={{ display: 'grid', gap: '12px', marginTop: '16px' }}>
            {topProducts.map((product, index) => (
              <div 
                key={index}
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  padding: '16px',
                  backgroundColor: '#f9fafb'
                }}
              >
                {product.image && (
                  <div style={{ marginBottom: '8px' }}>
                    <img
                      src={product.image}
                      alt={product.title}
                      style={{ width: '100%', maxWidth: '300px', borderRadius: '6px', border: '1px solid #e5e7eb' }}
                    />
                  </div>
                )}
                <div style={{ marginBottom: '8px' }}>
                  <strong style={{ color: '#374151' }}>{product.title}</strong>
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <a 
                    href={product.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{ 
                      color: '#3b82f6', 
                      textDecoration: 'none',
                      fontSize: '0.9rem'
                    }}
                  >
                    {product.url}
                  </a>
                </div>
                {product.reason && (
                  <div style={{ 
                    fontSize: '0.85rem', 
                    color: '#6b7280',
                    fontStyle: 'italic'
                  }}>
                    Selected because: {product.reason}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
} 