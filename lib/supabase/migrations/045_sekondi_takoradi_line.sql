-- Sekondi-Takoradi Western Line Commuter
-- 15 km, 7 stations, via Kojokrom junction
-- Mon-Fri workers' shuttle, operated by GRCL/GRDA
-- Source: grcl.gov.gh, GhanaWeb, Ghanaian Times
-- Note: Service may be intermittent — infrastructure under renovation

-- Insert the train line
INSERT INTO train_lines (id, name, code, color, official_fare, is_active)
VALUES (
  gen_random_uuid(),
  'Sekondi - Takoradi Commuter',
  'STK',
  '#10b981',  -- emerald green for Western Line
  10.00,      -- estimated commuter fare
  true
)
ON CONFLICT DO NOTHING;

-- Insert stations (order_index determines display order)
WITH line AS (SELECT id FROM train_lines WHERE code = 'STK' LIMIT 1)
INSERT INTO train_stations (id, line_id, name, order_index, is_active, latitude, longitude)
VALUES
  (gen_random_uuid(), (SELECT id FROM line), 'Sekondi',        1, true, 4.9377, -1.7102),
  (gen_random_uuid(), (SELECT id FROM line), 'Kojokrom',       2, true, 4.9636, -1.7245),
  (gen_random_uuid(), (SELECT id FROM line), 'Ketan',          3, true, 4.9511, -1.7289),
  (gen_random_uuid(), (SELECT id FROM line), 'Essaman',        4, true, 4.9237, -1.7369),
  (gen_random_uuid(), (SELECT id FROM line), 'Bakado',         5, true, 4.9379, -1.7295),
  (gen_random_uuid(), (SELECT id FROM line), 'New Takoradi',   6, true, 4.9046, -1.7479),
  (gen_random_uuid(), (SELECT id FROM line), 'Takoradi',       7, true, 4.8824, -1.7496)
ON CONFLICT DO NOTHING;
