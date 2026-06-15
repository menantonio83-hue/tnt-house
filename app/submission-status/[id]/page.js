'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

export default function SubmissionStatus({ params }) {
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    fetchStatus();
    let interval;
    if (autoRefresh) {
      interval = setInterval(fetchStatus, 3000);
    }
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const fetchStatus = async () => {
    try {
      const response = await fetch(`/api/submit-audit/status?submissionId=${params.id}`);
      const data = await response.json();
      if (data.success) {
        setSubmission(data.submission);
        if (data.submission.status === 'approved') {
          setAutoRefresh(false);
        }
      }
    } catch (error) {
      console.error('Failed to fetch status:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending_payment': return 'bg-yellow-500';
      case 'auditing': return 'bg-blue-500';
      case 'pending_admin_review': return 'bg-purple-500';
      case 'approved': return 'bg-green-500';
      case 'rejected': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'pending_payment': return '💳 Ожидание платежа';
      case 'auditing': return '🔍 Проверка на-чейн';
      case 'pending_admin_review': return '👨‍💼 Ожидание админа';
      case 'approved': return '✅ Одобрено!';
      case 'rejected': return '❌ Отклонено';
      default: return status;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center space-y-6">
          <div className="text-6xl">⏳</div>
          <h1 className="text-2xl font-bold">Loading Status...</h1>
        </div>
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center space-y-6">
          <div className="text-6xl">❌</div>
          <h1 className="text-2xl font-bold">Submission Not Found</h1>
          <Link href="/" className="inline-block px-6 py-3 rounded-lg bg-cyan-500 text-black font-bold hover:bg-cyan-400">← Back to Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/10 via-black to-cyan-900/10"></div>
      </div>

      <header className="border-b border-purple-500/30 backdrop-blur-sm sticky top-0 z-40 bg-black/50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-black bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">TNT House - Submission Status</h1>
          <Link href="/" className="px-4 py-2 rounded-lg bg-gray-700 text-white font-semibold hover:bg-gray-600">← Home</Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="mb-8 p-8 rounded-xl border border-purple-500/30 bg-gradient-to-br from-purple-900/20 to-cyan-900/20 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-3xl font-black text-white">{submission.projectName}</h2>
            <div className={`px-6 py-3 rounded-lg ${getStatusColor(submission.status)} text-black font-bold text-lg`}>{getStatusLabel(submission.status)}</div>
          </div>

          <div className="space-y-4 mb-8">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0"><span className="text-2xl">💳</span></div>
              <div className="flex-1">
                <h3 className="font-bold text-white mb-1">Step 1: Payment</h3>
                <p className="text-gray-400 text-sm">{submission.status !== 'pending_payment' ? '✅ Completed' : '⏳ Waiting for your payment'}</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-full ${['auditing', 'pending_admin_review', 'approved'].includes(submission.status) ? 'bg-blue-500/20' : 'bg-gray-700/20'} flex items-center justify-center flex-shrink-0`}><span className="text-2xl">🔍</span></div>
              <div className="flex-1">
                <h3 className="font-bold text-white mb-1">Step 2: AI Audit</h3>
                <p className="text-gray-400 text-sm">{['auditing', 'pending_admin_review', 'approved'].includes(submission.status) ? '✅ Completed' : '⏳ Will start after payment'}</p>
                {submission.securityScore !== null && <div className="mt-2 text-cyan-400 font-mono text-sm">Security Score: {submission.securityScore}/100</div>}
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-full ${['pending_admin_review', 'approved'].includes(submission.status) ? 'bg-purple-500/20' : 'bg-gray-700/20'} flex items-center justify-center flex-shrink-0`}><span className="text-2xl">👨‍💼</span></div>
              <div className="flex-1">
                <h3 className="font-bold text-white mb-1">Step 3: Admin Review</h3>
                <p className="text-gray-400 text-sm">{['approved'].includes(submission.status) ? '✅ Approved!' : ['pending_admin_review'].includes(submission.status) ? '⏳ Under review by admin' : '⏳ Will start after AI audit'}</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-full ${submission.status === 'approved' ? 'bg-green-500/20' : 'bg-gray-700/20'} flex items-center justify-center flex-shrink-0`}><span className="text-2xl">🎉</span></div>
              <div className="flex-1">
                <h3 className="font-bold text-white mb-1">Step 4: Published</h3>
                <p className="text-gray-400 text-sm">{submission.status === 'approved' ? '✅ Token is now live on TNT House!' : '⏳ Token will appear on main table'}</p>
              </div>
            </div>
          </div>

          {submission.auditReport && (
            <div className="mt-8 p-4 rounded-lg bg-black/50 border border-purple-500/20">
              <h3 className="text-lg font-bold mb-4 text-cyan-400">📋 Audit Report</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="p-3 rounded-lg bg-purple-500/20">
                  <div className="text-xs text-gray-400">Foundation</div>
                  <div className="text-xl font-bold text-purple-300">{submission.auditReport.details?.foundationScore || 0}/25</div>
                </div>
                <div className="p-3 rounded-lg bg-purple-500/20">
                  <div className="text-xs text-gray-400">Holders</div>
                  <div className="text-xl font-bold text-purple-300">{submission.auditReport.details?.holderScore || 0}/25</div>
                </div>
                <div className="p-3 rounded-lg bg-purple-500/20">
                  <div className="text-xs text-gray-400">Volume</div>
                  <div className="text-xl font-bold text-purple-300">{submission.auditReport.details?.volumeScore || 0}/20</div>
                </div>
                <div className="p-3 rounded-lg bg-purple-500/20">
                  <div className="text-xs text-gray-400">Insider</div>
                  <div className="text-xl font-bold text-purple-300">{submission.auditReport.details?.insiderScore || 0}/10</div>
                </div>
              </div>

              {submission.auditReport.checks && (
                <div className="space-y-2 text-sm text-gray-300">
                  <div>✅ Mint Authority: {submission.auditReport.checks.mintAuthority?.description}</div>
                  <div>✅ Freeze Authority: {submission.auditReport.checks.freezeAuthority?.description}</div>
                  <div>📊 Holder Distribution: {submission.auditReport.checks.holderDistribution?.recommendation}</div>
                </div>
              )}
            </div>
          )}

          {submission.status === 'rejected' && (
            <div className="mt-8 p-4 rounded-lg bg-red-900/30 border border-red-500/30">
              <h3 className="text-lg font-bold mb-2 text-red-400">❌ Rejection Reason</h3>
              <p className="text-gray-300">{submission.rejectionReason || 'No reason provided'}</p>
              <Link href="/" className="inline-block mt-4 px-4 py-2 rounded-lg bg-cyan-500 text-black font-bold hover:bg-cyan-400">Submit Another Token</Link>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <button onClick={fetchStatus} className="px-4 py-2 rounded-lg bg-gray-700 text-white font-semibold hover:bg-gray-600 transition-colors">🔄 Refresh Now</button>
          <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
            <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} className="w-4 h-4" />
            Auto-refresh every 3s
          </label>
        </div>
      </main>
    </div>
  );
}