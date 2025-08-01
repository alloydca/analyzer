-- Create schema
CREATE SCHEMA IF NOT EXISTS seo_analyzer;

-- Set search path
SET search_path TO seo_analyzer;

-- Main analysis record
CREATE TABLE analysis_records (
    id SERIAL PRIMARY KEY,
    top_level_url TEXT NOT NULL,
    created_dttm TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_dttm TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Pages analyzed
CREATE TABLE analyzed_pages (
    id SERIAL PRIMARY KEY,
    analysis_id INTEGER REFERENCES analysis_records(id),
    url TEXT NOT NULL,
    page_type TEXT NOT NULL CHECK (page_type IN ('product', 'category')),
    page_content TEXT NOT NULL,
    created_dttm TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Page-specific recommendations
CREATE TABLE page_recommendations (
    id SERIAL PRIMARY KEY,
    page_id INTEGER REFERENCES analyzed_pages(id),
    issue_type TEXT NOT NULL CHECK (issue_type IN ('general_quality', 'seo', 'ai_optimization')),
    issue_description TEXT NOT NULL,
    severity INTEGER NOT NULL CHECK (severity BETWEEN 1 AND 5),
    created_dttm TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Analysis summary
CREATE TABLE analysis_summary (
    id SERIAL PRIMARY KEY,
    analysis_id INTEGER REFERENCES analysis_records(id),
    executive_summary TEXT NOT NULL,
    created_dttm TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- OpenAI interactions log
CREATE TABLE openai_interactions (
    id SERIAL PRIMARY KEY,
    analysis_id INTEGER REFERENCES analysis_records(id),
    prompt TEXT NOT NULL,
    response TEXT NOT NULL,
    interaction_type TEXT NOT NULL CHECK (interaction_type IN ('initial_analysis', 'page_analysis', 'summary')),
    created_dttm TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_analysis_records_url ON analysis_records(top_level_url);
CREATE INDEX idx_analyzed_pages_analysis_id ON analyzed_pages(analysis_id);
CREATE INDEX idx_page_recommendations_page_id ON page_recommendations(page_id);
CREATE INDEX idx_analysis_summary_analysis_id ON analysis_summary(analysis_id);
CREATE INDEX idx_openai_interactions_analysis_id ON openai_interactions(analysis_id); 