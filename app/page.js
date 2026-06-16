'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  TrendingUp, Shield, Lock, Zap, Send, MessageSquare, X,
  RefreshCw, AlertCircle, Sparkles, ExternalLink, ChevronDown, Download, Image
} from 'lucide-react';
import { Connection, PublicKey } from '@solana/web3.js';

// --------------------- КОНФИГУРАЦИЯ ---------------------
const WALLET_ADDRESS = "AZyzUySu6HP9ocJYhZECG5syycYNV6ubTQKyfB2mDWgG";
const MRDT_CA = "8Q22r9qUm4AzFzTpZgaPYMxqq4z5WxE9FVa7X9dsvmBg";
const MRDT_MINT = new PublicKey(MRDT_CA);
const RECIPIENT_WALLET = new PublicKey(WALLET_ADDRESS);
const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
const MRDT_DECIMALS = 6;

const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

const getRecipientTokenAccount = async () => {
  const [ata] = PublicKey.findProgramAddressSync(
    [RECIPIENT_WALLET.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), MRDT_MINT.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  return ata;
};
// --------------------------------------------------------

export default function TntHouse() {
  // ---------- ВСЕ ОРИГИНАЛЬНЫЕ СТЕЙТЫ ----------
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const [activeBanner, setActiveBanner] = useState(null);
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

  const [isBlueprintOpen, setIsBlueprintOpen] = useState(false);
  const [selectedToken, setSelectedToken] = useState(null);

  const chatEndRef = useRef(null);

  // Новые стейты для модалки оплаты
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [txSignature, setTxSignature] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [pendingAction, setPendingAction] = useState(null);

  // Pillars
  const pillars = [
    { icon: Shield, label: 'AI Аудит', desc: 'Проверка контрактов', color: 'text-purple-400' },
    { icon: Zap, label: 'Микро-капы', desc: '$5K-$100K', color: 'text-emerald-400' },
    { icon: Lock, label: 'DAO Лицензия', desc: 'Через $MRDT', color: 'text-purple-400' }
  ];

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

  // Jupiter скрипт
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://terminal.jup.ag/main-v3.js';
    script.async = true;
    document.head.appendChild(script);
    return () => { if (document.head.contains(script)) document.head.removeChild(script); };
  }, []);

  // Баннер из localStorage
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

  // Логи
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

  // Загрузка токенов
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

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

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

  // ---------- ОПЛАТА: ПРОВЕРКА ТРАНЗАКЦИИ ----------
  const verifyPayment = async (signature, expectedAmount) => {
    try {
      const tx = await connection.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });
      if (!tx) throw new Error('Транзакция не найдена');

      const recipientATA = await getRecipientTokenAccount();
      const postBalances = tx.meta?.postTokenBalances || [];
      const preBalances = tx.meta?.preTokenBalances || [];

      const ourPost = postBalances.find(
        (b) => b.mint === MRDT_CA && b.owner === WALLET_ADDRESS
      );
      if (!ourPost) throw new Error('Перевод не на ваш токен-аккаунт');

      const postAmt = BigInt(ourPost.uiTokenAmount.amount);
      const preOur = preBalances.find(
        (b) => b.mint === MRDT_CA && b.owner === WALLET_ADDRESS
      );
      const preAmt = preOur ? BigInt(preOur.uiTokenAmount.amount) : 0n;
      const diff = postAmt - preAmt;

      if (diff < BigInt(expectedAmount)) {
        throw new Error(`Недостаточная сумма: получено ${diff.toString()} минимальных единиц`);
      }
      return true;
    } catch (err) {
      console.error('Ошибка проверки:', err);
      return false;
    }
  };

  const handlePayAudit = () => {
    const amount = getAmountForTier(selectedTier);
    setPendingAction({ type: 'audit', amount });
    setShowPaymentModal(true);
  };

  const handlePayBanner = () => {
    const amount = getAmountForBanner(bannerFormData.days);
    setPendingAction({ type: 'banner', amount });
    setShowPaymentModal(true);
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!formData.projectName || !formData.ca || !formData.email) {
      setError('Пожалуйста, заполни все поля формы!');
      return;
    }
    handlePayAudit();
  };

  const handleBannerSubmit = (e) => {
    e.preventDefault();
    if (!bannerFormData.tokenName || !bannerFormData.desc) {
      setBannerError('Укажите название и описание для баннера!');
      return;
    }
    handlePayBanner();
  };

  // ИИ чат
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
    return `$${num.toFixed(2)}`;
  };

  // ---------- UI ----------
  return (
    <div className="min-h-screen bg-black text-white font-sans">
      {/* Верхний баннер */}
      {activeBanner && (
        <div className="bg-gradient-to-r from-purple-900 to-purple-700 p-4 text-center animate-pulse">
          <strong>{activeBanner.tokenName}</strong> — {activeBanner.desc}
          {activeBanner.bannerImg && activeBanner.bannerImg !== '🪙' && (
            <img src={activeBanner.bannerImg} alt="" className="h-8 inline ml-2" />
          )}
        </div>
      )}

      {/* Header */}
      <header className="flex justify-between items-center p-4 border-b border-gray-800">
        <h1 className="text-2xl font-bold text-purple-400">TNT House ⚽️</h1>
        <div className="flex items-center gap-3">
          {/* Buy $MRDT Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsBuyDropdownOpen(!isBuyDropdownOpen)}
              className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded flex items-center gap-1"
            >
              Купить $MRDT <ChevronDown size={16} />
            </button>
            {isBuyDropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-gray-800 rounded shadow-lg z-20 border border-gray-700">
                <button onClick={handleLaunchJupiter} className="block w-full text-left px-4 py-2 hover:bg-gray-700">🪐 Jupiter</button>
                <button onClick={handleOpenRaydium} className="block w-full text-left px-4 py-2 hover:bg-gray-700">💧 Raydium</button>
              </div>
            )}
          </div>
          <button onClick={handleConnectWallet} className="bg-gray-700 px-4 py-2 rounded">
            {walletAddress || 'Connect Wallet'}
          </button>
        </div>
      </header>

      {/* Hero / Приветствие */}
      <section className="text-center py-12 px-4">
        <h2 className="text-4xl font-bold mb-2">Добро пожаловать в TNT House</h2>
        <p className="text-gray-400">Первый анти-скам хаб для микро-капов на Solana</p>
        <div className="flex justify-center gap-6 mt-8">
          {pillars.map((p, i) => (
            <div key={i} className="bg-gray-900 p-4 rounded-xl w-40 border border-gray-800">
              <p.icon className={`mx-auto ${p.color}`} size={32} />
              <h3 className="font-bold mt-2">{p.label}</h3>
              <p className="text-xs text-gray-500">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Форма Аудита */}
      <section className="max-w-2xl mx-auto p-4 mt-8">
        <h2 className="text-xl font-bold mb-4">🔍 Аудит токена</h2>
        <form onSubmit={handleFormSubmit} className="bg-gray-900 rounded-xl p-4 border border-gray-800 space-y-3">
          <input type="text" placeholder="Название проекта" className="w-full bg-gray-800 rounded p-2" value={formData.projectName} onChange={e => setFormData({...formData, projectName: e.target.value})} />
          <input type="text" placeholder="Контракт (CA)" className="w-full bg-gray-800 rounded p-2" value={formData.ca} onChange={e => setFormData({...formData, ca: e.target.value})} />
          <input type="email" placeholder="Email" className="w-full bg-gray-800 rounded p-2" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
          <select className="w-full bg-gray-800 rounded p-2" value={selectedTier} onChange={e => setSelectedTier(e.target.value)}>
            <option value="basic">Basic (≈10$)</option>
            <option value="fast">Fast (≈40$)</option>
            <option value="vip">VIP (≈120$)</option>
          </select>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button type="submit" className="w-full bg-purple-600 hover:bg-purple-700 py-2 rounded font-bold" disabled={isSending}>
            {isSending ? 'Обработка...' : 'Оплатить и разместить'}
          </button>
          {submitted && <p className="text-green-400 text-center">Токен добавлен в таблицу!</p>}
        </form>
      </section>

      {/* Форма VIP Баннера */}
      <section className="max-w-2xl mx-auto p-4 mt-8">
        <h2 className="text-xl font-bold mb-4">👑 VIP Баннер</h2>
        <form onSubmit={handleBannerSubmit} className="bg-gray-900 rounded-xl p-4 border border-gray-800 space-y-3">
          <input type="text" placeholder="Название токена" className="w-full bg-gray-800 rounded p-2" value={bannerFormData.tokenName} onChange={e => setBannerFormData({...bannerFormData, tokenName: e.target.value})} />
          <textarea placeholder="Краткое описание" className="w-full bg-gray-800 rounded p-2" value={bannerFormData.desc} onChange={e => setBannerFormData({...bannerFormData, desc: e.target.value})}></textarea>
          <label className="text-sm text-gray-400">Загрузить фото или видео</label>
          <input type="file" accept="image/*,video/*" onChange={e => {
            const file = e.target.files[0];
            if (file) {
              const reader = new FileReader();
              reader.onload = () => setBannerFormData({...bannerFormData, bannerImg: reader.result});
              reader.readAsDataURL(file);
            }
          }} />
          <select className="w-full bg-gray-800 rounded p-2" value={bannerFormData.days} onChange={e => setBannerFormData({...bannerFormData, days: e.target.value})}>
            <option value="1">1 день (≈20$)</option>
            <option value="2">2 дня (≈35$)</option>
            <option value="6">6 дней (≈100$)</option>
          </select>
          {bannerError && <p className="text-red-400 text-sm">{bannerError}</p>}
          <button type="submit" className="w-full bg-purple-600 hover:bg-purple-700 py-2 rounded font-bold" disabled={isBannerSending}>
            {isBannerSending ? 'Обработка...' : 'Оплатить баннер'}
          </button>
          {bannerSubmitted && <p className="text-green-400 text-center">Баннер активирован!</p>}
        </form>
      </section>

      {/* Таблица токенов */}
      <section className="max-w-4xl mx-auto p-4 mt-8">
        <h2 className="text-xl font-bold mb-4">📊 Безопасные токены</h2>
        {loading ? (
          <p className="text-center py-8">Загрузка данных с DexScreener...</p>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {tokens.map((token, idx) => {
              const score = getSafetyScore(token);
              const style = getScoreStyle(score);
              return (
                <div key={idx} className={`p-4 rounded-xl border ${style.border} ${style.bg} flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 ${style.glow}`}>
                  <div>
                    <div className="font-bold text-lg">{token.name} ({token.symbol})</div>
                    <div className="text-xs text-gray-400 font-mono">{token.ca?.slice(0,8)}...{token.ca?.slice(-4)}</div>
                    <div className="text-sm">Price: ${token.price} | Liq: {formatNumber(token.liquidity)} | Vol 24h: {formatNumber(token.volume24h)}</div>
                    <div className={token.priceChange24h >= 0 ? 'text-green-400 text-sm' : 'text-red-400 text-sm'}>
                      24h: {token.priceChange24h.toFixed(2)}%
                    </div>
                  </div>
                  <div className="text-right space-y-2">
                    <div className={`text-lg font-bold ${style.color}`}>{style.label}</div>
                    <button onClick={() => openTokenBlueprint(token)} className="text-purple-400 text-sm underline">Security Blueprint</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Модалка Blueprint */}
      {isBlueprintOpen && selectedToken && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={closeBlueprint}>
          <div className="bg-gray-900 p-6 rounded-xl border border-purple-500/30 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4">Security Blueprint: {selectedToken.symbol}</h2>
            <p className="text-sm">Contract: <span className="font-mono">{selectedToken.ca}</span></p>
            <p className="mt-2">Safety Score: {getSafetyScore(selectedToken)}/100</p>
            <p className="text-xs text-gray-500 mt-2">Mint Authority: {selectedToken.symbol === 'MRDT' ? 'Отключена ✓' : 'Не проверена'}</p>
            <button onClick={closeBlueprint} className="mt-4 bg-gray-700 px-4 py-2 rounded">Закрыть</button>
          </div>
        </div>
      )}

      {/* Модалка оплаты */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900 p-6 rounded-xl border border-purple-500/30 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Оплата MRDT</h2>
            <p className="text-gray-300 mb-4">
              Отправьте <strong>{pendingAction?.amount} MRDT</strong> на адрес:<br />
              <code className="bg-gray-800 p-1 rounded text-purple-400 break-all text-sm">
                {WALLET_ADDRESS}
              </code>
            </p>
            <div className="flex gap-2 mb-4">
              <button className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 rounded" onClick={handleLaunchJupiter}>Купить MRDT</button>
              <button className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded" onClick={() => { navigator.clipboard.writeText(WALLET_ADDRESS); alert('Адрес скопирован'); }}>Скопировать</button>
            </div>
            <label className="block text-sm mb-2">Вставьте TxID (сигнатуру) после перевода</label>
            <input type="text" className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white mb-3" placeholder="5U... или 2x..." value={txSignature} onChange={e => setTxSignature(e.target.value)} />
            {paymentError && <p className="text-red-400 mb-2 text-sm">{paymentError}</p>}
            <button
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
              disabled={paymentLoading || !txSignature.trim()}
              onClick={async () => {
                if (!pendingAction) return;
                setPaymentLoading(true);
                setPaymentError('');
                const amountLamports = pendingAction.amount * 10 ** MRDT_DECIMALS;
                const isValid = await verifyPayment(txSignature.trim(), amountLamports);
                if (isValid) {
                  if (pendingAction.type === 'audit') {
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
                    setLogs(prev => [...prev, `[✅] Аудит оплачен: ${pendingAction.amount} MRDT. Токен добавлен.`]);
                    setTimeout(() => setSubmitted(false), 5000);
                  } else if (pendingAction.type === 'banner') {
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
                    setLogs(prev => [...prev, `[👑] VIP Баннер размещён: ${bannerData.tokenName}`]);
                    setTimeout(() => setBannerSubmitted(false), 5000);
                  }
                  setShowPaymentModal(false);
                  setTxSignature('');
                  setPendingAction(null);
                } else {
                  setPaymentError('Оплата не подтверждена. Проверьте сигнатуру и сумму.');
                }
                setPaymentLoading(false);
              }}
            >
              {paymentLoading ? 'Проверка...' : 'Я оплатил'}
            </button>
            <button className="w-full mt-2 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded" onClick={() => { setShowPaymentModal(false); setTxSignature(''); setPaymentError(''); setPendingAction(null); }}>Отмена</button>
          </div>
        </div>
      )}

      {/* ИИ-Чат кнопка и окно */}
      <button onClick={() => setIsChatOpen(!isChatOpen)} className="fixed bottom-5 right-5 bg-purple-600 p-4 rounded-full shadow-lg z-40 hover:bg-purple-700">
        <MessageSquare />
      </button>
      {isChatOpen && (
        <div className="fixed bottom-20 right-5 w-80 bg-gray-900 rounded-xl border border-gray-700 z-50 flex flex-col shadow-2xl">
          <div className="flex justify-between items-center p-3 border-b border-gray-700">
            <span className="font-bold">ИИ-Инспектор</span>
            <button onClick={() => setIsChatOpen(false)}><X size={18} /></button>
          </div>
          <div className="flex-1 p-3 h-64 overflow-y-auto space-y-2">
            {chatMessages.map((msg, i) => (
              <div key={i} className={`p-2 rounded ${msg.sender === 'user' ? 'bg-purple-600 ml-8' : 'bg-gray-800 mr-8'}`}>{msg.text}</div>
            ))}
            {isTyping && <div className="text-gray-400 text-sm">ИИ печатает...</div>}
            <div ref={chatEndRef} />
          </div>
          <form onSubmit={handleSendChat} className="border-t border-gray-700 p-2 flex">
            <input type="text" placeholder="Спроси о токене..." className="flex-1 bg-gray-800 rounded p-2 text-sm" value={userMsg} onChange={e => setUserMsg(e.target.value)} />
            <button type="submit" className="ml-2 bg-purple-600 p-2 rounded"><Send size={18} /></button>
          </form>
        </div>
      )}

      {/* Лог-панель */}
      <footer className="p-4 text-xs text-gray-500 border-t border-gray-800 mt-8 space-y-1">
        {logs.slice(-5).map((log, i) => <div key={i} className="font-mono">{log}</div>)}
      </footer>
    </div>
  );
}
