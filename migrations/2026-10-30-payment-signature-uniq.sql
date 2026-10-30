-- One on-chain signature can be credited to at most one API invoice.
-- site_orders already has site_orders_tx_signature_uniq. This is the
-- same rule for risk_api_payments. Safe to run more than once.
create unique index if not exists risk_api_payments_tx_signature_uniq
  on risk_api_payments (tx_signature)
  where tx_signature is not null;
