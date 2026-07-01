-- Run this once in Supabase SQL Editor (Dashboard → SQL Editor → New query)

CREATE TABLE IF NOT EXISTS token_votes (
  ca TEXT PRIMARY KEY,
  upvotes INTEGER NOT NULL DEFAULT 0,
  downvotes INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE token_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_votes" ON token_votes
  FOR SELECT USING (true);

-- Atomic increment function, callable by anon via PostgREST RPC.
-- SECURITY DEFINER means it runs with the owner's (postgres) privileges,
-- so it can write to token_votes even though anon has no direct INSERT/
-- UPDATE grant on the table — avoids race conditions from read-then-write.
CREATE OR REPLACE FUNCTION cast_vote(p_ca TEXT, p_direction TEXT)
RETURNS TABLE(ca TEXT, upvotes INTEGER, downvotes INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO token_votes (ca, upvotes, downvotes)
  VALUES (
    p_ca,
    CASE WHEN p_direction = 'up' THEN 1 ELSE 0 END,
    CASE WHEN p_direction = 'down' THEN 1 ELSE 0 END
  )
  ON CONFLICT (ca) DO UPDATE SET
    upvotes = token_votes.upvotes + CASE WHEN p_direction = 'up' THEN 1 ELSE 0 END,
    downvotes = token_votes.downvotes + CASE WHEN p_direction = 'down' THEN 1 ELSE 0 END;

  RETURN QUERY
    SELECT token_votes.ca, token_votes.upvotes, token_votes.downvotes
    FROM token_votes WHERE token_votes.ca = p_ca;
END;
$$;

GRANT EXECUTE ON FUNCTION cast_vote(TEXT, TEXT) TO anon;
GRANT SELECT ON token_votes TO anon;
