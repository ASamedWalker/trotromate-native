-- Queue enhancements: add vehicle count + update stats view with computed wait times

-- 1. Add vehicle_count column to queue_reports
ALTER TABLE queue_reports ADD COLUMN IF NOT EXISTS vehicle_count INT;

-- 2. Recreate station_queue_stats view with vehicle counts and computed wait times
DROP VIEW IF EXISTS station_queue_stats;

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
    count(*) AS report_count_last_hour,
    avg(qr.vehicle_count) FILTER (WHERE qr.vehicle_count IS NOT NULL) AS avg_vehicle_count
  FROM queue_reports qr
  LEFT JOIN stations s ON lower(s.name) = lower(qr.station_name)
  WHERE qr.reported_at > now() - interval '1 hour'
  GROUP BY COALESCE(qr.station_id, s.id)
)
SELECT
  lr.station_id,
  lr.current_status,
  lr.last_report_at,
  COALESCE(hc.report_count_last_hour, 0) AS report_count_last_hour,
  round(hc.avg_vehicle_count::numeric, 1) AS avg_vehicle_count,
  round(
    (hc.avg_vehicle_count * 5)::numeric, 0  -- heuristic: ~5 min per vehicle in queue
  ) AS avg_wait_mins
FROM latest_reports lr
LEFT JOIN hourly_counts hc ON hc.station_id = lr.station_id;

-- Grant read access
GRANT SELECT ON station_queue_stats TO anon;
GRANT SELECT ON station_queue_stats TO authenticated;
