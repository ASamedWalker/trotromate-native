-- Station coordinates (Mapbox geocoding + manual curation)
-- Sources: [M] = Mapbox Geocoding API, [L] = manual lookup
-- Run: 2026-02-23

-- Major stations
UPDATE stations SET latitude = 5.556, longitude = -0.2055 WHERE name = 'Circle';           -- [L] Kwame Nkrumah Interchange
UPDATE stations SET latitude = 5.669, longitude = -0.1678 WHERE name = 'Madina';            -- [L] Madina Zongo Junction
UPDATE stations SET latitude = 5.6596, longitude = -0.0097 WHERE name = 'Tema Station';     -- [M] Tema main lorry park
UPDATE stations SET latitude = 5.5562, longitude = -0.231 WHERE name = 'Kaneshie';          -- [L] Kaneshie Market lorry park
UPDATE stations SET latitude = 5.6058, longitude = -0.2464 WHERE name = 'Lapaz';            -- [L] Lapaz Junction
UPDATE stations SET latitude = 5.614, longitude = -0.22 WHERE name = 'Achimota';            -- [L] Achimota Overpass station
UPDATE stations SET latitude = 5.6503, longitude = -0.1869 WHERE name = 'Legon';            -- [L] UG main gate area
UPDATE stations SET latitude = 5.7042, longitude = -0.1691 WHERE name = 'Adenta';           -- [M] Adenta Barrier
UPDATE stations SET latitude = 5.5326, longitude = -0.4375 WHERE name = 'Kasoa';            -- [M] Kasoa main market
UPDATE stations SET latitude = 5.5743, longitude = -0.289 WHERE name = 'Mallam';            -- [M] Mallam Junction
UPDATE stations SET latitude = 5.5468, longitude = -0.2657 WHERE name = 'Dansoman';         -- [M] Dansoman Roundabout
UPDATE stations SET latitude = 5.6944, longitude = -0.0295 WHERE name = 'Ashaiman';         -- [M] Ashaiman lorry park
UPDATE stations SET latitude = 5.6288, longitude = -0.0902 WHERE name = 'Spintex';          -- [M] Spintex Road junction

-- Other stations
UPDATE stations SET latitude = 5.548, longitude = -0.2115 WHERE name = 'Accra Central';     -- [L] Tudu/Makola area
UPDATE stations SET latitude = 5.647, longitude = -0.205 WHERE name = 'Haatso';             -- [L] Haatso junction
UPDATE stations SET latitude = 5.6636, longitude = -0.2652 WHERE name = 'Ofankor';          -- [M] Ofankor barrier
UPDATE stations SET latitude = 5.635, longitude = -0.187 WHERE name = 'Okponglo';           -- [L] Okponglo junction
UPDATE stations SET latitude = 5.634, longitude = -0.252 WHERE name = 'Taifa';              -- [L] Taifa junction
UPDATE stations SET latitude = 5.593, longitude = -0.164 WHERE name = 'Tetteh Quarshie';    -- [L] TQ Interchange
UPDATE stations SET latitude = 5.5869, longitude = -0.2076 WHERE name = '37 Station';          -- [L] Mapcarta N6968590872
-- Also rename if DB still has old name:
UPDATE stations SET name = '37 Station', latitude = 5.5869, longitude = -0.2076 WHERE name = '37 Military Hospital';
UPDATE stations SET latitude = 5.548, longitude = -0.252 WHERE name = 'Ablekuma';           -- [L] Ablekuma junction
UPDATE stations SET latitude = 5.715, longitude = -0.153 WHERE name = 'Abokobi';            -- [L] Abokobi town
UPDATE stations SET latitude = 5.6497, longitude = -0.1367 WHERE name = 'Adjringanor';      -- [M] Adjiringanor
UPDATE stations SET latitude = 5.605, longitude = -0.172 WHERE name = 'Airport';            -- [L] Kotoka area
UPDATE stations SET latitude = 5.596, longitude = -0.172 WHERE name = 'Airport City';       -- [L]
UPDATE stations SET latitude = 5.5709, longitude = -0.2025 WHERE name = 'Asylum Down';      -- [M]
UPDATE stations SET latitude = 5.692, longitude = -0.033 WHERE name = 'Atadeka';            -- [L] near Ashaiman
UPDATE stations SET latitude = 5.883, longitude = -0.097 WHERE name = 'Dodowa';             -- [L] Dodowa town
UPDATE stations SET latitude = 5.652, longitude = -0.231 WHERE name = 'Dome';               -- [L] Dome Market area
UPDATE stations SET latitude = 5.6393, longitude = -0.1625 WHERE name = 'East Legon';       -- [M]
UPDATE stations SET latitude = 5.5905, longitude = -0.197 WHERE name = 'Maamobi';           -- [M]
UPDATE stations SET latitude = 5.582, longitude = -0.1988 WHERE name = 'Nima';              -- [M]
UPDATE stations SET latitude = 5.556, longitude = -0.2055 WHERE name = 'Nkrumah Circle';    -- [L] Same as Circle
UPDATE stations SET latitude = 5.5607, longitude = -0.074 WHERE name = 'Nungua';            -- [L]
UPDATE stations SET latitude = 5.5606, longitude = -0.1824 WHERE name = 'Osu';              -- [M] Osu Oxford Street
UPDATE stations SET latitude = 5.62, longitude = -0.24 WHERE name = 'St Johns';             -- [L]
UPDATE stations SET latitude = 5.5835, longitude = -0.105 WHERE name = 'Teshie';            -- [L]
