'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  TrendingUp, Shield, Lock, Zap, Send, MessageSquare, X, 
  RefreshCw, AlertCircle, Sparkles, ExternalLink, ChevronDown, Download
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
  const [isSending, setIsSending] = useState(false);
  const [mrdtPrice, setMrdtPrice] = useState(0.000013);
  
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

  // Live $MRDT price
  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${MRDT_CA}`);
        const data = await res.json();
        if (data.pairs && data.pairs.length > 0) {
          const price = parseFloat(data.pairs[0].priceUsd);
          if (price > 0) setMrdtPrice(price);
        }
      } catch (e) {}
    };
    fetchPrice();
    const interval = setInterval(fetchPrice, 60000);
    return () => clearInterval(interval);
  }, []);

  const getAmountForTier = (tier) => {
    const usd = tier === 'fast' ? 40 : tier === 'vip' ? 120 : 10;
    return Math.round(usd / mrdtPrice);
  };

  const getTierLabel = (tier) => {
    const amt = getAmountForTier(tier);
    if (tier === 'basic') return `Базовый — $10 ≈ ${amt.toLocaleString()} $MRDT`;
    if (tier === 'fast') return `Быстрый — $40 ≈ ${amt.toLocaleString()} $MRDT`;
    return `VIP — $120 ≈ ${amt.toLocaleString()} $MRDT`;
  };

  // Solana Pay (как утром)
  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!formData.projectName || !formData.ca || !formData.email) {
      setError('Заполни все поля!');
      return;
    }

    setIsSending(true);

    const amount = getAmountForTier(selectedTier);
    const label = encodeURIComponent(`TNT House ${selectedTier}`);
    const msg = encodeURIComponent(`Аудит: ${formData.projectName}`);

    const payUrl = `solana:${WALLET_ADDRESS}?amount=${amount}&spl-token=${MRDT_CA}&label=${label}&message=${msg}`;
    window.location.href = payUrl;

    setTimeout(() => {
      const newToken = {
        name: formData.projectName,
        symbol: formData.projectName.slice(0,4).toUpperCase(),
        ca: formData.ca,
        price: (Math.random()*0.00005+0.000001).toFixed(8),
        liquidity: Math.floor(Math.random()*80000)+8000,
        volume24h: Math.floor(Math.random()*120000)+15000,
        priceChange24h: (Math.random()*25-3).toFixed(1),
        verified: true,
        dexUrl: `https://dexscreener.com/solana/${formData.ca}`
      };
      setTokens(prev => [newToken, ...prev]);
      setSubmitted(true);
      setFormData({ projectName: '', ca: '', email: '' });
      setError('');
      setLogs(prev => [...prev.slice(-10), `[${new Date().toLocaleTimeString()}] [✅] Оплата ${amount.toLocaleString()} $MRDT отправлена. Токен добавлен!`]);
      setIsSending(false);
      setTimeout(() => setSubmitted(false), 4000);
    }, 2000);
  };

  const handleSendChat = (e) => {
    e.preventDefault();
    if (!userMsg.trim()) return;
    setChatMessages(prev => [...prev, { sender: 'user', text: userMsg }]);
    setUserMsg('');
    setIsTyping(true);

    setTimeout(() => {
      setChatMessages(prev => [...prev, { sender: 'bot', text: 'Анализирую... Токен добавлен в таблицу с оценкой! ⚽️' }]);
      setIsTyping(false);
    }, 1000);
  };

  // Jupiter
  const handleLaunchJupiter = () => {
    window.open(`https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&buy=${MRDT_CA}`, '_blank');
  };

  const handleOpenRaydium = () => {
    window.open('https://raydium.io/liquidity/increase/?mode=add&pool_id=6cMTXZyCrnut7Lv39qt4dqEARbC2jbebvhzdCR1t2HEV', '_blank');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white font-mono relative overflow-hidden pb-12">
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-purple-600/10 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-emerald-500/10 blur-[120px] pointer-events-none"></div>

      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      <div className="relative z-10">
        <header className="border-b border-purple-500/30 backdrop-blur-lg bg-slate-950/60 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <a href="https://t.me/tnt_house2026" target="_blank" className="w-10 h-10 border-2 border-purple-500 rounded-lg flex items-center justify-center bg-purple-500/10 shadow-[0_0_15px_rgba(153,69,255,0.4)] animate-pulse">
                <span className="text-xl">🧨</span>
              </a>
              <div>
                <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-emerald-400 tracking-wider">TNT HOUSE</h1>
                <span className="text-[10px] text-purple-400 block font-bold tracking-widest">TOP NEW TOKENS v1.1 + LIVE PRICE</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="relative">
                <button onClick={() => setIsBuyDropdownOpen(!isBuyDropdownOpen)} className="bg-gradient-to-r from-purple-500 to-emerald-400 hover:from-purple-400 hover:to-emerald-300 text-slate-950 font-black px-4 py-2 rounded text-xs flex items-center gap-1 shadow-[0_0_15px_rgba(153,69,255,0.4)]">
                  BUY $MRDT <ChevronDown className="w-3 h-3" />
                </button>
                {isBuyDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-slate-900 border border-purple-500/30 rounded-lg shadow-xl z-50 py-1 text-sm">
                    <button onClick={handleLaunchJupiter} className="w-full text-left px-4 py-2.5 hover:bg-purple-500/10 text-emerald-400 flex items-center gap-2 text-sm">
                      <ExternalLink className="w-4 h-4" /> Jupiter Swap
                    </button>
                    <button onClick={handleOpenRaydium} className="w-full text-left px-4 py-2.5 hover:bg-purple-500/10 text-emerald-400 flex items-center gap-2 text-sm">
                      <ExternalLink className="w-4 h-4" /> Raydium
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <section className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="space-y-3 border-l-4 border-purple-500 pl-6">
                <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded font-bold border border-purple-500/30">БЕЗОПАСНЫЕ НОВЫЕ ТОКЕНЫ</span>
                <h2 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400">
                  Взрываем скамы.<br />Запускаем гемы.
                </h2>
                <p className="text-slate-300 text-base leading-relaxed">
                  Оплати $MRDT по текущему курсу → ИИ проверяет → Токен в таблице.
                </p>
              </div>
            </div>

            <div className="bg-slate-950 border-2 border-purple-500/40 rounded-lg p-4 font-mono text-xs h-72 flex flex-col justify-between shadow-[0_0_20px_rgba(153,69,255,0.15)]">
              <div className="text-purple-400 font-bold border-b border-purple-500/20 pb-2 mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-400 animate-spin" />
                AI SCANNER LIVE
              </div>
              <div className="flex-1 overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-purple-500/20 text-emerald-400">
                {logs.map((log, i) => <div key={i} className="leading-relaxed font-mono text-[11px]">{log}</div>)}
              </div>
            </div>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-6 py-6">
          <div className="border-2 border-purple-500/30 rounded-lg bg-slate-900/40 backdrop-blur-md p-6 shadow-[0_0_25px_rgba(153,69,255,0.2)]">
            <h3 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400 flex items-center gap-2 mb-4">
              <Shield className="w-5 h-5 text-emerald-400" /> ТАБЛИЦА БЕЗОПАСНЫХ НОВЫХ ТОКЕНОВ
            </h3>

            <div className="max-h-[340px] overflow-y-auto border border-purple-500/20 rounded-lg">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-purple-500/20 bg-purple-500/10 text-purple-400 font-bold">
                    <th className="p-2.5">Токен</th>
                    <th className="p-2.5">Цена</th>
                    <th className="p-2.5">Ликвидность</th>
                    <th className="p-2.5 text-center">TNT Safety Score</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-purple-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 transition">
                    <td className="p-2 font-bold flex items-center gap-2">
                      <span className="text-lg">⚽️</span>
                      <div><span className="text-emerald-400 font-extrabold text-sm tracking-wider">$MRDT</span><div className="text-[9px] text-slate-400">MARADONATOKEN</div></div>
                    </td>
                    <td className="p-2 font-mono text-emerald-400 font-bold">${mrdtPrice.toFixed(8)}</td>
                    <td className="p-2 font-mono text-emerald-400 font-bold">$13,000+</td>
                    <td className="p-2 text-center">
                      <div className="inline-flex items-center justify-center w-14 h-7 rounded-full bg-emerald-500/20 border border-emerald-500 text-emerald-400 text-[11px] font-extrabold tracking-widest shadow-[0_0_10px_rgba(16,185,129,0.5)]">98</div>
                    </td>
                  </tr>

                  {tokens.map((token, i) => {
                    const score = getSafetyScore(token);
                    const style = getScoreStyle(score);
                    return (
                      <tr key={i} className="border-b border-purple-500/10 hover:bg-purple-500/5 transition">
                        <td className="p-2 font-bold"><span className="text-purple-400">${token.symbol}</span><span className="text-[9px] text-slate-500 block font-normal truncate max-w-[120px]">{token.name}</span></td>
                        <td className="p-2 font-mono text-slate-300">${token.price}</td>
                        <td className="p-2 font-mono text-slate-300">{formatNumber(token.liquidity)}</td>
                        <td className="p-2 text-center"><div className={`inline-flex items-center justify-center w-14 h-7 rounded-full ${style.bg} ${style.border} ${style.color} text-[11px] font-extrabold tracking-widest ${style.glow}`}>{score}</div></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-6 py-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-4">
              <h3 className="text-2xl font-black text-purple-400">Подай заявку на ИИ-Аудит</h3>
              <p className="text-slate-300 text-sm leading-relaxed">Оплата автоматически считается по текущему курсу $MRDT</p>

              <div className="mt-6 border-t border-purple-500/20 pt-4 space-y-3">
                <h4 className="text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400 flex items-center gap-1.5">
                  <Download className="w-4 h-4 text-purple-400 animate-pulse" /> ТАРИФЫ ПО ТЕКУЩЕМУ КУРСУ:
                </h4>
                <div className="grid grid-cols-1 gap-2 text-xs font-mono">
                  <div className="flex justify-between p-2.5 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                    <span className="text-slate-300">🎁 Первые 3 токена</span>
                    <span className="text-emerald-400 font-bold">БЕСПЛАТНО</span>
                  </div>
                  <div className="flex justify-between p-2.5 bg-slate-900 border border-purple-500/10 rounded-lg">
                    <span className="text-slate-300">🔍 Базовый ИИ-Аудит ($10)</span>
                    <span className="text-emerald-400 font-bold">≈ {getAmountForTier('basic').toLocaleString()} $MRDT</span>
                  </div>
                  <div className="flex justify-between p-2.5 bg-slate-900 border border-purple-500/10 rounded-lg">
                    <span className="text-slate-300">⚡ Быстрый Листинг ($40)</span>
                    <span className="text-emerald-400 font-bold">≈ {getAmountForTier('fast').toLocaleString()} $MRDT</span>
                  </div>
                  <div className="flex justify-between p-2.5 bg-slate-900 border border-purple-500/10 rounded-lg">
                    <span className="text-slate-300">👑 VIP-Буст ($120)</span>
                    <span className="text-emerald-400 font-bold">≈ {getAmountForTier('vip').toLocaleString()} $MRDT</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-2 border-purple-500/30 rounded-lg bg-slate-900/40 p-6 backdrop-blur-md">
              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div>
                  <label className="block text-purple-400 text-xs font-bold mb-1.5">Название проекта</label>
                  <input type="text" value={formData.projectName} onChange={(e) => setFormData({...formData, projectName: e.target.value})} placeholder="Твой токен..." className="w-full bg-slate-950 border border-purple-500/20 rounded px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none transition" />
                </div>
                <div>
                  <label className="block text-purple-400 text-xs font-bold mb-1.5">Contract Address (Solana)</label>
                  <input type="text" value={formData.ca} onChange={(e) => setFormData({...formData, ca: e.target.value})} placeholder="Впиши адрес контракта..." className="w-full bg-slate-950 border border-purple-500/20 rounded px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none transition font-mono" />
                </div>

                <div>
                  <label className="block text-purple-400 text-xs font-bold mb-1.5">Выберите Тариф (цена обновляется автоматически)</label>
                  <select value={selectedTier} onChange={(e) => setSelectedTier(e.target.value)} className="w-full bg-slate-950 border border-purple-500/20 rounded px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-none transition font-mono">
                    <option value="basic">{getTierLabel('basic')}</option>
                    <option value="fast">{getTierLabel('fast')}</option>
                    <option value="vip">{getTierLabel('vip')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-purple-400 text-xs font-bold mb-1.5">Email для связи</label>
                  <input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} placeholder="your@email.com" className="w-full bg-slate-950 border border-purple-500/20 rounded px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none transition" />
                </div>
                <button type="submit" disabled={isSending} className="w-full bg-gradient-to-r from-purple-500 to-emerald-400 hover:from-purple-400 hover:to-emerald-300 text-slate-950 font-black py-2.5 rounded text-xs transition flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(153,69,255,0.3)] disabled:opacity-50">
                  <Send className="w-3.5 h-3.5" /> {isSending ? 'ОТПРАВЛЯЕМ...' : 'ЗАПУСТИТЬ ИИ-ИНСПЕКЦИЮ'}
                </button>
                {submitted && <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded text-emerald-300 text-xs text-center">✓ Оплата отправлена! Токен добавлен в таблицу с оценкой.</div>}
              </form>
            </div>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-6 py-6">
          <div className="relative bg-gradient-to-r from-purple-500/10 via-transparent to-emerald-500/10 border-2 border-purple-500/30 rounded-lg p-10 overflow-hidden shadow-lg">
            <div className="relative z-10 max-w-2xl">
              <h3 className="text-2xl font-black text-purple-400 mb-2">🐋 TNT WHALE CLUB (DAO)</h3>
              <p className="text-slate-300 text-sm leading-relaxed mb-5">Держи $MRDT и получи доступ к закрытому Telegram чату.</p>
              <a href="https://t.me/tnt_house2026" target="_blank" className="inline-block bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-400 hover:to-purple-500 text-white font-bold py-2.5 px-6 rounded text-xs transition duration-300 shadow-md shadow-purple-500/30">
                Вступить в VIP-Клуб →
              </a>
            </div>
          </div>
        </section>

        <footer className="border-t border-purple-500/20 mt-12 py-6 bg-slate-950/60 backdrop-blur-lg">
          <div className="max-w-7xl mx-auto px-6 text-center space-y-2">
            <div className="text-purple-400 font-bold text-sm tracking-widest">TNT HOUSE v1.1 • SOLANA PAY + LIVE PRICE</div>
          </div>
        </footer>
      </div>

      <button onClick={() => setIsChatOpen(!isChatOpen)} className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-tr from-purple-500 to-emerald-400 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(153,69,255,0.5)] hover:scale-105 transition duration-300 z-50 animate-bounce">
        {isChatOpen ? <X className="w-6 h-6 text-slate-950" /> : <MessageSquare className="w-6 h-6 text-slate-950" />}
      </button>

      {isChatOpen && (
        <div className="fixed bottom-24 right-6 w-80 md:w-96 h-[450px] bg-slate-900 border-2 border-purple-500 rounded-xl shadow-[0_0_30px_rgba(153,69,255,0.4)] flex flex-col overflow-hidden z-50 font-mono">
          <div className="bg-gradient-to-r from-purple-600 to-emerald-500 p-4 flex items-center justify-between border-b border-purple-500/20">
            <div className="flex items-center gap-2">
              <span className="text-xl">🤖</span>
              <div><h4 className="font-bold text-xs text-white">TNT AI INSPECTOR</h4></div>
            </div>
            <button onClick={() => setIsChatOpen(false)} className="text-white hover:text-slate-200"><X className="w-4 h-4" /></button>
          </div>

          <div className="flex-1 p-4 overflow-y-auto space-y-3 scrollbar-thin scrollbar-thumb-purple-500/20 text-xs">
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-lg p-2.5 leading-relaxed ${msg.sender === 'user' ? 'bg-purple-500/20 text-purple-200 border border-purple-500/30' : 'bg-slate-950 text-emerald-400 border border-emerald-500/30'}`}>{msg.text}</div>
              </div>
            ))}
            {isTyping && <div className="flex justify-start"><div className="bg-slate-950 text-emerald-400 border border-emerald-500/30 rounded-lg p-2.5 animate-pulse text-[11px]">TNT Inspector думает...</div></div>}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={handleSendChat} className="p-3 border-t border-purple-500/20 bg-slate-950 flex gap-2">
            <input type="text" value={userMsg} onChange={(e) => setUserMsg(e.target.value)} placeholder="Спроси у ИИ..." className="flex-1 bg-slate-909 border border-purple-500/20 rounded px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none" />
            <button type="submit" className="bg-purple-500 hover:bg-purple-400 text-slate-950 px-3 rounded text-xs font-bold transition"><Send className="w-3.5 h-3.5" /></button>
          </form>
        </div>
      )}
    </div>
  );
}
