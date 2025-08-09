// Mock data for development iteration
export const mockAnalysisData = {
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
    inferredBrandPositioning: "Premium outdoor gear focused on quality and durability"
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
