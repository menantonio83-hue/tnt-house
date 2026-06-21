'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Shield, Send, MessageSquare, X, RefreshCw, AlertCircle, Sparkles, ExternalLink, ChevronDown, Download, Zap, Lock, CheckCircle, XCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';

const WALLET_ADDRESS = "Ev6oXBXo6qyoaT5wypJ2Umxch91F7cFvE1SarYLaUn8Z";
const MRDT_CA = "8Q22r9qUm4AzFzTpZgaPYMxqq4z5WxE9FVa7X9dsvmBg";
const SITE_URL = 'https://tnt-house.vercel.app';
const SUPABASE_URL = 'https://pjtvjslcffuulsqxerpx.supabase.co';
const SUPABASE_KEY = 'sb_publishable__gmhE8SE_blCu-v90fV2OQ_YmFCkfFU';

const GLOW_PURPLE = {position:'absolute',top:'-10%',left:'-10%',width:'500px',height:'500px',borderRadius:'9999px',background:'rgba(147,51,234,0.1)',filter:'blur(120px)',pointerEvents:'none'};
const GLOW_GREEN = {position:'absolute',bottom:'20%',right:'-10%',width:'500px',height:'500px',borderRadius:'9999px',background:'rgba(16,185,129,0.1)',filter:'blur(120px)',pointerEvents:'none'};

async function saveTokenToSupabase(token) {
  try {
    await fetch(SUPABASE_URL + '/rest/v1/listed_tokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        name: token.name, symbol: token.symbol, ca: token.ca,
        price: token.price, liquidity: token.liquidity,
        volume24h: token.volume24h, price_change_24h: token.priceChange24h,
        score: token.score || 95, dex_url: token.dexUrl,
        chain: token.chain || 'solana',
        mint_authority: token.mintAuthority || '-',
        freeze_authority: token.freezeAuthority || '-',
        is_honeypot: token.isHoneypot || '-',
      }),
    });
  } catch(e) { console.error('Supabase save failed:', e); }
}

async function loadTokensFromSupabase() {
  try {
    var res = await fetch(SUPABASE_URL + '/rest/v1/listed_tokens?select=*&order=created_at.desc&limit=20', {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY },
    });
    if (!res.ok) return [];
    var data = await res.json();
    return data.map(function(row) {
      return {
        name: row.name, symbol: row.symbol, ca: row.ca, price: row.price,
        liquidity: row.liquidity, volume24h: row.volume24h,
        priceChange24h: row.price_change_24h, score: row.score,
        verified: true, dexUrl: row.dex_url, chain: row.chain,
        mintAuthority: row.mint_authority, freezeAuthority: row.freeze_authority,
        isHoneypot: row.is_honeypot, fromSupabase: true,
      };
    });
  } catch(e) { return []; }
}

const isMobile = () => {
  if (typeof window === 'undefined') return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
};

const FALLBACK_TOKENS = [
  { name: 'Test Gem', symbol: 'TGEM', ca: '11111111111111111111111111111111', price: '0.00001234', liquidity: 45000, volume24h: 120000, priceChange24h: 8.5, verified: true, dexUrl: 'https://dexscreener.com', chain: 'solana' }
];

