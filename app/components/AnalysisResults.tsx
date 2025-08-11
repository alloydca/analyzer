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
  const [shareLogged, setShareLogged] = React.useState(false)

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
      {/* Combined Analysis Summary & Executive Summary */}
      <div className="section">
        <h2>Analysis Summary</h2>
        {stats && (
          <p style={{ marginBottom: '20px' }}>
            Successfully analyzed <strong>{stats.successful}</strong> pages
            {stats.productsCollected !== undefined && stats.categoriesCollected !== undefined && (
              <span> ({stats.productsCollected} products, {stats.categoriesCollected} categories)</span>
            )}
          </p>
        )}
        
        <p style={{ marginBottom: '24px' }}>{analysis.executiveSummary}</p>
        
        {/* Small Score Cards */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(4, 1fr)', 
          gap: '16px',
          marginBottom: '24px' 
        }}>
          <div style={{
            padding: '16px',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            backgroundColor: '#f9fafb',
            textAlign: 'center'
          }}>
            <div style={{ 
              fontSize: '24px', 
              fontWeight: 'bold', 
              color: getScoreColor(analysis.brandAlignment.score),
              marginBottom: '4px'
            }}>
              {analysis.brandAlignment.score}
            </div>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#374151' }}>
              Brand Alignment
            </div>
          </div>
          
          <div style={{
            padding: '16px',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            backgroundColor: '#f9fafb',
            textAlign: 'center'
          }}>
            <div style={{ 
              fontSize: '24px', 
              fontWeight: 'bold', 
              color: getScoreColor(analysis.conversionEffectiveness.score),
              marginBottom: '4px'
            }}>
              {analysis.conversionEffectiveness.score}
            </div>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#374151' }}>
              Conversion Effectiveness
            </div>
          </div>
          
          <div style={{
            padding: '16px',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            backgroundColor: '#f9fafb',
            textAlign: 'center'
          }}>
            <div style={{ 
              fontSize: '24px', 
              fontWeight: 'bold', 
              color: getScoreColor(analysis.seoAiBestPractices.score),
              marginBottom: '4px'
            }}>
              {analysis.seoAiBestPractices.score}
            </div>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#374151' }}>
              SEO & AI Best Practices
            </div>
          </div>
          
          <div style={{
            padding: '16px',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            backgroundColor: '#f9fafb',
            textAlign: 'center'
          }}>
            <div style={{ 
              fontSize: '24px', 
              fontWeight: 'bold', 
              color: getScoreColor(Math.round((analysis.brandAlignment.score + analysis.conversionEffectiveness.score + analysis.seoAiBestPractices.score) / 3)),
              marginBottom: '4px'
            }}>
              {Math.round((analysis.brandAlignment.score + analysis.conversionEffectiveness.score + analysis.seoAiBestPractices.score) / 3)}
            </div>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#374151' }}>
              Overall Score
            </div>
          </div>
        </div>
        
        {/* Call to Action and Share Link */}
        <div style={{
          padding: '24px',
          backgroundColor: '#f9fafb',
          border: '1px solid #e5e7eb',
          borderRadius: '8px'
        }}>
          {/* Call to Action based on score */}
          {(() => {
            const overallScore = Math.round((analysis.brandAlignment.score + analysis.conversionEffectiveness.score + analysis.seoAiBestPractices.score) / 3);
            const scores = [
              { name: 'Brand Alignment', score: analysis.brandAlignment.score },
              { name: 'Conversion Effectiveness', score: analysis.conversionEffectiveness.score },
              { name: 'SEO and AI Best Practices', score: analysis.seoAiBestPractices.score }
            ];
            const lowestCategory = scores.reduce((min, current) => current.score < min.score ? current : min);
            const highestCategory = scores.reduce((max, current) => current.score > max.score ? current : max);
            
            if (overallScore >= 80) {
              return (
                <div style={{ marginBottom: '24px', textAlign: 'left' }}>
                  <h3 style={{ 
                    fontSize: '18px', 
                    fontWeight: '600', 
                    color: '#1a1a1a', 
                    marginBottom: '16px' 
                  }}>
                    You are doing well!
                  </h3>
                  <p style={{ 
                    fontSize: '16px', 
                    lineHeight: '1.6', 
                    color: '#374151', 
                    marginBottom: '20px' 
                  }}>
                    Your scores are better than most but we still think we can help. In particular your score for <strong>{lowestCategory.name}</strong> shows room to improve, and with Brandfuel you'll save time writing all the different descriptions for all your sales channels. Additionally, we can help you create content that is relevant to each individual shopper and campaign. Click below to learn all the ways we can help.
                  </p>
                  <div style={{ textAlign: 'center' }}>
                    <a 
                      href="https://www.brandfuel.ai/get-started" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-block',
                        padding: '12px 24px',
                        fontSize: '16px',
                        fontWeight: '600',
                        color: '#ffffff',
                        backgroundColor: '#ff4500',
                        textDecoration: 'none',
                        borderRadius: '8px',
                        transition: 'background-color 0.2s',
                        marginBottom: '24px'
                      }}
                    >
                      Learn How We Can Help
                    </a>
                  </div>
                </div>
              );
            } else {
              return (
                <div style={{ marginBottom: '24px', textAlign: 'left' }}>
                  <h3 style={{ 
                    fontSize: '18px', 
                    fontWeight: '600', 
                    color: '#1a1a1a', 
                    marginBottom: '16px' 
                  }}>
                    There's room for improvement
                  </h3>
                  <p style={{ 
                    fontSize: '16px', 
                    lineHeight: '1.6', 
                    color: '#374151', 
                    marginBottom: '20px' 
                  }}>
                    While your score for <strong>{highestCategory.name}</strong> is your best, there is a lot of room for improvement. Did you know that Brandfuel uses AI to improve your content continuously and automatically? Click the button below to talk to us and learn how we can help you raise your content quality.
                  </p>
                  <div style={{ textAlign: 'center' }}>
                    <a 
                      href="https://www.brandfuel.ai/get-started" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-block',
                        padding: '12px 24px',
                        fontSize: '16px',
                        fontWeight: '600',
                        color: '#ffffff',
                        backgroundColor: '#ff4500',
                        textDecoration: 'none',
                        borderRadius: '8px',
                        transition: 'background-color 0.2s',
                        marginBottom: '24px'
                      }}
                    >
                      Talk to Us
                    </a>
                  </div>
                </div>
              );
            }
          })()}
          
          {/* Share section */}
          <div style={{ 
            borderTop: '1px solid #e5e7eb', 
            paddingTop: '20px',
            textAlign: 'center'
          }}>
            <p style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#444343' }}>
              Want to share these results with your team?
            </p>
          <div id="shareUrlContainer" style={{ display: 'none', marginBottom: '12px' }}>
            <input
              type="text"
              id="shareUrl"
              readOnly
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: '13px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                backgroundColor: '#ffffff',
                color: '#374151',
                boxSizing: 'border-box'
              }}
            />
          </div>
          <button 
            onClick={async () => {
              const shareData = {
                email: window.leadEmail || '',
                url: window.analyzedUrl || ''
              }
              const encodedData = btoa(JSON.stringify(shareData))
              const currentUrl = new URL(window.location.href)
              const shareUrl = `${currentUrl.origin}${currentUrl.pathname}?s=${encodedData}`
              
              // Show URL and copy to clipboard
              const shareUrlInput = document.getElementById('shareUrl') as HTMLInputElement
              const shareUrlContainer = document.getElementById('shareUrlContainer') as HTMLElement
              if (shareUrlInput && shareUrlContainer) {
                shareUrlInput.value = shareUrl
                shareUrlContainer.style.display = 'block'
              }
              navigator.clipboard.writeText(shareUrl)
              
              // Add note to Brevo that user shared results (only once)
              if (!shareLogged) {
                fetch('/api/brevo-notes', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    contactEmail: window.leadEmail,
                    message: `User shared analysis results for ${window.analyzedUrl}`,
                    noteType: 'analysis-shared'
                  })
                })
                setShareLogged(true)
              }
              
              // Show feedback
              const button = event.target as HTMLButtonElement
              if (button) {
                const originalText = button.textContent
                button.textContent = 'Link Copied!'
                setTimeout(() => {
                  button.textContent = originalText
                }, 2000)
              }
            }}
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              fontWeight: '600',
              color: '#ff4500',
              backgroundColor: 'transparent',
              border: '1px solid #ff4500',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Copy Share Link
          </button>
          </div>
        </div>
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