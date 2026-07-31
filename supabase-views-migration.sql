-- Run this once in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- v1.109: "Proof of Eyeballs" — real view counters on token cards.

CREATE TABLE IF NOT EXISTS token_views (
  ca TEXT PRIMARY KEY,
  views INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE token_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_views" ON token_views
  FOR SELECT USING (true);

-- Atomic increment function, callable by anon via PostgREST RPC.
-- SECURITY DEFINER means it runs with the owner's (postgres) privileges,
-- so it can write to token_views even though anon has no direct INSERT/
-- UPDATE grant on the table — avoids race conditions from concurrent
-- viewers opening the same token card at the same time.
CREATE OR REPLACE FUNCTION track_view(p_ca TEXT)
RETURNS TABLE(ca TEXT, views INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO token_views (ca, views)
  VALUES (p_ca, 1)
  ON CONFLICT (ca) DO UPDATE SET
    views = token_views.views + 1;

  RETURN QUERY
    SELECT token_views.ca, token_views.views
    FROM token_views WHERE token_views.ca = p_ca;
END;
$$;

GRANT EXECUTE ON FUNCTION track_view(TEXT) TO anon;
GRANT SELECT ON token_views TO anon;
