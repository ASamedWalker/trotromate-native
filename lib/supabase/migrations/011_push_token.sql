-- 011_push_token.sql
-- Add push notification token to contributor profiles

ALTER TABLE contributor_profiles
  ADD COLUMN IF NOT EXISTS push_token text;
