-- ══════════════════════════════════════════════════════════════════════
-- 040: Fix completed_trips SELECT RLS policy
-- ══════════════════════════════════════════════════════════════════════
--
-- Problem: Migration 039 created a SELECT policy that checks
-- current_setting('request.headers')::json->>'x-device-id'
-- but the Supabase JS client never sends this header.
-- Result: every SELECT on completed_trips returns zero rows.
--
-- Fix: Match the pattern used by all other Troski tables — open
-- SELECT policy with client-side .eq('device_id', deviceId) filtering.
-- The INSERT policy (anyone can insert) remains unchanged.
-- ══════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS completed_trips_select_own ON completed_trips;

CREATE POLICY completed_trips_select_own ON completed_trips
  FOR SELECT USING (true);
