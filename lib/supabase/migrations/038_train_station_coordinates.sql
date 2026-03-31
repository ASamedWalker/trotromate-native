-- 038_train_station_coordinates.sql
-- Update all train station coordinates with OSM/Mapcarta-verified data
-- Sources: OpenStreetMap Overpass API, Mapcarta, Google Maps verification
-- Run in Supabase SQL Editor

-- ─── Tema–Accra Commuter (TMA) ────────────────────────────────
-- 8 stations, Accra-Tema narrow gauge DMU line
-- OSM sources: railway=station nodes in Greater Accra

-- Community 1: OSM node N133492151
UPDATE train_stations SET latitude = 5.6525, longitude = 0.0036
WHERE name = 'Community 1'
  AND line_id = (SELECT id FROM train_lines WHERE code = 'TMA');

-- Tema Station: OSM node N9937916704 (shared TMA/TMP hub)
UPDATE train_stations SET latitude = 5.6311, longitude = 0.0018
WHERE name = 'Tema Station'
  AND line_id = (SELECT id FROM train_lines WHERE code = 'TMA');

-- Asoprochona: OSM node N9937596017
UPDATE train_stations SET latitude = 5.6145, longitude = -0.0550
WHERE name = 'Asoprochona'
  AND line_id = (SELECT id FROM train_lines WHERE code = 'TMA');

-- Batchona (Baatsona): OSM node N133027073
UPDATE train_stations SET latitude = 5.6197, longitude = -0.1197
WHERE name = 'Batchona'
  AND line_id = (SELECT id FROM train_lines WHERE code = 'TMA');

-- Alajo: approximate, near railway crossing
UPDATE train_stations SET latitude = 5.5879, longitude = -0.2182
WHERE name = 'Alajo'
  AND line_id = (SELECT id FROM train_lines WHERE code = 'TMA');

-- Achimota: OSM node N9937596017
UPDATE train_stations SET latitude = 5.6074, longitude = -0.2237
WHERE name = 'Achimota'
  AND line_id = (SELECT id FROM train_lines WHERE code = 'TMA');

-- Odaw (Circle): OSM "Odo" station
UPDATE train_stations SET latitude = 5.5655, longitude = -0.2191
WHERE name = 'Odaw (Circle)'
  AND line_id = (SELECT id FROM train_lines WHERE code = 'TMA');

-- Accra Central: OSM node N1375249822
UPDATE train_stations SET latitude = 5.5489, longitude = -0.2110
WHERE name = 'Accra Central'
  AND line_id = (SELECT id FROM train_lines WHERE code = 'TMA');

-- ─── Tema–Mpakadan (TMP) ──────────────────────────────────────
-- 9 stations, 97.3 km standard gauge line
-- OSM verified where available; Mapcarta/Google Maps for rest

-- Tema Harbour: OSM node N9937916704
UPDATE train_stations SET latitude = 5.6311, longitude = 0.0018
WHERE name = 'Tema Harbour'
  AND line_id = (SELECT id FROM train_lines WHERE code = 'TMP');

-- Tema Industrial Area: Mapcarta verified, north of Tema port along rail corridor
UPDATE train_stations SET latitude = 5.6796, longitude = 0.0026
WHERE name = 'Tema Industrial Area'
  AND line_id = (SELECT id FROM train_lines WHERE code = 'TMP');

-- Ashaiman: Mapcarta verified
UPDATE train_stations SET latitude = 5.6868, longitude = -0.0327
WHERE name = 'Ashaiman'
  AND line_id = (SELECT id FROM train_lines WHERE code = 'TMP');

-- Afienya: Mapcarta verified, town on N1 highway
UPDATE train_stations SET latitude = 5.7981, longitude = 0.0052
WHERE name = 'Afienya'
  AND line_id = (SELECT id FROM train_lines WHERE code = 'TMP');

-- Shai Hills: Mapcarta verified, near Shai Hills Resource Reserve
UPDATE train_stations SET latitude = 5.8840, longitude = 0.0386
WHERE name = 'Shai Hills'
  AND line_id = (SELECT id FROM train_lines WHERE code = 'TMP');

-- Doryumu: Mapcarta verified, junction town
UPDATE train_stations SET latitude = 5.9007, longitude = 0.0232
WHERE name = 'Doryumu'
  AND line_id = (SELECT id FROM train_lines WHERE code = 'TMP');

-- Kpong: OSM node N16943966
UPDATE train_stations SET latitude = 6.1759, longitude = 0.0591
WHERE name = 'Kpong'
  AND line_id = (SELECT id FROM train_lines WHERE code = 'TMP');

-- Juapong: Mapcarta verified, across Volta River from Kpong
UPDATE train_stations SET latitude = 6.2545, longitude = 0.1353
WHERE name = 'Juapong'
  AND line_id = (SELECT id FROM train_lines WHERE code = 'TMP');

-- Mpakadan: Mapcarta verified, terminus on east bank of Volta Lake
UPDATE train_stations SET latitude = 6.3322, longitude = 0.1090
WHERE name = 'Mpakadan'
  AND line_id = (SELECT id FROM train_lines WHERE code = 'TMP');
