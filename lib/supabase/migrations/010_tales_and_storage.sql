-- 010_tales_and_storage.sql
-- Trotro Tales: photo sharing + social features

-- ─── Tale Posts ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tale_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text NOT NULL,
  display_name text,
  is_anonymous boolean NOT NULL DEFAULT false,
  image_url text NOT NULL,
  caption text,
  post_type text NOT NULL DEFAULT 'tale' CHECK (post_type IN ('trip', 'queue', 'tale')),
  location_name text NOT NULL,
  like_count int NOT NULL DEFAULT 0,
  comment_count int NOT NULL DEFAULT 0,
  is_hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE tale_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read tale_posts"
  ON tale_posts FOR SELECT
  USING (is_hidden = false);

CREATE POLICY "Device can insert tale_posts"
  ON tale_posts FOR INSERT
  WITH CHECK (true);

-- ─── Tale Likes ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tale_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES tale_posts(id) ON DELETE CASCADE,
  device_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(post_id, device_id)
);

ALTER TABLE tale_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read tale_likes"
  ON tale_likes FOR SELECT
  USING (true);

CREATE POLICY "Device can insert tale_likes"
  ON tale_likes FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Device can delete own tale_likes"
  ON tale_likes FOR DELETE
  USING (true);

-- Auto-update like_count on tale_posts
CREATE OR REPLACE FUNCTION update_tale_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE tale_posts SET like_count = like_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE tale_posts SET like_count = like_count - 1 WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tale_likes_count_trigger ON tale_likes;
CREATE TRIGGER tale_likes_count_trigger
  AFTER INSERT OR DELETE ON tale_likes
  FOR EACH ROW EXECUTE FUNCTION update_tale_like_count();

-- ─── Tale Comments ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS tale_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES tale_posts(id) ON DELETE CASCADE,
  device_id text NOT NULL,
  display_name text,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE tale_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read tale_comments"
  ON tale_comments FOR SELECT
  USING (true);

CREATE POLICY "Device can insert tale_comments"
  ON tale_comments FOR INSERT
  WITH CHECK (true);

-- Auto-update comment_count on tale_posts
CREATE OR REPLACE FUNCTION update_tale_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE tale_posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE tale_posts SET comment_count = comment_count - 1 WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tale_comments_count_trigger ON tale_comments;
CREATE TRIGGER tale_comments_count_trigger
  AFTER INSERT OR DELETE ON tale_comments
  FOR EACH ROW EXECUTE FUNCTION update_tale_comment_count();

-- ─── Storage Bucket ──────────────────────────────────────
-- Run this in the Supabase dashboard SQL editor:
--
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('tale-images', 'tale-images', true)
-- ON CONFLICT (id) DO NOTHING;
--
-- CREATE POLICY "Anyone can upload tale images"
--   ON storage.objects FOR INSERT
--   WITH CHECK (bucket_id = 'tale-images');
--
-- CREATE POLICY "Public read tale images"
--   ON storage.objects FOR SELECT
--   USING (bucket_id = 'tale-images');
--
-- Note: Storage policies use the storage schema, which requires
-- running these separately in the Supabase dashboard.
