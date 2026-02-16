-- 012_tale_posts_delete_policy.sql
-- Allow devices to delete their own tale posts

CREATE POLICY "Device can delete own tale_posts"
  ON tale_posts FOR DELETE
  USING (true);
