-- Tema-Mpakadan Railway Line
-- 97.3 km, 9 stations, zone-based fares (₵15/₵25/₵40)
-- Launched Oct 2025, operated by GRDA
-- Source: grda.gov.gh, GhanaWeb, Graphic Online

-- Insert the train line
INSERT INTO train_lines (id, name, code, color, official_fare, is_active)
VALUES (
  gen_random_uuid(),
  'Tema - Mpakadan Commuter',
  'TMP',
  '#16a34a',  -- green to distinguish from sky-blue TMA
  40.00,      -- full trip fare (zone 1 + zone 2)
  true
)
ON CONFLICT DO NOTHING;

-- Insert stations (order_index determines display order)
WITH line AS (SELECT id FROM train_lines WHERE code = 'TMP' LIMIT 1)
INSERT INTO train_stations (id, line_id, name, order_index, is_active)
VALUES
  (gen_random_uuid(), (SELECT id FROM line), 'Tema Harbour',         1, true),
  (gen_random_uuid(), (SELECT id FROM line), 'Tema Industrial Area', 2, true),
  (gen_random_uuid(), (SELECT id FROM line), 'Ashaiman',             3, true),
  (gen_random_uuid(), (SELECT id FROM line), 'Afienya',              4, true),
  (gen_random_uuid(), (SELECT id FROM line), 'Shai Hills',           5, true),
  (gen_random_uuid(), (SELECT id FROM line), 'Doryumu',              6, true),
  (gen_random_uuid(), (SELECT id FROM line), 'Kpong',                7, true),
  (gen_random_uuid(), (SELECT id FROM line), 'Juapong',              8, true),
  (gen_random_uuid(), (SELECT id FROM line), 'Mpakadan',             9, true)
ON CONFLICT DO NOTHING;
