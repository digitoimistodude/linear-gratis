-- Add OAuth token column for Linear app integration (bot-identity comments)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS linear_oauth_token TEXT;
