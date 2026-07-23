// Version 1.1 — server.js
//
// Receives TradingView alert webhooks, looks up the token's risk score via
// the TNT House Risk-Data API, and only forwards the signal to your trading
// logic (or downstream webhook) if the token passes your risk threshold.
//
// Setup:
//   npm install
//   export TNT_RISK_API_KEY="tnt_sk_your_key_here"
//   export MIN_SAFETY_SCORE=50        # optional, defaults to 50
//   export FORWARD_WEBHOOK_URL=...    # optional, where to forward safe signals
//   node server.js
//
// TradingView alert message (Notifications -> Webhook URL) should be JSON
// and include the token mint address, e.g.:
//   { "mint": "{{ticker}}", "action": "buy", "price": "{{close}}" }
//
// TradingView's {{ticker}} won't be a Solana mint by default — this is meant
// as a template for whatever field your alert setup actually puts the mint
// address in (a custom alert message, or a lookup table you maintain).

const express = require('express');
const fetch = require('node-fetch');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const TNT_RISK_API_KEY = process.env.TNT_RISK_API_KEY;
const RISK_API_URL = 'https://tnt-audit.com/api/v1/token-risk';
const MIN_SAFETY_SCORE = Number(process.env.MIN_SAFETY_SCORE || 50);
const FORWARD_WEBHOOK_URL = process.env.FORWARD_WEBHOOK_URL || null;

if (!TNT_RISK_API_KEY) {
  console.error('Missing TNT_RISK_API_KEY env var.');
  process.exit(1);
}

async function fetchRisk(mint) {
  const res = await fetch(`${RISK_API_URL}?mint=${encodeURIComponent(mint)}`, {
    headers: { Authorization: `Bearer ${TNT_RISK_API_KEY}` },
    timeout: 15000,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`Risk-Data API returned ${res.status}: ${body}`);
    err.status = res.status;
    throw err;
  }

  return res.json();
}

function decide(riskData) {
  const score = riskData.safety_score;
  const hasInsiderClusters = Array.isArray(riskData.insider_clusters) && riskData.insider_clusters.length > 0;

  if (typeof score !== 'number') {
    return { approved: false, reason: 'no safety_score returned' };
  }
  if (riskData.honeypot_risk) {
    return { approved: false, reason: 'honeypot risk flagged' };
  }
  if (score < MIN_SAFETY_SCORE) {
    return { approved: false, reason: `safety_score ${score} below threshold ${MIN_SAFETY_SCORE}` };
  }
  if (hasInsiderClusters) {
    return { approved: true, reason: `passed with ${riskData.insider_clusters.length} insider cluster(s) noted`, warn: true };
  }
  return { approved: true, reason: 'passed all checks' };
}

app.post('/tradingview-webhook', async (req, res) => {
  const alert = req.body || {};
  const mint = alert.mint;

  if (!mint) {
    return res.status(400).json({ error: 'Alert payload missing "mint" field' });
  }

  console.log(`[alert] mint=${mint} action=${alert.action || 'n/a'}`);

  let riskData;
  try {
    riskData = await fetchRisk(mint);
  } catch (err) {
    console.error(`[risk-api-error] mint=${mint}:`, err.message);
    // Fail closed: if we can't verify risk, don't act on the signal.
    return res.status(502).json({ error: 'risk check failed, signal not forwarded', detail: err.message });
  }

  const decision = decide(riskData);
  console.log(`[decision] mint=${mint} approved=${decision.approved} reason="${decision.reason}"`);

  if (!decision.approved) {
    return res.status(200).json({ forwarded: false, decision, risk: riskData });
  }

  if (FORWARD_WEBHOOK_URL) {
    try {
      await fetch(FORWARD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...alert, risk: riskData }),
        timeout: 10000,
      });
    } catch (err) {
      console.error('[forward-error]', err.message);
      return res.status(502).json({ error: 'approved but forwarding failed', detail: err.message });
    }
  }

  return res.status(200).json({ forwarded: Boolean(FORWARD_WEBHOOK_URL), decision, risk: riskData });
});

app.get('/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`TradingView -> Risk-Data API webhook listening on :${PORT}`);
  console.log(`MIN_SAFETY_SCORE=${MIN_SAFETY_SCORE}, forwarding=${FORWARD_WEBHOOK_URL ? 'on' : 'off'}`);
});
