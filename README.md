# Product Analyzer

A modern web application that analyzes product titles and descriptions to provide comprehensive scorecards and optimization suggestions.

## Features

- **Title Analysis**: Evaluates title length, word count, power words, and formatting
- **Description Quality**: Analyzes description length, word count, power words, and benefit focus
- **SEO Optimization**: Combined analysis for search engine optimization
- **Visual Scorecards**: Beautiful, intuitive interface with progress bars and status indicators
- **Actionable Suggestions**: Detailed recommendations for improvement
- **Real-time Analysis**: Instant feedback with loading animations

## Analysis Criteria

### Title Optimization
- **Length**: 30-60 characters optimal
- **Word Count**: 3-8 words recommended
- **Power Words**: Includes "Premium", "Best", "Quality" etc.
- **Capitalization**: Proper case formatting

### Description Quality
- **Length**: 100-500 characters optimal
- **Word Count**: 15-75 words recommended
- **Power Words**: Engaging vocabulary for conversions
- **Benefits Focus**: Highlights features and advantages

### SEO Optimization
- Combined score from title and description analysis
- Overall performance assessment
- Search engine optimization recommendations

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/alloydca/analyzer.git
cd analyzer
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:5173`

## Usage

1. Enter your product title in the left text area
2. Enter your product description in the right text area
3. Click "Analyze Product" to generate your scorecard
4. Review the detailed analysis and suggestions
5. Use the recommendations to improve your product content

## Technology Stack

- **React 18** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** for styling
- **Lucide React** for icons
- **Modern ES6+** features

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

### Project Structure

```
analyzer/
├── src/
│   ├── App.tsx          # Main application component
│   ├── main.tsx         # Application entry point
│   └── index.css        # Global styles with Tailwind
├── public/              # Static assets
├── index.html           # HTML template
├── package.json         # Dependencies and scripts
├── tailwind.config.js   # Tailwind configuration
├── postcss.config.js    # PostCSS configuration
└── README.md           # Project documentation
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

If you have any questions or need support, please open an issue on GitHub.

---

Built with ❤️ using React and TypeScript
