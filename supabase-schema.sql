CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE verified_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  ca TEXT NOT NULL UNIQUE,
  price NUMERIC,
  liquidity NUMERIC,
  volume24h NUMERIC,
  priceChange24h NUMERIC,
  security_score INTEGER CHECK (security_score >= 0 AND security_score <= 100),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  audit_report JSONB,
  mint_authority TEXT,
  freeze_authority TEXT,
  top_holders JSONB,
  liquidity_locked BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_verified_tokens_status ON verified_tokens(status);
CREATE INDEX idx_verified_tokens_security_score ON verified_tokens(security_score DESC);
CREATE INDEX idx_verified_tokens_ca ON verified_tokens(ca);

CREATE TABLE submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ca TEXT NOT NULL,
  project_name TEXT,
  description TEXT,
  creator_wallet TEXT,
  tier TEXT CHECK (tier IN ('free', 'basic', 'fast-track', 'vip')),
  payment_amount NUMERIC,
  payment_signature TEXT,
  payment_verified BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'pending_payment',
  security_score INTEGER,
  audit_report JSONB,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  approved_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_submissions_status ON submissions(status);
CREATE INDEX idx_submissions_ca ON submissions(ca);

CREATE TABLE admin_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_wallet TEXT NOT NULL,
  action TEXT NOT NULL,
  submission_id UUID REFERENCES submissions(id),
  token_ca TEXT,
  old_status TEXT,
  new_status TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_admin_logs_admin_wallet ON admin_logs(admin_wallet);

ALTER TABLE verified_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_approved_tokens" ON verified_tokens FOR SELECT USING (status = 'approved');
CREATE POLICY "insert_submissions" ON submissions FOR INSERT WITH CHECK (true);
CREATE POLICY "read_own_submissions" ON submissions FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_verified_tokens_updated_at BEFORE UPDATE ON verified_tokens FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_submissions_updated_at BEFORE UPDATE ON submissions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();