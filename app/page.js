'use client';

import React, { useState, useEffect } from 'react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useWallet } from '@solana/wallet-adapter-react';

export default function Home() {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedToken, setSelectedToken] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const { publicKey } = useWallet();
  const [formData, setFormData] = useState({
    ca: '',
    projectName: '',
    description: '',
    tier: 'basic'
  });

  useEffect(() => {
    fetchTokens();
  }, []);

  const fetchTokens = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/tokens?sort=newest&limit=50');
      const data = await response.json();
      setTokens(data.tokens || []);
    } catch (error) {
      console.error('Failed to fetch tokens:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!publicKey) {
      alert('Пожалуйста подключите кошелёк!');
      return;
    }
    setScanning(true);
    setScanProgress(0);
    const progressInterval = setInterval(() => {
      setScanProgress(prev => Math.min(prev + 10, 90));
    }, 200);

    try {
      const submitResponse = await fetch('/api/submit-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ca: formData.ca,
          projectName: formData.projectName,
          description: formData.description,
          creatorWallet: publicKey.toString(),
          tier: formData.tier
        })
      });
      const submitData = await submitResponse.json();
      if (!submitResponse.ok) {
        alert('Ошибка: ' + submitData.error);
        return;
      }
      setScanProgress(100);
      if (submitData.paymentRequired) {
        const solanaPayUri = submitData.solanaPayUri;
        if (window.solana) {
          window.solana.sendAndConfirm(solanaPayUri).catch(err => {
            console.error('Payment error:', err);
            alert('Отправьте платёж:\n' + solanaPayUri);
          });
        } else {
          alert('Отправьте платёж:\n' + solanaPayUri);
        }
      }
      setTimeout(() => {
        window.location.href = `/submission-status/${submitData.submissionId}`;
      }, 500);
    } catch (error) {
      console.error('Submission error:', error);
      alert('Ошибка при отправке заявки');
    } finally {
      clearInterval(progressInterval);
      setScanning(false);
      setScanProgress(0);
    }
  };

  const getStatusDot = (score) => {
    if (score >= 75) return <span className="inline-block w-3 h-3 rounded-full bg-green-500 mr-2"></span>;
    if (score >= 50) return <span className="inline-block w-3 h-3 rounded-full bg-yellow-400 mr-2"></span>;
    return <span className="inline-block w-3 h-3 rounded-full bg-red-500 mr-2"></span>;
  };

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden">
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/10 via-black to-cyan-900/10"></div>
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob"></div>
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-cyan-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-emerald-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-4000"></div>
      </div>

      <header className="border-b border-purple-500/30 backdrop-blur-sm sticky top-0 z-40 bg-black/50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="text-3xl font-black bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">TNT House</div>
            <div className="text-xs text-purple-300 uppercase tracking-widest">Safe New Tokens</div>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-cyan-500 text-black font-bold hover:from-purple-400 hover:to-cyan-400 transition-all">📋 Submit Token</button>
            <WalletMultiButton />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-12">
        {showForm && (
          <div className="mb-12 p-6 rounded-xl border border-purple-500/50 bg-gradient-to-br from-purple-900/20 to-cyan-900/20 backdrop-blur-sm">
            <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">🚀 Submit Your Token for AI Audit</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-purple-300 mb-2">Contract Address (Solana)</label>
                <input type="text" required placeholder="Token mint address..." value={formData.ca} onChange={(e) => setFormData({ ...formData, ca: e.target.value })} className="w-full px-4 py-2 rounded-lg bg-black/50 border border-purple-500/30 text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm text-purple-300 mb-2">Project Name</label>
                <input type="text" required placeholder="Your token name..." value={formData.projectName} onChange={(e) => setFormData({ ...formData, projectName: e.target.value })} className="w-full px-4 py-2 rounded-lg bg-black/50 border border-purple-500/30 text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm text-purple-300 mb-2">Description</label>
                <textarea required placeholder="What is your project about..." value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full px-4 py-2 rounded-lg bg-black/50 border border-purple-500/30 text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none h-24 resize-none" />
              </div>
              <div>
                <label className="block text-sm text-purple-300 mb-2">Audit Tier</label>
                <select value={formData.tier} onChange={(e) => setFormData({ ...formData, tier: e.target.value })} className="w-full px-4 py-2 rounded-lg bg-black/50 border border-purple-500/30 text-white focus:border-cyan-500 focus:outline-none">
                  <option value="free">🎁 Free (First 3 tokens)</option>
                  <option value="basic">🔍 Basic Audit - $10 MRDT</option>
                  <option value="fast-track">⚡ Fast-Track (5min) - $40 MRDT</option>
                  <option value="vip">👑 VIP Boost (Banner) - $120 MRDT</option>
                </select>
              </div>
              {scanning && (
                <div className="space-y-2">
                  <div className="text-sm text-cyan-400 font-semibold">Scanning contract on Solana...</div>
                  <div className="w-full h-2 rounded-full bg-black/50 border border-cyan-500/30 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-purple-500 to-cyan-500 transition-all duration-300" style={{ width: `${scanProgress}%` }}></div>
                  </div>
                  <div className="text-xs text-gray-400">Checking: Mint Authority, Freeze Authority, Holder Distribution, Volume...</div>
                </div>
              )}
              <button type="submit" disabled={scanning || !publicKey} className="w-full px-6 py-3 rounded-lg bg-gradient-to-r from-purple-500 to-cyan-500 text-black font-bold hover:from-purple-400 hover:to-cyan-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed">{scanning ? '🔍 Scanning...' : '📤 Submit for AI Audit'}</button>
            </form>
          </div>
        )}

        <div className="space-y-6">
          <h1 className="text-4xl font-black bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">✅ Verified Safe Tokens</h1>
          {loading ? (
            <div className="text-center py-12 text-gray-400">Loading tokens...</div>
          ) : tokens.length === 0 ? (
            <div className="text-center py-12 text-gray-400">No verified tokens yet. Be first to submit!</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-purple-500/30 bg-black/30 backdrop-blur-sm">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-purple-500/30">
                    <th className="px-6 py-4 text-left text-sm font-semibold text-purple-300">Token</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-purple-300">Security Score</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-purple-300">Price</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-purple-300">24h Volume</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-purple-300">Status</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-purple-300">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {tokens.map((token) => (
                    <tr key={token.id} className={`border-b border-purple-500/10 hover:bg-purple-500/10 transition-colors ${token.symbol === 'MRDT' ? 'bg-gradient-to-r from-yellow-900/30 to-emerald-900/30 border-t border-b border-yellow-500/50' : ''}`}>
                      <td className="px-6 py-4"><div className="font-semibold text-white">{token.name}</div><div className="text-xs text-gray-400">{token.symbol}</div></td>
                      <td className="px-6 py-4"><div className="flex items-center gap-2">{getStatusDot(token.security_score)}<span className="font-mono font-bold text-cyan-400">{token.security_score}/100</span></div></td>
                      <td className="px-6 py-4 font-mono text-emerald-400">${token.price || 'N/A'}</td>
                      <td className="px-6 py-4 font-mono text-purple-300">${token.volume24h || 'N/A'}</td>
                      <td className="px-6 py-4"><div className="text-sm">{token.security_score >= 75 ? <span className="text-green-400 font-semibold">🟢 Safe</span> : token.security_score >= 50 ? <span className="text-yellow-400 font-semibold">🟡 Caution</span> : <span className="text-red-400 font-semibold">🔴 Risky</span>}</div></td>
                      <td className="px-6 py-4"><button onClick={() => { setSelectedToken(token); setShowDetails(true); }} className="px-3 py-1 rounded-lg bg-cyan-500/20 text-cyan-400 text-sm font-semibold hover:bg-cyan-500/30 transition-colors">View Details</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {showDetails && selectedToken && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gradient-to-br from-purple-900/50 to-cyan-900/50 border border-purple-500/30 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-8">
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-2xl font-black bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">{selectedToken.name} ({selectedToken.symbol})</h2>
              <button onClick={() => setShowDetails(false)} className="text-2xl text-gray-400 hover:text-white">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <div className="text-sm text-purple-300 mb-1">Security Blueprint</div>
                <div className="bg-black/50 rounded-lg p-4 space-y-2">{selectedToken.audit_report ? (<><div className="flex justify-between items-center"><span>Foundation Score</span><span className="font-mono text-cyan-400">{selectedToken.audit_report.details?.foundationScore || 0}/25</span></div><div className="flex justify-between items-center"><span>Holder Score</span><span className="font-mono text-cyan-400">{selectedToken.audit_report.details?.holderScore || 0}/25</span></div><div className="flex justify-between items-center"><span>Volume Score</span><span className="font-mono text-cyan-400">{selectedToken.audit_report.details?.volumeScore || 0}/20</span></div><div className="flex justify-between items-center font-bold border-t border-purple-500/30 pt-2"><span>Total Security Score</span><span className="font-mono text-emerald-400 text-lg">{selectedToken.security_score}/100</span></div></>) : (<div className="text-gray-400">No audit report available</div>)}</div>
              </div>
              <div>
                <div className="text-sm text-purple-300 mb-1">Contract Details</div>
                <div className="bg-black/50 rounded-lg p-4 space-y-2 font-mono text-xs text-gray-300 break-all"><div>CA: {selectedToken.ca}</div></div>
              </div>
              <button onClick={() => setShowDetails(false)} className="w-full px-6 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-cyan-500 text-black font-bold hover:from-purple-400 hover:to-cyan-400 transition-all">Close</button>
            </div>
          </div>
        </div>
      )}

      <a href="https://jup.ag/swap/SOL-8Q22r9qUm4AzFzTpZgaPYMxqq4z5WxE9FVa7X9dsvmBg" target="_blank" rel="noopener noreferrer" className="fixed bottom-8 right-8 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-black font-bold text-lg hover:from-emerald-400 hover:to-cyan-400 transition-all shadow-lg shadow-emerald-500/50 hover:shadow-emerald-500/70 z-40">💰 BUY $MRDT</a>

      <style jsx global>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        .animate-blob { animation: blob 7s infinite; }
        .animation-delay-2000 { animation-delay: 2s; }
        .animation-delay-4000 { animation-delay: 4s; }
      `}</style>
    </div>
  );
}