'use client';

// ============================================================
// admin-d10s/page.jsx
// Version: 1.1
// Fix: removed @solana/wallet-adapter-react dependency entirely.
//      Auth now uses window.solana / window.solflare directly —
//      no WalletProvider ancestor required.
// ============================================================

import React, { useState, useEffect } from 'react';

const ADMIN_WALLET = 'AZyzUySu6HP9ocJYhZECG5syycYNV6ubTQKyfB2mDWgG';

export default function AdminPanel() {
  const [publicKey, setPublicKey]         = useState(null);   // string | null
  const [isAuthorized, setIsAuthorized]   = useState(false);
  const [pendingTokens, setPendingTokens] = useState([]);
  const [loading, setLoading]             = useState(false);
  const [selectedToken, setSelectedToken] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [walletStatus, setWalletStatus]   = useState('idle'); // idle | connecting | connected | error
  const [walletError, setWalletError]     = useState('');

  // ── Detect wallet on mount ──────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // If already connected (e.g. eager connect), read publicKey immediately
    const solana = window.solana || window.solflare;
    if (solana?.publicKey) {
      const pk = solana.publicKey.toString();
      setPublicKey(pk);
      setIsAuthorized(pk === ADMIN_WALLET);
    }
  }, []);

  // ── Fetch pending tokens when authorized ───────────────────
  useEffect(() => {
    if (isAuthorized) fetchPendingTokens();
  }, [isAuthorized]);

  // ── Connect wallet ──────────────────────────────────────────
  const connectWallet = async () => {
    setWalletStatus('connecting');
    setWalletError('');
    try {
      const solana = window.solana || window.solflare;
      if (!solana) throw new Error('Кошелёк не найден. Установи Phantom или Solflare.');
      const resp = await solana.connect();
      const pk   = resp.publicKey.toString();
      setPublicKey(pk);
      setIsAuthorized(pk === ADMIN_WALLET);
      setWalletStatus('connected');
    } catch (err) {
      setWalletError(err.message || 'Ошибка подключения');
      setWalletStatus('error');
    }
  };

  // ── Disconnect ──────────────────────────────────────────────
  const disconnectWallet = async () => {
    try {
      const solana = window.solana || window.solflare;
      await solana?.disconnect?.();
    } catch (e) {}
    setPublicKey(null);
    setIsAuthorized(false);
    setWalletStatus('idle');
    setPendingTokens([]);
  };

  const fetchPendingTokens = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/pending');
      const data     = await response.json();
      setPendingTokens(data.submissions || []);
    } catch (error) {
      console.error('Failed to fetch pending tokens:', error);
    } finally {
      setLoading(false);
    }
  };

  const approveToken = async (submissionId, auditData) => {
    try {
      const response = await fetch('/api/admin/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId, adminWallet: publicKey, auditData }),
      });
      if (response.ok) {
        alert('✅ Токен одобрен и добавлен на главную страницу!');
        fetchPendingTokens();
      } else {
        alert('❌ Ошибка при одобрении');
      }
    } catch (error) {
      console.error('Approve error:', error);
      alert('Ошибка: ' + error.message);
    }
  };

  const rejectToken = async (submissionId) => {
    try {
      const response = await fetch('/api/admin/reject', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId, adminWallet: publicKey, reason: rejectionReason }),
      });
      if (response.ok) {
        alert('✅ Токен отклонён');
        setShowRejectModal(false);
        setRejectionReason('');
        fetchPendingTokens();
      } else {
        alert('❌ Ошибка при отклонении');
      }
    } catch (error) {
      console.error('Reject error:', error);
      alert('Ошибка: ' + error.message);
    }
  };

  // ── Short address helper ────────────────────────────────────
  const shortKey = (pk) => pk ? pk.slice(0, 4) + '...' + pk.slice(-4) : '';

  // ════════════════════════════════════════════════════════════
  // SCREENS
  // ════════════════════════════════════════════════════════════

  // Not connected
  if (!publicKey) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center space-y-6 max-w-sm w-full px-4">
          <h1 className="text-4xl font-black bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
            Admin Panel
          </h1>
          <p className="text-gray-400">Подключите кошелёк администратора</p>

          <button
            onClick={connectWallet}
            disabled={walletStatus === 'connecting'}
            className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-cyan-500 text-black font-black text-sm hover:opacity-90 transition disabled:opacity-50"
          >
            {walletStatus === 'connecting' ? '⏳ Подключаем...' : '👻 Connect Wallet'}
          </button>

          {walletError && (
            <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2">
              {walletError}
            </p>
          )}
        </div>
      </div>
    );
  }

  // Connected but not admin
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center space-y-4 max-w-sm px-4">
          <h1 className="text-4xl font-black bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
            ❌ Access Denied
          </h1>
          <p className="text-gray-400">Только администратор может получить доступ к этой панели.</p>
          <p className="text-xs text-gray-600 font-mono">{shortKey(publicKey)}</p>
          <button
            onClick={disconnectWallet}
            className="px-6 py-2 rounded-lg border border-gray-600 text-gray-300 text-sm hover:border-gray-400 transition"
          >
            Отключить кошелёк
          </button>
        </div>
      </div>
    );
  }

  // ── Admin view ──────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/10 via-black to-red-900/10" />
      </div>

      {/* Header */}
      <header className="border-b border-red-500/30 backdrop-blur-sm sticky top-0 z-40 bg-black/50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-3xl font-black bg-gradient-to-r from-red-400 to-purple-400 bg-clip-text text-transparent">
            🔐 Admin Panel
          </h1>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchPendingTokens}
              className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 font-semibold hover:bg-red-500/30 transition-colors text-sm"
            >
              🔄 Refresh
            </button>
            {/* Wallet badge */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/30">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-green-300 text-xs font-mono">{shortKey(publicKey)}</span>
              <button onClick={disconnectWallet} className="text-gray-500 hover:text-red-400 transition ml-1 text-xs">✕</button>
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-4 py-12">
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-2 text-red-400">⏳ Pending Submissions</h2>
          <p className="text-gray-400">Total: {pendingTokens.length} токенов ожидают модерации</p>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading pending tokens...</div>
        ) : pendingTokens.length === 0 ? (
          <div className="text-center py-12 text-gray-400">✅ Все заявки обработаны!</div>
        ) : (
          <div className="space-y-4">
            {pendingTokens.map((token) => (
              <div
                key={token.id}
                className="p-6 rounded-xl border border-red-500/30 bg-gradient-to-r from-red-900/20 to-purple-900/20 backdrop-blur-sm hover:border-red-500/60 transition-all"
              >
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <div className="text-sm text-gray-400">Project Name</div>
                    <div className="text-xl font-bold text-white">{token.project_name}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-400">Contract Address</div>
                    <div className="font-mono text-sm text-cyan-400 truncate">{token.ca}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-400">Security Score</div>
                    <div className="text-2xl font-bold">
                      {token.security_score !== null ? (
                        <span className={token.security_score >= 75 ? 'text-green-400' : token.security_score >= 50 ? 'text-yellow-400' : 'text-red-400'}>
                          {token.security_score}/100
                        </span>
                      ) : (
                        <span className="text-gray-400">Pending...</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-400">Tier</div>
                    <div className="text-xl font-bold text-purple-400">{token.tier}</div>
                  </div>
                </div>

                {token.audit_report && (
                  <div className="mb-4 p-4 rounded-lg bg-black/50 border border-purple-500/20">
                    <div className="text-sm text-purple-300 font-semibold mb-3">📋 Audit Report</div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                      <div><span className="text-gray-400">Foundation</span><div className="font-bold text-cyan-400">{token.audit_report.details?.foundationScore || 0}/25</div></div>
                      <div><span className="text-gray-400">Holders</span><div className="font-bold text-cyan-400">{token.audit_report.details?.holderScore || 0}/25</div></div>
                      <div><span className="text-gray-400">Volume</span><div className="font-bold text-cyan-400">{token.audit_report.details?.volumeScore || 0}/20</div></div>
                      <div><span className="text-gray-400">Insider</span><div className="font-bold text-cyan-400">{token.audit_report.details?.insiderScore || 0}/10</div></div>
                      <div><span className="text-gray-400">Verdict</span><div className="font-bold text-emerald-400">{token.audit_report.verdict || 'Unknown'}</div></div>
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => { setSelectedToken(token); approveToken(token.id, token.audit_report); }}
                    className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-green-500 to-emerald-500 text-black font-bold hover:from-green-400 hover:to-emerald-400 transition-all"
                  >
                    ✅ Approve & Publish
                  </button>
                  <button
                    onClick={() => { setSelectedToken(token); setShowRejectModal(true); }}
                    className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold hover:from-red-400 hover:to-orange-400 transition-all"
                  >
                    ❌ Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Reject modal */}
      {showRejectModal && selectedToken && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gradient-to-br from-red-900/50 to-purple-900/50 border border-red-500/30 rounded-xl max-w-md w-full p-8">
            <h2 className="text-2xl font-bold mb-4 text-red-400">Reject Token?</h2>
            <p className="text-gray-300 mb-4">
              Project: <span className="font-bold text-white">{selectedToken.project_name}</span>
            </p>
            <div className="mb-4">
              <label className="block text-sm text-red-300 mb-2">Reason for Rejection</label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Explain why this token is being rejected..."
                className="w-full px-4 py-2 rounded-lg bg-black/50 border border-red-500/30 text-white placeholder-gray-500 focus:border-red-500 focus:outline-none h-24 resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowRejectModal(false); setRejectionReason(''); }}
                className="flex-1 px-4 py-2 rounded-lg border border-gray-500 text-gray-300 font-semibold hover:border-gray-400 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => rejectToken(selectedToken.id)}
                className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold hover:from-red-400 hover:to-orange-400 transition-all"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
