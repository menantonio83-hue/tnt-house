-- Run this once in Supabase SQL Editor (new query tab), in addition to
-- supabase-votes-migration.sql. Adds columns to store REAL audit metrics
-- (top-10 holder concentration, LP-locked %, holder count) instead of
-- always showing "Unknown" for every token except the hardcoded MRDT case.

ALTER TABLE listed_tokens ADD COLUMN IF NOT EXISTS top10_percent NUMERIC;
ALTER TABLE listed_tokens ADD COLUMN IF NOT EXISTS lp_locked_percent NUMERIC;
ALTER TABLE listed_tokens ADD COLUMN IF NOT EXISTS holder_count INTEGER;
ALTER TABLE listed_tokens ADD COLUMN IF NOT EXISTS creator_balance_percent NUMERIC;
