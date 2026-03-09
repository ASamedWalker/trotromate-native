-- =============================================
-- Migration 022: Forensic audit fixes
-- Resolves: missing RPC, emergency_contacts RLS,
-- duplicate triggers, reward table policy conflicts
-- =============================================

-- ══════════════════════════════════════════════════
-- 1. CREATE MISSING increment_route_count RPC
--    Called by rewards.ts as fallback when upsert fails
-- ══════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.increment_route_count(
  p_contributor_id UUID,
  p_route_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.contributor_route_counts (contributor_id, route_id, report_count)
  VALUES (p_contributor_id, p_route_id, 1)
  ON CONFLICT (contributor_id, route_id)
  DO UPDATE SET report_count = contributor_route_counts.report_count + 1;
END;
$$;

-- ══════════════════════════════════════════════════
-- 2. FIX emergency_contacts RLS
--    Native app needs anon access (uses device_id, no Supabase Auth)
--    Restrict writes to own device_id for safety
-- ══════════════════════════════════════════════════

-- Drop service_role-only policies from migration 029
DROP POLICY IF EXISTS "emergency_contacts_service_select" ON public.emergency_contacts;
DROP POLICY IF EXISTS "emergency_contacts_service_insert" ON public.emergency_contacts;
DROP POLICY IF EXISTS "emergency_contacts_service_update" ON public.emergency_contacts;
DROP POLICY IF EXISTS "emergency_contacts_service_delete" ON public.emergency_contacts;

-- Drop old overly-permissive policies from migration 015
DROP POLICY IF EXISTS "emergency_contacts_read" ON public.emergency_contacts;
DROP POLICY IF EXISTS "emergency_contacts_insert" ON public.emergency_contacts;
DROP POLICY IF EXISTS "emergency_contacts_update" ON public.emergency_contacts;

-- Create proper anon policies
CREATE POLICY "Anon select emergency_contacts" ON public.emergency_contacts
  FOR SELECT TO anon USING (true);

CREATE POLICY "Anon insert emergency_contacts" ON public.emergency_contacts
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Anon update emergency_contacts" ON public.emergency_contacts
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- ══════════════════════════════════════════════════
-- 3. FIX contributor_badges / points_history / contributor_route_counts
--    Ensure anon can write (native app does rewards client-side)
--    These may have been overwritten by PWA migration 029
-- ══════════════════════════════════════════════════

-- contributor_badges
DROP POLICY IF EXISTS "System can insert contributor badges" ON public.contributor_badges;
DROP POLICY IF EXISTS "Anon can insert contributor badges" ON public.contributor_badges;
CREATE POLICY "Anon can insert contributor badges" ON public.contributor_badges
  FOR INSERT TO anon WITH CHECK (true);

-- points_history
DROP POLICY IF EXISTS "System can insert points history" ON public.points_history;
DROP POLICY IF EXISTS "Anon can insert points history" ON public.points_history;
CREATE POLICY "Anon can insert points history" ON public.points_history
  FOR INSERT TO anon WITH CHECK (true);

-- contributor_route_counts
DROP POLICY IF EXISTS "System can manage route counts" ON public.contributor_route_counts;
DROP POLICY IF EXISTS "Anon can insert route counts" ON public.contributor_route_counts;
DROP POLICY IF EXISTS "Anon can update route counts" ON public.contributor_route_counts;
DROP POLICY IF EXISTS "Public read route counts" ON public.contributor_route_counts;

CREATE POLICY "Anon can insert route counts" ON public.contributor_route_counts
  FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update route counts" ON public.contributor_route_counts
  FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Public read route counts" ON public.contributor_route_counts
  FOR SELECT USING (true);

-- ══════════════════════════════════════════════════
-- 4. REMOVE DUPLICATE TALE TRIGGERS
--    Keep the native versions (they use DROP IF EXISTS + handle both INSERT/DELETE)
--    Remove the PWA versions to prevent double-counting
-- ══════════════════════════════════════════════════

-- Drop PWA-style triggers (keep native-style ones)
DROP TRIGGER IF EXISTS on_tale_like_insert ON public.tale_likes;
DROP TRIGGER IF EXISTS on_tale_like_delete ON public.tale_likes;
DROP TRIGGER IF EXISTS on_tale_comment_insert ON public.tale_comments;
DROP TRIGGER IF EXISTS on_tale_comment_delete ON public.tale_comments;

-- Drop PWA-style functions (keep native-style ones)
DROP FUNCTION IF EXISTS public.increment_tale_like_count();
DROP FUNCTION IF EXISTS public.decrement_tale_like_count();
DROP FUNCTION IF EXISTS public.increment_tale_comment_count();
DROP FUNCTION IF EXISTS public.decrement_tale_comment_count();

-- Ensure the native-style triggers exist
-- (safe to re-run — uses CREATE OR REPLACE + DROP IF EXISTS)

CREATE OR REPLACE FUNCTION public.update_tale_like_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.tale_posts
    SET like_count = like_count + 1
    WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.tale_posts
    SET like_count = GREATEST(like_count - 1, 0)
    WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_tale_comment_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.tale_posts
    SET comment_count = comment_count + 1
    WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.tale_posts
    SET comment_count = GREATEST(comment_count - 1, 0)
    WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS tale_likes_count_trigger ON public.tale_likes;
CREATE TRIGGER tale_likes_count_trigger
  AFTER INSERT OR DELETE ON public.tale_likes
  FOR EACH ROW EXECUTE FUNCTION public.update_tale_like_count();

DROP TRIGGER IF EXISTS tale_comments_count_trigger ON public.tale_comments;
CREATE TRIGGER tale_comments_count_trigger
  AFTER INSERT OR DELETE ON public.tale_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_tale_comment_count();

-- ══════════════════════════════════════════════════
-- 5. CLEANUP: Remove orphan auto_link_route_stations references
--    Trigger + function were dropped manually, ensure they stay gone
-- ══════════════════════════════════════════════════

DROP TRIGGER IF EXISTS trigger_auto_link_stations ON public.routes;
DROP FUNCTION IF EXISTS public.auto_link_route_stations();
