-- Fix station_queue_stats: create as a view aggregating queue_reports
-- Matches by station_name since existing reports don't have station_id

-- Drop existing view or table
DROP VIEW IF EXISTS station_queue_stats;
DROP TABLE IF EXISTS station_queue_stats;

-- Create view that aggregates queue_reports per station
CREATE OR REPLACE VIEW station_queue_stats AS
WITH latest_reports AS (
  SELECT DISTINCT ON (COALESCE(qr.station_id, s.id))
    COALESCE(qr.station_id, s.id) AS station_id,
    qr.queue_status AS current_status,
    qr.reported_at AS last_report_at
  FROM queue_reports qr
  LEFT JOIN stations s ON lower(s.name) = lower(qr.station_name)
  WHERE qr.reported_at > now() - interval '24 hours'
  ORDER BY COALESCE(qr.station_id, s.id), qr.reported_at DESC
),
hourly_counts AS (
  SELECT
    COALESCE(qr.station_id, s.id) AS station_id,
    count(*) AS report_count_last_hour
  FROM queue_reports qr
  LEFT JOIN stations s ON lower(s.name) = lower(qr.station_name)
  WHERE qr.reported_at > now() - interval '1 hour'
  GROUP BY COALESCE(qr.station_id, s.id)
)
SELECT
  lr.station_id,
  lr.current_status,
  lr.last_report_at,
  COALESCE(hc.report_count_last_hour, 0) AS report_count_last_hour
FROM latest_reports lr
LEFT JOIN hourly_counts hc ON hc.station_id = lr.station_id;

-- Grant read access (anon can SELECT on views if underlying tables allow)
GRANT SELECT ON station_queue_stats TO anon;
GRANT SELECT ON station_queue_stats TO authenticated;