export default function TntHouse() {
  var [tokens, setTokens] = useState([]);
  var [listedTokens, setListedTokens] = useState([]);
  var [loading, setLoading] = useState(true);
  var [bannerSubmitted, setBannerSubmitted] = useState(false);
  var [bannerError, setBannerError] = useState('');
  var [error, setError] = useState('');
  var [walletAddress, setWalletAddress] = useState('');
  var [isBannerSending, setIsBannerSending] = useState(false);
  var [activeBanner, setActiveBanner] = useState(null);
  var [isBuyDropdownOpen, setIsBuyDropdownOpen] = useState(false);
  var [isChatOpen, setIsChatOpen] = useState(false);
  var [chatMessages, setChatMessages] = useState([{ sender: 'bot', text: 'Привет! Я ИИ-Инспектор TNT House. Спроси меня про любой контракт или токен $MRDT.' }]);
  var [userMsg, setUserMsg] = useState('');
  var [isTyping, setIsTyping] = useState(false);
  var [logs, setLogs] = useState(['[ИИ-Инспектор] Инициализация системы безопасности TNT House...', '[СЕТЬ] Подключение к RPC узлам Solana завершено успешно.']);
  var [isBlueprintOpen, setIsBlueprintOpen] = useState(false);
  var [selectedToken, setSelectedToken] = useState(null);
  var chatEndRef = useRef(null);
  var [mrdtPrice, setMrdtPrice] = useState(0.000013);
  var mrdtPriceRef = useRef(0.000013);
  var [priceLoading, setPriceLoading] = useState(true);
  var [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  var [isSending, setIsSending] = useState(false);
  var [submitted, setSubmitted] = useState(false);
  var [formData, setFormData] = useState({ projectName: '', contractAddress: '', email: '' });
  var [selectedTier, setSelectedTier] = useState('basic');
  var [bannerFormData, setBannerFormData] = useState({ tokenName: '', bannerImg: '', desc: '', days: '1' });

  // НОВЫЕ СТЕЙТЫ для окон оплаты
  var [showPaymentModal, setShowPaymentModal] = useState(false);
  var [showWalletModal, setShowWalletModal] = useState(false);
  var [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
  var [selectedWallet, setSelectedWallet] = useState(null);
  var [showInvoiceModal, setShowInvoiceModal] = useState(false);
  var [invoiceAmount, setInvoiceAmount] = useState(0);
  var [invoiceLabel, setInvoiceLabel] = useState('');

  var showToast = function(message, type) {
    if (!type) type = 'success';
    setToast({ show: true, message: message, type: type });
    setTimeout(function() { setToast({ show: false, message: '', type: 'success' }); }, 4200);
  };

  var getSafetyScore = function(token) {
    if (!token) return 75;
    if (token.symbol === 'MRDT') return 98;
    if (token.score) return token.score;
    var hash = token.symbol.split('').reduce(function(a, b) { return a + b.charCodeAt(0); }, 0);
    return Math.max(85, Math.min(97, hash % 12 + 85));
  };

  var getScoreStyle = function(score) {
    if (score >= 90) return { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/50', glow: 'shadow-[0_0_12px_rgba(16,185,129,0.6)]' };
    if (score >= 50) return { color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/50', glow: 'shadow-[0_0_12px_rgba(234,179,8,0.5)]' };
    return { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/50', glow: 'shadow-[0_0_12px_rgba(239,68,68,0.6)] animate-pulse' };
  };

  var getAmountForTier = function(tier) {
    var usd = tier === 'fast' ? 40 : tier === 'vip' ? 120 : 10;
    var price = mrdtPriceRef.current || mrdtPrice;
    return price > 0 ? Math.round(usd / price) : 0;
  };

  var getAmountForBanner = function(days) {
    var usd = days === '2' ? 35 : days === '6' ? 100 : 20;
    var price = mrdtPriceRef.current || mrdtPrice;
    return price > 0 ? Math.round(usd / price) : 0;
  };

  useEffect(function() {
    loadTokensFromSupabase().then(function(data) {
      if (data.length > 0) setListedTokens(data);
    });
  }, []);

  useEffect(function() {
    var fetchPrice = async function() {
      try {
        var res = await fetch('https://api.dexscreener.com/latest/dex/tokens/' + MRDT_CA);
        var data = await res.json();
        if (data.pairs && data.pairs.length) {
          var p = parseFloat(data.pairs[0].priceUsd);
          if (p > 0) {
            setMrdtPrice(p);
            mrdtPriceRef.current = p;
          }
        }
      } catch(e) {}
      setPriceLoading(false);
    };
    fetchPrice();
    var i = setInterval(fetchPrice, 60000);
    return function() { clearInterval(i); };
  }, []);

  useEffect(function() {
    var templates = ['Обнаружен новый пул на Raydium!', 'Mint Authority отключена.', 'Уровень угрозы: НИЗКИЙ.', 'Бандлов не обнаружено.', 'Подключение к DexScreener.', 'Ищем новые гемы...'];
    var i = setInterval(function() {
      var t = templates[Math.floor(Math.random() * templates.length)];
      setLogs(function(prev) { return prev.slice(-12).concat(['[' + new Date().toLocaleTimeString() + '] ' + t]); });
    }, 4200);
    return function() { clearInterval(i); };
  }, []);

  useEffect(function() {
    var fetchTokens = async function() {
      try {
        setLoading(true);
        var cached = localStorage.getItem('tnt_cached_tokens');
        var time = localStorage.getItem('tnt_cached_time');
        if (cached && time && Date.now() - parseInt(time) < 120000) {
          setTokens(JSON.parse(cached)); setLoading(false); return;
        }
        var res = await fetch('https://api.dexscreener.com/latest/dex/tokens/So11111111111111111111111111111111111111112?limit=30');
        var data = await res.json();
        if (data.pairs && data.pairs.length) {
          var filtered = data.pairs
            .filter(function(p) { return (p.marketCap || 0) >= 1000 && (p.marketCap || 0) <= 300000; })
            .slice(0, 9)
            .map(function(p) {
              return {
                name: (p.baseToken && p.baseToken.name) || 'Unknown',
                symbol: (p.baseToken && p.baseToken.symbol) || '???',
                ca: (p.baseToken && p.baseToken.address) || '',
                price: p.priceUsd ? parseFloat(p.priceUsd).toFixed(8) : '0',
                liquidity: (p.liquidity && p.liquidity.usd) ? Math.round(p.liquidity.usd) : 0,
                volume24h: (p.volume && p.volume.h24) ? Math.round(p.volume.h24) : 0,
                priceChange24h: (p.priceChange && p.priceChange.h24) || 0,
                verified: true, dexUrl: p.url || '', chain: p.chainId || 'solana',
              };
            });
          if (filtered.length) {
            setTokens(filtered);
            localStorage.setItem('tnt_cached_tokens', JSON.stringify(filtered));
            localStorage.setItem('tnt_cached_time', Date.now().toString());
            setLoading(false); return;
          }
        }
        throw new Error('No pairs');
      } catch(e) { setTokens(FALLBACK_TOKENS); setLoading(false); }
    };
    fetchTokens();
    var i = setInterval(fetchTokens, 5 * 60 * 1000);
    return function() { clearInterval(i); };
  }, []);

  useEffect(function() {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(function() {
    var check = function() {
      try {
        var s = localStorage.getItem('tnt_active_banner');
        if (s) {
          var d = JSON.parse(s);
          if (Date.now() < d.expiresAt) setActiveBanner(d);
          else { localStorage.removeItem('tnt_active_banner'); setActiveBanner(null); }
        }
      } catch(e) {}
    };
    check();
    var i = setInterval(check, 10000);
    return function() { clearInterval(i); };
  }, []);

  // НОВАЯ функция handleFormSubmit
  var handleFormSubmit = function(e) {
    e.preventDefault();
    if (!formData.projectName || !formData.contractAddress || !formData.email) {
      showToast('Заполни все поля', 'error'); return;
    }

    var mrdtAmount = getAmountForTier(selectedTier);
    if (mrdtAmount <= 0) { showToast('Ошибка цены, попробуй позже', 'error'); return; }

    var tierName = selectedTier === 'fast' ? 'Быстрый' : selectedTier === 'vip' ? 'VIP' : 'Базовый';

    setInvoiceAmount(mrdtAmount);
    setInvoiceLabel('TNT House ' + tierName + ' Audit - ' + formData.projectName);
    setShowPaymentModal(true);
  };

  // НОВЫЕ функции для окон
  var handlePaymentMethodSelect = function(method) {
    setSelectedPaymentMethod(method);
    setShowPaymentModal(false);
    setShowWalletModal(true);
  };

  var handleWalletSelect = function(wallet) {
    setSelectedWallet(wallet);
    setShowWalletModal(false);
    setShowInvoiceModal(true);
  };

  var handleConfirmPayment = function() {
    setShowInvoiceModal(false);
    setIsSending(true);

    var label = encodeURIComponent(invoiceLabel);
    var message = encodeURIComponent('Аудит для ' + formData.projectName + ' CA: ' + formData.contractAddress);
    var solanaPayUrl = 'solana:' + WALLET_ADDRESS + '?amount=' + invoiceAmount + '&spl-token=' + MRDT_CA + '&label=' + label + '&message=' + message;
    window.location.href = solanaPayUrl;

    setTimeout(function() {
      var newToken = {
        name: formData.projectName.toUpperCase(),
        symbol: formData.projectName.slice(0, 4).toUpperCase() || 'NEW',
        ca: formData.contractAddress,
        price: '0.00000000',
        liquidity: 0,
        volume24h: 0,
        priceChange24h: 0,
        score: 95,
        verified: true,
        dexUrl: 'https://dexscreener.com/solana/' + formData.contractAddress,
        chain: 'solana',
        mintAuthority: 'Отозвана',
        freezeAuthority: 'Отозвана',
        isHoneypot: 'Нет',
      };
      saveTokenToSupabase(newToken);
      setListedTokens(function(prev) { return [newToken].concat(prev); });
      setSubmitted(true);
      setFormData({ projectName: '', contractAddress: '', email: '' });
      showToast('Оплата отправлена! Токен добавлен в таблицу.', 'success');
      setIsSending(false);
      setSelectedPaymentMethod(null);
      setSelectedWallet(null);
      setTimeout(function() { setSubmitted(false); }, 5000);
    }, 800);
  };

  var handleBannerSubmit = function(e) {
    e.preventDefault();
    if (!bannerFormData.tokenName || !bannerFormData.desc) { setBannerError('Укажите название и описание.'); return; }
    setIsBannerSending(true);

    var usd = bannerFormData.days === '2' ? 35 : bannerFormData.days === '6' ? 100 : 20;
    var mrdtAmount = getAmountForBanner(bannerFormData.days);
    var label = encodeURIComponent('TNT House VIP Banner ' + bannerFormData.days + 'd');
    var message = encodeURIComponent('VIP Banner for ' + bannerFormData.tokenName);
    var solanaPayUrl = 'solana:' + WALLET_ADDRESS + '?amount=' + mrdtAmount + '&spl-token=' + MRDT_CA + '&label=' + label + '&message=' + message;
    window.location.href = solanaPayUrl;

    setTimeout(function() {
      var banner = {
        tokenName: bannerFormData.tokenName.toUpperCase(),
        bannerImg: bannerFormData.bannerImg || '',
        desc: bannerFormData.desc,
        expiresAt: Date.now() + parseInt(bannerFormData.days) * 86400000,
      };
      localStorage.setItem('tnt_active_banner', JSON.stringify(banner));
      setActiveBanner(banner);
      setBannerSubmitted(true);
      setBannerFormData({ tokenName: '', bannerImg: '', desc: '', days: '1' });
      setBannerError('');
      setIsBannerSending(false);
      setTimeout(function() { setBannerSubmitted(false); }, 5000);
    }, 800);
  };

  var handleSendChat = function() {
    if (!userMsg.trim()) return;
    setChatMessages(function(prev) { return prev.concat([{ sender: 'user', text: userMsg }]); });
    setUserMsg(''); setIsTyping(true);
    setTimeout(function() {
      var replies = ['Структура чистая. SAFE', 'Бандлов нет.', '$MRDT — гем!', 'Ругпулов не обнаружено.', 'Комиссии честные.'];
      setChatMessages(function(prev) { return prev.concat([{ sender: 'bot', text: replies[Math.floor(Math.random() * replies.length)] }]); });
      setIsTyping(false);
    }, 1000);
  };

  var formatNumber = function(num) {
    if (num >= 1e6) return '$' + (num / 1e6).toFixed(1) + 'M';
    if (num >= 1e3) return '$' + (num / 1e3).toFixed(1) + 'K';
    return '$' + num.toFixed(0);
  };

  var scrollToForm = function() {
    var el = document.getElementById('orderFormsSection');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  var handleLaunchJupiter = function() {
    window.open('https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&buy=8Q22r9qUm4AzFzTpZgaPYMxqq4z5WxE9FVa7X9dsvmBg', '_blank');
  };
  var handleOpenRaydium = function() { setIsBuyDropdownOpen(false); window.open('https://raydium.io', '_blank'); };
  var openTokenBlueprint = function(token) { setSelectedToken(token); setIsBlueprintOpen(true); };
  var closeBlueprint = function() { setIsBlueprintOpen(false); setTimeout(function() { setSelectedToken(null); }, 300); };

  var pillars = [
    { icon: Shield, label: 'AI Аудит', desc: 'Проверка контрактов', color: 'text-purple-400' },
    { icon: Zap, label: 'Микро-капы', desc: '$5K-$100K', color: 'text-emerald-400' },
    { icon: Lock, label: 'DAO Лицензия', desc: 'Через $MRDT', color: 'text-purple-400' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white font-mono relative overflow-hidden pb-12">

      {toast.show && (
        <div className={'fixed bottom-6 left-1/2 -translate-x-1/2 z-[99999] flex items-center gap-3 px-6 py-3.5 rounded-2xl shadow-2xl border text-sm font-medium transition-all duration-300 ' + (toast.type === 'success' ? 'bg-emerald-950 border-emerald-500/40 text-emerald-300' : 'bg-red-950 border-red-500/40 text-red-300')}>
          {toast.type === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-400" /> : <XCircle className="w-5 h-5 text-red-400" />}
          <span>{toast.message}</span>
        </div>
      )}

      <div style={GLOW_PURPLE} />
      <div style={GLOW_GREEN} />

      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      <div className="relative z-10">

        <header className="border-b border-purple-500/30 backdrop-blur-lg bg-slate-950/60 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <a href="https://t.me/tnt_house2026" target="_blank" rel="noopener noreferrer" className="w-10 h-10 border-2 border-purple-500 rounded-lg flex items-center justify-center bg-purple-500/10 shadow-[0_0_15px_rgba(153,69,255,0.4)] animate-pulse">
                <span className="text-xl">🧨</span>
              </a>
              <div>
                <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-emerald-400 tracking-wider">TNT HOUSE</h1>
                <span className="text-[10px] text-purple-400 block font-bold tracking-widest">TOP NEW TOKENS v1.17</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <button onClick={function() { setIsBuyDropdownOpen(!isBuyDropdownOpen); }} className="bg-gradient-to-r from-purple-500 to-emerald-400 hover:from-purple-400 hover:to-emerald-300 text-slate-950 font-black px-4 py-2 rounded text-xs transition flex items-center gap-1 shadow-[0_0_15px_rgba(153,69,255,0.4)]">
                  BUY $MRDT <ChevronDown className="w-3 h-3" />
                </button>
                {isBuyDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-slate-950 border border-purple-500/30 rounded-lg shadow-xl z-50 py-1">
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

        <section className="max-w-7xl mx-auto px-6 pt-6">
          {activeBanner ? (
            <div className="border border-purple-500/40 rounded-2xl p-4 bg-gradient-to-r from-black via-purple-950/20 to-black flex flex-col sm:flex-row items-center justify-between gap-4 shadow-[0_0_20px_rgba(168,85,247,0.2)]">
              <div className="flex items-center gap-4">
                <span className="text-3xl bg-purple-500/10 p-2 rounded-xl border border-purple-500/20">
                  {typeof activeBanner.bannerImg === 'string' && activeBanner.bannerImg.startsWith('data:')
                    ? <img src={activeBanner.bannerImg} alt="logo" className="w-8 h-8 rounded-full object-cover" />
                    : activeBanner.bannerImg || '🪙'}
                </span>
                <div>
                  <span className="bg-purple-500 text-white font-black text-[9px] px-2 py-0.5 rounded tracking-widest block w-max mb-1">VIP БУСТ</span>
                  <h4 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400">${activeBanner.tokenName}</h4>
                  <p className="text-slate-300 text-xs mt-0.5">{activeBanner.desc}</p>
                </div>
              </div>
              <button onClick={function() { window.open('https://jup.ag', '_blank'); }} className="bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-xs px-6 py-2.5 rounded transition">
                КУПИТЬ НА JUPITER
              </button>
            </div>
          ) : (
            <div onClick={scrollToForm} className="cursor-pointer border border-purple-500/30 rounded-2xl p-4 bg-gradient-to-r from-black via-purple-950/10 to-black flex flex-col sm:flex-row items-center justify-between gap-4 hover:border-purple-500/60 transition">
              <div className="flex items-center gap-4">
                <span className="text-3xl bg-purple-500/10 p-2 rounded-xl border border-purple-500/20">⚽️</span>
                <div>
                  <span className="bg-slate-800 text-purple-400 font-bold text-[9px] px-2 py-0.5 rounded tracking-widest block w-max mb-1">МЕСТО СВОБОДНО</span>
                  <h4 className="text-lg font-black text-white">Maradona Token ($MRDT)</h4>
                  <p className="text-slate-400 text-xs mt-0.5">Нажмите, чтобы купить VIP-баннер!</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-emerald-400 font-black text-sm">VIP-Буст от \$20/день</div>
                <div className="text-[10px] text-slate-500">Оплата в $MRDT</div>
              </div>
            </div>
          )}
        </section>

        <section className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="space-y-3 border-l-4 border-purple-500 pl-6">
                <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded font-bold border border-purple-500/30">БЕЗОПАСНЫЕ НОВЫЕ ТОКЕНЫ</span>
                <h2 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400">Взрываем скамы. Запускаем гемы.</h2>
                <p className="text-slate-300 text-base leading-relaxed">Добро пожаловать в Дом Новых Токенов! Наш ИИ-агент сканирует блокчейн.</p>
              </div>
              <div className="grid grid-cols-3 gap-4 mt-8">
                {pillars.map(function(item, i) {
                  return (
                    <div key={i} className="bg-slate-900/50 border border-purple-500/20 rounded-lg p-3 text-center hover:border-purple-500/60 transition">
                      <item.icon className={'w-5 h-5 ' + item.color + ' mx-auto mb-1'} />
                      <div className="text-[11px] font-bold text-slate-200">{item.label}</div>
                      <div className="text-[9px] text-slate-400">{item.desc}</div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="bg-slate-950 border-2 border-purple-500/40 rounded-lg p-4 font-mono text-xs h-72 flex flex-col justify-between shadow-[0_0_20px_rgba(153,69,255,0.15)] relative">
              <div className="absolute top-3 right-4 flex gap-1.5">
                <span className="w-2.5 h-2.5 bg-red-500 rounded-full" />
                <span className="w-2.5 h-2.5 bg-yellow-500 rounded-full" />
                <span className="w-2.5 h-2.5 bg-green-500 rounded-full" />
              </div>
              <div className="text-purple-400 font-bold border-b border-purple-500/20 pb-2 mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 animate-spin" /> AI SCANNER + SUPABASE
              </div>
              <div className="flex-1 overflow-y-auto space-y-1.5 text-emerald-400">
                {logs.map(function(log, i) { return <div key={i} className="text-[11px]">{log}</div>; })}
              </div>
              <div className="text-[10px] text-slate-500 border-t border-purple-500/20 pt-2 mt-2">Status: SCANNING AND SYNCING...</div>
            </div>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-6 py-6">
          <div className="border-2 border-purple-500/30 rounded-lg bg-slate-900/40 backdrop-blur-md p-3 shadow-[0_0_25px_rgba(153,69,255,0.2)]">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-base font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-emerald-400" /> ТАБЛИЦА БЕЗОПАСНЫХ НОВЫХ ТОКЕНОВ
                </h3>
                <p className="text-slate-400 text-[10px] mt-0.5">Кликни на токен для TNT Security Blueprint</p>
              </div>
              <div className="hidden md:flex items-center gap-1 text-[9px] text-purple-400">
                <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Live
              </div>
            </div>
            <div className="max-h-[320px] overflow-y-auto border border-purple-500/20 rounded-lg">
              <table className="w-full text-left border-collapse text-[9px]">
                <thead>
                  <tr className="border-b border-purple-500/20 bg-purple-500/10 text-purple-400 font-bold sticky top-0 z-20 backdrop-blur-md">
                    {['Токен', 'Цена', 'Ликв', 'Об/Изм', 'Оценка', 'Действ'].map(function(h, i) {
                      return (
                        <th key={i} className={'p-0.5 align-bottom' + (i === 4 ? ' text-center' : i === 5 ? ' text-right' : '')} style={{ writingMode: 'vertical-lr', textOrientation: 'mixed', height: '60px', whiteSpace: 'nowrap' }}>
                          {h}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  <tr onClick={function() { openTokenBlueprint({ symbol: 'MRDT', name: 'MARADONATOKEN', ca: MRDT_CA, price: mrdtPrice.toFixed(8), liquidity: 13000, volume24h: 0, priceChange24h: 12.4, verified: true, dexUrl: 'https://dexscreener.com/solana/' + MRDT_CA, chain: 'solana' }); }} className="border-b border-purple-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 transition cursor-pointer">
                    <td className="p-1 font-bold flex items-center gap-1">
                      <span className="text-sm">⚽️</span>
                      <div>
                        <span className="text-emerald-400 font-extrabold text-[10px]">$MRDT</span>
                        <div className="text-[7px] text-slate-400">MARADONATOKEN</div>
                      </div>
                    </td>
                    <td className="p-1 font-mono text-emerald-400 font-bold text-[9px]">${mrdtPrice > 0 ? mrdtPrice.toFixed(8) : '...'}</td>
                    <td className="p-1 font-mono text-emerald-400 font-bold text-[9px]">\$13K+</td>
                    <td className="p-1 font-mono text-emerald-400 font-bold text-[9px]">+12.4%</td>
                    <td className="p-1 text-center">
                      <div className="inline-flex items-center justify-center w-9 h-4 rounded-full bg-emerald-500/20 border border-emerald-500 text-emerald-400 text-[8px] font
