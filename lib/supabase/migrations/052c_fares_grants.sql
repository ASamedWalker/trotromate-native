-- 052c_fares_grants.sql
-- The app uses the anon key. New tables (segment_fares, fare_settings) weren't
-- readable by anon, so resolveDropoffFare() saw nothing. Grant read + keep RLS
-- off (project runs without RLS), make the crowd aggregator run as definer so
-- anon fare reports can fold in, and (re)seed in case the earlier inserts didn't
-- persist. Idempotent. Owner runs once.

ALTER TABLE segment_fares DISABLE ROW LEVEL SECURITY;
ALTER TABLE fare_settings DISABLE ROW LEVEL SECURITY;

GRANT SELECT ON segment_fares TO anon, authenticated;
GRANT SELECT ON fare_settings TO anon, authenticated;

-- Let anon-submitted fare reports update the aggregate without direct table grants
ALTER FUNCTION apply_fare_report_to_segment(uuid, int, int, numeric) SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION apply_fare_report_to_segment(uuid, int, int, numeric) TO anon, authenticated;

-- Ensure config row + demo stage fares exist (covers a partial earlier run)
INSERT INTO fare_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

INSERT INTO segment_fares
  (route_id, from_stop_order, to_stop_order, official_fare, source, is_official, effective_date)
VALUES
  ('1ec7683c-6445-4fe5-a960-d2fd1c3c446d', 0, 1, 4.00, 'seed', true, current_date),
  ('1ec7683c-6445-4fe5-a960-d2fd1c3c446d', 0, 2, 5.50, 'seed', true, current_date),
  ('1ec7683c-6445-4fe5-a960-d2fd1c3c446d', 0, 3, 7.00, 'seed', true, current_date)
ON CONFLICT (route_id, from_stop_order, to_stop_order) DO UPDATE SET
  official_fare  = EXCLUDED.official_fare,
  is_official    = true,
  source         = 'seed',
  effective_date = EXCLUDED.effective_date,
  updated_at     = now();
