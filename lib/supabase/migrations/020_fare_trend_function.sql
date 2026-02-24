-- Fare trend RPC: returns daily average fares for a route over a given period
-- Used by the fare trend chart on route detail pages

CREATE OR REPLACE FUNCTION get_fare_trend(
  p_route_id UUID,
  p_days INT DEFAULT 30
)
RETURNS TABLE (
  day DATE,
  avg_fare NUMERIC,
  min_fare NUMERIC,
  max_fare NUMERIC,
  report_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE(fr.reported_at) AS day,
    ROUND(AVG(fr.reported_fare)::numeric, 2) AS avg_fare,
    MIN(fr.reported_fare)::numeric AS min_fare,
    MAX(fr.reported_fare)::numeric AS max_fare,
    COUNT(*)::bigint AS report_count
  FROM fare_reports fr
  WHERE fr.route_id = p_route_id
    AND fr.reported_at >= NOW() - (p_days || ' days')::interval
  GROUP BY DATE(fr.reported_at)
  ORDER BY day ASC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant access
GRANT EXECUTE ON FUNCTION get_fare_trend(UUID, INT) TO anon;
GRANT EXECUTE ON FUNCTION get_fare_trend(UUID, INT) TO authenticated;
