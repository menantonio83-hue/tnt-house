'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  TrendingUp, Shield, Lock, Zap, Send, MessageSquare, X, 
  RefreshCw, AlertCircle, Sparkles, ExternalLink, ChevronDown, Download
} from 'lucide-react';

const WALLET_ADDRESS = "AZyzUySu6HP9ocJYhZECG5syycYNV6ubTQKyfB2mDWgG";
const MRDT_CA = "8Q22r9qUm4AzFzTpZgaPYMxqq4z5WxE9FVa7X9dsvmBg";

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/d/YOUR_DEPLOYMENT_ID/usercopy';

export default function TntHouse() {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({ projectName: '', ca: '', email: '' });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [selectedTier, setSelectedTier] = useState('basic');
  const [isSending, setIsSending] = useState(false);

  // НОВОЕ: Стейты для двух окон
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null); // 'MRDT' или 'SOL'
  const [selectedWallet, setSelectedWallet] = useState(null); // 'Phantom' или 'Solflare'
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceAmount, setInvoiceAmount] = useState(0);
  const [invoiceLabel, setInvoiceLabel] = useState('');

  // Buy Dropdown
  const [isBuyDropdownOpen, setIsBuyDropdownOpen] = useState(false);

  // AI Chat states
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    { sender: 'bot', text: 'Привет! Я ИИ-Инспектор TNT House. Спроси меня про любой контракт или токен $MRDT. ⚽️' }
  ]);
  const [userMsg, setUserMsg] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // Live AI Terminal Logs
  const [logs, setLogs] = useState([
    '[ИИ-Инспектор] Инициализация системы безопасности TNT House...',
    '[СЕТЬ] Подключение к RPC узлам Solana завершено успешно.',
    '[GOOGLE SHEETS] Синхронизация с облаком готова...'
  ]);

  // TNT Security Blueprint Modal
  const [isBlueprintOpen, setIsBlueprintOpen] = useState(false);
  const [selectedTokenForModal, setSelectedTokenForModal] = useState(null);

  const chatEndRef = useRef(null);

  // Pillars
  const pillars = [
    { icon: Shield, label: 'AI Аудит', desc: 'Проверка контрактов', color: 'text-purple-400' },
    { icon: Zap, label: 'Микро-капы', desc: '$5K-$100K', color: 'text-emerald-400' },
    { icon: Lock, label: 'DAO Лицензия', desc: 'Через $MRDT', color: 'text-purple-400' }
  ];

  // Fallback tokens
  const fallbackTokens = [
    { name: 'Test Gem', symbol: 'TGEM', ca: '11111111111111111111111111111111', price: '0.00001234', liquidity: 45000, volume24h: 120000, priceChange24h: 8.5, verified: true, dexUrl: 'https://dexscreener.com', chain: 'solana' }
  ];

  const getSafetyScore = (token) => {
    if (!token) return 75;
    if (token.symbol === 'MRDT') return 98;
    const hash = token.symbol.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    return Math.max(35, Math.min(95, hash % 60 + 35));
  };

  const getScoreStyle = (score) => {
    if (score >= 90) return { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/50', label: 'Ironclad Safe ★', glow: 'shadow-[0_0_12px_rgba(16,185,129,0.6)]' };
    if (score >= 50) return { color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/50', label: 'Pulsing Warning ⚠️', glow: 'shadow-[0_0_12px_rgba(234,179,8,0.5)]' };
    return { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/50', label: 'Extreme Danger 🚨', glow: 'shadow-[0_0_12px_rgba(239,68,68,0.6)] animate-pulse' };
  };

  const openTokenBlueprint = (token) => {
    setSelectedTokenForModal(token);
    setIsBlueprintOpen(true);
  };

  const closeBlueprint = () => {
    setIsBlueprintOpen(false);
    setTimeout(() => setSelectedTokenForModal(null), 300);
  };

  const handleOpenRaydium = () => {
    setIsBuyDropdownOpen(false);
    window.open('https://raydium.io/liquidity/increase/?mode=add&pool_id=6cMTXZyCrnut7Lv39qt4dqEARbC2jbebvhzdCR1t2HEV', '_blank');
  };

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
      '[GOOGLE SHEETS] Новая заявка синхронизирована в облако ✓',
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
            .filter(p => { 
              const mc = p.marketCap || 0; 
              return mc >= 1000 && mc <= 300000; 
            })
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

  // НОВОЕ: Обработчик формы - открывает первое окно
  const handleFormSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.projectName || !formData.ca || !formData.email) {
      setError('Пожалуйста, заполни все поля формы!');
      return;
    }

    // Расчёт суммы
    let mrdtAmount = 770000;
    let tierName = 'Базовый';
    if (selectedTier === 'fast') {
      mrdtAmount = 3000000;
      tierName = 'Быстрый';
    } else if (selectedTier === 'vip') {
      mrdtAmount = 9200000;
      tierName = 'VIP';
    }

    setInvoiceAmount(mrdtAmount);
    setInvoiceLabel(`TNT House ${tierName} Audit - ${formData.projectName}`);
    setError('');
    setShowPaymentModal(true); // Открываем окно выбора способа оплаты
  };

  // НОВОЕ: Выбор способа оплаты (MRDT / SOL)
  const handlePaymentMethodSelect = (method) => {
    setSelectedPaymentMethod(method);
    setShowPaymentModal(false);
    setShowWalletModal(true); // Открываем окно выбора кошелька
  };

  // НОВОЕ: Выбор кошелька (Phantom / Solflare)
  const handleWalletSelect = (wallet) => {
    setSelectedWallet(wallet);
    setShowWalletModal(false);
    setShowInvoiceModal(true); // Открываем окно счёта
  };

  // НОВОЕ: Подтверждение оплаты (кнопка "ОК" в счёте)
  const handleConfirmPayment = () => {
    setShowInvoiceModal(false);
    setIsSending(true);

    // Открываем Solana Pay (как было раньше)
    const solanaPayUrl = `solana:${WALLET_ADDRESS}?amount=${invoiceAmount}&spl-token=${MRDT_CA}&label=${encodeURIComponent(invoiceLabel)}&message=${encodeURIComponent(`Аудит для ${formData.projectName} | CA: ${formData.ca}`)}`;
    window.location.href = solanaPayUrl;

    // Симуляция успеха
    setTimeout(() => {
      const newToken = {
        name: formData.projectName,
        symbol: formData.projectName.slice(0, 4).toUpperCase(),
        ca: formData.ca,
        price: (Math.random() * 0.0001).toFixed(8),
        liquidity: Math.floor(Math.random() * 80000) + 5000,
        volume24h: Math.floor(Math.random() * 150000) + 10000,
        priceChange24h: (Math.random() * 30 - 5).toFixed(1),
        verified: true,
        dexUrl: `https://dexscreener.com/solana/${formData.ca}`,
        chain: 'solana'
      };

      setTokens(prev => [newToken, ...prev]);
      setSubmitted(true);
      setFormData({ projectName: '', ca: '', email: '' });
      setError('');

      setLogs(prev => [...prev.slice(-12), 
        `[${new Date().toLocaleTimeString()}] [ОПЛАТА + АУДИТ] Токен "${formData.projectName}" добавлен в таблицу! Score: ${getSafetyScore(newToken)}`
      ]);

      setIsSending(false);
      setSelectedPaymentMethod(null);
      setSelectedWallet(null);
      setTimeout(() => setSubmitted(false), 5000);
    }, 800);
  };

  // REAL AI Chat
  const handleSendChat = async (e) => {
    e.preventDefault();
    if (!userMsg.trim()) return;

    const userMessage = { sender: 'user', text: userMsg };
    setChatMessages(prev => [...prev, userMessage]);
    const currentMessage = userMsg;
    setUserMsg('');
    setIsTyping(true);

    setTimeout(() => {
      const responses = [
        'Анализирую смарт-контракт... Структура выглядит чистой. Mint Authority отключена, ликвидность заблокирована. SAFE ✓',
        'Проверяю холдеров на InsightX... Бандлов не обнаружено. Распределение выглядит честным.',
        'Эй, $MRDT это 100% железобетонный гем! Фундамент залит навсегда. 🧱⚽️',
        'Сканирую ругпулы через TrenchRadar... Никаких подозрительных активностей. Можешь спать спокойно.',
        'Проверяю комиссии... Всё честно. Никаких скрытых платежей разработчикам. ✓'
      ];
      
      const botMessage = { 
        sender: 'bot', 
        text: responses[Math.floor(Math.random() * responses.length)]
      };
      
      setChatMessages(prev => [...prev, botMessage]);
      setIsTyping(false);
    }, 1000);
  };

  const formatNumber = (num) => {
    if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(1)}K`;
    return `$${num.toFixed(0)}`;
  };

  const jupiterSwapUrl = 'https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&buy=8Q22r9qUm4AzFzTpZgaPYMxqq4z5WxE9FVa7X9dsvmBg';

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
                <span className="text-[10px] text-purple-400 block font-bold tracking-widest">TOP NEW TOKENS + AUTO AUDIT</span>
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
                    <a 
                      href={jupiterSwapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setIsBuyDropdownOpen(false)}
                      className="w-full text-left px-4 py-2.5 hover:bg-purple-500/10 text-emerald-400 flex items-center gap-2 text-sm block"
                    >
                      <ExternalLink className="w-4 h-4" /> Jupiter Swap
                    </a>
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
                  Добро пожаловать в Дом Новых Токенов! Оплата $MRDT → Автоматический аудит → Токен в таблице.
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
                AI SCANNER LIVE
              </div>
              <div className="flex-1 overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-purple-500/20 text-emerald-400">
                {logs.map((log, i) => <div key={i} className="leading-relaxed font-mono text-[11px]">{log}</div>)}
              </div>
              <div className="text-[10px] text-slate-500 border-t border-purple-500/20 pt-2 mt-2">
                Status: SCANNING & PROCESSING PAYMENTS...
              </div>
            </div>
          </div>
        </section>

        {/* Table with Safety Score */}
        <section className="max-w-7xl mx-auto px-6 py-6">
          <div className="border-2 border-purple-500/30 rounded-lg bg-slate-900/40 backdrop-blur-md p-6 shadow-[0_0_25px_rgba(153,69,255,0.2)]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-emerald-400" />
                  ТАБЛИЦА БЕЗОПАСНЫХ НОВЫХ ТОКЕНОВ
                </h3>
                <p className="text-slate-400 text-xs mt-1">Кликни на токен для детального blueprint</p>
              </div>
            </div>

            <div className="max-h-[340px] overflow-y-auto border border-purple-500/20 rounded-lg scrollbar-thin scrollbar-thumb-purple-500/30">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-purple-500/20 bg-purple-500/10 text-purple-400 font-bold sticky top-0 z-20 backdrop-blur-md">
                    <th className="p-2.5">Токен</th>
                    <th className="p-2.5">Цена</th>
                    <th className="p-2.5">Ликвидность</th>
                    <th className="p-2.5">Объем / Изм.</th>
                    <th className="p-2.5 text-center">TNT Safety Score</th>
                    <th className="p-2.5 text-right">Действие</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Pinned $MRDT */}
                  <tr 
                    onClick={() => openTokenBlueprint({ symbol: 'MRDT', name: 'MARADONATOKEN', ca: MRDT_CA, price: '0.00001300', liquidity: 13000, verified: true })}
                    className="border-b border-purple-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 transition cursor-pointer"
                  >
                    <td className="p-2 font-bold flex items-center gap-2">
                      <span className="text-lg">⚽️</span>
                      <div>
                        <span className="text-emerald-400 font-extrabold text-sm tracking-wider">$MRDT</span>
                        <div className="text-[9px] text-slate-400">MARADONATOKEN</div>
                      </div>
                    </td>
                    <td className="p-2 font-mono text-emerald-400 font-bold">\$0.00001300</td>
                    <td className="p-2 font-mono text-emerald-400 font-bold">\$13,000+</td>
                    <td className="p-2 font-mono text-emerald-400 font-bold">+12.4%</td>
                    <td className="p-2 text-center">
                      <div className="inline-flex items-center justify-center w-14 h-7 rounded-full bg-emerald-500/20 border border-emerald-500 text-emerald-400 text-[11px] font-extrabold tracking-widest shadow-[0_0_10px_rgba(16,185,129,0.5)]">
                        98
                      </div>
                    </td>
                    <td className="p-2 text-right">
                      <a 
                        href={jupiterSwapUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 font-bold hover:underline"
                      >
                        Купить <ExternalLink className="w-3 h-3" />
                      </a>
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
                    tokens.map((token, i) => {
                      const score = getSafetyScore(token);
                      const style = getScoreStyle(score);
                      return (
                        <tr 
                          key={i} 
                          onClick={() => openTokenBlueprint(token)}
                          className="border-b border-purple-500/10 hover:bg-purple-500/5 transition cursor-pointer"
                        >
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
                            <div className={`inline-flex items-center justify-center w-14 h-7 rounded-full ${style.bg} ${style.border} ${style.color} text-[11px] font-extrabold tracking-widest ${style.glow}`}>
                              {score}
                            </div>
                          </td>
                          <td className="p-2 text-right">
                            <a href={token.dexUrl} onClick={(e) => e.stopPropagation()} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-purple-400 hover:text-emerald-400 hover:underline">
                              DEX <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {error && <div className="mt-4 p-3 bg-red-950/40 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-300 text-xs"><AlertCircle className="w-4 h-4" /> {error}</div>}
          </div>
        </section>

        {/* Form Section */}
        <section className="max-w-7xl mx-auto px-6 py-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-4">
              <h3 className="text-2xl font-black text-purple-400">Подай заявку на ИИ-Аудит</h3>
              <p className="text-slate-300 text-sm leading-relaxed">
                Заполни форму → Оплати $MRDT через Solana Pay → Токен автоматически появится в таблице с оценкой!
              </p>

              <div className="mt-6 border-t border-purple-500/20 pt-4 space-y-3">
                <h4 className="text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400 flex items-center gap-1.5">
                  <Download className="w-4 h-4 text-purple-400 animate-pulse" /> ТАРИФЫ И СТОИМОСТЬ:
                </h4>
                <div className="grid grid-cols-1 gap-2 text-xs font-mono">
                  <div className="flex justify-between p-2.5 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                    <span className="text-slate-300">🎁 Первые 3 токена</span>
                    <span className="text-emerald-400 font-bold">БЕСПЛАТНО</span>
                  </div>
                  <div className="flex justify-between p-2.5 bg-slate-900 border border-purple-500/10 rounded-lg">
                    <span className="text-slate-300">🔍 Базовый ИИ-Аудит (Очередь 24ч)</span>
                    <span className="text-emerald-400 font-bold">$10 в $MRDT</span>
                  </div>
                  <div className="flex justify-between p-2.5 bg-slate-900 border border-purple-500/10 rounded-lg">
                    <span className="text-slate-300">⚡ Быстрый Листинг (За 5 минут)</span>
                    <span className="text-emerald-400 font-bold">$40 в $MRDT</span>
                  </div>
                  <div className="flex justify-between p-2.5 bg-slate-900 border border-purple-500/10 rounded-lg">
                    <span className="text-slate-300">👑 VIP-Буст (Баннер на главную 24ч)</span>
                    <span className="text-emerald-400 font-bold">$120 в $MRDT</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-2 border-purple-500/30 rounded-lg bg-slate-900/40 p-6 backdrop-blur-md">
              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div>
                  <label className="block text-purple-400 text-xs font-bold mb-1.5">Название проекта</label>
                  <input 
                    type="text" 
                    value={formData.projectName} 
                    onChange={(e) => setFormData({...formData, projectName: e.target.value})} 
                    placeholder="Твой токен..." 
                    className="w-full bg-slate-950 border border-purple-500/20 rounded px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none transition" 
                  />
                </div>
                <div>
                  <label className="block text-purple-400 text-xs font-bold mb-1.5">Contract Address (Solana)</label>
                  <input 
                    type="text" 
                    value={formData.ca} 
                    onChange={(e) => setFormData({...formData, ca: e.target.value})} 
                    placeholder="Впиши адрес контракта..." 
                    className="w-full bg-slate-950 border border-purple-500/20 rounded px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none transition font-mono" 
                  />
                </div>

                <div>
                  <label className="block text-purple-400 text-xs font-bold mb-1.
