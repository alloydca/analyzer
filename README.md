# SEO Analyzer

A Next.js application that analyzes e-commerce websites for SEO optimization opportunities.

## Current Implementation

The application currently uses the browser's `fetch` API to retrieve website content. This approach has some limitations:

- Some websites block automated requests
- Limited control over headers and request parameters
- Less detailed error information

## Future Improvements

### Server-Side Curl Implementation

A more robust approach would be to use a server-side component with `curl` instead of `fetch`. This would provide several advantages:

1. **More Control Over Headers**: We can set more precise headers that mimic a real browser, including:
   - User-Agent strings
   - Accept headers
   - Cookie handling
   - Referrer information

2. **Better Error Handling**: curl gives us more detailed error information and status codes

3. **Proxy Support**: We could easily add proxy support if needed

4. **Rate Limiting**: Better control over request timing and rate limiting

### Implementation Plan

To implement this improvement:

1. Create a server-side API route that uses Node's `child_process` to execute curl commands
2. Add proper error handling and logging
3. Implement rate limiting to avoid being blocked
4. Add proxy support for websites that block direct requests

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Create a `.env.local` file with your OpenAI API key
4. Run the development server: `npm run dev`
5. Open [http://localhost:3001](http://localhost:3001) in your browser

## Environment Variables

- `OPENAI_API_KEY`: Your OpenAI API key
- `POSTGRES_URL`: Your PostgreSQL connection string

## Features

- Identifies top 10 product pages and 2 category pages
- Analyzes each page for:
  - General quality issues (spelling, grammar, readability)
  - SEO issues (meta tags, headings, content structure)
  - AI chat optimization opportunities
- Generates executive summary and recommendations
- Provides detailed page-specific analysis

## Usage

1. Enter the URL of the e-commerce website you want to analyze
2. Click "Analyze Website"
3. Wait for the analysis to complete
4. Review the results, including:
   - Executive summary
   - Critical issues
   - Key recommendations
   - Page-specific issues

## Technologies Used

- Next.js
- TypeScript
- Tailwind CSS
- OpenAI API
- PostgreSQL
