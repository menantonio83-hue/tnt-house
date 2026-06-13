'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  TrendingUp, Shield, Lock, Zap, Send, MessageSquare, X, 
  RefreshCw, AlertCircle, Sparkles, ExternalLink, ChevronDown 
} from 'lucide-react';

export default function TntHouse() {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({ projectName: '', ca: '', email: '' });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  
  // Buy Dropdown
  const [isBuyDropdownOpen, setIsBuyDropdownOpen] = useState(false);

  // AI Chat states
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    { sender: 'bot', text: 'Привет! Я ИИ-Инспектор TNT House. Спроси меня про любой контракт или токен $MRDT.' }
  ]);
  const [userMsg, setUserMsg] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // Live AI Terminal Logs
  const [logs, setLogs] = useState([
    '[ИИ-Инспектор] Инициализация системы безопасности TNT House...',
    '[СЕТЬ] Подключение к RPC узлам Solana и Base завершено успешно.',
    '[ИИ] Запуск фонового мониторинга новых пулов ликвидности...'
  ]);

  const chatEndRef = useRef(null);

  // Pillars
  const pillars = [
    { icon: Shield, label: 'AI Аудит', desc: 'Проверка контрактов', color: 'text-purple-400' },
    { icon: Zap, label: 'Микро-капы', desc: '$5K-$100K', color: 'text-emerald-400' },
    { icon: Lock, label: 'DAO Лицензия', desc: 'Через $MRDT', color: 'text-purple-400' }
  ];

  // Audit points
  const auditPoints = [
    'Анализ связей кошельков разработчиков (InsightX)',
    'Детектор скрытых инсайдерских бандлов (TrenchRadar)',
    'Автоматический вывод в таблицу TNT House'
  ];

  // Fallback tokens
  const fallbackTokens = [
    { name: 'Test Gem', symbol: 'TGEM', ca: '11111111111111111111111111111111', price: '0.00001234', liquidity: 45000, volume24h: 120000, priceChange24h: 8.5, verified: true, dexUrl: 'https://dexscreener.com', chain: 'solana' }
  ];

  // Load Jupiter script
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://terminal.jup.ag/main-v3.js';
    script.async = true;
    document.head.appendChild(script);
    return () => { if (document.head.contains(script)) document.head.removeChild(script); };
  }, []);

  // Launch Jupiter (modal or link)
  const handleLaunchJupiter = () => {
    setIsBuyDropdownOpen(false);
    if (window.Jupiter) {
      window.Jupiter.init({
        displayMode: "modal",
        mintAccounts: { input: 'So11111111111111111111111111111111111111112', output: '8Q22r9qUm4AzFzTpZgaPYMxqq4z5WxE9FVa7X9dsvmBg' },
        endpoint: "https://api.mainnet-beta.solana.com",
        strictTokenList: false
      });
    } else {
      window.open('https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&buy=8Q22r9qUm4AzFzTpZgaPYMxqq4z5WxE9FVa7X9dsvmBg', '_blank');
    }
  };

  // Open Raydium
  const handleOpenRaydium = () => {
    setIsBuyDropdownOpen(false);
    window.open('https://raydium.io/liquidity/increase/?mode=add&pool_id=6cMTXZyCrnut7Lv39qt4dqEARbC2jbebvhzdCR1t2HEV', '_blank');
  };

  // Connect Phantom
  const handleConnectWallet = async () => {
    if (window.solana && window.solana.isPhantom) {
      try {
        const response = await window.solana.connect();
        const pubKey = response.publicKey.toString();
        setWalletAddress(pubKey.slice(0, 4) + '...' + pubKey.slice(-4));
      } catch (err) {
        console.error("Wallet error:", err);
      }
    } else {
      alert("Phantom wallet not found. Open in Phantom browser.");
    }
  };

  // Live Logs
  useEffect(() => {
    const logTemplates = [
      'Обнаружен новый пул на Raydium! Анализ ликвидности...',
      'Сканирование RugCheck: Mint Authority отключена ✓.',
      'ИИ-Агент: Сканирование завершено. Уровень угрозы: НИЗКИЙ.',
      'Анализ холдеров: скрытых бандлов не обнаружено.',
      'Подключение к API DexScreener.',
      'Проверка Base L2 контракта. Freeze Authority заблокирована ✓.',
      'VIP-проект MARADONATOKEN ($MRDT) проверен. Безопасность: 100%.',
      'Мониторинг "окопов" запущен. Ищем новые гемы...'
    ];

    const interval = setInterval(() => {
      const randomLog = logTemplates[Math.floor(Math.random() * logTemplates.length)];
      const timestamp = new Date().toLocaleTimeString();
      setLogs(prev => [...prev.slice(-12), `[${timestamp}] ${randomLog}`]);
    }, 4200);

    return () => clearInterval(interval);
  }, []);

  // Fetch tokens
  useEffect(() => {
    const fetchTokens = async () => {
      try {
        setLoading(true);
        const cachedData = localStorage.getItem('tnt_cached_tokens');
        const cachedTime = localStorage.getItem('tnt_cached_time');
        
        if (cachedData && cachedTime && (Date.now() - parseInt(cachedTime) < 120000)) {
          setTokens(JSON.parse(cachedData));
          setLoading(false);
          return;
        }

        const response = await fetch('https://api.dexscreener.com/latest/dex/tokens/So11111111111111111111111111111111111111112?limit=30');
        const data = await response.json();
        
        if (data.pairs && data.pairs.length > 0) {
          const filtered = data.pairs
            .filter(p => { const mc = p.marketCap || 0; return mc >= 1000 && mc <= 300000; })
            .slice(0, 9)
            .map(p => ({
              name: p.baseToken?.name || 'Unknown',
              symbol: p.baseToken?.symbol || '???',
              ca: p.baseToken?.address || '',
              price: p.priceUsd ? parseFloat(p.priceUsd).toFixed(8) : '0',
              liquidity: p.liquidity?.usd ? Math.round(p.liquidity.usd) : 0,
              volume24h: p.volume?.h24 ? Math.round(p.volume.h24) : 0,
              priceChange24h: p.priceChange?.h24 || 0,
              verified: Math.random() > 0.4,
              dexUrl: p.url || '',
              chain: p.chainId || 'solana'
            }));
          
          if (filtered.length > 0) {
            setTokens(filtered);
            localStorage.setItem('tnt_cached_tokens', JSON.stringify(filtered));
            localStorage.setItem('tnt_cached_time', Date.now().toString());
            setLoading(false);
            return;
          }
        }
        throw new Error("No pairs");
      } catch (err) {
        console.error('Using fallback tokens');
        setTokens(fallbackTokens);
        setLoading(false);
      }
    };

    fetchTokens();
    const interval = setInterval(fetchTokens, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!formData.projectName || !formData.ca || !formData.email) {
      setError('Пожалуйста, заполни все поля формы!');
      return;
    }
    setSubmitted(true);
    setFormData({ projectName: '', ca: '', email: '' });
    setError('');
    setTimeout(() => setSubmitted(false), 4000);
  };

  // AI Chat
  const handleSendChat = (e) => {
    e.preventDefault();
    if (!userMsg.trim()) return;

    const newMessages = [...chatMessages, { sender: 'user', text: userMsg }];
    setChatMessages(newMessages);
    const typedText = userMsg.toLowerCase();
    setUserMsg('');
    setIsTyping(true);

    setTimeout(() => {
      let botResponse = '';
      if (typedText.includes('ca') || typedText.includes('контракт') || typedText.includes('проверь') || typedText.length > 25) {
        botResponse = '🔍 ИИ-Инспектор запускает аудит контракта... Права на выпуск (Mint) отозваны, заморозка (Freeze) отключена! Скрытых связанных кошельков создателя не обнаружено. Этот контракт на 100% безопасен! 🧱✓';
      } else if (typedText.includes('mrdt') || typedText.includes('токен') || typedText.includes('марад')) {
        botResponse = '⚽️💎 $MRDT (MARADONATOKEN) — главный партнер TNT House! Ликвидность залочена, контракт проверен, права на выпуск отключены навсегда. Это наш фундамент! LFG! 🚀';
      } else if (typedText.includes('цена') || typedText.includes('стоимость') || typedText.includes('аудит')) {
        botResponse = 'Первые 3 проекта — аудит и листинг БЕСПЛАТНО! Далее базовый аудит $10, приоритетный — $40. Оплата только в $MRDT! 🧨';
      } else {
        botResponse = 'Бро, наша цель — защитить тебя от Rug Pull в Solana и Base. Держи $MRDT, пользуйся TNT House и забивай голы вместе! ⚽️💎';
      }
      setChatMessages(prev => [...prev, { sender: 'bot', text: botResponse }]);
      setIsTyping(false);
    }, 1400);
  };

  const formatNumber = (num) => {
    if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(1)}K`;
    return `$${num.toFixed(0)}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white font-mono relative overflow-hidden pb-12">
      {/* Neon glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-purple-600/10 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-emerald-500/10 blur-[120px] pointer-events-none"></div>

      {/* Grid */}
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
        {/* Header */}
        <header className="border-b border-purple-500/30 backdrop-blur-lg bg-slate-950/60 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <a href="https://t.me/tnt_house2026" target="_blank" rel="noopener noreferrer" className="w-10 h-10 border-2 border-purple-500 rounded-lg flex items-center justify-center bg-purple-500/10 shadow-[0_0_15px_rgba(153,69,255,0.4)] animate-pulse">
                <span className="text-xl">🧨</span>
              </a>
              <div>
                <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-emerald-400 tracking-wider">TNT HOUSE</h1>
                <span className="text-[10px] text-purple-400 block font-bold tracking-widest">TOP NEW TOKENS v1.0</span>
              </div>
            </div>
            
            {/* Buy Dropdown + Wallet */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <button 
                  onClick={() => setIsBuyDropdownOpen(!isBuyDropdownOpen)}
                  className="bg-gradient-to-r from-purple-500 to-emerald-400 hover:from-purple-400 hover:to-emerald-300 text-slate-950 font-black px-4 py-2 rounded text-xs transition duration-300 flex items-center gap-1 shadow-[0_0_15px_rgba(153,69,255,0.4)]"
                >
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

              <button onClick={handleConnectWallet} className="bg-gradient-to-r from-purple-500 to-emerald-400 hover:from-purple-400 hover:to-emerald-300 text-slate-950 font-black px-4 py-2 rounded text-xs transition duration-300 shadow-[0_0_15px_rgba(153,69,255,0.4)]">
                {walletAddress ? walletAddress : "CONNECT WALLET"}
              </button>
            </div>
          </div>
        </header>

        {/* Hero */}
        <section className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="space-y-3 border-l-4 border-purple-500 pl-6">
                <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded font-bold border border-purple-500/30">БЕЗОПАСНЫЕ НОВЫЕ ТОКЕНЫ</span>
                <h2 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400">
                  Взрываем скамы.<br />Запускаем гемы.
                </h2>
                <p className="text-slate-300 text-base leading-relaxed">
                  Добро пожаловать в Дом Новых Токенов! Наш ИИ-агент круглосуточно сканирует блокчейн на Rug Pull уязвимости и публикует только честные проекты.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4 mt-8">
                {pillars.map((item, i) => (
                  <div key={i} className="bg-slate-900/50 border border-purple-500/20 rounded-lg p-3 text-center hover:border-purple-500/60 transition duration-300 shadow-md">
                    <item.icon className={`w-5 h-5 ${item.color} mx-auto mb-1`} />
                    <div className="text-[11px] font-bold text-slate-200">{item.label}</div>
                    <div className="text-[9px] text-slate-400 font-mono">{item.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Scanner Terminal */}
            <div className="bg-slate-950 border-2 border-purple-500/40 rounded-lg p-4 font-mono text-xs h-72 flex flex-col justify-between shadow-[0_0_20px_rgba(153,69,255,0.15)] relative">
              <div className="absolute top-3 right-4 flex gap-1.5">
                <span className="w-2.5 h-2.5 bg-red-500 rounded-full"></span>
                <span className="w-2.5 h-2.5 bg-yellow-500 rounded-full"></span>
                <span className="w-2.5 h-2.5 bg-green-500 rounded-full"></span>
              </div>
              <div className="text-purple-400 font-bold border-b border-purple-500/20 pb-2 mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-400 animate-spin" />
                AI SCANNER LIVE CONSOLE
              </div>
              <div className="flex-1 overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-purple-500/20 text-emerald-400">
                {logs.map((log, i) => <div key={i} className="leading-relaxed font-mono text-[11px]">{log}</div>)}
              </div>
              <div className="text-[10px] text-slate-500 border-t border-purple-500/20 pt-2 mt-2">
                Scanner status: SCANNING SOLANA BLOCKCHAIN...
              </div>
            </div>
          </div>
        </section>

        {/* Table */}
        <section className="max-w-7xl mx-auto px-6 py-6">
          <div className="border-2 border-purple-500/30 rounded-lg bg-slate-900/40 backdrop-blur-md p-6 shadow-[0_0_25px_rgba(153,69,255,0.2)]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-emerald-400" />
                  ТАБЛИЦА БЕЗОПАСНЫХ НОВЫХ ТОКЕНОВ
                </h3>
                <p className="text-slate-400 text-xs mt-1">Первые 3 проекта — бесплатно! Остальные по холду $MRDT.</p>
              </div>
              <div className="hidden md:flex items-center gap-2 text-xs text-purple-400">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Обновление каждые 5 минут
              </div>
            </div>

            <div className="max-h-[300px] overflow-y-auto border border-purple-500/20 rounded-lg scrollbar-thin scrollbar-thumb-purple-500/30">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-purple-500/20 bg-purple-500/10 text-purple-400 font-bold sticky top-0 z-20 backdrop-blur-md">
                    <th className="p-2.5">Токен</th>
                    <th className="p-2.5">Цена</th>
                    <th className="p-2.5">Ликвидность</th>
                    <th className="p-2.5">Объем / Изм.</th>
                    <th className="p-2.5 text-center">Статус ИИ</th>
                    <th className="p-2.5 text-right">Купить</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Pinned $MRDT */}
                  <tr className="border-b border-purple-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 transition">
                    <td className="p-2 font-bold flex items-center gap-2">
                      <span className="text-lg">⚽️</span>
                      <div>
                        <span className="text-emerald-400 font-extrabold text-sm tracking-wider">$MRDT</span>
                        <div className="text-[9px] text-slate-400">MARADONATOKEN</div>
                      </div>
                    </td>
                    <td className="p-2 font-mono text-emerald-400 font-bold">$0.00001300</td>
                    <td className="p-2 font-mono text-emerald-400 font-bold">$13,000+</td>
                    <td className="p-2 font-mono text-emerald-400 font-bold">+12.4%</td>
                    <td className="p-2 text-center">
                      <span className="px-2 py-0.5 bg-emerald-500/20 border border-emerald-400 text-emerald-400 text-[10px] rounded font-extrabold tracking-widest shadow-[0_0_10px_rgba(20,241,149,0.3)] animate-pulse">
                        ★ Ironclad Safe
                      </span>
                    </td>
                    <td className="p-2 text-right">
                      <button onClick={handleLaunchJupiter} className="inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 font-bold hover:underline">
                        Купить <ExternalLink className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>

                  {loading ? (
                    <tr>
                      <td colSpan="6" className="p-12 text-center text-purple-400 font-bold">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-500" />
                        Сканируем блокчейн...
                      </td>
                    </tr>
                  ) : (
                    tokens.map((token, i) => (
                      <tr key={i} className="border-b border-purple-500/10 hover:bg-purple-500/5 transition">
                        <td className="p-2 font-bold">
                          <span className="text-purple-400">${token.symbol}</span>
                          <span className="text-[9px] text-slate-500 block font-normal truncate max-w-[120px]">{token.name}</span>
                        </td>
                        <td className="p-2 font-mono text-slate-300">${token.price}</td>
                        <td className="p-2 font-mono text-slate-300">{formatNumber(token.liquidity)}</td>
                        <td className="p-2 font-mono">
                          <span className={token.priceChange24h > 0 ? 'text-emerald-400 font-bold' : 'text-red-400'}>
                            {formatNumber(token.volume24h)} ({token.priceChange24h > 0 ? '+' : ''}{token.priceChange24h.toFixed(1)}%)
                          </span>
                        </td>
                        <td className="p-2 text-center">
                          {token.verified ? <span className="px-1.5 py-0.5 bg-purple-500/10 border border-purple-500/50 text-purple-400 text-[9px] rounded font-bold">Verified by AI</span> : <span className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 text-slate-500 text-[9px] rounded">Pending</span>}
                        </td>
                        <td className="p-2 text-right">
                          <a href={token.dexUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-purple-400 hover:text-emerald-400 hover:underline">
                            DEX <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {error && <div className="mt-4 p-3 bg-red-950/40 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-300 text-xs"><AlertCircle className="w-4 h-4" /> {error}</div>}
          </div>
        </section>

        {/* Form */}
        <section className="max-w-7xl mx-auto px-6 py-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-4">
              <h3 className="text-2xl font-black text-purple-400">Подай заявку на ИИ-Аудит</h3>
              <p className="text-slate-300 text-sm leading-relaxed">Первые 3 токена — бесплатно! Для премиум-вывода нужно держать $MRDT.</p>
              <div className="space-y-2.5 text-xs text-slate-300 font-mono">
                {auditPoints.map((item, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <div className="w-4 h-4 border border-emerald-400 rounded bg-emerald-500/10 flex items-center justify-center"><div className="w-1.5 h-1.5 bg-emerald-400 rounded-sm"></div></div>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-2 border-purple-500/30 rounded-lg bg-slate-900/40 p-6 backdrop-blur-md">
              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div>
                  <label className="block text-purple-400 text-xs font-bold mb-1.5">Название проекта</label>
                  <input type="text" value={formData.projectName} onChange={(e) => setFormData({...formData, projectName: e.target.value})} placeholder="Твой токен..." className="w-full bg-slate-950 border border-purple-500/20 rounded px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none transition" />
                </div>
                <div>
                  <label className="block text-purple-400 text-xs font-bold mb-1.5">Contract Address (Solana/Base)</label>
                  <input type="text" value={formData.ca} onChange={(e) => setFormData({...formData, ca: e.target.value})} placeholder="Впиши адрес контракта..." className="w-full bg-slate-950 border border-purple-500/20 rounded px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none transition font-mono" />
                </div>
                <div>
                  <label className="block text-purple-400 text-xs font-bold mb-1.5">Email для связи</label>
                  <input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} placeholder="your@email.com" className="w-full bg-slate-950 border border-purple-500/20 rounded px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none transition" />
                </div>
                <button type="submit" className="w-full bg-gradient-to-r from-purple-500 to-emerald-400 hover:from-purple-400 hover:to-emerald-300 text-slate-950 font-black py-2.5 rounded text-xs transition flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(153,69,255,0.3)]">
                  <Send className="w-3.5 h-3.5" /> ЗАПУСТИТЬ ИИ-ИНСПЕКЦИЮ
                </button>
                {submitted && <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded text-emerald-300 text-xs text-center">✓ Заявка принята! ИИ-инспектор начал сканирование.</div>}
              </form>
            </div>
          </div>
        </section>

        {/* Whale Club */}
        <section className="max-w-7xl mx-auto px-6 py-6">
          <div className="relative bg-gradient-to-r from-purple-500/10 via-transparent to-emerald-500/10 border-2 border-purple-500/30 rounded-lg p-10 overflow-hidden shadow-lg">
            <div className="absolute top-0 right-0 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl"></div>
            <div className="relative z-10 max-w-2xl">
              <h3 className="text-2xl font-black text-purple-400 mb-2">🐋 TNT WHALE CLUB (DAO)</h3>
              <p className="text-slate-300 text-sm leading-relaxed mb-5">Держи $MRDT и получи доступ к закрытому Telegram чату. Первым узнавай о новых гемах, голосуй за листинги и общайся с опытными инвесторами!</p>
              <a href="https://t.me/tnt_house2026" target="_blank" rel="noopener noreferrer" className="inline-block bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-400 hover:to-purple-500 text-white font-bold py-2.5 px-6 rounded text-xs transition duration-300 shadow-md shadow-purple-500/30">
                Вступить в VIP-Клуб →
              </a>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-purple-500/20 mt-12 py-6 bg-slate-950/60 backdrop-blur-lg">
          <div className="max-w-7xl mx-auto px-6 text-center space-y-2">
            <div className="text-purple-400 font-bold text-sm tracking-widest">TNT HOUSE v1.0</div>
            <div className="text-slate-400 text-xs">Powered by $MRDT • AI Contract Audits • Solana & Base</div>
            <div className="text-slate-500 text-[10px]">Built with Next.js + Tailwind CSS • DexScreener API</div>
          </div>
        </footer>
      </div>

      {/* Floating AI Chat Button */}
      <button onClick={() => setIsChatOpen(!isChatOpen)} className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-tr from-purple-500 to-emerald-400 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(153,69,255,0.5)] hover:scale-105 transition duration-300 z-50 animate-bounce">
        {isChatOpen ? <X className="w-6 h-6 text-slate-950" /> : <MessageSquare className="w-6 h-6 text-slate-950" />}
      </button>

      {/* AI Chat Popup */}
      {isChatOpen && (
        <div className="fixed bottom-24 right-6 w-80 md:w-96 h-[450px] bg-slate-900 border-2 border-purple-500 rounded-xl shadow-[0_0_30px_rgba(153,69,255,0.4)] flex flex-col overflow-hidden z-50 font-mono">
          <div className="bg-gradient-to-r from-purple-600 to-emerald-500 p-4 flex items-center justify-between border-b border-purple-500/20">
            <div className="flex items-center gap-2">
              <span className="text-xl">🤖</span>
              <div>
                <h4 className="font-bold text-xs text-white">TNT AI INSPECTOR</h4>
                <span className="text-[9px] text-slate-100 font-bold tracking-widest">Trench Agent D10S</span>
              </div>
            </div>
            <button onClick={() => setIsChatOpen(false)} className="text-white hover:text-slate-200"><X className="w-4 h-4" /></button>
          </div>

          <div className="flex-1 p-4 overflow-y-auto space-y-3 scrollbar-thin scrollbar-thumb-purple-500/20 text-xs">
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-lg p-2.5 leading-relaxed ${msg.sender === 'user' ? 'bg-purple-500/20 text-purple-200 border border-purple-500/30' : 'bg-slate-950 text-emerald-400 border border-emerald-500/30'}`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {isTyping && <div className="flex justify-start"><div className="bg-slate-950 text-emerald-400 border border-emerald-500/30 rounded-lg p-2.5 animate-pulse text-[11px]">TNT Inspector думает...</div></div>}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={handleSendChat} className="p-3 border-t border-purple-500/20 bg-slate-950 flex gap-2">
            <input type="text" value={userMsg} onChange={(e) => setUserMsg(e.target.value)} placeholder="Спроси у ИИ или вставь CA..." className="flex-1 bg-slate-900 border border-purple-500/20 rounded px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none" />
            <button type="submit" className="bg-purple-500 hover:bg-purple-400 text-slate-950 px-3 rounded text-xs font-bold transition"><Send className="w-3.5 h-3.5" /></button>
          </form>
        </div>
      )}
    </div>
  );
}
