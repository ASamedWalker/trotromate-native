-- 052_segment_fares.sql
-- Per-drop-off (stage) fares: the fare from a BOARDING stop to an ALIGHTING stop
-- along a route. Trotro fares are stage-based, not flat per corridor.
--
-- Sources: GPRTU official, station charts, drivers (Trotro Pro), crowd, manual seed.
-- Maintenance: Ghana fares move by a single NATIONAL % → store official fares once,
-- re-price by a multiplier per GPRTU announcement (reprice_segment_fares()).
--
-- Build-first: GPRTU partnership comes later. Until segment_fares is populated the
-- app falls back to the flat corridor fare, so this is additive + safe.
-- (Project runs WITHOUT RLS — no policies added here.)

-- ── 1. Capture drop-off in fare reports (board + alight stops) ────────────────
ALTER TABLE fare_reports
  ADD COLUMN IF NOT EXISTS from_stop_id UUID REFERENCES route_stops(id),
  ADD COLUMN IF NOT EXISTS to_stop_id   UUID REFERENCES route_stops(id);

-- ── 2. Segment fare store (board stop_order → alight stop_order on a route) ───
CREATE TABLE IF NOT EXISTS segment_fares (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id          UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  from_stop_order   INT  NOT NULL DEFAULT 0,   -- board; 0 = route origin
  to_stop_order     INT  NOT NULL,             -- alight / drop-off
  official_fare     NUMERIC(10,2),             -- GPRTU / authoritative
  avg_reported_fare NUMERIC(10,2),             -- crowdsourced aggregate
  min_fare          NUMERIC(10,2),
  max_fare          NUMERIC(10,2),
  report_count      INT  NOT NULL DEFAULT 0,
  last_report_at    TIMESTAMPTZ,
  source            TEXT NOT NULL DEFAULT 'seed'
                      CHECK (source IN ('gprtu','station','driver','crowd','seed')),
  is_official       BOOLEAN NOT NULL DEFAULT false,
  effective_date    DATE,
  fare_version      INT  NOT NULL DEFAULT 1,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (route_id, from_stop_order, to_stop_order)
);
CREATE INDEX IF NOT EXISTS idx_segment_fares_route ON segment_fares(route_id);

-- ── 3. Global fare settings (national % multiplier + current version) ─────────
CREATE TABLE IF NOT EXISTS fare_settings (
  id                  INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),  -- single row
  national_multiplier NUMERIC(6,4) NOT NULL DEFAULT 1.0,
  current_version     INT  NOT NULL DEFAULT 1,
  effective_date      DATE NOT NULL DEFAULT current_date,
  note                TEXT,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO fare_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ── 4. National re-price: multiply official fares, bump version + date ────────
-- Usage on a GPRTU change: SELECT reprice_segment_fares(1.20, '2026-06-02', '+20% GPRTU');
CREATE OR REPLACE FUNCTION reprice_segment_fares(p_factor NUMERIC, p_effective DATE, p_note TEXT DEFAULT NULL)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE v_new_version INT;
BEGIN
  UPDATE fare_settings
    SET national_multiplier = national_multiplier * p_factor,
        current_version     = current_version + 1,
        effective_date      = p_effective,
        note                = p_note,
        updated_at          = now()
    WHERE id = 1
    RETURNING current_version INTO v_new_version;

  UPDATE segment_fares
    SET official_fare  = ROUND(official_fare * p_factor, 2),
        fare_version   = v_new_version,
        effective_date = p_effective,
        updated_at     = now()
    WHERE official_fare IS NOT NULL;

  RETURN v_new_version;
END $$;

-- ── 5. Fold a crowdsourced report into a segment's aggregate ──────────────────
-- Recomputes avg/min/max/count for (route, from_order, to_order). Called after a
-- fare_report with a drop-off is inserted (from the app or a trigger later).
CREATE OR REPLACE FUNCTION apply_fare_report_to_segment(
  p_route_id UUID, p_from_order INT, p_to_order INT, p_fare NUMERIC
) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO segment_fares (route_id, from_stop_order, to_stop_order,
                             avg_reported_fare, min_fare, max_fare,
                             report_count, last_report_at, source)
  VALUES (p_route_id, p_from_order, p_to_order, p_fare, p_fare, p_fare, 1, now(), 'crowd')
  ON CONFLICT (route_id, from_stop_order, to_stop_order) DO UPDATE SET
    avg_reported_fare = ROUND(
      ((COALESCE(segment_fares.avg_reported_fare, 0) * segment_fares.report_count) + p_fare)
      / (segment_fares.report_count + 1), 2),
    min_fare       = LEAST(COALESCE(segment_fares.min_fare, p_fare), p_fare),
    max_fare       = GREATEST(COALESCE(segment_fares.max_fare, p_fare), p_fare),
    report_count   = segment_fares.report_count + 1,
    last_report_at = now(),
    updated_at     = now();
END $$;

-- ── 6. Grants (app uses the anon key; project runs without RLS) ───────────────
ALTER TABLE segment_fares DISABLE ROW LEVEL SECURITY;
ALTER TABLE fare_settings DISABLE ROW LEVEL SECURITY;
GRANT SELECT ON segment_fares TO anon, authenticated;
GRANT SELECT ON fare_settings TO anon, authenticated;
ALTER FUNCTION apply_fare_report_to_segment(uuid, int, int, numeric) SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION apply_fare_report_to_segment(uuid, int, int, numeric) TO anon, authenticated;
