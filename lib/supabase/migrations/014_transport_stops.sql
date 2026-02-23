-- OSM-sourced transport stops (decorative layer, separate from main stations)
CREATE TABLE IF NOT EXISTS transport_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  osm_id BIGINT UNIQUE NOT NULL,
  name TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  stop_type TEXT NOT NULL CHECK (stop_type IN ('trotro_stop', 'bus_stop', 'lorry_park', 'taxi_rank')),
  tags JSONB DEFAULT '{}',
  linked_station_id UUID REFERENCES stations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transport_stops_type ON transport_stops(stop_type);
CREATE INDEX IF NOT EXISTS idx_transport_stops_linked ON transport_stops(linked_station_id) WHERE linked_station_id IS NOT NULL;

-- OSM route relations (transport corridors)
CREATE TABLE IF NOT EXISTS transport_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  osm_id BIGINT UNIQUE NOT NULL,
  name TEXT,
  ref TEXT,
  route_from TEXT,
  route_to TEXT,
  route_type TEXT NOT NULL CHECK (route_type IN ('bus', 'share_taxi', 'minibus')),
  coordinates JSONB NOT NULL,
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transport_routes_type ON transport_routes(route_type);

-- RLS policies (read-only for anon)
ALTER TABLE transport_stops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read transport stops" ON transport_stops FOR SELECT USING (true);

ALTER TABLE transport_routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read transport routes" ON transport_routes FOR SELECT USING (true);
