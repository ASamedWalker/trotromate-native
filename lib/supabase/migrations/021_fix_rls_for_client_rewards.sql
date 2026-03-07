-- =============================================
-- Migration 021: Fix RLS for client-side rewards
-- The native app awards points client-side (no server API routes),
-- so anon role needs INSERT on reward-related tables.
-- =============================================

-- contributor_badges: awarded client-side after report submission
DROP POLICY IF EXISTS "System can insert contributor badges" ON public.contributor_badges;
CREATE POLICY "Anon can insert contributor badges" ON public.contributor_badges
  FOR INSERT TO anon WITH CHECK (true);

-- points_history: logged client-side after report submission
DROP POLICY IF EXISTS "System can insert points history" ON public.points_history;
CREATE POLICY "Anon can insert points history" ON public.points_history
  FOR INSERT TO anon WITH CHECK (true);

-- contributor_route_counts: upserted client-side after fare report
DROP POLICY IF EXISTS "System can manage route counts" ON public.contributor_route_counts;
CREATE POLICY "Anon can insert route counts" ON public.contributor_route_counts
  FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update route counts" ON public.contributor_route_counts
  FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Public read route counts" ON public.contributor_route_counts
  FOR SELECT USING (true);
