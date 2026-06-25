-- 052b_seed_demo_corridor.sql
-- Demo data to test per-drop-off fares end-to-end on ONE corridor: Circle → Taifa
-- (route 1ec7683c, corridor official_fare 7.00). Stops + stage fares so picking a
-- drop-off changes the fare. Safe to re-run (guarded / upsert). Owner runs once.

-- Ensure the single fare_settings config row exists (migration seed fallback).
INSERT INTO fare_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE rid uuid := '1ec7683c-6445-4fe5-a960-d2fd1c3c446d';  -- Circle → Taifa
BEGIN
  -- Stops along the corridor (only if none seeded yet — don't clobber real stops)
  IF NOT EXISTS (SELECT 1 FROM route_stops WHERE route_id = rid) THEN
    INSERT INTO route_stops
      (route_id, stop_name, latitude, longitude, stop_order, is_terminal, distance_from_origin_km, source, is_verified)
    VALUES
      (rid, 'Circle',   5.5717, -0.1969, 0, true,  0.0, 'admin', true),
      (rid, 'Achimota', 5.6150, -0.2230, 1, false, 5.0, 'admin', true),
      (rid, 'Dome',     5.6520, -0.2280, 2, false, 9.0, 'admin', true),
      (rid, 'Taifa',    5.6800, -0.2330, 3, true, 11.0, 'admin', true);
  END IF;

  -- Stage fares from origin (Circle, order 0) to each drop-off
  INSERT INTO segment_fares
    (route_id, from_stop_order, to_stop_order, official_fare, source, is_official, effective_date)
  VALUES
    (rid, 0, 1, 4.00, 'seed', true, current_date),   -- Circle → Achimota
    (rid, 0, 2, 5.50, 'seed', true, current_date),   -- Circle → Dome
    (rid, 0, 3, 7.00, 'seed', true, current_date)    -- Circle → Taifa (= corridor)
  ON CONFLICT (route_id, from_stop_order, to_stop_order) DO UPDATE SET
    official_fare  = EXCLUDED.official_fare,
    is_official    = true,
    source         = 'seed',
    effective_date = EXCLUDED.effective_date,
    updated_at     = now();
END $$;
