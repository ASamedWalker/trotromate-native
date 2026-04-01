-- 044_route_stops.sql
-- Intermediate stops along trotro routes
-- Enables: stop-by-stop route display, intermediate stop search, "alight at X" UX
-- Run in Supabase SQL Editor

-- ═══════════════════════════════════════════════════════════
-- TABLE: route_stops
-- Links routes to ordered sequence of stops they pass through
-- Follows train_stations pattern (line_id + order_index)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS route_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Route this stop belongs to
  route_id UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,

  -- Optional link to OSM transport_stops (NULL if stop not in OSM data)
  transport_stop_id UUID REFERENCES transport_stops(id) ON DELETE SET NULL,

  -- Denormalized for fast reads (avoids join on every route detail load)
  stop_name TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,

  -- Sequential order: 0 = origin, N = destination
  stop_order SMALLINT NOT NULL,

  -- Terminal = origin or destination (matches routes.from_location / to_location)
  is_terminal BOOLEAN NOT NULL DEFAULT false,

  -- Distance/time from route origin (populated by seed script)
  distance_from_origin_km DECIMAL(6, 2),
  duration_from_origin_mins SMALLINT,

  -- Provenance
  source TEXT NOT NULL DEFAULT 'osm' CHECK (source IN ('osm', 'community', 'admin')),
  is_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),

  -- One stop per position per route
  UNIQUE(route_id, stop_order)
);

-- ── Indexes ──────────────────────────────────────────────

-- Primary: all stops for a route, in order (route detail page)
CREATE INDEX idx_route_stops_route_order ON route_stops(route_id, stop_order);

-- Reverse: which routes pass through this stop? (search by intermediate stop)
CREATE INDEX idx_route_stops_name ON route_stops(lower(stop_name));

-- Geo: find route_stops near a coordinate
CREATE INDEX idx_route_stops_geo ON route_stops(latitude, longitude);

-- FK lookup
CREATE INDEX idx_route_stops_transport_stop ON route_stops(transport_stop_id)
  WHERE transport_stop_id IS NOT NULL;

-- ── RLS ──────────────────────────────────────────────────

ALTER TABLE route_stops ENABLE ROW LEVEL SECURITY;

-- Public read (route stops are public transit data)
CREATE POLICY "Anyone can read route stops"
  ON route_stops FOR SELECT USING (true);

-- Community can suggest stops (source = 'community', is_verified = false)
CREATE POLICY "Anyone can suggest route stops"
  ON route_stops FOR INSERT WITH CHECK (source = 'community' AND is_verified = false);

-- ── Helper: stop count per route ─────────────────────────

CREATE OR REPLACE VIEW route_stop_counts AS
SELECT
  route_id,
  COUNT(*) as total_stops,
  COUNT(*) FILTER (WHERE NOT is_terminal) as intermediate_stops
FROM route_stops
GROUP BY route_id;
