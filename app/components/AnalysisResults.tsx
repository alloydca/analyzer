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

  // Check if analysis was performed (analysis will be null if no products were analyzed)
  if (!analysis) {
    return (
      <div>
        <div className="section">
          <h2>No Analysis Available</h2>
          <p>No product pages could be analyzed from this website. Please ensure the website has accessible product pages and try again.</p>
        </div>
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

      {/* Problematic Content */}
      {analysis.problematicContent && analysis.problematicContent.length > 0 && (
        <div className="section">
          <h2>Most Problematic Content</h2>
          <p>These are the 3 most critical content issues that need immediate attention:</p>
          <div style={{ 
            display: 'grid', 
            gap: '16px', 
            marginTop: '16px'
          }}>
            {analysis.problematicContent.map((item, index) => (
              <div 
                key={index} 
                style={{
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  padding: '16px',
                  backgroundColor: '#fef2f2',
                  borderLeft: '4px solid #ef4444'
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px'
                }}>
                  <div style={{
                    backgroundColor: '#ef4444',
                    color: 'white',
                    borderRadius: '50%',
                    width: '24px',
                    height: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.8rem',
                    fontWeight: 'bold',
                    flexShrink: 0
                  }}>
                    {index + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      backgroundColor: '#f3f4f6',
                      padding: '12px',
                      borderRadius: '6px',
                      marginBottom: '12px',
                      fontFamily: 'monospace',
                      fontSize: '0.9rem',
                      border: '1px solid #d1d5db'
                    }}>
                      "{item.content}"
                    </div>
                    <h3 style={{
                      margin: '0 0 8px 0',
                      fontSize: '1rem',
                      fontWeight: '600',
                      color: '#dc2626'
                    }}>
                      Issue: {item.issue}
                    </h3>
                    <p style={{
                      margin: '0',
                      color: '#6b7280',
                      fontSize: '0.9rem'
                    }}>
                      <strong>Location:</strong> {item.location}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
} 