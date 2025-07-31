import { useState } from 'react'
import { 
  BarChart3, 
  Target, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  Info,
  FileText,
  Zap
} from 'lucide-react'

interface ScoreCard {
  title: string
  score: number
  maxScore: number
  description: string
  status: 'excellent' | 'good' | 'needs-improvement' | 'poor'
  suggestions: string[]
}

interface AnalysisResult {
  overallScore: number
  scoreCards: ScoreCard[]
  summary: string
}

function App() {
  const [productTitle, setProductTitle] = useState('')
  const [productDescription, setProductDescription] = useState('')
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const analyzeProduct = () => {
    if (!productTitle.trim() && !productDescription.trim()) {
      alert('Please enter a product title or description to analyze.')
      return
    }

    setIsAnalyzing(true)
    
    // Simulate analysis delay
    setTimeout(() => {
      const result = performAnalysis(productTitle, productDescription)
      setAnalysisResult(result)
      setIsAnalyzing(false)
    }, 1500)
  }

  const performAnalysis = (title: string, description: string): AnalysisResult => {
    const scoreCards: ScoreCard[] = []
    
    // Title Analysis
    const titleLength = title.length
    const titleWords = title.split(' ').length
    let titleScore = 0
    let titleStatus: ScoreCard['status'] = 'poor'
    let titleSuggestions: string[] = []

    if (titleLength >= 30 && titleLength <= 60) titleScore += 25
    else if (titleLength > 60) titleSuggestions.push('Title is too long - keep it under 60 characters')
    else titleSuggestions.push('Title is too short - aim for 30-60 characters')

    if (titleWords >= 3 && titleWords <= 8) titleScore += 25
    else titleSuggestions.push('Title should have 3-8 words')

    if (title.includes('Premium') || title.includes('Best') || title.includes('Quality')) titleScore += 25
    else titleSuggestions.push('Consider adding power words like "Premium", "Best", or "Quality"')

    if (/[A-Z]/.test(title) && /[a-z]/.test(title)) titleScore += 25
    else titleSuggestions.push('Use proper capitalization')

    if (titleScore >= 80) titleStatus = 'excellent'
    else if (titleScore >= 60) titleStatus = 'good'
    else if (titleScore >= 40) titleStatus = 'needs-improvement'

    scoreCards.push({
      title: 'Title Optimization',
      score: titleScore,
      maxScore: 100,
      description: 'Analyzes title length, word count, power words, and formatting',
      status: titleStatus,
      suggestions: titleSuggestions
    })

    // Description Analysis
    const descLength = description.length
    const descWords = description.split(' ').length
    let descScore = 0
    let descStatus: ScoreCard['status'] = 'poor'
    let descSuggestions: string[] = []

    if (descLength >= 100 && descLength <= 500) descScore += 25
    else if (descLength > 500) descSuggestions.push('Description is too long - keep it under 500 characters')
    else descSuggestions.push('Description is too short - aim for 100-500 characters')

    if (descWords >= 15 && descWords <= 75) descScore += 25
    else descSuggestions.push('Description should have 15-75 words')

    const powerWords = ['amazing', 'incredible', 'premium', 'exclusive', 'limited', 'best', 'top', 'quality']
    const hasPowerWords = powerWords.some(word => description.toLowerCase().includes(word))
    if (hasPowerWords) descScore += 25
    else descSuggestions.push('Add compelling power words to increase engagement')

    const hasBenefits = description.includes('benefit') || description.includes('advantage') || description.includes('feature')
    if (hasBenefits) descScore += 25
    else descSuggestions.push('Highlight key benefits and features')

    if (descScore >= 80) descStatus = 'excellent'
    else if (descScore >= 60) descStatus = 'good'
    else if (descScore >= 40) descStatus = 'needs-improvement'

    scoreCards.push({
      title: 'Description Quality',
      score: descScore,
      maxScore: 100,
      description: 'Evaluates description length, word count, power words, and benefit focus',
      status: descStatus,
      suggestions: descSuggestions
    })

    // SEO Analysis
    const seoScore = Math.round((titleScore + descScore) / 2)
    let seoStatus: ScoreCard['status'] = 'poor'
    let seoSuggestions: string[] = []

    if (seoScore >= 80) seoStatus = 'excellent'
    else if (seoScore >= 60) seoStatus = 'good'
    else if (seoScore >= 40) seoStatus = 'needs-improvement'

    if (seoScore < 80) seoSuggestions.push('Improve overall content quality for better SEO performance')
    if (seoScore >= 80) seoSuggestions.push('Excellent SEO optimization!')

    scoreCards.push({
      title: 'SEO Optimization',
      score: seoScore,
      maxScore: 100,
      description: 'Combined analysis of title and description for search engine optimization',
      status: seoStatus,
      suggestions: seoSuggestions
    })

    const overallScore = Math.round(scoreCards.reduce((sum, card) => sum + card.score, 0) / scoreCards.length)
    
    let summary = ''
    if (overallScore >= 80) {
      summary = 'Excellent product content! Your title and description are well-optimized for conversions and SEO.'
    } else if (overallScore >= 60) {
      summary = 'Good product content with room for improvement. Focus on the suggestions below.'
    } else if (overallScore >= 40) {
      summary = 'Your product content needs improvement. Review the detailed suggestions below.'
    } else {
      summary = 'Significant improvements needed. Consider rewriting your title and description.'
    }

    return {
      overallScore,
      scoreCards,
      summary
    }
  }

  const getStatusColor = (status: ScoreCard['status']) => {
    switch (status) {
      case 'excellent': return 'text-green-600 bg-green-100'
      case 'good': return 'text-blue-600 bg-blue-100'
      case 'needs-improvement': return 'text-yellow-600 bg-yellow-100'
      case 'poor': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getStatusIcon = (status: ScoreCard['status']) => {
    switch (status) {
      case 'excellent': return <CheckCircle className="w-5 h-5" />
      case 'good': return <TrendingUp className="w-5 h-5" />
      case 'needs-improvement': return <AlertTriangle className="w-5 h-5" />
      case 'poor': return <AlertTriangle className="w-5 h-5" />
      default: return <Info className="w-5 h-5" />
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <BarChart3 className="w-8 h-8 text-indigo-600 mr-3" />
            <h1 className="text-4xl font-bold text-gray-900">Product Analyzer</h1>
          </div>
          <p className="text-lg text-gray-600">Analyze your product titles and descriptions for optimal performance</p>
        </div>

        {/* Input Form */}
        <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-6 mb-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <FileText className="w-4 h-4 inline mr-2" />
                Product Title
              </label>
              <textarea
                value={productTitle}
                onChange={(e) => setProductTitle(e.target.value)}
                placeholder="Enter your product title here..."
                className="w-full h-32 p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <FileText className="w-4 h-4 inline mr-2" />
                Product Description
              </label>
              <textarea
                value={productDescription}
                onChange={(e) => setProductDescription(e.target.value)}
                placeholder="Enter your product description here..."
                className="w-full h-32 p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>
          
          <div className="mt-6 text-center">
            <button
              onClick={analyzeProduct}
              disabled={isAnalyzing}
              className="inline-flex items-center px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAnalyzing ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Analyzing...
                </>
              ) : (
                <>
                  <Zap className="w-5 h-5 mr-2" />
                  Analyze Product
                </>
              )}
            </button>
          </div>
        </div>

        {/* Results */}
        {analysisResult && (
          <div className="max-w-4xl mx-auto">
            {/* Overall Score */}
            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Overall Score</h2>
                <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full mb-4">
                  <span className="text-3xl font-bold text-white">{analysisResult.overallScore}</span>
                </div>
                <p className="text-lg text-gray-600">{analysisResult.summary}</p>
              </div>
            </div>

            {/* Score Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {analysisResult.scoreCards.map((card, index) => (
                <div key={index} className="bg-white rounded-lg shadow-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">{card.title}</h3>
                    <div className={`flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(card.status)}`}>
                      {getStatusIcon(card.status)}
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                      <span>Score</span>
                      <span>{card.score}/{card.maxScore}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-indigo-500 to-purple-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${(card.score / card.maxScore) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-4">{card.description}</p>
                  
                  {card.suggestions.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 mb-2">Suggestions:</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        {card.suggestions.map((suggestion, idx) => (
                          <li key={idx} className="flex items-start">
                            <span className="text-indigo-500 mr-2">•</span>
                            {suggestion}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
