'use client';

import { useState, useRef, useEffect } from 'react';

interface PaymentModalProps {
  amount: number;
  onPaymentSuccess?: (data: { amount: number; signature: string }) => void;
  onClose?: () => void;
}

export default function PaymentModal({ amount, onPaymentSuccess, onClose }: PaymentModalProps) {
  const [status, setStatus] = useState<'idle' | 'deeplink' | 'verifying' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [verifyAttempt, setVerifyAttempt] = useState(0);
  const initiatedAtRef = useRef<number | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const VERIFY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
  const POLL_INTERVAL_MS = 3000; // Check every 3 seconds
  const MAX_VERIFY_ATTEMPTS = 300; // ~900 seconds of polling

  // Initiate payment via Solana Pay deeplink
  const handlePayment = async () => {
    try {
      setStatus('deeplink');
      setErrorMsg('');
      setVerifyAttempt(0);

      // Store when payment was initiated
      initiatedAtRef.current = Date.now();
      setTimeLeft(VERIFY_TIMEOUT_MS / 1000);

      // Build Solana Pay deeplink
      const WALLET_ADDRESS = 'Ev6oXBXo6qyoaT5wypJ2Umxch91F7cFvE1SarYLaUn8Z';
      const MRDT_CA = '8Q22r9qUm4AzFzTpZgaPYMxqq4z5WxE9FVa7X9dsvmBg';
      const orderId = `TNT_${Date.now()}`;

      const deeplink = new URL('solana:' + WALLET_ADDRESS);
      deeplink.searchParams.set('amount', amount.toString());
      deeplink.searchParams.set('spl-token', MRDT_CA);
      deeplink.searchParams.set('reference', orderId);
      deeplink.searchParams.set('label', 'TNT House Audit');
      deeplink.searchParams.set('message', `Pay ${amount} MRDT for token audit`);
      deeplink.searchParams.set('memo', orderId);

      console.log('[PaymentModal] Opening deeplink:', deeplink.toString());

      // Open wallet via deeplink
      window.location.href = deeplink.toString();

      // Start polling immediately
      setTimeout(() => startPolling(), 1000);

      // Start countdown timer
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = setInterval(() => {
        setTimeLeft(prev => {
          const newVal = prev - 1;
          if (newVal <= 0) {
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            handleVerificationTimeout();
          }
          return Math.max(0, newVal);
        });
      }, 1000);
    } catch (e) {
      setStatus('error');
      setErrorMsg('Failed to initiate payment: ' + (e instanceof Error ? e.message : 'Unknown error'));
      console.error('[PaymentModal] Error:', e);
    }
  };

  const startPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    const attemptVerification = async () => {
      try {
        setVerifyAttempt(prev => prev + 1);

        const response = await fetch('/api/verify-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            expectedAmount: amount,
            since: initiatedAtRef.current
          })
        });

        const data = await response.json();
        console.log('[PaymentModal] Verification attempt:', data);

        if (data.verified) {
          setStatus('success');
          if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
          // Give user a moment to see success, then close
          setTimeout(() => {
            onPaymentSuccess?.({ amount: data.received, signature: data.signature });
            onClose?.();
          }, 1500);
        }
      } catch (e) {
        console.error('[PaymentModal] Polling error:', e);
      }
    };

    // First attempt immediately
    attemptVerification();

    // Then poll every N seconds
    pollingIntervalRef.current = setInterval(() => {
      if (verifyAttempt < MAX_VERIFY_ATTEMPTS) {
        attemptVerification();
      } else {
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
        handleVerificationTimeout();
      }
    }, POLL_INTERVAL_MS);
  };

  const handleVerificationTimeout = () => {
    setStatus('error');
    setErrorMsg('Payment not detected within 15 minutes. If you paid, contact admin in Telegram.');
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  // Manual verification retry button
  const handleRetryVerification = async () => {
    if (status !== 'error' || !initiatedAtRef.current) return;

    setStatus('verifying');
    setErrorMsg('');
    setVerifyAttempt(0);
    startPolling();
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-purple-500/50 rounded-2xl p-8 max-w-md w-full shadow-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          {status === 'success' && (
            <>
              <div className="text-5xl mb-3">✓</div>
              <h2 className="text-2xl font-bold text-emerald-400">Payment Received!</h2>
            </>
          )}

          {(status === 'idle' || status === 'deeplink') && (
            <>
              <div className="text-5xl mb-3">🔐</div>
              <h2 className="text-2xl font-bold text-white">Send Payment</h2>
            </>
          )}

          {status === 'verifying' && (
            <>
              <div className="inline-block animate-spin text-4xl mb-3">⏳</div>
              <h2 className="text-2xl font-bold text-blue-400">Verifying Payment...</h2>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="text-5xl mb-3">⏱️</div>
              <h2 className="text-2xl font-bold text-orange-400">Payment Not Detected</h2>
            </>
          )}
        </div>

        {/* Info */}
        <div className="bg-slate-800/50 rounded-lg p-4 mb-6 border border-slate-700">
          <p className="text-sm text-slate-300 mb-2">Amount:</p>
          <p className="text-2xl font-mono font-bold text-emerald-400">{amount} MRDT</p>
        </div>

        {/* Timer */}
        {status !== 'success' && (
          <div className="text-center mb-6">
            <p className="text-xs text-slate-400 mb-1">Time Remaining</p>
            <p className="text-lg font-mono text-yellow-400">{formatTime(timeLeft)}</p>
          </div>
        )}

        {/* Error message */}
        {errorMsg && (
          <div className="bg-orange-900/30 border border-orange-500/50 rounded-lg p-4 mb-6">
            <p className="text-sm text-orange-200">{errorMsg}</p>
            {status === 'error' && (
              <p className="text-xs text-orange-300 mt-2">
                Attempt {verifyAttempt} / {MAX_VERIFY_ATTEMPTS}
              </p>
            )}
          </div>
        )}

        {/* Status message */}
        {status === 'deeplink' && (
          <div className="bg-blue-900/30 border border-blue-500/50 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-200">
              Your wallet should open. Please confirm the transaction. We'll verify payment automatically.
            </p>
          </div>
        )}

        {status === 'verifying' && (
          <div className="bg-blue-900/30 border border-blue-500/50 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-200">
              Checking blockchain... Attempt {verifyAttempt}/{MAX_VERIFY_ATTEMPTS}
            </p>
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3">
          {status === 'idle' && (
            <button
              onClick={handlePayment}
              className="w-full bg-gradient-to-r from-purple-600 to-emerald-600 hover:from-purple-700 hover:to-emerald-700 text-white font-bold py-3 rounded-lg transition-all duration-200 active:scale-95"
            >
              Open Wallet
            </button>
          )}

          {status === 'error' && (
            <>
              <button
                onClick={handleRetryVerification}
                className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold py-3 rounded-lg transition-all duration-200 active:scale-95"
              >
                Retry Verification
              </button>
              <button
                onClick={onClose}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-lg transition-all duration-200 active:scale-95"
              >
                Close
              </button>
            </>
          )}

          {status === 'success' && (
            <button
              onClick={() => onClose?.()}
              className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-bold py-3 rounded-lg transition-all duration-200 active:scale-95"
            >
              Continue
            </button>
          )}

          {status !== 'idle' && status !== 'error' && status !== 'success' && (
            <button
              onClick={onClose}
              className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-lg transition-all duration-200 active:scale-95"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

