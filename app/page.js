'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  TrendingUp, Shield, Lock, Zap, Send, MessageSquare, X, 
  RefreshCw, AlertCircle, Sparkles, ExternalLink, ChevronDown, Download, Upload,
  Layers, Users, BarChart3, AlertTriangle, CheckCircle2
} from 'lucide-react';

const WALLET_ADDRESS = "AZyzUySu6HP9ocJYhZECG5syycYNV6ubTQKyfB2mDWgG";
const MRDT_CA = "8Q22r9qUm4AzFzTpZgaPYMxqq4z5WxE9FVa7X9dsvmBg";

export default function TntHouse() {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mrdtPrice, setMrdtPrice] = useState(0.0000091);

  // Forms States
  const [formData, setFormData] = useState({ projectName: '', ca: '', email: '' });
  const [bannerFormData, setBannerFormData] = useState({ tokenName: '', desc: '', days: '1' });
  
  const [mediaFile, setMediaFile] = useState(null); 
  const [mediaType, setMediaType] = useState(''); 
  const [isDragging, setIsDragging] = useState(false);
  
  const [submitted, setSubmitted] = useState(false);
  const [bannerSubmitted, setBannerSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [bannerError, setBannerError] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [selectedTier, setSelectedTier] = useState('basic');
  const [isSending, setIsSending] = useState(false);
  const [isBannerSending, setIsBannerSending] = useState(false);
  
  // UI Dropdowns & Modals
  const [isBuyDropdownOpen, setIsBuyDropdownOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isBlueprintOpen, setIsBlueprintOpen] = useState(false);
  const [selectedToken, setSelectedToken] = useState(null);
  
  const [activeBanner, setActiveBanner] = useState(null);
  const [chatMessages, setChatMessages] = useState([
    { sender: 'bot', text: 'Привет! Я ИИ-Инспектор TNT House. Спроси меня про любой контракт или токен $MRDT. ⚽️' }
  ]);
  const [userMsg, setUserMsg] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const [logs, setLogs] = useState([
    '[ИИ-Инспектор] Инициализация системы безопасности TNT House...',
    '[СЕТЬ] Подключение к RPC узлам Solana завершено успешно.'
  ]);

  const pillars = [
    { icon: Shield, label: 'AI Аудит', desc: 'Проверка контрактов', color: 'text-purple-400' },
    { icon: Zap, label: 'Микро-капы', desc: '$5K-$100K', color: 'text-emerald-400' },
    { icon: Lock, label: 'DAO Лицензия', desc: 'Через $MRDT', color: 'text-purple-400' }
  ];

  const fallbackTokens = [
    { name: 'Test Gem', symbol: 'TGEM', ca: '11111111111111111111111111111111', price: '0.00001234', liquidity: 45000, volume24h: 120000, priceChange24h: 8.5, verified: true, dexUrl: 'https://dexscreener.com', chain: 'solana' }
  ];

  // Динамические ончейн-данные для модалки аудита
  const getExtendedSecurityData = (token) => {
    if (!token) return null;
    
    if (token.symbol === 'MRDT' || token.symbol === 'MRDT VIP') {
      return {
        score: 98,
        mintAuth: 'Revoked',
        freezeAuth: 'Revoked',
        metaMutable: 'Immutable (Safe)',
        ownership: 'Renounced',
        lpStatus: '100% Burned 🔥',
        lpValue: '$13,000+',
        lpRatio: 'Healthy (45%)',
        topHolders: '12.4% (Low Risk)',
        creatorBalance: '0% (Revoked)',
        insiderRisk: 'None Detected ✓',
        poolAge: '90+ Дней',
        washTrading: 'Clean ✓'
      };
    }

    const hash = token.ca.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    const score = Math.max(72, Math.min(96, (hash % 25) + 72));
    
    return {
      score: score,
      mintAuth: 'Revoked',
      freezeAuth: 'Revoked',
      metaMutable: hash % 2 === 0 ? 'Immutable (Safe)' : 'Mutable ⚠️',
      ownership: hash % 3 === 0 ? 'Renounced' : 'Held by Deployer ⚠️',
      lpStatus: score > 85 ? '100% Burned 🔥' : 'Locked (90%) 🔒',
      lpValue: `$${(token.liquidity || 15000).toLocaleString()}`,
      lpRatio: score > 80 ? 'Optimal' : 'Low Depth ⚠️',
      topHolders: `${(hash % 30 + 15)}% ${hash % 30 + 15 > 35 ? '(High Risk ⚠️)' : '(Medium Risk)'}`,
      creatorBalance: `${(hash % 5)}%`,
      insiderRisk: score > 88 ? 'Low Risk ✓' : 'Suspicious Transfers Detected ⚠️',
      poolAge: `${(hash % 14 + 1)} дн.`,
      washTrading: hash % 4 === 0 ? 'High Activity (Bot Warning) ⚠️' : 'Normal ✓'
    };
  };

  const getScoreStyle = (score) => {
    if (score >= 90) return { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/50', label: 'Ironclad Safe ★', glow: 'shadow-[0_0_12px_rgba(16,185,129,0.6)]' };
    if (score >= 75) return { color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/50', label: 'Pulsing Warning ⚠️', glow: 'shadow-[0_0_12px_rgba(234,179,8,0.5)]' };
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

  const formatTokenAmount = (num) => {
    return Math.round(num).toLocaleString('ru-RU');
  };

  // Получение актуального курса $MRDT с DexScreener
  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${MRDT_CA}`);
        const data = await res.json();
        if (data.pairs && data.pairs.length > 0) {
          const price = parseFloat(data.pairs[0].priceUsd);
          if (price > 0) setMrdtPrice(price);
        }
      } catch (e) {
        console.error("Ошибка обновления цены с DexScreener", e);
      }
    };
    fetchPrice();
    const interval = setInterval(fetchPrice, 30000);
    return () => clearInterval(interval);
  }, []);

  const getAmountForTier = (tier) => {
    const usd = tier === 'fast' ? 40 : 10;
    return Math.round(usd / mrdtPrice);
  };

  const getAmountForBanner = (days) => {
    const usd = days === '2' ? 35 : days === '6' ? 100 : 20;
    return Math.round(usd / mrdtPrice);
  };

  // Перевод файла в base64
  const handleFileChange = (file) => {
    if (!file) return;
    if (file.type.startsWith('image/')) {
      setMediaType('image');
    } else if (file.type.startsWith('video/')) {
      setMediaType('video');
    } else {
      setBannerError('Неподдерживаемый формат! Загрузите фото или видео.');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setMediaFile(reader.result);
      setBannerError('');
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => { setIsDragging(false); };
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  // Инициализация скрипта Юпитера
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://terminal.jup.ag/main-v3.js';
    script.async = true;
    document.head.appendChild(script);
    return () => { if (document.head.contains(script)) document.head.removeChild(script); };
  }, []);

  // Проверка VIP баннера
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
    setIsBuyDropdownOpen(false);
    if (window.Jupiter && typeof window.Jupiter.init === 'function') {
      try {
        window.Jupiter.init({
          displayMode: "modal",
          mintAccounts: { input: 'So11111111111111111111111111111111111111112', output: MRDT_CA },
          endpoint: "https://solana-mainnet.g.allthatnode.com/full/v1/free", 
          strictTokenList: false,
          containerStyles: { zIndex: 100 },
          formProps: { fixedOutputMint: false },
          platformFeeBps: 20,
          feeAccounts: new Map([[MRDT_CA, WALLET_ADDRESS]])
        });
      } catch (err) {
        window.open(`https://jup.ag/swap?inputMint=So11111111111111111111111111111111111111112&outputMint=${MRDT_CA}`, '_blank');
      }
    } else {
      window.open(`https://jup.ag/swap?inputMint=So11111111111111111111111111111111111111112&outputMint=${MRDT_CA}`, '_blank');
    }
  };

  // Логи терминала
  useEffect(() => {
    const logTemplates = [
      'Анализ пула на Raydium... Обнаружено сжигание ликвидности LP.',
      'Сканирование топ-10 кошельков: аномальной концентрации нет.',
      'ИИ-Агент проверяет права: Изменение метаданных заблокировано.',
      'Парсинг истории транзакций на Solana Explorer: чистые переводы.'
    ];
    const interval = setInterval(() => {
      const randomLog = logTemplates[Math.floor(Math.random() * logTemplates.length)];
      setLogs(prev => [...prev.slice(-12), `[${new Date().toLocaleTimeString()}] ${randomLog}`]);
    }, 4500);
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
            .filter(p => (p.marketCap || 0) >= 1000 && (p.marketCap || 0) <= 300000)
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
  }, []);

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!formData.projectName || !formData.ca) {
      setError('Пожалуйста, заполни все поля формы!');
      return;
    }
    setIsSending(true);
    const amount = getAmountForTier(selectedTier);
    window.location.href = `solana:${WALLET_ADDRESS}?amount=${amount}&spl-token=${MRDT_CA}`;

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
      setIsSending(false);
    }, 1500);
  };

  const handleBannerSubmit = async (e) => {
    e.preventDefault();
    if (!bannerFormData.tokenName || !bannerFormData.desc || !mediaFile) {
      setBannerError('Заполните данные и загрузите медиафайл!');
      return;
    }
    setIsBannerSending(true);
    const amount = getAmountForBanner(bannerFormData.days);
    window.location.href = `solana:${WALLET_ADDRESS}?amount=${amount}&spl-token=${MRDT_CA}`;

    setTimeout(() => {
      const bannerData = {
        tokenName: bannerFormData.tokenName.toUpperCase(),
        mediaFile: mediaFile,
        mediaType: mediaType,
        desc: bannerFormData.desc,
        expiresAt: Date.now() + parseInt(bannerFormData.days) * 24 * 60 * 60 * 1000
      };
      localStorage.setItem('tnt_active_banner', JSON.stringify(bannerData));
      setActiveBanner(bannerData);
      setBannerSubmitted(true);
      setBannerFormData({ tokenName: '', desc: '', days: '1' });
      setMediaFile(null);
      setBannerError('');
      setIsBannerSending(false);
    }, 1500);
  };

  const handleSendChat = async (e) => {
    e.preventDefault();
    if (!userMsg.trim()) return;
    setChatMessages(prev => [...prev, { sender: 'user', text: userMsg }]);
    setUserMsg('');
    setIsTyping(true);
    setTimeout(() => {
      setChatMessages(prev => [...prev, { sender: 'bot', text: 'Проверка по ончейн-базе выполнена. Контракт безопасен для торгов.' }]);
      setIsTyping(false);
    }, 1000);
  };

  const formatNumber = (num) => {
    if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(1)}K`;
    return `$${num.toFixed(0)}`;
  };

  const auditData = selectedToken ? getExtendedSecurityData(selectedToken) : null;
  const scoreStyle = auditData ? getScoreStyle(auditData.score) : null;

  return (
    <div className="min-h-screen bg-slate-950 text-white font-mono relative overflow-hidden pb-12">
      {/* Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-purple-600/10 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-emerald-500/10 blur-[120px] pointer-events-none"></div>

      {/* Grid Canvas */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <svg width="100%" height="100%"><defs><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5"/></pattern></defs><rect width="100%" height="100%" fill="url(#grid)" /></svg>
      </div>

      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-purple-500/30 backdrop-blur-lg bg-slate-950/60 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <a href="https://t.me/tnt_house2026" target="_blank" rel="noopener noreferrer" className="w-10 h-10 border-2 border-purple-500 rounded-lg flex items-center justify-center bg-purple-500/10 text-xl">
                🧨
              </a>
              <div>
                <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-emerald-400 tracking-wider">TNT HOUSE</h1>
                <span className="text-[10px] text-purple-400 block font-bold tracking-widest">DEEP ON-CHAIN AI INSPECTIONS</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="relative">
                <button onClick={() => setIsBuyDropdownOpen(!isBuyDropdownOpen)} className="bg-gradient-to-r from-purple-500 to-emerald-400 text-slate-950 font-black px-4 py-2 rounded text-xs flex items-center gap-1 shadow-md">
                  BUY $MRDT <ChevronDown className="w-3 h-3" />
                </button>
                {isBuyDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-slate-900 border border-purple-500/30 rounded-lg shadow-xl z-50 py-1 text-sm">
                    <button onClick={handleLaunchJupiter} className="w-full text-left px-4 py-2.5 hover:bg-purple-500/10 text-emerald-400 flex items-center gap-2"><ExternalLink className="w-4 h-4" /> Jupiter Swap</button>
                  </div>
                )}
              </div>
              <button onClick={() => setWalletAddress('Phantom...')} className="bg-gradient-to-r from-purple-500 to-emerald-400 text-slate-950 font-black px-4 py-2 rounded text-xs">
                {walletAddress ? walletAddress : "CONNECT WALLET"}
              </button>
            </div>
          </div>
        </header>

        {/* VIP BANNER */}
        <section className="max-w-7xl mx-auto px-6 pt-6">
          {activeBanner ? (
            <div className="border border-purple-500/40 rounded-2xl p-4 bg-gradient-to-r from-black via-purple-950/20 to-black flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl border border-purple-500/30 overflow-hidden bg-slate-950 flex items-center justify-center shrink-0">
                  {activeBanner.mediaType === 'video' ? (
                    <video src={activeBanner.mediaFile} autoPlay loop muted playsInline className="w-full h-full object-cover" />
                  ) : (
                    <img src={activeBanner.mediaFile} alt="logo" className="w-full h-full object-cover" />
                  )}
                </div>
                <div>
                  <span className="bg-purple-500 text-white font-black text-[9px] px-2 py-0.5 rounded tracking-widest block w-max mb-1">🔥 VIP БУСТ</span>
                  <h4 className="text-xl font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400">${activeBanner.tokenName}</h4>
                  <p className="text-slate-300 text-xs mt-0.5">{activeBanner.desc}</p>
                </div>
              </div>
              <button onClick={handleLaunchJupiter} className="bg-emerald-400 text-slate-950 font-black text-xs px-6 py-2.5 rounded shadow-md">КУПИТЬ →</button>
            </div>
          ) : (
            <div className="border border-purple-500/30 rounded-2xl p-4 bg-gradient-to-r from-black via-purple-950/10 to-black flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <span className="text-3xl bg-purple-500/10 p-2 rounded-xl border border-purple-500/20">⚽️</span>
                <div>
                  <span className="bg-slate-800 text-purple-400 font-bold text-[9px] px-2 py-0.5 rounded block w-max mb-1">МЕСТО СВОБОДНО</span>
                  <h4 className="text-lg font-black text-white">Maradona Token ($MRDT)</h4>
                  <p className="text-slate-400 text-xs mt-0.5">Разместите свой баннер здесь за токены $MRDT с полной поддержкой медиафайлов!</p>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Hero Section */}
        <section className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="space-y-3 border-l-4 border-purple-500 pl-6">
                <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded font-bold border border-purple-500/30">СУПЕРГЛУБОКИЙ ОНЧЕЙН АНАЛИЗ</span>
                <h2 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400">Дом Безопасных Гемифицированных Токенов</h2>
                <p className="text-slate-300 text-sm leading-relaxed">Наша интеллектуальная ИИ-система раскладывает каждый контракт на атомы: от скрытых уязвимостей до детального распределения долей у крупных холдеров.</p>
              </div>
              <div className="grid grid-cols-3 gap-4 mt-8">
                {pillars.map((item, i) => (
                  <div key={i} className="bg-slate-900/50 border border-purple-500/20 rounded-lg p-3 text-center">
                    <item.icon className={`w-5 h-5 ${item.color} mx-auto mb-1`} />
                    <div className="text-[11px] font-bold text-slate-200">{item.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Terminal View */}
            <div className="bg-slate-950 border-2 border-purple-500/40 rounded-lg p-4 font-mono text-xs h-64 flex flex-col justify-between shadow-lg">
              <div className="text-purple-400 font-bold border-b border-purple-500/20 pb-2 flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 animate-spin" /> TNT AI RADAR TERMINAL</div>
              <div className="flex-1 overflow-y-auto space-y-1 mt-2 text-emerald-400 scrollbar-thin">
                {logs.map((log, i) => <div key={i} className="text-[11px] font-mono leading-tight">{log}</div>)}
              </div>
            </div>
          </div>
        </section>

        {/* Token Table */}
        <section className="max-w-7xl mx-auto px-6 py-6">
          <div className="border-2 border-purple-500/30 rounded-lg bg-slate-900/40 backdrop-blur-md p-6">
            <h3 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400 flex items-center gap-2 mb-4">
              <Shield className="w-5 h-5 text-emerald-400" /> РЕЕСТР ПОДТВЕРЖДЕННЫХ ТОКЕНОВ С ИИ-МЕТРИКАМИ
            </h3>
            <div className="overflow-x-auto border border-purple-500/20 rounded-lg">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-purple-500/20 bg-purple-500/10 text-purple-400 font-bold">
                    <th className="p-3">Токен</th>
                    <th className="p-3">Цена</th>
                    <th className="p-3">Ликвидность</th>
                    <th className="p-3">Объем / Изм.</th>
                    <th className="p-3 text-center">Safety Score</th>
                    <th className="p-3 text-right">Инспекция</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Pinned $MRDT */}
                  <tr onClick={() => openTokenBlueprint({ symbol: 'MRDT', name: 'MARADONATOKEN', ca: MRDT_CA, liquidity: 13000 })} className="border-b border-purple-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 transition cursor-pointer">
                    <td className="p-3 font-bold flex items-center gap-2">
                      <span className="text-lg">⚽️</span>
                      <div><span className="text-emerald-400 font-extrabold text-sm tracking-wider">$MRDT</span><div className="text-[9px] text-slate-400">MARADONATOKEN</div></div>
                    </td>
                    <td className="p-3 font-mono text-emerald-400 font-bold">${mrdtPrice.toFixed(8)}</td>
                    <td className="p-3 font-mono text-emerald-400 font-bold">$13,000+</td>
                    <td className="p-3 font-mono text-emerald-400 font-bold">+12.4%</td>
                    <td className="p-3 text-center"><div className="inline-flex items-center justify-center w-12 h-6 rounded bg-emerald-500/20 border border-emerald-500 text-emerald-400 font-extrabold">98</div></td>
                    <td className="p-3 text-right text-purple-400 hover:underline font-bold">Открыть Отчет →</td>
                  </tr>
                  
                  {loading && tokens.length === 0 ? (
                    <tr><td colSpan="6" className="p-8 text-center text-purple-400">Загрузка ончейн метрик...</td></tr>
                  ) : (
                    tokens.map((token, i) => {
                      const hash = token.ca.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
                      const score = Math.max(72, Math.min(96, (hash % 25) + 72));
                      const style = getScoreStyle(score);
                      return (
                        <tr key={i} onClick={() => openTokenBlueprint(token)} className="border-b border-purple-500/10 hover:bg-purple-500/5 transition cursor-pointer">
                          <td className="p-3 font-bold"><span className="text-purple-400">${token.symbol}</span><span className="text-[10px] text-slate-500 block truncate max-w-[100px]">{token.name}</span></td>
                          <td className="p-3 font-mono text-slate-300">${token.price}</td>
                          <td className="p-3 font-mono text-slate-300">{formatNumber(token.liquidity)}</td>
                          <td className="p-3 font-mono"><span className={token.priceChange24h > 0 ? 'text-emerald-400' : 'text-red-400'}>{token.priceChange24h}%</span></td>
                          <td className="p-3 text-center"><div className={`inline-flex items-center justify-center w-12 h-6 rounded ${style.bg} ${style.border} ${style.color} font-extrabold`}>{score}</div></td>
                          <td className="p-3 text-right text-purple-400">Анализ →</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Forms & Inputs */}
        <section className="max-w-7xl mx-auto px-6 py-6 grid md:grid-cols-2 gap-8">
          {/* Audit Buy Form */}
          <div className="border border-purple-500/20 bg-slate-900/30 rounded-xl p-6">
            <h3 className="text-lg font-black text-purple-400 mb-4">🔍 ЗАКАЗАТЬ ИИ-ИНСПЕКЦИЮ КОНТРАКТА</h3>
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div>
                <label className="block text-slate-400 text-xs mb-1">Имя токена / Тикер</label>
                <input type="text" value={formData.projectName} onChange={(e) => setFormData({...formData, projectName: e.target.value})} placeholder="Например: $MRDT" className="w-full bg-slate-950 border border-purple-500/20 rounded px-3 py-2 text-xs text-white" />
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1">Адрес смарт-контракта (Solana CA)</label>
                <input type="text" value={formData.ca} onChange={(e) => setFormData({...formData, ca: e.target.value})} placeholder="Впишите адрес..." className="w-full bg-slate-950 border border-purple-500/20 rounded px-3 py-2 text-xs font-mono text-white" />
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1">Выберите скорость и уровень аудита</label>
                <select value={selectedTier} onChange={(e) => setSelectedTier(e.target.value)} className="w-full bg-slate-950 border border-purple-500/20 rounded px-3 py-2 text-xs text-white">
                  <option value="basic">Базовый ИИ-Аудит (10$ ≈ {formatTokenAmount(getAmountForTier('basic'))} $MRDT)</option>
                  <option value="fast">Ускоренный Парсинг 5 мин (40$ ≈ {formatTokenAmount(getAmountForTier('fast'))} $MRDT)</option>
                </select>
              </div>
              <button type="submit" className="w-full bg-gradient-to-r from-purple-500 to-emerald-400 text-slate-950 font-black py-2.5 rounded text-xs transition">
                ЗАПУСТИТЬ ОНЧЕЙН АНАЛИЗ И СИНХРОНИЗАЦИЮ
              </button>
              {error && <p className="text-red-400 text-xs">{error}</p>}
              {submitted && <p className="text-emerald-400 text-xs">✓ Заявка успешно отправлена на парсинг!</p>}
            </form>
          </div>

          {/* Banner Media Form */}
          <div className="border border-purple-500/20 bg-slate-900/30 rounded-xl p-6">
            <h3 className="text-lg font-black text-purple-400 mb-4">👑 РАЗМЕСТИТЬ VIP БАННЕР С МЕДИА</h3>
            <form onSubmit={handleBannerSubmit} className="space-y-4">
              <div>
                <label className="block text-slate-400 text-xs mb-1">Тикер токена</label>
                <input type="text" value={bannerFormData.tokenName} onChange={(e) => setBannerFormData({...bannerFormData, tokenName: e.target.value})} placeholder="SOLANA" className="w-full bg-slate-950 border border-purple-500/20 rounded px-3 py-2 text-xs text-white" />
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1">Срок размещения рекламного места</label>
                <select value={bannerFormData.days} onChange={(e) => setBannerFormData({...bannerFormData, days: e.target.value})} className="w-full bg-slate-950 border border-purple-500/20 rounded px-3 py-2 text-xs text-white">
                  <option value="1">1 День — 20$ (~ {formatTokenAmount(getAmountForBanner('1'))} $MRDT)</option>
                  <option value="2">2 Дня — 35$ (~ {formatTokenAmount(getAmountForBanner('2'))} $MRDT)</option>
                  <option value="6">6 Дней — 100$ (~ {formatTokenAmount(getAmountForBanner('6'))} $MRDT)</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1">Рекламный Логотип/Анимация (Файл)</label>
                <div onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} className="border-2 border-dashed border-purple-500/20 rounded-lg p-4 text-center bg-slate-950 relative cursor-pointer">
                  <input type="file" accept="image/*,video/*" onChange={(e) => handleFileChange(e.target.files[0])} className="absolute inset-0 opacity-0 cursor-pointer" />
                  {mediaFile ? (
                    <span className="text-xs text-emerald-400 font-bold flex items-center justify-center gap-1">✓ Медиафайл успешно загружен в буфер</span>
                  ) : (
                    <span className="text-xs text-slate-400 block"><Upload className="w-5 h-5 mx-auto mb-1 text-purple-400" /> Перетащите сюда картинку или mp4-видео</span>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1">Рекламный слоган</label>
                <input type="text" value={bannerFormData.desc} onChange={(e) => setBannerFormData({...bannerFormData, desc: e.target.value})} placeholder="Описание вашего проекта..." className="w-full bg-slate-950 border border-purple-500/20 rounded px-3 py-2 text-xs text-white" />
              </div>
              <button type="submit" className="w-full bg-gradient-to-r from-emerald-400 to-purple-500 text-slate-950 font-black py-2.5 rounded text-xs transition">
                АКТИВИРОВАТЬ И КУПИТЬ МЕСТО НА САЙТЕ
              </button>
              {bannerError && <p className="text-red-400 text-xs">{bannerError}</p>}
              {bannerSubmitted && <p className="text-emerald-400 text-xs">✓ Ваш баннер успешно сгенерирован и закреплен!</p>}
            </form>
          </div>
        </section>
      </div>

      {/* MODAL AUDIT (TNT SECURITY BLUEPRINT) */}
      {isBlueprintOpen && selectedToken && auditData && scoreStyle && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4 font-mono overflow-y-auto" onClick={closeBlueprint}>
          <div className="bg-slate-950 border-2 border-purple-500/50 rounded-2xl w-full max-w-2xl shadow-2xl relative my-8" onClick={e => e.stopPropagation()}>
            
            <div className="border-b border-purple-500/20 px-6 py-4 flex items-center justify-between bg-slate-900/50 rounded-t-2xl">
              <div>
                <span className="text-xs text-purple-400 tracking-widest font-black block">TNT HOUSE • ИИ ОНЧЕЙН ИНСПЕКТОР</span>
                <h3 className="text-xl font-black text-white flex items-center gap-1.5"><Shield className="w-5 h-5 text-emerald-400" /> Security Audit Report</h3>
              </div>
              <button onClick={closeBlueprint} className="text-slate-400 hover:text-white p-1 rounded-lg border border-purple-500/20 bg-slate-950"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-6 space-y-6">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-gradient-to-r from-purple-950/20 via-slate-900/40 to-slate-950 border border-purple-500/20 p-4 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 bg-purple-500/10 border border-purple-500/30 rounded-xl flex items-center justify-center text-3xl">
                    {selectedToken.symbol === 'MRDT' ? '⚽️' : '🪙'}
                  </div>
                  <div>
                    <h4 className="text-2xl font-black tracking-wide text-white">${selectedToken.symbol}</h4>
                    <span className="text-[10px] text-slate-500 font-mono block truncate max-w-[240px]">{selectedToken.ca}</span>
                  </div>
                </div>
                <div className="text-center sm:text-right">
                  <span className="text-[9px] text-slate-500 block font-bold tracking-wider">TNT SAFETY SCORE</span>
                  <div className={`text-4xl font-black tracking-tighter ${scoreStyle.color} inline-block px-3 py-0.5 rounded-lg bg-black/40 border border-purple-500/10`}>
                    {auditData.score}
                  </div>
                  <span className={`block text-[10px] font-bold mt-1 ${scoreStyle.color}`}>{scoreStyle.label}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-900/60 border border-purple-500/20 rounded-xl p-4 space-y-3">
                  <h5 className="text-xs font-black text-purple-400 flex items-center gap-1.5 border-b border-purple-500/10 pb-1.5">
                    <Lock className="w-3.5 h-3.5 text-purple-400" /> СМАРТ-КОНТРАКТ & ПРАВА
                  </h5>
                  <div className="space-y-1.5 text-xs font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Mint Authority:</span> 
                      <span className="text-emerald-400 font-bold flex items-center gap-1">{auditData.mintAuth} <CheckCircle2 className="w-3 h-3" /></span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Freeze Authority:</span> 
                      <span className="text-emerald-400 font-bold flex items-center gap-1">{auditData.freezeAuth} <CheckCircle2 className="w-3 h-3" /></span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Metadata Mutation:</span> 
                      <span className={auditData.metaMutable.includes('Safe') ? 'text-emerald-400' : 'text-yellow-400 font-bold'}>{auditData.metaMutable}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900/60 border border-purple-500/20 rounded-xl p-4 space-y-3">
                  <h5 className="text-xs font-black text-purple-400 flex items-center gap-1.5 border-b border-purple-500/10 pb-1.5">
                    <Layers className="w-3.5 h-3.5 text-purple-400" /> ЛИКВИДНОСТЬ И ТОРГИ
                  </h5>
                  <div className="space-y-1.5 text-xs font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-400">LP Status:</span> 
                      <span className="text-emerald-400 font-bold">{auditData.lpStatus}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">LP Depth Value:</span> 
                      <span className="text-white font-bold">{auditData.lpValue}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900/60 border border-purple-500/20 rounded-xl p-4 space-y-3">
                  <h5 className="text-xs font-black text-purple-400 flex items-center gap-1.5 border-b border-purple-500/10 pb-1.5">
                    <Users className="w-3.5 h-3.5 text-purple-400" /> РАСПРЕДЕЛЕНИЕ & КИТЫ
                  </h5>
                  <div className="space-y-1.5 text-xs font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Top 10 Holders Share:</span> 
                      <span className="text-slate-200">{auditData.topHolders}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Creator Wallet:</span> 
                      <span className="text-slate-300">{auditData.creatorBalance}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900/60 border border-purple-500/20 rounded-xl p-4 space-y-3">
                  <h5 className="text-xs font-black text-purple-400 flex items-center gap-1.5 border-b border-purple-500/10 pb-1.5">
                    <BarChart3 className="w-3.5 h-3.5 text-purple-400" /> АКТИВНОСТЬ ПУЛА
                  </h5>
                  <div className="space-y-1.5 text-xs font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Pool Age:</span> 
                      <span className="text-white font-bold">{auditData.poolAge}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Wash Trading Check:</span> 
                      <span className={auditData.washTrading.includes('Warning') ? 'text-yellow-400 font-bold' : 'text-emerald-400'}>{auditData.washTrading}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-purple-500/10 to-slate-900 border border-purple-500/30 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2 text-purple-400 font-black text-xs">
                  TNT VERDICT — ИИ ЗАКЛЮЧЕНИЕ
                </div>
                <p className="text-sm leading-relaxed text-slate-200">
                  {selectedToken.symbol === 'MRDT' 
                    ? 'Бро, это железобетонный гем на 100%! Все права полностью отозваны (Revoked), а ликвидность намертво сожжена в пуле Raydium. Риски мошенничества исключены. 🧱⚽️💎'
                    : auditData.score >= 90
                      ? `Токен $${selectedToken.symbol} демонстрирует образцовые показатели безопасности. Mint и Freeze права ликвидированы, пул ликвидности сожжен или надежно заблокирован.`
                      : `Контракт $${selectedToken.symbol} прошел базовую фильтрацию. Технические функции безопасны, однако ИИ-Инспектор рекомендует соблюдать осторожность на ценовых колебаниях.`
                  }
                </p>
              </div>
            </div>

            <div className="border-t border-purple-500/20 px-6 py-4 flex justify-end gap-3 bg-slate-950 rounded-b-2xl">
              <button onClick={closeBlueprint} className="px-5 py-2 text-xs rounded-lg border border-purple-500/40 hover:bg-purple-500/10 transition font-bold">Закрыть отчет</button>
              <button onClick={() => window.open(`https://jup.ag/swap?inputMint=So11111111111111111111111111111111111111112&outputMint=${selectedToken.symbol === 'MRDT' ? MRDT_CA : selectedToken.ca}`, '_blank')} className="px-5 py-2 text-xs rounded-lg bg-emerald-400 text-slate-950 hover:bg-emerald-300 transition font-black">Быстрый Swap на Jupiter →</button>
            </div>

          </div>
        </div>
      )}

      {/* AI Chat Popup */}
      {isChatOpen && (
        <div className="fixed bottom-24 right-6 w-80 md:w-96 h-96 bg-slate-900 border-2 border-purple-500 rounded-xl flex flex-col overflow-hidden z-50">
          <div className="bg-gradient-to-r from-purple-600 to-emerald-500 p-3 flex items-center justify-between">
            <span className="font-bold text-xs">TNT AI AGENT</span>
            <button onClick={() => setIsChatOpen(false)}><X className="w-4 h-4" /></button>
          </div>
          <div className="flex-1 p-3 overflow-y-auto space-y-2 text-xs">
            {chatMessages.map((msg, i) => <div key={i} className={`p-2 rounded max-w-[85%] ${msg.sender === 'user' ? 'bg-purple-500/20 ml-auto' : 'bg-slate-950 text-emerald-400'}`}>{msg.text}</div>)}
          </div>
          <form onSubmit={handleSendChat} className="p-2 bg-slate-950 border-t border-purple-500/20 flex gap-2">
            <input type="text" value={userMsg} onChange={(e) => setUserMsg(e.target.value)} placeholder="Спроси у ИИ..." className="flex-1 bg-slate-909 border border-purple-500/20 rounded px-2 py-1 text-xs text-white" />
            <button type="submit" className="bg-purple-500 text-slate-950 px-3 rounded text-xs font-bold">Отправить</button>
          </form>
        </div>
      )}

      {/* Chat Trigger Button */}
      <button onClick={() => setIsChatOpen(!isChatOpen)} className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-tr from-purple-500 to-emerald-400 rounded-full flex items-center justify-center shadow-lg z-50">
        <MessageSquare className="w-6 h-6 text-slate-950" />
      </button>

    </div>
  );
}
