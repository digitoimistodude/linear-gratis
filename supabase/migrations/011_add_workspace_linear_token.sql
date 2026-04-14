-- Workspace-level shared Linear API token
-- Creates workspace_settings table (if it doesn't exist) and adds linear_api_token column

CREATE TABLE IF NOT EXISTS workspace_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    linear_api_token TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE workspace_settings ADD COLUMN IF NOT EXISTS linear_api_token TEXT;

ALTER TABLE workspace_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view workspace settings" ON workspace_settings;
CREATE POLICY "Authenticated users can view workspace settings" ON workspace_settings
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can insert workspace settings" ON workspace_settings;
CREATE POLICY "Authenticated users can insert workspace settings" ON workspace_settings
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can update workspace settings" ON workspace_settings;
CREATE POLICY "Authenticated users can update workspace settings" ON workspace_settings
    FOR UPDATE USING (auth.role() = 'authenticated');
