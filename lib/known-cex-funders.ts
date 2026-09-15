// Version 2.0 — lib/known-cex-funders.ts
//
// A small, manually-curated whitelist of Solana wallet addresses known
// to belong to centralized exchanges, bridges or co-signer
// infrastructure hot wallets. This is the SINGLE source of truth for
// both cluster surfaces:
//   - app/api/cluster-check/route.js (manual "Check Clusters" button)
//     excludes these funders from its cluster list (v1.10, unchanged);
//   - lib/insider-cluster-detector.ts (the real safety_score engine)
//     classifies them as funder_class: 'cex' with confidence 1.0 and
//     false_positive_likely: true, so a shared CEX/infra funding source
//     stops penalizing computeSafetyScoreBase (v7.3).
//
// v2.0: type changed from ReadonlySet<string> to Record<string, string>
// (address -> human label) so the detector can report the REAL label
// instead of just "excluded". route.js's old `.has()` caller was updated
// to match. The list is grown BY HAND, one verified address at a time:
//   1. a funder shows up in a cluster;
//   2. look it up on a free public explorer (solscan.io / solana.fm)
//      and confirm the exchange/infra label there;
//   3. add it below with the label and the date you checked (labels can
//      be re-used or retired, so a dated entry is easier to re-verify).
//
// Why the list can stay small: established exchange HOT wallets are
// already handled by the age/balance hop rules in the detector (v1.9/
// v7.0 — see git history), and the new composite infra heuristic in
// insider-cluster-detector v7.3 covers co-signer-style wallets. This
// allowlist covers the remaining gap with certain labels: verified
// addresses that either predate the heuristic or deserve a real name
// instead of an inferred one.
export const KNOWN_CEX_FUNDERS: Record<string, string> = {
  // Binance 2 Hot Wallet (verified on-chain 2026-09-15)
  '5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9': 'Binance Hot Wallet',
  // Fomo Co-signer Hot Wallet (verified on-chain 2026-09-15)
  'AgmLJBMDCqWynYnQiPCuj9ewsNNsBJXyzoUhD9LJzN51': 'Fomo Co-signer',
};
