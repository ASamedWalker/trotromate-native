-- 036: Add GPRTU fare verification fields to routes
-- Allows distinguishing GPRTU-endorsed official fares from crowdsourced data

ALTER TABLE routes ADD COLUMN IF NOT EXISTS fare_approved_at TIMESTAMPTZ;
ALTER TABLE routes ADD COLUMN IF NOT EXISTS fare_approved_by TEXT;
ALTER TABLE routes ADD COLUMN IF NOT EXISTS is_gprtu_verified BOOLEAN NOT NULL DEFAULT false;

-- Partial index for fast filtering of verified routes
CREATE INDEX IF NOT EXISTS idx_routes_gprtu_verified
  ON routes(is_gprtu_verified) WHERE is_gprtu_verified = true;
