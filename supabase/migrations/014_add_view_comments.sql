-- Add customer commenting support to public views

-- Table for customer comments on public view issues
CREATE TABLE view_comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    view_id UUID NOT NULL REFERENCES public_views(id) ON DELETE CASCADE,
    issue_id TEXT NOT NULL,
    author_name TEXT NOT NULL,
    author_email TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL,
    is_approved BOOLEAN NOT NULL DEFAULT true,
    is_hidden BOOLEAN NOT NULL DEFAULT false,
    ip_hash TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_view_comments_view_id ON view_comments(view_id);
CREATE INDEX idx_view_comments_issue_id ON view_comments(issue_id);
CREATE INDEX idx_view_comments_view_issue ON view_comments(view_id, issue_id);

-- Enable RLS
ALTER TABLE view_comments ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Anyone can read approved comments" ON view_comments
    FOR SELECT USING (is_approved = true AND is_hidden = false);

CREATE POLICY "Anyone can insert comments" ON view_comments
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role can manage all comments" ON view_comments
    FOR ALL USING (true) WITH CHECK (true);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_view_comments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_view_comments_updated_at
    BEFORE UPDATE ON view_comments
    FOR EACH ROW EXECUTE FUNCTION update_view_comments_updated_at();

-- Add commenting settings to public_views
ALTER TABLE public_views ADD COLUMN IF NOT EXISTS allow_customer_comments BOOLEAN DEFAULT false;
ALTER TABLE public_views ADD COLUMN IF NOT EXISTS require_email_for_comments BOOLEAN DEFAULT true;
ALTER TABLE public_views ADD COLUMN IF NOT EXISTS moderate_comments BOOLEAN DEFAULT false;
