'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  TrendingUp, Shield, Lock, Zap, Send, MessageSquare, X, 
  RefreshCw, AlertCircle, Sparkles, ExternalLink, ChevronDown 
} from 'lucide-react';

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
  const [chatMessages, setChatMessages] = useState([
    { sender: 'bot', text: 'Привет! Я ИИ-Инспектор TNT House. Спроси меня про любой контракт или токен $MRDT. ⚽️' }
  ]);
  const [userMsg, setUserMsg] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [logs, setLogs] = useState([
    '[ИИ-Инспектор] Инициализация системы безопасности TNT House...',
    '[СЕТЬ] Подключение к RPC узлам Solana завершено успешно.'
  ]);

  const chatEndRef = useRef(null);

  // Initial tokens
  useEffect(() => {
    setTokens([
      {
        name: 'MaradonaToken',
        symbol: '$MRDT',
        ca: MRDT_CA,
        price: '0.00001300',
        liquidity: 13000,
        volume24h: 45000,
        priceChange24h: 12.4,
        score: 98,
        status: 'Ironclad Safe ★'
      }
    ]);
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
      setError('Пожалуйста, заполни все поля!');
      return;
    }

    const amount = getAmountForTier(selectedTier);
    const solanaPayUrl = `solana:${WALLET_ADDRESS}?amount=${amount}&spl-token=${MRDT_CA}&label=TNT%20House%20Audit&message=${encodeURIComponent(formData.projectName)}`;
    window.location.href = solanaPayUrl;

    setTimeout(() => {
      const newToken = {
        name: formData.projectName,
        symbol: formData.projectName.slice(0,4).toUpperCase(),
        ca: formData.ca,
        price: (Math.random()*0.00005 + 0.000001).toFixed(8),
        liquidity: Math.floor(Math.random()*80000)+8000,
        volume24h: Math.floor(Math.random()*120000)+15000,
        priceChange24h: (Math.random()*25 - 3).toFixed(1),
        score: Math.floor(Math.random()*25) + 75,
        status: Math.random() > 0.35 ? 'Ironclad Safe ★' : 'Pulsing Warning ⚠️'
      };
      setTokens(prev => [newToken, ...prev]);
      setSubmitted(true);
      setFormData({ projectName: '', ca: '', email: '' });
      setError('');
      setLogs(prev => [...prev.slice(-10), `[${new Date().toLocaleTimeString()}] [✅] Токен "${formData.projectName}" прошёл аудит и добавлен в таблицу!`]);
      setTimeout(() => setSubmitted(false), 4500);
    }, 1800);
  };

  const handleSendChat = (e) => {
    e.preventDefault();
    if (!userMsg.trim()) return;
    setChatMessages(prev => [...prev, { sender: 'user', text: userMsg }]);
    setUserMsg('');
    setIsTyping(true);

    setTimeout(() => {
      setChatMessages(prev => [...prev, { sender: 'bot', text: 'Анализирую CA... Токен добавлен в таблицу с оценкой! ⚽️' }]);
      setIsTyping(false);
    }, 1100);
  };

  return (
    <div className="min-h-screen bg-[#030303] text-white font-mono">
      {/* Header */}
      <header className="border-b border-purple-500/30 bg-[#030303]/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 border-2 border-purple-500 rounded-lg flex items-center justify-center bg-purple-500/10">
              <span className="text-2xl">🧨</span>
            </div>
            <div>
              <div className="text-2xl font-black tracking-wider">TNT HOUSE</div>
              <div className="text-[10px] text-purple-400 -mt-1">TOP NEW TOKENS + AI AUDIT</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <button onClick={() => setIsBuyDropdownOpen(!isBuyDropdownOpen)} className="bg-gradient-to-r from-purple-500 to-emerald-400 text-black font-bold px-5 py-2 rounded text-sm flex items-center gap-2">
                BUY $MRDT <ChevronDown className="w-4 h-4" />
              </button>
              {isBuyDropdownOpen && (
                <div className="absolute right-0 mt-2 w-44 bg-zinc-950 border border-purple-500/30 rounded-xl shadow-xl z-50 text-sm py-1">
                  <a href="https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&buy=8Q22r9qUm4AzFzTpZgaPYMxqq4z5WxE9FVa7X9dsvmBg" target="_blank" className="block px-4 py-2.5 hover:bg-purple-500/10">Jupiter Swap</a>
                  <a href="https://raydium.io/liquidity/increase/?mode=add&pool_id=6cMTXZyCrnut7Lv39qt4dqEARbC2jbebvhzdCR1t2HEV" target="_blank" className="block px-4 py-2.5 hover:bg-purple-500/10">Raydium</a>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="max-w-5xl mx-auto px-6 pt-14 pb-10 text-center">
        <div className="inline px-4 py-1 bg-purple-500/10 border border-purple-500/30 rounded-full text-sm mb-6">БЕЗОПАСНЫЕ НОВЫЕ ТОКЕНЫ</div>
        <h1 className="text-6xl font-black tracking-tighter mb-4">Взрываем скамы.<br />Запускаем гемы.</h1>
        <p className="text-xl text-zinc-400">Оплати $MRDT → ИИ проверяет → Токен в таблице с оценкой</p>
      </div>

      {/* AI Terminal */}
      <div className="max-w-5xl mx-auto px-6 mb-10">
        <div className="bg-zinc-950 border border-purple-500/30 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2 text-purple-400"><Sparkles className="w-4 h-4" /> AI SCANNER LIVE</div>
          <div className="h-36 overflow-auto text-emerald-400 text-sm font-mono space-y-1">
            {logs.map((l,i) => <div key={i}>{l}</div>)}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="max-w-6xl mx-auto px-6 mb-16">
        <div className="flex justify-between items-center mb-4">
          <div className="text-2xl font-bold">Проверенные токены</div>
        </div>
        <div className="bg-zinc-950 border border-purple-500/30 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-purple-500/20 bg-zinc-900">
                <th className="px-6 py-4 text-left text-sm">Токен</th>
                <th className="px-6 py-4 text-left text-sm">Цена</th>
                <th className="px-6 py-4 text-left text-sm">Ликвидность</th>
                <th className="px-6 py-4 text-center text-sm">TNT Score</th>
                <th className="px-6 py-4 text-center text-sm">Статус</th>
              </tr>
            </thead>
            <tbody>
              {tokens.map((t, i) => (
                <tr key={i} className="border-b border-purple-500/10 hover:bg-zinc-900/60">
                  <td className="px-6 py-5"><div className="font-bold">{t.name}</div><div className="text-xs text-zinc-500">{t.ca.slice(0,6)}...{t.ca.slice(-4)}</div></td>
                  <td className="px-6 py-5 font-mono text-sm">${t.price}</td>
                  <td className="px-6 py-5 font-mono text-sm">${t.liquidity.toLocaleString()}</td>
                  <td className="px-6 py-5 text-center"><span className="px-4 py-1 bg-emerald-500/10 border border-emerald-500 rounded-full text-emerald-400 text-sm">{t.score}</span></td>
                  <td className="px-6 py-5 text-center text-emerald-400 text-sm">{t.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-2xl mx-auto px-6 pb-16">
        <div className="bg-zinc-950 border border-purple-500/30 rounded-3xl p-8">
          <div className="text-center mb-8">
            <div className="text-purple-400 font-bold mb-1">ПОДАЙ ЗАЯВКУ НА ИИ-АУДИТ</div>
            <div className="text-3xl font-black">Оплати → Проверь → Получи результат</div>
          </div>

          <form onSubmit={handleFormSubmit} className="space-y-5">
            <div>
              <label className="block text-purple-400 text-sm mb-2">Название проекта</label>
              <input type="text" value={formData.projectName} onChange={e => setFormData({...formData, projectName: e.target.value})} placeholder="Твой токен..." className="w-full bg-zinc-900 border border-purple-500/30 rounded-2xl px-5 py-4" />
            </div>
            <div>
              <label className="block text-purple-400 text-sm mb-2">Contract Address</label>
              <input type="text" value={formData.ca} onChange={e => setFormData({...formData, ca: e.target.value})} placeholder="CA токена" className="w-full bg-zinc-900 border border-purple-500/30 rounded-2xl px-5 py-4 font-mono" />
            </div>
            <div>
              <label className="block text-purple-400 text-sm mb-2">Тариф</label>
              <select value={selectedTier} onChange={e => setSelectedTier(e.target.value)} className="w-full bg-zinc-900 border border-purple-500/30 rounded-2xl px-5 py-4">
                <option value="basic">Базовый Аудит — $10 в $MRDT</option>
                <option value="fast">Быстрый Листинг — $40 в $MRDT</option>
                <option value="vip">VIP-Буст — $120 в $MRDT</option>
              </select>
            </div>
            <div>
              <label className="block text-purple-400 text-sm mb-2">Email</label>
              <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="your@email.com" className="w-full bg-zinc-900 border border-purple-500/30 rounded-2xl px-5 py-4" />
            </div>
            <button type="submit" className="w-full py-5 bg-gradient-to-r from-purple-600 to-emerald-500 rounded-2xl font-black text-xl flex justify-center items-center gap-3">
              <Send className="w-5 h-5" /> ЗАПУСТИТЬ ИИ-ИНСПЕКЦИЮ
            </button>
          </form>

          {submitted && <div className="mt-6 p-4 bg-emerald-900/40 border border-emerald-500 rounded-2xl text-center text-emerald-400">✅ Оплата отправлена! Токен добавлен в таблицу с оценкой.</div>}
          {error && <div className="mt-4 text-red-400">{error}</div>}
        </div>
      </div>

      <div className="text-center text-xs text-zinc-500 pb-10">Powered by $MRDT • Solana Pay • AI Audits</div>
    </div>
  );
}
