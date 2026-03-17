-- Add hide_onboarding column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hide_onboarding BOOLEAN DEFAULT false;
