'use client';

// app/pay/page.js
// Version 1.4
//
// FIX v1.4: previously this page ONLY ever looked at window.phantom?.solana,
// so no matter which wallet the user picked on the main page (Phantom or
// Solflare), landing here after the Solflare redirect still failed/fell
// back to Phantom's flow. Now reads a `wallet` query param (set by
// app/page.js's handleConfirmPayment / handleBannerConfirmPayment) and
// picks window.solflare vs window.phantom.solana accordingly.
//
// WHY THIS PAGE EXISTS: both Solana Pay URI approaches failed in production
// (17 days of testing across SOL/MRDT/USDC):
// - Static Transfer Request (solana:addr?amount=X&spl-token=Y): recipient
//   and token parse correctly, but Phantom Android renders its generic
//   "Send" screen (not the real Solana Pay confirm screen) and drops the
//   `amount` query param — it always shows 0, user must type it manually.
// - Transaction Request (solana:{encoded /api/pay URL}): amount is correct
//   (baked into a real server-built transaction), but Phantom's Blowfish
//   integration hard-blocks it as a "potentially malicious dApp" — the
//   domain-review appeal (#11857) was rejected.
//
// THIS APPROACH: open this page INSIDE Phantom's own in-app browser via the
// `https://phantom.app/ul/browse/{url}` universal link. Once loaded there,
// `window.phantom.solana` is injected directly (no deeplink query-string
// parsing involved at all). We build the transaction on the client with
// @solana/web3.js / @solana/spl-token — same exact amount, decimals read
// live from the mint — and call `signAndSendTransaction`. Phantom shows its
// real, standard confirm screen with the correct amount, because the amount
// lives inside the transaction itself, not a URL param. This is the same
// pattern used by Jupiter, Magic Eden, etc., so it does not trigger the
// "fetches and blind-signs a server-built tx" pattern that got Approach B
// blocked.
//
// The original tab that opened this page keeps running its own
// startPaymentVerification() polling loop (unchanged) — that loop checks
// Helius for a matching transfer to WALLET_ADDRESS regardless of which
// browser/tab actually sent it, so no round-trip back to the original tab
// is needed here. This page's only job is: connect, build, sign, send.

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  getMint,
} from '@solana/spl-token';

const WALLET_ADDRESS = 'Ev6oXBXo6qyoaT5wypJ2Umxch91F7cFvE1SarYLaUn8Z';
const MRDT_CA = '8Q22r9qUm4AzFzTpZgaPYMxqq4z5WxE9FVa7X9dsvmBg';
const USDC_CA = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
// FIX v1.2: route through our own /api/rpc proxy (backed by the server-side
// Helius key) instead of hitting the public Solana RPC directly from the
// client — the public endpoint returned 403 Access forbidden almost
// immediately when called from inside Phantom's in-app browser.

