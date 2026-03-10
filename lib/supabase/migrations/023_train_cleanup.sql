-- =============================================
-- Migration 023: Train data cleanup
-- - Update official fare from ₵5 to ₵15 (current TapnGo fare)
-- - Remove 'fare' from train report types (GRA sets fares, not crowdsourced)
-- =============================================

-- Update official fare to current price
UPDATE train_lines SET official_fare = 15.00 WHERE code = 'TMA';

-- Remove 'fare' from allowed report types
-- (existing fare reports are preserved but no new ones can be created)
ALTER TABLE train_reports DROP CONSTRAINT IF EXISTS train_reports_report_type_check;
ALTER TABLE train_reports ADD CONSTRAINT train_reports_report_type_check
  CHECK (report_type IN ('schedule', 'crowd', 'delay'));
