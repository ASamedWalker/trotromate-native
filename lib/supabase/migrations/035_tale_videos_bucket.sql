-- 035_tale_videos_bucket.sql
-- Storage bucket for tale video uploads
--
-- Run this in the Supabase dashboard SQL editor:

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tale-videos',
  'tale-videos',
  true,
  52428800,  -- 50MB
  ARRAY['video/mp4', 'video/quicktime']
)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to upload videos
CREATE POLICY "Anyone can upload tale videos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'tale-videos');

-- Public read access for tale videos
CREATE POLICY "Public read tale videos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'tale-videos');

-- Allow device to delete their own videos
CREATE POLICY "Anyone can delete tale videos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'tale-videos');
