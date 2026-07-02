-- Run once in Supabase SQL Editor (new query tab)
ALTER TABLE listed_tokens ADD COLUMN IF NOT EXISTS standard_program BOOLEAN;
