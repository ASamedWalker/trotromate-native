-- ============================================================
-- 049: Text-only Tales — Twitter/Threads-style text posts
-- Users can post fare stories, commute thoughts, tips without
-- needing a photo or video. Lowest friction content creation.
-- ============================================================

-- Make image_url nullable for text-only posts
alter table public.tale_posts alter column image_url drop not null;

-- Expand post_type to include 'text'
alter table public.tale_posts drop constraint if exists tale_posts_post_type_check;
alter table public.tale_posts add constraint tale_posts_post_type_check
  check (post_type in ('trip', 'queue', 'tale', 'text'));
