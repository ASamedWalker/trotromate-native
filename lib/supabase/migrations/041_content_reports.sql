-- Content moderation reports (tales, comments, profiles)
CREATE TABLE IF NOT EXISTS content_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_device_id TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('tale', 'comment', 'profile')),
  content_id UUID NOT NULL,
  reason TEXT NOT NULL DEFAULT 'inappropriate',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Prevent duplicate reports from same device on same content
CREATE UNIQUE INDEX IF NOT EXISTS idx_content_reports_unique
  ON content_reports (reporter_device_id, content_type, content_id);

-- RLS: anyone can insert their own reports, no one reads others'
ALTER TABLE content_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_insert_content_reports"
  ON content_reports FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "anon_read_own_content_reports"
  ON content_reports FOR SELECT TO anon
  USING (reporter_device_id = current_setting('request.headers', true)::json->>'x-device-id');