function PayInner() {
  const searchParams = useSearchParams();
  const amount = parseFloat(searchParams.get('amount') || '0');
  const method = (searchParams.get('method') || 'SOL').toUpperCase(); // SOL | MRDT | USDC
  const label = searchParams.get('label') || 'TNT House Payment';
  // FIX v1.4: which wallet the user picked on the main page — defaults to
  // Phantom for old links that don't have this param yet.
  const wallet = searchParams.get('wallet') || 'Phantom';

  // idle -> connecting -> building -> signing -> sent | error
  const [status, setStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [signature, setSignature] = useState('');

  // FIX v1.3: log every stage transition to /api/pay-log. Vercel's free
  // Web Analytics doesn't support custom events, so this is the only way
  // to see WHERE a visitor drops off (no Phantom, rejected connect, RPC
  // failure building the tx, rejected sign, etc.) instead of just seeing
  // "2 visits, 0 orders" with no further detail.
  const logStage = function (stage, extra) {
    try {
      fetch('/api/pay-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage, amount, method, label, ...extra }),
      }).catch(function () {});
    } catch (e) {}
  };

  const pay = async function () {
    try {
      setStatus('connecting');
      logStage('connecting');
      // FIX v1.4: pick the provider based on which wallet the user chose,
      // instead of always requiring window.phantom.solana.
      const isSolflare = wallet === 'Solflare';
      const provider = typeof window === 'undefined'
        ? null
        : isSolflare
          ? window.solflare
          : window.phantom?.solana;

      const providerOk = isSolflare
        ? provider && provider.isSolflare
        : provider && provider.isPhantom;

      if (!providerOk) {
        setErrorMsg(
          'This page needs to be opened inside the ' + wallet + ' app browser.',
        );
        setStatus('error');
        logStage('error', { reason: 'no_' + wallet.toLowerCase() + '_provider' });
        return;
      }

      const resp = await provider.connect();
      const payer = resp.publicKey;
      logStage('connected', { payer: payer.toString() });

      setStatus('building');
      const rpcProxyUrl = window.location.origin + '/api/rpc';
      const connection = new Connection(rpcProxyUrl, 'confirmed');
      const tx = new Transaction();

      if (method === 'SOL') {
        tx.add(
          SystemProgram.transfer({
            fromPubkey: payer,
            toPubkey: new PublicKey(WALLET_ADDRESS),
            lamports: Math.round(amount * LAMPORTS_PER_SOL),
          }),
        );
      } else {
        // SPL token (MRDT or USDC) — decimals read live from the mint,
        // same as /api/pay's Transaction Request build, so both paths
        // always agree on the exact token amount.
        const mintCA = method === 'USDC' ? USDC_CA : MRDT_CA;
        const mintPubkey = new PublicKey(mintCA);
        const mintInfo = await getMint(connection, mintPubkey);
        const tokenAmount = Math.round(amount * Math.pow(10, mintInfo.decimals));

        const senderATA = await getAssociatedTokenAddress(mintPubkey, payer);
        const recipientPubkey = new PublicKey(WALLET_ADDRESS);
        const recipientATA = await getAssociatedTokenAddress(mintPubkey, recipientPubkey);

        const recipientAccountInfo = await connection.getAccountInfo(recipientATA);
        if (!recipientAccountInfo) {
          tx.add(
            createAssociatedTokenAccountInstruction(
              payer,
              recipientATA,
              recipientPubkey,
              mintPubkey,
            ),
          );
        }

        tx.add(createTransferInstruction(senderATA, recipientATA, payer, tokenAmount));
      }

      tx.feePayer = payer;
      const { blockhash } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      logStage('built');

      setStatus('signing');
      logStage('signing');
      const result = await provider.signAndSendTransaction(tx);
      setSignature(result.signature);
      setStatus('sent');
      logStage('sent', { signature: result.signature });
    } catch (e) {
      console.error('Payment error:', e);
      setErrorMsg(e?.message || 'Payment failed. Please try again.');
      setStatus('error');
      logStage('error', { reason: e?.message || 'unknown' });
    }
  };

  useEffect(function () {
    if (amount > 0 && method) {
      pay();
    } else {
      setErrorMsg('Missing or invalid payment amount.');
      setStatus('error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-black text-white font-mono flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-sm w-full bg-purple-900/20 border border-purple-500/30 rounded-2xl p-8">
        <div className="text-2xl font-black text-purple-400 mb-2">TNT House</div>
        <div className="text-sm text-slate-400 mb-6">{label}</div>

        <div className="text-3xl font-black text-emerald-400 mb-6">
          {amount} {method}
        </div>

        {status === 'idle' && <div className="text-slate-400">Preparing...</div>}
        {status === 'connecting' && <div className="text-purple-300">🔗 Connecting to Phantom...</div>}
        {status === 'building' && <div className="text-purple-300">⚙️ Building transaction...</div>}
        {status === 'signing' && (
          <div className="text-purple-300">✍️ Confirm the payment in Phantom...</div>
        )}
        {status === 'sent' && (
          <div>
            <div className="text-emerald-400 font-bold mb-2">✅ Payment sent!</div>
            <div className="text-xs text-slate-500 break-all mb-4">{signature}</div>
            <div className="text-sm text-slate-400">
              You can close this tab and return to TNT House — your token/banner will appear
              automatically once the payment confirms.
            </div>
          </div>
        )}
        {status === 'error' && (
          <div>
            <div className="text-red-400 font-bold mb-2">❌ {errorMsg}</div>
            <button
              onClick={pay}
              className="mt-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-emerald-400 text-black font-bold rounded-lg"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PayPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black text-white flex items-center justify-center">
          Loading...
        </div>
      }
    >
      <PayInner />
    </Suspense>
  );
}
