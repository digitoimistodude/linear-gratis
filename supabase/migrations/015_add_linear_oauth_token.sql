-- Workspace-level settings (single row)
CREATE TABLE IF NOT EXISTS workspace_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    linear_oauth_client_id TEXT,
    linear_oauth_client_secret TEXT,
    linear_oauth_token TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE workspace_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view workspace settings" ON workspace_settings
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert workspace settings" ON workspace_settings
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update workspace settings" ON workspace_settings
    FOR UPDATE USING (auth.role() = 'authenticated');
