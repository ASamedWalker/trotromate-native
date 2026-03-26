-- Completed trips: every GO Mode trip becomes a persistent data asset.
-- This is Troski's data flywheel — each tracked trip builds our route intelligence.

CREATE TABLE IF NOT EXISTS completed_trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL,
  route_id TEXT,                          -- FK to routes (null for train trips without a route row)
  train_line_id UUID,                     -- FK to train_lines (null for trotro trips)
  transport_type TEXT NOT NULL DEFAULT 'trotro' CHECK (transport_type IN ('trotro', 'train')),

  from_location TEXT NOT NULL,
  to_location TEXT NOT NULL,
  from_lat DOUBLE PRECISION,
  from_lng DOUBLE PRECISION,
  to_lat DOUBLE PRECISION,
  to_lng DOUBLE PRECISION,

  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_mins INTEGER,                  -- computed: ended_at - started_at
  distance_km NUMERIC(6,2),              -- straight-line from station coords

  fare_paid NUMERIC(8,2),                -- post-trip user input (GH₵)
  fare_currency TEXT NOT NULL DEFAULT 'GHS',

  -- Trip quality metadata
  station_count INTEGER,                 -- how many stations on the route
  reached_destination BOOLEAN DEFAULT false, -- did the "arrived" alert fire?

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_completed_trips_device ON completed_trips(device_id);
CREATE INDEX IF NOT EXISTS idx_completed_trips_route ON completed_trips(route_id) WHERE route_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_completed_trips_train_line ON completed_trips(train_line_id) WHERE train_line_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_completed_trips_transport ON completed_trips(transport_type);
CREATE INDEX IF NOT EXISTS idx_completed_trips_created ON completed_trips(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_completed_trips_from_to ON completed_trips(from_location, to_location);

-- RLS: anyone can insert (anon key), only own trips readable
ALTER TABLE completed_trips ENABLE ROW LEVEL SECURITY;

CREATE POLICY completed_trips_insert ON completed_trips
  FOR INSERT WITH CHECK (true);

CREATE POLICY completed_trips_select_own ON completed_trips
  FOR SELECT USING (device_id = current_setting('request.headers', true)::json->>'x-device-id'
                    OR current_setting('role', true) = 'service_role');

-- View: route popularity from actual trips (not just searches)
CREATE OR REPLACE VIEW route_trip_stats AS
SELECT
  route_id,
  from_location,
  to_location,
  transport_type,
  COUNT(*) AS trip_count,
  AVG(duration_mins) AS avg_duration_mins,
  AVG(distance_km) AS avg_distance_km,
  AVG(fare_paid) AS avg_fare_paid,
  COUNT(fare_paid) AS fare_data_points,
  MAX(created_at) AS last_trip_at
FROM completed_trips
WHERE route_id IS NOT NULL
GROUP BY route_id, from_location, to_location, transport_type;
