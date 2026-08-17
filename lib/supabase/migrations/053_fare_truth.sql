-- 053_fare_truth.sql
-- Fare truth: "official" must MEAN official.
--
-- 052b seeded the demo corridor with is_official = true and source = 'seed'.
-- The app badges a fare as official whenever official_fare is present, so our own
-- placeholder numbers were being shown to riders as GPRTU-approved fares. Fare
-- truth is the product's whole claim — this closes it at the DB level so no
-- importer, script, or future seed can reopen it.
--
-- Client-side fix ships alongside (lib/services/segment-fares.ts: trust requires
-- an authoritative origin, not just a non-null official_fare).

-- ── 1. Demote every fare that is not from a union/station chart ───────────────
UPDATE segment_fares
   SET is_official = false
 WHERE is_official = true
   AND source NOT IN ('gprtu', 'station');

-- ── 2. Make the invariant permanent ──────────────────────────────────────────
-- is_official may only be true for an authoritative origin. 'driver' and 'crowd'
-- are unverified reports; 'seed' is ours. Named so a failed insert is readable.
ALTER TABLE segment_fares
  DROP CONSTRAINT IF EXISTS segment_fares_official_requires_authoritative_source;

ALTER TABLE segment_fares
  ADD CONSTRAINT segment_fares_official_requires_authoritative_source
  CHECK (is_official = false OR source IN ('gprtu', 'station'));

-- ── 3. Verify ────────────────────────────────────────────────────────────────
-- Expect 0 rows. Anything returned is a fare claiming an authority it lacks.
--   SELECT id, route_id, source, is_official, official_fare
--     FROM segment_fares
--    WHERE is_official = true AND source NOT IN ('gprtu','station');
