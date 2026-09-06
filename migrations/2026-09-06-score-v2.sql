-- Version 1.0 — migrations/2026-09-06-score-v2.sql
-- Provenance columns for the V2 scoring rollout (lib/scoring.ts).
--
-- score_version:
--   'v1'                -> original score, pre-unification (default)
--   'v2'                -> recomputed under the canonical formula
--   'insufficient_data' -> not scored: row lacks top10_percent, so the
--                          concentration caps could not be evaluated and any
--                          number would be optimistic
--
-- recalculated_at is DELIBERATELY separate from the original audit time. The
-- underlying market figures are still as-of the original audit; only the
-- formula is new. The UI must say so rather than silently show a new number.

ALTER TABLE listed_tokens
  ADD COLUMN IF NOT EXISTS score_version TEXT NOT NULL DEFAULT 'v1',
  ADD COLUMN IF NOT EXISTS recalculated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS listed_tokens_score_version_idx
  ON listed_tokens (score_version);
