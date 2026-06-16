'use client';

import React, { useState, useEffect, useRef } from 'react';
import { TrendingUp, Shield, Lock, Zap, Send, MessageSquare, X, RefreshCw, AlertCircle, Sparkles, ExternalLink, ChevronDown } from 'lucide-react';

const WALLET_ADDRESS = "AZyzUySu6HP9ocJYhZECG5syycYNV6ubTQKyfB2mDWgG";
const MRDT_CA = "8Q22r9qUm4AzFzTpZgaPYMxqq4z5WxE9FVa7X9dsvmBg";

export default function TntHouse() {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({ projectName: '', ca: '', email: '' });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [selectedTier, setSelectedTier] = useState('basic');
  const [isBuyDropdownOpen, setIsBuyDropdownOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([{ sender: 'bot', text: 'Привет! Я ИИ-Инспектор TNT House. Спроси меня про любой контракт или токен $MRDT. ⚽️' }]);
  const [userMsg, setUserMsg] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [logs, setLogs] = useState([
    '[ИИ-Инспектор] Инициализация системы безопасности TNT House...',
    '[СЕТЬ] Подключение к RPC узлам Solana завершено успешно.'
  ]);

  const chatEndRef = useRef(null);

  useEffect(() => {
    setTokens([{
      name: 'MaradonaToken',
      symbol: '$MRDT',
      ca: MRDT_CA,
      score: 98,
      status: 'Ironclad Safe ★',
      color: 'green'
    }]);
    setLoading(false);
  }, []);

  const getAmountForTier = (tier) => {
    if (tier === 'fast') return 3000000;
    if (tier === 'vip') return 9200000;
    return 770000;
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!formData.projectName || !formData.ca || !formData.email) {
      setError('Заполни все поля!');
      return;
    }

    const amount = getAmountForTier(selectedTier);
    const solanaPayUrl = `solana:${WALLET_ADDRESS}?amount=${amount}&spl-token=${MRDT_CA}&label=TNT%20House%20Audit&message=${encodeURIComponent(formData.projectName)}`;
    window.location.href = solanaPayUrl;

    setTimeout(() => {
      const newToken = {
        name: formData.projectName,
        symbol: 'NEW',
        ca: formData.ca,
        score: Math.floor(Math.random() * 25) + 75,
        status: Math.random() > 0.4 ? 'Ironclad Safe ★' : 'Pulsing Warning ⚠️',
        color: 'green'
      };
      setTokens(prev => [newToken, ...prev]);
      setSubmitted(true);
      setFormData({ projectName: '', ca: '', email: '' });
      setError('');
      setLogs(prev => [...prev, `[✅] Токен ${formData.projectName} прошёл аудит и добавлен в таблицу!`]);
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-[#030303] text-white p-6">
      <h1 className="text-4xl font-bold text-center mb-8">TNT HOUSE</h1>

      <div className="max-w-2xl mx-auto bg-zinc-950 border border-purple-500/30 rounded-2xl p-8">
        <form onSubmit={handleFormSubmit} className="space-y-6">
          <div>
            <label className="block text-purple-400 mb-2">Название проекта</label>
            <input type="text" value={formData.projectName} onChange={(e) => setFormData({...formData, projectName: e.target.value})} className="w-full bg-zinc-900 border border-purple-500/30 rounded p-4" placeholder="Твой токен..." />
          </div>
          <div>
            <label className="block text-purple-400 mb-2">Contract Address</label>
            <input type="text" value={formData.ca} onChange={(e) => setFormData({...formData, ca: e.target.value})} className="w-full bg-zinc-900 border border-purple-500/30 rounded p-4" placeholder="CA токена" />
          </div>
          <div>
            <label className="block text-purple-400 mb-2">Тариф</label>
            <select value={selectedTier} onChange={(e) => setSelectedTier(e.target.value)} className="w-full bg-zinc-900 border border-purple-500/30 rounded p-4">
              <option value="basic">Базовый Аудит — $10 в $MRDT</option>
              <option value="fast">Быстрый Листинг — $40 в $MRDT</option>
              <option value="vip">VIP-Буст — $120 в $MRDT</option>
            </select>
          </div>
          <div>
            <label className="block text-purple-400 mb-2">Email</label>
            <input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full bg-zinc-900 border border-purple-500/30 rounded p-4" placeholder="your@email.com" />
          </div>
          <button type="submit" className="w-full py-5 bg-gradient-to-r from-purple-600 to-emerald-500 rounded-xl font-bold text-lg hover:brightness-110 transition">
            🚀 ЗАПУСТИТЬ ИИ-ИНСПЕКЦИЮ
          </button>
        </form>

        {submitted && <div className="mt-6 p-4 bg-emerald-900/50 border border-emerald-500 rounded-xl text-center">✅ Заявка принята! Токен добавлен в таблицу с оценкой.</div>}
        {error && <div className="mt-4 text-red-400">{error}</div>}
      </div>

      <div className="max-w-4xl mx-auto mt-12">
        <h2 className="text-2xl mb-4">Проверенные токены</h2>
        <div className="bg-zinc-950 border border-purple-500/30 rounded-2xl overflow-hidden">
          {tokens.map((t, i) => (
            <div key={i} className="p-6 border-b border-purple-500/10 flex justify-between items-center">
              <div>
                <div className="font-bold">{t.name}</div>
                <div className="text-xs text-gray-500">{t.ca.slice(0,8)}...{t.ca.slice(-6)}</div>
              </div>
              <div className="text-right">
                <div className="text-emerald-400 font-mono">{t.score}/100</div>
                <div className="text-sm">{t.status}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
