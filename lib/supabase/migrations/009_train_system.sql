-- 009_train_system.sql
-- Crowdsourced train/rail module for Troski

-- ─── Train Lines ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS train_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  color text NOT NULL DEFAULT '#0ea5e9',
  official_fare numeric,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE train_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read train_lines"
  ON train_lines FOR SELECT
  USING (true);

-- ─── Train Stations ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS train_stations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  line_id uuid NOT NULL REFERENCES train_lines(id) ON DELETE CASCADE,
  order_index int NOT NULL,
  latitude numeric,
  longitude numeric,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(line_id, order_index)
);

ALTER TABLE train_stations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read train_stations"
  ON train_stations FOR SELECT
  USING (true);

-- ─── Train Reports ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS train_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id uuid NOT NULL REFERENCES train_lines(id) ON DELETE CASCADE,
  station_id uuid NOT NULL REFERENCES train_stations(id) ON DELETE CASCADE,
  report_type text NOT NULL CHECK (report_type IN ('schedule', 'crowd', 'fare', 'delay')),
  direction text CHECK (direction IN ('inbound', 'outbound')),
  crowd_level text CHECK (crowd_level IN ('empty', 'few_seats', 'standing', 'packed')),
  reported_fare numeric,
  delay_mins int,
  notes text,
  device_id text NOT NULL,
  reported_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE train_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read train_reports"
  ON train_reports FOR SELECT
  USING (true);

CREATE POLICY "Public insert train_reports"
  ON train_reports FOR INSERT
  WITH CHECK (true);

-- Index for common queries
CREATE INDEX idx_train_reports_line ON train_reports(line_id, reported_at DESC);
CREATE INDEX idx_train_reports_station ON train_reports(station_id, reported_at DESC);

-- ─── Train Report Stats (View) ─────────────────────────────
CREATE OR REPLACE VIEW train_report_stats AS
SELECT
  tl.id AS line_id,
  tl.name AS line_name,
  COUNT(tr.id) AS total_reports,
  COUNT(CASE WHEN tr.report_type = 'fare' THEN 1 END) AS fare_reports,
  AVG(CASE WHEN tr.report_type = 'fare' THEN tr.reported_fare END) AS avg_fare,
  COUNT(CASE WHEN tr.report_type = 'crowd' THEN 1 END) AS crowd_reports,
  COUNT(CASE WHEN tr.report_type = 'schedule' THEN 1 END) AS schedule_reports,
  COUNT(CASE WHEN tr.report_type = 'delay' THEN 1 END) AS delay_reports,
  AVG(CASE WHEN tr.report_type = 'delay' THEN tr.delay_mins END) AS avg_delay_mins,
  MAX(tr.reported_at) AS last_report_at
FROM train_lines tl
LEFT JOIN train_reports tr ON tr.line_id = tl.id
WHERE tl.is_active = true
GROUP BY tl.id, tl.name;

-- ─── Seed Data: Tema–Accra Commuter Line ───────────────────
-- Source: grcl.gov.gh / grda.gov.gh — Accra-Tema DMU service
-- Morning (S112): Community 1 06:00 → Accra Central 07:30
-- Evening (S117): Accra Central 17:40 → Community 1 19:22
-- Fare: GH₵5.00 | Mon–Sat | DMU 360 seats

INSERT INTO train_lines (name, code, color, official_fare, is_active)
VALUES ('Tema – Accra Commuter', 'TMA', '#0ea5e9', 5.00, true)
ON CONFLICT (code) DO NOTHING;

-- 8 stations in order (Community 1 → Accra Central)
WITH line AS (SELECT id FROM train_lines WHERE code = 'TMA')
INSERT INTO train_stations (name, line_id, order_index, latitude, longitude) VALUES
  ('Community 1',       (SELECT id FROM line), 1, 5.6698, -0.0166),
  ('Tema Station',      (SELECT id FROM line), 2, 5.6696, -0.0120),
  ('Asoprochona',       (SELECT id FROM line), 3, 5.6605, -0.0394),
  ('Batchona',          (SELECT id FROM line), 4, 5.6329, -0.1105),
  ('Alajo',             (SELECT id FROM line), 5, 5.5780, -0.2100),
  ('Achimota',          (SELECT id FROM line), 6, 5.5918, -0.2278),
  ('Odaw (Circle)',     (SELECT id FROM line), 7, 5.5712, -0.2220),
  ('Accra Central',     (SELECT id FROM line), 8, 5.5500, -0.2131)
ON CONFLICT (line_id, order_index) DO NOTHING;
