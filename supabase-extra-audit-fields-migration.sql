-- Run once in Supabase SQL Editor (new query tab)
ALTER TABLE listed_tokens ADD COLUMN IF NOT EXISTS buy_tax_percent NUMERIC;
ALTER TABLE listed_tokens ADD COLUMN IF NOT EXISTS sell_tax_percent NUMERIC;
ALTER TABLE listed_tokens ADD COLUMN IF NOT EXISTS contract_renounced BOOLEAN;
ALTER TABLE listed_tokens ADD COLUMN IF NOT EXISTS hidden_owner TEXT;
ALTER TABLE listed_tokens ADD COLUMN IF NOT EXISTS age_days INTEGER;
