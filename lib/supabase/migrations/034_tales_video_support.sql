-- 034: Add video support to Troski Tales
-- Adds video_url, video_thumbnail_url, media_type, and video_duration_secs columns

ALTER TABLE public.tale_posts ADD COLUMN video_url TEXT;
ALTER TABLE public.tale_posts ADD COLUMN video_thumbnail_url TEXT;
ALTER TABLE public.tale_posts ADD COLUMN media_type TEXT DEFAULT 'image'
  CHECK (media_type IN ('image', 'video'));
ALTER TABLE public.tale_posts ADD COLUMN video_duration_secs INTEGER;
