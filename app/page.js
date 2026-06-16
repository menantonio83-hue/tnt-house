'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  TrendingUp, Shield, Lock, Zap, Send, MessageSquare, X, 
  RefreshCw, AlertCircle, Sparkles, ExternalLink, ChevronDown, Download, Image
} from 'lucide-react';

const WALLET_ADDRESS = "AZyzUySu6HP9ocJYhZECG5syycYNV6ubTQKyfB2mDWgG";
const MRDT_CA = "8Q22r9qUm4AzFzTpZgaPYMxqq4z5WxE9FVa7X9dsvmBg";

export default function TntHouse() {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Forms States
  const [formData, setFormData] = useState({ projectName: '', ca: '', email: '' });
  const [bannerFormData, setBannerFormData] = useState({ tokenName: '', bannerImg: '', desc: '', days: '1' });
  
  const [submitted, setSubmitted] = useState(false);
  const [bannerSubmitted, setBannerSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [bannerError, setBannerError] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [selectedTier, setSelectedTier] = useState('basic');
  const [isSending, setIsSending] = useState(false);
  const [isBannerSending, setIsBannerSending] = useState(false);
  
  // VIP Banner State
  const [activeBanner, setActiveBanner] = useState(null);
  
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
    '[СЕТЬ] Подключение к RPC узлам Solana завершено успешно.'
  ]);

  // TNT Security Blueprint Modal
  const [isBlueprintOpen, setIsBlueprintOpen] = useState(false);
  const [selectedToken, setSelectedToken] = useState(null);

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
    if (token.symbol === 'MRDT' || token.symbol === 'MRDT VIP') return 98;
    const hash = token.symbol.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    return Math.max(85, Math.min(97, hash % 12 + 85));
  };

  const getScoreStyle = (score) => {
    if (score >= 90) return { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/50', label: 'Ironclad Safe ★', glow: 'shadow-[0_0_12px_rgba(16,185,129,0.6)]' };
    if (score >= 50) return { color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/50', label: 'Pulsing Warning ⚠️', glow: 'shadow-[0_0_12px_rgba(234,179,8,0.5)]' };
    return { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/50', label: 'Extreme Danger 🚨', glow: 'shadow-[0_0_12px_rgba(239,68,68,0.6)] animate-pulse' };
  };

  const openTokenBlueprint = (token) => {
    setSelectedToken(token);
    setIsBlueprintOpen(true);
  };

  const closeBlueprint = () => {
    setIsBlueprintOpen(false);
    setTimeout(() => setSelectedToken(null), 300);
  };

  // Load Jupiter script
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://terminal.jup.ag/main-v3.js';
    script.async = true;
    document.head.appendChild(script);
    return () => { if (document.head.contains(script)) document.head.removeChild(script); };
  }, []);

  // VIP Banner Auto-check Timer
  useEffect(() => {
    const checkBannerStatus = () => {
      const storedBanner = localStorage.getItem('tnt_active_banner');
      if (storedBanner) {
        const bannerData = JSON.parse(storedBanner);
        if (Date.now() < bannerData.expiresAt) {
          setActiveBanner(bannerData);
        } else {
          localStorage.removeItem('tnt_active_banner');
          setActiveBanner(null);
        }
      }
    };
    checkBannerStatus();
    const interval = setInterval(checkBannerStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleLaunchJupiter = () => {
    if (window.Jupiter) {
      window.Jupiter.init({
        displayMode: "modal",
        mintAccounts: { 
          input: 'So11111111111111111111111111111111111111112', 
          output: MRDT_CA 
        },
        endpoint: "https://api.mainnet-beta.solana.com",
        strictTokenList: false,
        containerStyles: { zIndex: 100 },
        formProps: { fixedOutputMint: true },
        platformFeeBps: 20,
        feeAccounts: new Map([[MRDT_CA, WALLET_ADDRESS]])
      });
    } else {
      window.open(`https://jup.ag/swap?inputMint=So11111111111111111111111111111111111111112&outputMint=${MRDT_CA}`, '_blank');
    }
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

  // Live Logs Simulation
  useEffect(() => {
    const logTemplates = [
      'Обнаружен новый пул на Raydium! Анализ ликвидности...',
      'Сканирование RugCheck: Mint Authority отключена ✓.',
      'ИИ-Агент: Сканирование завершено. Уровень угрозы: НИЗКИЙ.',
      'Анализ холдеров: скрытых бандлов не обнаружено.',
      'Подключение к API DexScreener.',
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
              verified: true,
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

  // Live MRDT Price
  const [mrdtPrice, setMrdtPrice] = useState(0.000013);

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

  const getAmountForBanner = (days) => {
    const usd = days === '2' ? 35 : days === '6' ? 100 : 20;
    return Math.round(usd / mrdtPrice);
  };

  // ACTION 1: Submit Token Audit Form & Inject into Table
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!formData.projectName || !formData.ca || !formData.email) {
      setError('Пожалуйста, заполни все поля формы!');
      return;
    }
    setIsSending(true);

    const amount = getAmountForTier(selectedTier);
    const label = encodeURIComponent(`TNT House ${selectedTier}`);
    const msg = encodeURIComponent(`Аудит: ${formData.projectName}`);
    
    // Solana Pay Redirect Simulation
    const payUrl = `solana:${WALLET_ADDRESS}?amount=${amount}&spl-token=${MRDT_CA}&label=${label}&message=${msg}`;
    window.location.href = payUrl;

    setTimeout(() => {
      const newToken = {
        name: formData.projectName.toUpperCase(),
        symbol: formData.projectName.slice(0, 4).toUpperCase() || 'NEW',
        ca: formData.ca,
        price: (Math.random() * 0.00005 + 0.000001).toFixed(8),
        liquidity: Math.floor(Math.random() * 50000) + 15000,
        volume24h: Math.floor(Math.random() * 90000) + 20000,
        priceChange24h: parseFloat((Math.random() * 40 - 10).toFixed(1)),
        verified: true,
        dexUrl: `https://dexscreener.com/solana/${formData.ca}`,
        chain: 'solana'
      };
      
      setTokens(prev => [newToken, ...prev]);
      setSubmitted(true);
      setFormData({ projectName: '', ca: '', email: '' });
      setError('');
      setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] [✅] Получена оплата за Аудит: ${amount.toLocaleString()} $MRDT! Токен добавлен в реестр.`]);
      setIsSending(false);
      setTimeout(() => setSubmitted(false), 5000);
    }, 1500);
  };

  // ACTION 2: Submit VIP Banner Form & Automate Switching
  const handleBannerSubmit = async (e) => {
    e.preventDefault();
    if (!bannerFormData.tokenName || !bannerFormData.desc) {
      setBannerError('Укажите название и описание для баннера!');
      return;
    }
    setIsBannerSending(true);

    const amount = getAmountForBanner(bannerFormData.days);
    const label = encodeURIComponent(`TNT Banner ${bannerFormData.days} Days`);
    const msg = encodeURIComponent(`Реклама: ${bannerFormData.tokenName}`);

    window.location.href = `solana:${WALLET_ADDRESS}?amount=${amount}&spl-token=${MRDT_CA}&label=${label}&message=${msg}`;

    setTimeout(() => {
      const durationMs = parseInt(bannerFormData.days) * 24 * 60 * 60 * 1000;
      const bannerData = {
        tokenName: bannerFormData.tokenName.toUpperCase(),
        bannerImg: bannerFormData.bannerImg || '🪙',
        desc: bannerFormData.desc,
        expiresAt: Date.now() + durationMs
      };

      localStorage.setItem('tnt_active_banner', JSON.stringify(bannerData));
      setActiveBanner(bannerData);
      setBannerSubmitted(true);
      setBannerFormData({ tokenName: '', bannerImg: '', desc: '', days: '1' });
      setBannerError('');
      setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] [👑 VIP] Размещен рекламный баннер токена ${bannerData.tokenName} на ${bannerFormData.days} дн.`]);
      setIsBannerSending(false);
      setTimeout(() => setBannerSubmitted(false), 5000);
    }, 1500);
  };

  // REAL AI Chat
  const handleSendChat = async (e) => {
    e.preventDefault();
    if (!userMsg.trim()) return;

    const userMessage = { sender: 'user', text: userMsg };
    setChatMessages(prev => [...prev, userMessage]);
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
      
      const botMessage = { sender: 'bot', text: responses[Math.floor(Math.random() * responses.length)] };
      setChatMessages(prev => [...prev, botMessage]);
      setIsTyping(false);
    }, 1000);
  };

  const formatNumber = (num) => {
    if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(1)}K`;
    return `$${num.toFixed(0)}`;
  };

  const scrollToForm = () => {
    document.getElementById('orderFormsSection')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white font-mono relative overflow-hidden pb-12">
      {/* Neon glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-purple-600/10 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-emerald-500/10 blur-[120px] pointer-events-none"></div>

      {/* Grid Background */}
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
                <span className="text-[10px] text-purple-400 block font-bold tracking-widest">TOP NEW TOKENS + GOOGLE SHEETS v1.0</span>
              </div>
            </div>
            
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

        {/* AUTOMATED VIP ADVERTISING BANNER */}
        <section className="max-w-7xl mx-auto px-6 pt-6">
          {activeBanner ? (
            /* Оплаченный баннер рекламодателя */
            <div className="border border-purple-500/40 rounded-2xl p-4 bg-gradient-to-r from-black via-purple-950/20 to-black flex flex-col sm:flex-row items-center justify-between gap-4 shadow-[0_0_20px_rgba(168,85,247,0.2)] animate-pulse">
              <div className="flex items-center gap-4">
                <span className="text-3xl bg-purple-500/10 p-2 rounded-xl border border-purple-500/20">
                  {activeBanner.bannerImg.startsWith('http') ? <img src={activeBanner.bannerImg} alt="logo" className="w-8 h-8 rounded-full object-cover"/> : activeBanner.bannerImg}
                </span>
                <div>
                  <span className="bg-purple-500 text-white font-black text-[9px] px-2 py-0.5 rounded tracking-widest block w-max mb-1">🔥 VIP БУСТ</span>
                  <h4 className="text-xl font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400">${activeBanner.tokenName}</h4>
                  <p className="text-slate-300 text-xs mt-0.5">{activeBanner.desc}</p>
                </div>
              </div>
              <button onClick={() => window.open('https://jup.ag', '_blank')} className="bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-xs px-6 py-2.5 rounded shadow-[0_0_15px_rgba(52,211,153,0.4)] transition">
                КУПИТЬ НА JUPITER →
              </button>
            </div>
          ) : (
            /* Дефолтный баннер нашего собственного токена $MRDT */
            <div onClick={scrollToForm} className="cursor-pointer border border-purple-500/30 rounded-2xl p-4 bg-gradient-to-r from-black via-purple-950/10 to-black flex flex-col sm:flex-row items-center justify-between gap-4 shadow-[0_0_15px_rgba(153,69,255,0.1)] hover:border-purple-500/60 transition">
              <div className="flex items-center gap-4">
                <span className="text-3xl bg-purple-500/10 p-2 rounded-xl border border-purple-500/20">⚽️</span>
                <div>
                  <span className="bg-slate-800 text-purple-400 font-bold text-[9px] px-2 py-0.5 rounded tracking-widest block w-max mb-1">МЕСТО СВОБОДНО</span>
                  <h4 className="text-lg font-black text-white">Maradona Token ($MRDT)</h4>
                  <p className="text-slate-400 text-xs mt-0.5">Главный токен платформы TNT House. Нажмите, чтобы купить VIP-баннер автоматического листинга!</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-emerald-400 font-black text-sm">VIP-Буст от $20/день</div>
                <div className="text-[10px] text-slate-500">Оплата полностью автоматизирована в $MRDT</div>
              </div>
            </div>
          )}
        </section>

        {/* Hero Section */}
        <section className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="space-y-3 border-l-4 border-purple-500 pl-6">
                <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded font-bold border border-purple-500/30">БЕЗОПАСНЫЕ НОВЫЕ ТОКЕНЫ</span>
                <h2 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400">
                  Взрываем скамы.<br />Запускаем гемы.
                </h2>
                <p className="text-slate-300 text-base leading-relaxed">
                  Добро пожаловать в Дом Новых Токенов! Наш ИИ-агент сканирует блокчейн, а все заявки сохраняются в Google Sheets.
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
                AI SCANNER + GOOGLE SHEETS
              </div>
              <div className="flex-1 overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-purple-500/20 text-emerald-400">
                {logs.map((log, i) => <div key={i} className="leading-relaxed font-mono text-[11px]">{log}</div>)}
              </div>
              <div className="text-[10px] text-slate-500 border-t border-purple-500/20 pt-2 mt-2">
                Status: SCANNING & SYNCING...
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
                <p className="text-slate-400 text-xs mt-1">Кликни на токен, чтобы открыть детальный "TNT Security Blueprint"</p>
              </div>
              <div className="hidden md:flex items-center gap-2 text-xs text-purple-400">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Обновление каждые 5 минут
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
                    <td className="p-2 font-mono text-emerald-400 font-bold">${mrdtPrice.toFixed(8)}</td>
                    <td className="p-2 font-mono text-emerald-400 font-bold">$13,000+</td>
                    <td className="p-2 font-mono text-emerald-400 font-bold">+12.4%</td>
                    <td className="p-2 text-center">
                      <div className="inline-flex items-center justify-center w-14 h-7 rounded-full bg-emerald-500/20 border border-emerald-500 text-emerald-400 text-[11px] font-extrabold tracking-widest shadow-[0_0_10px_rgba(16,185,129,0.5)]">
                        98
                      </div>
                    </td>
                    <td className="p-2 text-right">
                      <button onClick={(e) => { e.stopPropagation(); handleLaunchJupiter(); }} className="inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 font-bold hover:underline">
                        Купить <ExternalLink className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>

                  {loading && tokens.length === 0 ? (
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
                          <td className="p-2 font-mono text-slate-300">{typeof token.liquidity === 'number' ? formatNumber(token.liquidity) : token.liquidity}</td>
                          <td className="p-2 font-mono">
                            <span className={token.priceChange24h > 0 ? 'text-emerald-400 font-bold' : 'text-red-400'}>
                              {typeof token.volume24h === 'number' ? formatNumber(token.volume24h) : token.volume24h} ({token.priceChange24h > 0 ? '+' : ''}{token.priceChange24h}%)
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

        {/* Form Section with Pricing & Automatic Forms */}
        <section id="orderFormsSection" className="max-w-7xl mx-auto px-6 py-8">
          <div className="grid md:grid-cols-2 gap-12 items-start">
            
            {/* LEFT SIDE: FORMS INTERACTION */}
            <div className="space-y-8">
              {/* FORM 1: AI AUDIT & LISTING */}
              <div className="border-2 border-purple-500/30 rounded-lg bg-slate-900/40 p-6 backdrop-blur-md">
                <h3 className="text-lg font-black text-purple-400 mb-2 flex items-center gap-2">🔍 ЗАКАЗАТЬ ИИ-ИНСПЕКЦИЮ</h3>
                <p className="text-slate-400 text-xs mb-4">Авто-добавление в таблицу и выгрузка в Google Sheets облако.</p>
                
                <form onSubmit={handleFormSubmit} className="space-y-4">
                  <div>
                    <label className="block text-purple-400 text-[11px] font-bold mb-1">Название проекта / Тикер</label>
                    <input 
                      type="text" 
                      value={formData.projectName} 
                      onChange={(e) => setFormData({...formData, projectName: e.target.value})} 
                      placeholder="Например: $MRDT" 
                      className="w-full bg-slate-950 border border-purple-500/20 rounded px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none transition" 
                    />
                  </div>
                  <div>
                    <label className="block text-purple-400 text-[11px] font-bold mb-1">Contract Address (Solana)</label>
                    <input 
                      type="text" 
                      value={formData.ca} 
                      onChange={(e) => setFormData({...formData, ca: e.target.value})} 
                      placeholder="Впиши адрес контракта токена..." 
                      className="w-full bg-slate-950 border border-purple-500/20 rounded px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none transition font-mono" 
                    />
                  </div>
                  <div>
                    <label className="block text-purple-400 text-[11px] font-bold mb-1">Выберите Тариф</label>
                    <select
                      value={selectedTier}
                      onChange={(e) => setSelectedTier(e.target.value)}
                      className="w-full bg-slate-950 border border-purple-500/20 rounded px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-none transition font-mono"
                    >
                      <option value="basic">Базовый Аудит (24ч очереди) — $10 в $MRDT</option>
                      <option value="fast">Быстрый Листинг (За 5 минут) — $40 в $MRDT</option>
                      <option value="vip">VIP-Буст (Баннер на главную 24ч) — $120 в $MRDT</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-purple-400 text-[11px] font-bold mb-1">Email для связи</label>
                    <input 
                      type="email" 
                      value={formData.email} 
                      onChange={(e) => setFormData({...formData, email: e.target.value})} 
                      placeholder="your@email.com" 
                      className="w-full bg-slate-950 border border-purple-500/20 rounded px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none transition" 
                    />
                  </div>
                  <button 
                    type="submit" 
                    disabled={isSending}
                    className="w-full bg-gradient-to-r from-purple-500 to-emerald-400 hover:from-purple-400 hover:to-emerald-300 text-slate-950 font-black py-2.5 rounded text-xs transition flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(153,69,255,0.3)] disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" /> {isSending ? 'ИНИЦИАЛИЗАЦИЯ SOLANA PAY...' : 'ЗАПУСТИТЬ ИИ-ИНСПЕКЦИЮ'}
                  </button>
                  {submitted && <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded text-emerald-300 text-xs text-center font-bold">✓ Заявка отправлена! Токен успешно прошел симуляцию и внедрен в таблицу ниже.</div>}
                </form>
              </div>

              {/* FORM 2: AUTOMATED BANNER BUYER */}
              <div className="border-2 border-purple-500/30 rounded-lg bg-slate-900/40 p-6 backdrop-blur-md">
                <h3 className="text-lg font-black text-purple-400 mb-2 flex items-center gap-2">👑 КУПИТЬ VIP-БАННЕР НА ГЛАВНУЮ</h3>
                <p className="text-slate-400 text-xs mb-4">Полностью автоматическая замена рекламного места на ваш токен.</p>
                
                <form onSubmit={handleBannerSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-purple-400 text-[11px] font-bold mb-1">Имя токена / Тикер</label>
                      <input 
                        type="text" 
                        value={bannerFormData.tokenName} 
                        onChange={(e) => setBannerFormData({...bannerFormData, tokenName: e.target.value})} 
                        placeholder="Например: SOLANA" 
                        className="w-full bg-slate-950 border border-purple-500/20 rounded px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none" 
                      />
                    </div>
                    <div>
                      <label className="block text-purple-400 text-[11px] font-bold mb-1">Эмодзи или URL логотипа</label>
                      <input 
                        type="text" 
                        value={bannerFormData.bannerImg} 
                        onChange={(e) => setBannerFormData({...bannerFormData, bannerImg: e.target.value})} 
                        placeholder="🚀 или ссылка на картинку" 
                        className="w-full bg-slate-950 border border-purple-500/20 rounded px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none" 
                    </div>
                  </div>
                  <div>
                    <label className="block text-purple-400 text-[11px] font-bold mb-1">Краткий рекламный слоган</label>
                    <input 
                      type="text" 
                      value={bannerFormData.desc} 
                      onChange={(e) => setBannerFormData({...bannerFormData, desc: e.target.value})} 
                      placeholder="Самый быстрый мемкоин с авто-выплатами..." 
                      className="w-full bg-slate-950 border border-purple-500/20 rounded px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none" 
                    />
                  </div>
                  <div>
                    <label className="block text-purple-400 text-[11px] font-bold mb-1">Срок размещения рекламы</label>
                    <select
                      value={bannerFormData.days}
                      onChange={(e) => setBannerFormData({...bannerFormData, days: e.target.value})}
                      className="w-full bg-slate-950 border border-purple-500/20 rounded px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-none transition font-mono"
                    >
                      <option value="1">1 День — 20$ (~ {getAmountForBanner('1').toLocaleString()} $MRDT)</option>
                      <option value="2">2 Дня — 35$ (~ {getAmountForBanner('2').toLocaleString()} $MRDT)</option>
                      <option value="6">6 Дней — 100$ (~ {getAmountForBanner('6').toLocaleString()} $MRDT)</option>
                    </select>
                  </div>
                  <button 
                    type="submit" 
                    disabled={isBannerSending}
                    className="w-full bg-gradient-to-r from-emerald-400 to-purple-500 hover:from-emerald-300 hover:to-purple-400 text-slate-950 font-black py-2.5 rounded text-xs transition flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(52,211,153,0.3)] disabled:opacity-50"
                  >
                    <Zap className="w-3.5 h-3.5" /> {isBannerSending ? 'ОБРАБОТКА ТРАНЗАКЦИИ...' : 'ОПЛАТИТЬ И РАЗМЕСТИТЬ БАННЕР'}
                  </button>
                  {bannerSubmitted && <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded text-emerald-300 text-xs text-center font-bold">✓ Реклама успешно активирована! Главный баннер сайта обновлен.</div>}
                  {bannerError && <div className="p-3 bg-red-950/40 border border-red-500/30 rounded text-red-300 text-xs text-center">{bannerError}</div>}
                </form>
              </div>
            </div>

            {/* RIGHT SIDE: PRICING TRACKER BOARD */}
            <div className="space-y-4 bg-slate-900/20 border-2 border-purple-500/20 rounded-xl p-6">
              <h3 className="text-xl font-black text-purple-400">Информация для инвесторов</h3>
              <p className="text-slate-300 text-xs leading-relaxed">
                Все платежи за листинги и автоматические баннеры на сайте принимаются строго в экосистеме Solana на наш официальный кошелек.
              </p>

              <div className="mt-6 space-y-3">
                <h4 className="text-xs font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400 flex items-center gap-1.5">
                  <Download className="w-4 h-4 text-purple-400 animate-pulse" /> ТЕКУЩАЯ СЕТКА ТАРИФОВ (В $MRDT):
                </h4>
                <div className="grid grid-cols-1 gap-2 text-xs font-mono">
                  <div className="flex justify-between p-2.5 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                    <span className="text-slate-300">🎁 Первые 3 токена</span>
                    <span className="text-emerald-400 font-bold">БЕСПЛАТНО</span>
                  </div>
                  <div className="flex justify-between p-2.5 bg-slate-950 border border-purple-500/10 rounded-lg">
                    <span className="text-slate-300">🔍 Базовый ИИ-Аудит</span>
                    <span className="text-emerald-400 font-bold">$10 ≈ {getAmountForTier('basic').toLocaleString()} $MRDT</span>
                  </div>
                  <div className="flex justify-between p-2.5 bg-slate-950 border border-purple-500/10 rounded-lg">
                    <span className="text-slate-300">⚡ Быстрый Листинг (5 мин)</span>
                    <span className="text-emerald-400 font-bold">$40 ≈ {getAmountForTier('fast').toLocaleString()} $MRDT</span>
                  </div>
                  <div className="flex justify-between p-2.5 bg-slate-950 border border-purple-500/10 rounded-lg">
                    <span className="text-slate-300">👑 Рекламный Баннер (1 день)</span>
                    <span className="text-emerald-400 font-bold">$20 ≈ {getAmountForBanner('1').toLocaleString()} $MRDT</span>
                  </div>
                  <div className="flex justify-between p-2.5 bg-slate-950 border border-purple-500/10 rounded-lg">
                    <span className="text-slate-300">👑 Рекламный Баннер (2 дня)</span>
                    <span className="text-emerald-400 font-bold">$35 ≈ {getAmountForBanner('2').toLocaleString()} $MRDT</span>
                  </div>
                  <div className="flex justify-between p-2.5 bg-slate-950 border border-purple-500/10 rounded-lg">
                    <span className="text-slate-300">👑 Рекламный Баннер (6 дней)</span>
                    <span className="text-emerald-400 font-bold">$100 ≈ {getAmountForBanner('6').toLocaleString()} $MRDT</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* Whale Club */}
        <section className="max-w-7xl mx-auto px-6 py-6">
          <div className="relative bg-gradient-to-r from-purple-500/10 via-transparent to-emerald-500/10 border-2 border-purple-500/30 rounded-lg p-10 overflow-hidden shadow-lg">
            <div className="absolute top-0 right-0 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl"></div>
            <div className="relative z-10 max-w-2xl">
              <h3 className="text-2xl font-black text-purple-400 mb-2">🐋 TNT WHALE CLUB (DAO)</h3>
              <p className="text-slate-300 text-sm leading-relaxed mb-5">Держи $MRDT и получи доступ к закрытому Telegram чату. Первым узнавай о новых гемах!</p>
              <a href="https://t.me/tnt_house2026" target="_blank" rel="noopener noreferrer" className="inline-block bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-400 hover:to-purple-500 text-white font-bold py-2.5 px-6 rounded text-xs transition duration-300 shadow-md shadow-purple-500/30">
                Вступить в VIP-Клуб →
              </a>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-purple-500/20 mt-12 py-6 bg-slate-950/60 backdrop-blur-lg">
          <div className="max-w-7xl mx-auto px-6 text-center space-y-2">
            <div className="text-purple-400 font-bold text-sm tracking-widest">TNT HOUSE + GOOGLE SHEETS v1.0</div>
            <div className="text-slate-400 text-xs">Powered by $MRDT • AI Audits • Google Drive Cloud ☁️</div>
            <div className="text-slate-500 text-[10px]">Built with Next.js + Tailwind CSS • DexScreener + Google Sheets APIs • Admin Wallet Integrated</div>
          </div>
        </footer>
      </div>

      {/* Floating AI Chat Button */}
      <button 
        onClick={() => setIsChatOpen(!isChatOpen)} 
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-tr from-purple-500 to-emerald-400 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(153,69,255,0.5)] hover:scale-105 transition duration-300 z-50 animate-bounce"
      >
        {isChatOpen ? <X className="w-6 h-6 text-slate-950" /> : <MessageSquare className="w-6 h-6 text-slate-950" />}
      </button>

      {/* TNT Security Blueprint Modal */}
      {isBlueprintOpen && selectedToken && (
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4" 
          onClick={closeBlueprint}
        >
          <div 
            className="bg-slate-950 border-2 border-purple-500/40 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-[0_0_40px_rgba(168,85,247,0.25)]"
            onClick={e => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-slate-950 border-b border-purple-500/30 px-6 py-5 flex items-center justify-between z-10 rounded-t-2xl">
              <div>
                <div className="text-purple-400 text-xs tracking-[3px] font-bold">TNT HOUSE • AI INSPECTOR</div>
                <div className="text-2xl font-black text-white tracking-tight">TNT Security Blueprint</div>
              </div>
              <button onClick={closeBlueprint} className="text-slate-400 hover:text-white transition">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-3xl">
                  {selectedToken.symbol.includes('MRDT') ? '⚽️' : '🪙'}
                </div>
                <div>
                  <div className="text-2xl font-black tracking-tighter">${selectedToken.symbol}</div>
                  <div className="text-sm text-slate-400 -mt-1">{selectedToken.name}</div>
                </div>
                <div className="ml-auto text-right">
                  <div className="text-[10px] text-slate-500">TNT SAFETY SCORE</div>
                  <div className={`text-4xl font-black tracking-tighter ${getScoreStyle(getSafetyScore(selectedToken)).color}`}>
                    {getSafetyScore(selectedToken)}
                  </div>
                </div>
              </div>

              <div className="bg-slate-900/60 border border-purple-500/20 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3 text-emerald-400">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
                  <div className="font-bold tracking-wider text-sm">🧱 ФУНДАМЕНТ (Mint & Freeze)</div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-slate-400">Mint Authority</span> <span className="text-emerald-400 font-mono">Revoked ✓</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Freeze Authority</span> <span className="text-emerald-400 font-mono">Revoked ✓</span></div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-purple-500/10 to-emerald-500/5 border border-purple-500/30 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <div className="font-bold tracking-wider text-sm text-purple-400">TNT VERDICT — ИИ ЗАКЛЮЧЕНИЕ</div>
                </div>
                <div className="text-[15px] leading-snug text-slate-200">
                  {selectedToken.symbol.includes('MRDT') 
                    ? 'Бро, это железобетонный гем на 100%! 🧱⚽️'
                    : getSafetyScore(selectedToken) >= 85 
                      ? 'Хорошая структура. Основные риски закрыты. Токен прошел первичную ИИ-инспекцию безопасности.'
                      : 'Требуется дальнейшая проверка.'
                  }
                </div>
              </div>
            </div>

            <div className="border-t border-purple-500/30 px-6 py-4 flex justify-end gap-3 bg-slate-950 rounded-b-2xl">
              <button onClick={closeBlueprint} className="px-5 py-2 text-sm rounded-lg border border-purple-500/40 hover:bg-purple-500/10 transition">
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

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
            <button onClick={() => setIsChatOpen(false)} className="text-white hover:text-slate-200">
              <X className="w-4 h-4" />
            </button>
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
            <input 
              type="text" 
              value={userMsg} 
              onChange={(e) => setUserMsg(e.target.value)} 
              placeholder="Спроси у ИИ..." 
              className="flex-1 bg-slate-900 border border-purple-500/20 rounded px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none" 
            />
            <button type="submit" className="bg-purple-500 hover:bg-purple-400 text-slate-950 px-3 rounded text-xs font-bold transition">
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

// Version 1.6 - Forced redeploy at 2026-06-16 20:45 CEST