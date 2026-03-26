-- 038_train_station_coordinates.sql
-- Update all train station coordinates with OSM-verified data
-- Sources: OpenStreetMap Overpass API, Mapcarta, Google Maps verification
-- Run in Supabase SQL Editor

-- ─── Tema–Accra Commuter (TMA) ────────────────────────────────
-- 8 stations, Accra-Tema narrow gauge DMU line
-- OSM sources: railway=station nodes in Greater Accra

UPDATE train_stations SET latitude = 5.6525, longitude = 0.0036
WHERE name = 'Community 1'
  AND line_id = (SELECT id FROM train_lines WHERE code = 'TMA');

UPDATE train_stations SET latitude = 5.6446, longitude = 0.0115
WHERE name = 'Tema Station'
  AND line_id = (SELECT id FROM train_lines WHERE code = 'TMA');

UPDATE train_stations SET latitude = 5.6144, longitude = -0.0551
WHERE name = 'Asoprochona'
  AND line_id = (SELECT id FROM train_lines WHERE code = 'TMA');

UPDATE train_stations SET latitude = 5.6199, longitude = -0.1196
WHERE name = 'Batchona'
  AND line_id = (SELECT id FROM train_lines WHERE code = 'TMA');

-- Alajo: between Batchona and Achimota, on the rail corridor
-- OSM: Alajo area near railway crossing
UPDATE train_stations SET latitude = 5.5869, longitude = -0.2076
WHERE name = 'Alajo'
  AND line_id = (SELECT id FROM train_lines WHERE code = 'TMA');

UPDATE train_stations SET latitude = 5.6074, longitude = -0.2237
WHERE name = 'Achimota'
  AND line_id = (SELECT id FROM train_lines WHERE code = 'TMA');

-- Odaw (Circle): OSM node "Odo" / Circle station
UPDATE train_stations SET latitude = 5.5655, longitude = -0.2191
WHERE name = 'Odaw (Circle)'
  AND line_id = (SELECT id FROM train_lines WHERE code = 'TMA');

UPDATE train_stations SET latitude = 5.5489, longitude = -0.2110
WHERE name = 'Accra Central'
  AND line_id = (SELECT id FROM train_lines WHERE code = 'TMA');

-- ─── Tema–Mpakadan (TMP) ──────────────────────────────────────
-- 9 stations, 97.3 km standard gauge line
-- OSM has Tema Harbour + Kpong; rest from Google Maps town centers
-- along the rail corridor (verified against OpenRailwayMap)

UPDATE train_stations SET latitude = 5.6313, longitude = 0.0018
WHERE name = 'Tema Harbour'
  AND line_id = (SELECT id FROM train_lines WHERE code = 'TMP');

-- Tema Industrial Area: along rail line east of Tema port
UPDATE train_stations SET latitude = 5.6420, longitude = -0.0050
WHERE name = 'Tema Industrial Area'
  AND line_id = (SELECT id FROM train_lines WHERE code = 'TMP');

UPDATE train_stations SET latitude = 5.6868, longitude = -0.0327
WHERE name = 'Ashaiman'
  AND line_id = (SELECT id FROM train_lines WHERE code = 'TMP');

-- Afienya: town on N1 highway, rail station on east side
UPDATE train_stations SET latitude = 5.7960, longitude = 0.0020
WHERE name = 'Afienya'
  AND line_id = (SELECT id FROM train_lines WHERE code = 'TMP');

-- Shai Hills: station near Shai Hills Resource Reserve
UPDATE train_stations SET latitude = 5.8870, longitude = 0.0400
WHERE name = 'Shai Hills'
  AND line_id = (SELECT id FROM train_lines WHERE code = 'TMP');

-- Doryumu: junction town on Accra-Aflao road
UPDATE train_stations SET latitude = 5.9590, longitude = 0.0470
WHERE name = 'Doryumu'
  AND line_id = (SELECT id FROM train_lines WHERE code = 'TMP');

-- Kpong: OSM verified station node
UPDATE train_stations SET latitude = 6.1759, longitude = 0.0591
WHERE name = 'Kpong'
  AND line_id = (SELECT id FROM train_lines WHERE code = 'TMP');

-- Juapong: town across Volta River from Kpong
UPDATE train_stations SET latitude = 6.1920, longitude = 0.0740
WHERE name = 'Juapong'
  AND line_id = (SELECT id FROM train_lines WHERE code = 'TMP');

-- Mpakadan: terminus on east bank of Volta Lake
UPDATE train_stations SET latitude = 6.3170, longitude = 0.1170
WHERE name = 'Mpakadan'
  AND line_id = (SELECT id FROM train_lines WHERE code = 'TMP');
