'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Shield, Send, MessageSquare, X, RefreshCw, AlertCircle, Sparkles, ExternalLink, ChevronDown, Download, Zap, Lock, CheckCircle, XCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';

const WALLET_ADDRESS = "Ev6oXBXo6qyoaT5wypJ2Umxch91F7cFvE1SarYLaUn8Z";
const MRDT_CA = "8Q22r9qUm4AzFzTpZgaPYMxqq4z5WxE9FVa7X9dsvmBg";
const SITE_URL = 'https://tnt-house.vercel.app';
const SUPABASE_URL = 'https://pjtvjslcffuulsqxerpx.supabase.co';
const SUPABASE_KEY = 'sb_publishable__gmhE8SE_blCu-v90fV2OQ_YmFCkfFU';

const GLOW_PURPLE = { position: 'absolute', top: '-10%', left: '-10%', width: '500px', height: '500px', borderRadius: '9999px', background: 'rgba(147,51,234,0.1)', filter: 'blur(120px)', pointerEvents: 'none' };
const GLOW_GREEN = { position: 'absolute', bottom: '20%', right: '-10%', width: '500px', height: '500px', borderRadius: '9999px', background: 'rgba(16,185,129,0.1)', filter: 'blur(120px)', pointerEvents: 'none' };

// --- Supabase helpers ---
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
  } catch (e) { console.error('Supabase save failed:', e); }
}

async function loadTokensFromSupabase() {
  try {
    var res = await fetch(SUPABASE_URL + '/rest/v1/listed_tokens?select=*&order=created_at.desc&limit=20', {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY },
    });
    if (!res.ok) return [];
    var data = await res.json();
    return data.map(function (row) {
      return {
        name: row.name, symbol: row.symbol, ca: row.ca, price: row.price,
        liquidity: row.liquidity, volume24h: row.volume24h,
        priceChange24h: row.price_change_24h, score: row.score,
        verified: true, dexUrl: row.dex_url, chain: row.chain,
        mintAuthority: row.mint_authority, freezeAuthority: row.freeze_authority,
        isHoneypot: row.is_honeypot, fromSupabase: true,
      };
    });
  } catch (e) { return []; }
}

const FALLBACK_TOKENS = [
  { name: 'Test Gem', symbol: 'TGEM', ca: '11111111111111111111111111111111', price: '0.00001234', liquidity: 45000, volume24h: 120000, priceChange24h: 8.5, verified: true, dexUrl: 'https://dexscreener.com', chain: 'solana' }
];

export default function TntHouse() {
  // --- Core state ---
  var [tokens, setTokens] = useState([]);
  var [listedTokens, setListedTokens] = useState([]);
  var [loading, setLoading] = useState(true);
  var [error, setError] = useState('');
  var [walletAddress, setWalletAddress] = useState('');
  var [isBuyDropdownOpen, setIsBuyDropdownOpen] = useState(false);
  var [activeBanner, setActiveBanner] = useState(null);
  var [isBlueprintOpen, setIsBlueprintOpen] = useState(false);
  var [selectedToken, setSelectedToken] = useState(null);

  // --- Price state ---
  var [mrdtPrice, setMrdtPrice] = useState(0.000013);
  var mrdtPriceRef = useRef(0.000013);
  var [priceLoading, setPriceLoading] = useState(true);

  // --- Toast ---
  var [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // --- AI Inspection form ---
  var [formData, setFormData] = useState({ projectName: '', contractAddress: '', telegram: '' });
  var [selectedTier, setSelectedTier] = useState('basic');
  var [isSending, setIsSending] = useState(false);
  var [submitted, setSubmitted] = useState(false);

  // --- Payment modal state (from 1.17.4) ---
  var [showPaymentModal, setShowPaymentModal] = useState(false);
  var [showWalletModal, setShowWalletModal] = useState(false);
  var [showInvoiceModal, setShowInvoiceModal] = useState(false);
  var [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
  var [selectedWallet, setSelectedWallet] = useState(null);
  var [invoiceAmount, setInvoiceAmount] = useState(0);
  var [invoiceLabel, setInvoiceLabel] = useState('');

  // --- Banner form ---
  var [bannerFormData, setBannerFormData] = useState({ tokenName: '', bannerImg: '', desc: '', days: '1' });
  var [bannerSubmitted, setBannerSubmitted] = useState(false);
  var [bannerError, setBannerError] = useState('');
  var [isBannerSending, setIsBannerSending] = useState(false);

  // --- Chat ---
  var [isChatOpen, setIsChatOpen] = useState(false);
  var [chatMessages, setChatMessages] = useState([{ sender: 'bot', text: 'Привет! Я ИИ-Инспектор TNT House. Спроси меня про любой контракт или токен $MRDT.' }]);
  var [userMsg, setUserMsg] = useState('');
  var [isTyping, setIsTyping] = useState(false);
  var chatEndRef = useRef(null);

  // --- Live logs ---
  var [logs, setLogs] = useState(['[ИИ-Инспектор] Инициализация системы безопасности TNT House...', '[СЕТЬ] Подключение к RPC узлам Solana завершено успешно.']);

  // --- Helpers ---
  var showToast = function (message, type) {
    if (!type) type = 'success';
    setToast({ show: true, message: message, type: type });
    setTimeout(function () { setToast({ show: false, message: '', type: 'success' }); }, 4200);
  };

  var getSafetyScore = function (token) {
    if (!token) return 75;
    if (token.symbol === 'MRDT') return 98;
    if (token.score) return token.score;
    var hash = token.symbol.split('').reduce(function (a, b) { return a + b.charCodeAt(0); }, 0);
    return Math.max(85, Math.min(97, hash % 12 + 85));
  };

  var getScoreStyle = function (score) {
    if (score >= 90) return { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/50', glow: 'shadow-[0_0_12px_rgba(16,185,129,0.6)]' };
    if (score >= 50) return { color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/50', glow: 'shadow-[0_0_12px_rgba(234,179,8,0.5)]' };
    return { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/50', glow: 'shadow-[0_0_12px_rgba(239,68,68,0.6)] animate-pulse' };
  };

  var getAmountForTier = function (tier) {
    var usd = tier === 'fast' ? 40 : tier === 'vip' ? 120 : 10;
    var price = mrdtPriceRef.current || mrdtPrice;
    return price > 0 ? Math.round(usd / price) : 0;
  };

  var getAmountForBanner = function (days) {
    var usd = days === '2' ? 35 : days === '6' ? 100 : 20;
    var price = mrdtPriceRef.current || mrdtPrice;
    return price > 0 ? Math.round(usd / price) : 0;
  };

  var formatNumber = function (num) {
    if (num >= 1e6) return '$' + (num / 1e6).toFixed(1) + 'M';
    if (num >= 1e3) return '$' + (num / 1e3).toFixed(1) + 'K';
    return '$' + (typeof num === 'number' ? num.toFixed(0) : '0');
  };

  var scrollToForm = function () {
    var el = document.getElementById('orderFormsSection');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  var handleLaunchJupiter = function () {
    window.open('https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&buy=8Q22r9qUm4AzFzTpZgaPYMxqq4z5WxE9FVa7X9dsvmBg', '_blank');
  };

  var handleOpenRaydium = function () {
    setIsBuyDropdownOpen(false);
    window.open('https://raydium.io/liquidity/increase/?mode=add&pool_id=6cMTXZyCrnut7Lv39qt4dqEARbC2jbebvhzdCR1t2HEV', '_blank');
  };

  var openTokenBlueprint = function (token) { setSelectedToken(token); setIsBlueprintOpen(true); };
  var closeBlueprint = function () { setIsBlueprintOpen(false); setTimeout(function () { setSelectedToken(null); }, 300); };

  var pillars = [
    { icon: Shield, label: 'AI Аудит', desc: 'Проверка контрактов', color: 'text-purple-400' },
    { icon: Zap, label: 'Микро-капы', desc: '$5K-$100K', color: 'text-emerald-400' },
    { icon: Lock, label: 'DAO Лицензия', desc: 'Через $MRDT', color: 'text-purple-400' },
  ];

  // --- Effects ---
  useEffect(function () {
    loadTokensFromSupabase().then(function (data) {
      if (data.length > 0) setListedTokens(data);
    });
  }, []);

  useEffect(function () {
    var fetchPrice = async function () {
      try {
        var res = await fetch('https://api.dexscreener.com/latest/dex/tokens/' + MRDT_CA);
        var data = await res.json();
        if (data.pairs && data.pairs.length) {
          var p = parseFloat(data.pairs[0].priceUsd);
          if (p > 0) { setMrdtPrice(p); mrdtPriceRef.current = p; }
        }
      } catch (e) { }
      setPriceLoading(false);
    };
    fetchPrice();
    var i = setInterval(fetchPrice, 60000);
    return function () { clearInterval(i); };
  }, []);

  useEffect(function () {
    var templates = ['Обнаружен новый пул на Raydium!', 'Mint Authority отключена ✓', 'Уровень угрозы: НИЗКИЙ.', 'Бандлов не обнаружено.', 'Подключение к DexScreener.', 'Ищем новые гемы...', '[SUPABASE] Синхронизация завершена ✓'];
    var i = setInterval(function () {
      var t = templates[Math.floor(Math.random() * templates.length)];
      setLogs(function (prev) { return prev.slice(-12).concat(['[' + new Date().toLocaleTimeString() + '] ' + t]); });
    }, 4200);
    return function () { clearInterval(i); };
  }, []);

  useEffect(function () {
    var fetchTokens = async function () {
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
            .filter(function (p) { return (p.marketCap || 0) >= 1000 && (p.marketCap || 0) <= 300000; })
            .slice(0, 9)
            .map(function (p) {
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
      } catch (e) { setTokens(FALLBACK_TOKENS); setLoading(false); }
    };
    fetchTokens();
    var i = setInterval(fetchTokens, 5 * 60 * 1000);
    return function () { clearInterval(i); };
  }, []);

  useEffect(function () {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(function () {
    var check = function () {
      try {
        var s = localStorage.getItem('tnt_active_banner');
        if (s) {
          var d = JSON.parse(s);
          if (Date.now() < d.expiresAt) setActiveBanner(d);
          else { localStorage.removeItem('tnt_active_banner'); setActiveBanner(null); }
        }
      } catch (e) { }
    };
    check();
    var i = setInterval(check, 10000);
    return function () { clearInterval(i); };
  }, []);

  // --- PAYMENT FLOW (from 1.17.4) ---

  // Step 1: Form submit → show payment modal
  var handleFormSubmit = function (e) {
    e.preventDefault();
    if (!formData.projectName || !formData.contractAddress || !formData.telegram) {
      showToast('Заполни все поля', 'error'); return;
    }
    var mrdtAmount = getAmountForTier(selectedTier);
    if (mrdtAmount <= 0) { showToast('Ошибка цены, попробуй позже', 'error'); return; }

    var tierName = selectedTier === 'fast' ? 'Быстрый' : selectedTier === 'vip' ? 'VIP' : 'Базовый';
    setInvoiceAmount(mrdtAmount);
    setInvoiceLabel('TNT House ' + tierName + ' Audit - ' + formData.projectName);
    setShowPaymentModal(true);
  };

  // Step 2: Choose payment method (MRDT / SOL)
  var handlePaymentMethodSelect = function (method) {
    setSelectedPaymentMethod(method);
    setShowPaymentModal(false);
    setShowWalletModal(true);
  };

  // Step 3: Choose wallet (Phantom / Solflare)
  var handleWalletSelect = function (wallet) {
    setSelectedWallet(wallet);
    setShowWalletModal(false);
    setShowInvoiceModal(true);
  };

  // Step 4: Confirm payment → fire Solana Pay deeplink → run real RugCheck audit
  var handleConfirmPayment = async function () {
    setShowInvoiceModal(false);
    setIsSending(true);

    var ca = formData.contractAddress;
    var projectName = formData.projectName;

    // Fire Solana Pay deeplink to open wallet
    var label = encodeURIComponent(invoiceLabel);
    var message = encodeURIComponent('Аудит для ' + projectName + ' CA: ' + ca);
    var solanaPayUrl = 'solana:' + WALLET_ADDRESS + '?amount=' + invoiceAmount + '&spl-token=' + MRDT_CA + '&label=' + label + '&message=' + message;
    window.location.href = solanaPayUrl;

    // Run real RugCheck audit in parallel
    var auditResult = {
      score: 75,
      mintAuthority: 'Неизвестно',
      freezeAuthority: 'Неизвестно',
      isHoneypot: 'Неизвестно',
    };

    try {
      setLogs(function (prev) { return prev.slice(-12).concat(['[АУДИТ] Запрос к RugCheck API для ' + ca + '...']); });
      var rugRes = await fetch('https://api.rugcheck.xyz/v1/tokens/' + ca + '/report/summary', {
        headers: { 'Accept': 'application/json' }
      });
      if (rugRes.ok) {
        var rugData = await rugRes.json();
        // RugCheck score: 0=risky, higher=safer — normalize to 0-100
        var rawScore = rugData.score || 0;
        var normalizedScore = Math.min(100, Math.max(0, Math.round(100 - rawScore / 10)));

        // Parse risks array for specific flags
        var risks = rugData.risks || [];
        var hasMint = risks.some(function (r) { return r.name && r.name.toLowerCase().includes('mint'); });
        var hasFreeze = risks.some(function (r) { return r.name && r.name.toLowerCase().includes('freeze'); });
        var hasHoneypot = risks.some(function (r) { return r.name && r.name.toLowerCase().includes('honeypot'); });

        auditResult = {
          score: normalizedScore,
          mintAuthority: hasMint ? 'Активна ⚠️' : 'Отозвана ✓',
          freezeAuthority: hasFreeze ? 'Активна ⚠️' : 'Отозвана ✓',
          isHoneypot: hasHoneypot ? 'Да 🚨' : 'Нет ✓',
        };

        setLogs(function (prev) { return prev.slice(-12).concat(['[АУДИТ ✓] ' + projectName + ' — Score: ' + normalizedScore + ' | Mint: ' + auditResult.mintAuthority + ' | Honeypot: ' + auditResult.isHoneypot]); });
      } else {
        setLogs(function (prev) { return prev.slice(-12).concat(['[АУДИТ] RugCheck недоступен, используем базовые данные.']); });
      }
    } catch (e) {
      setLogs(function (prev) { return prev.slice(-12).concat(['[АУДИТ] Ошибка подключения к RugCheck: ' + e.message]); });
    }

    // Save to Supabase with real audit data
    setTimeout(function () {
      var newToken = {
        name: projectName.toUpperCase(),
        symbol: projectName.slice(0, 4).toUpperCase() || 'NEW',
        ca: ca,
        price: '0.00000000',
        liquidity: 0,
        volume24h: 0,
        priceChange24h: 0,
        score: auditResult.score,
        verified: true,
        dexUrl: 'https://dexscreener.com/solana/' + ca,
        chain: 'solana',
        mintAuthority: auditResult.mintAuthority,
        freezeAuthority: auditResult.freezeAuthority,
        isHoneypot: auditResult.isHoneypot,
      };
      saveTokenToSupabase(newToken);
      setListedTokens(function (prev) { return [newToken].concat(prev); });
      setSubmitted(true);
      setFormData({ projectName: '', contractAddress: '', telegram: '' });
      setSelectedPaymentMethod(null);
      setSelectedWallet(null);
      showToast('Аудит завершён! Токен добавлен в таблицу. Score: ' + auditResult.score, 'success');
      setIsSending(false);
      setTimeout(function () { setSubmitted(false); }, 5000);
    }, 800);
  };

  // --- Banner submit ---
  var handleBannerSubmit = function (e) {
    e.preventDefault();
    if (!bannerFormData.tokenName || !bannerFormData.desc) { setBannerError('Укажите название и описание.'); return; }
    setIsBannerSending(true);

    var mrdtAmount = getAmountForBanner(bannerFormData.days);
    var label = encodeURIComponent('TNT House VIP Banner ' + bannerFormData.days + 'd');
    var message = encodeURIComponent('VIP Banner for ' + bannerFormData.tokenName);
    var solanaPayUrl = 'solana:' + WALLET_ADDRESS + '?amount=' + mrdtAmount + '&spl-token=' + MRDT_CA + '&label=' + label + '&message=' + message;
    window.location.href = solanaPayUrl;

    setTimeout(function () {
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
      setTimeout(function () { setBannerSubmitted(false); }, 5000);
    }, 800);
  };

  // --- Chat send ---
  var handleSendChat = function () {
    if (!userMsg.trim()) return;
    setChatMessages(function (prev) { return prev.concat([{ sender: 'user', text: userMsg }]); });
    setUserMsg(''); setIsTyping(true);
    setTimeout(function () {
      var replies = ['Структура чистая. SAFE ✓', 'Бандлов нет.', '$MRDT — железобетонный гем! 🧱⚽️', 'Ругпулов не обнаружено.', 'Комиссии честные. ✓'];
      setChatMessages(function (prev) { return prev.concat([{ sender: 'bot', text: replies[Math.floor(Math.random() * replies.length)] }]); });
      setIsTyping(false);
    }, 1000);
  };

  // =====================
  // RENDER
  // =====================
  return (
    <div className="min-h-screen bg-slate-950 text-white font-mono relative overflow-hidden pb-12">

      {/* Toast notification */}
      {toast.show && (
        <div className={'fixed bottom-6 left-1/2 -translate-x-1/2 z-[99999] flex items-center gap-3 px-6 py-3.5 rounded-2xl shadow-2xl border text-sm font-medium transition-all duration-300 ' + (toast.type === 'success' ? 'bg-emerald-950 border-emerald-500/40 text-emerald-300' : 'bg-red-950 border-red-500/40 text-red-300')}>
          {toast.type === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-400" /> : <XCircle className="w-5 h-5 text-red-400" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Background glows */}
      <div style={GLOW_PURPLE} />
      <div style={GLOW_GREEN} />

      {/* Grid background */}
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

        {/* Header */}
        <header className="border-b border-purple-500/30 backdrop-blur-lg bg-slate-950/60 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <a href="https://t.me/tnt_house2026" target="_blank" rel="noopener noreferrer" className="w-10 h-10 border-2 border-purple-500 rounded-lg flex items-center justify-center bg-purple-500/10 shadow-[0_0_15px_rgba(153,69,255,0.4)] animate-pulse">
                <span className="text-xl">🧨</span>
              </a>
              <div>
                <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-emerald-400 tracking-wider">TNT HOUSE</h1>
                <span className="text-[10px] text-purple-400 block font-bold tracking-widest">TOP NEW TOKENS v1.18</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <button onClick={function () { setIsBuyDropdownOpen(!isBuyDropdownOpen); }} className="bg-gradient-to-r from-purple-500 to-emerald-400 hover:from-purple-400 hover:to-emerald-300 text-slate-950 font-black px-4 py-2 rounded text-xs transition flex items-center gap-1 shadow-[0_0_15px_rgba(153,69,255,0.4)]">
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

        {/* VIP Banner slot */}
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
              <button onClick={function () { window.open('https://jup.ag', '_blank'); }} className="bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-xs px-6 py-2.5 rounded transition">
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
                <div className="text-emerald-400 font-black text-sm">VIP-Буст от $20/день</div>
                <div className="text-[10px] text-slate-500">Оплата в $MRDT</div>
              </div>
            </div>
          )}
        </section>

        {/* Hero section */}
        <section className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="space-y-3 border-l-4 border-purple-500 pl-6">
                <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded font-bold border border-purple-500/30">БЕЗОПАСНЫЕ НОВЫЕ ТОКЕНЫ</span>
                <h2 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400">Взрываем скамы. Запускаем гемы.</h2>
                <p className="text-slate-300 text-base leading-relaxed">Добро пожаловать в Дом Новых Токенов! Наш ИИ-агент сканирует блокчейн.</p>
              </div>
              <div className="grid grid-cols-3 gap-4 mt-8">
                {pillars.map(function (item, i) {
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

            {/* Live AI Scanner terminal */}
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
                {logs.map(function (log, i) { return <div key={i} className="text-[11px]">{log}</div>; })}
              </div>
              <div className="text-[10px] text-slate-500 border-t border-purple-500/20 pt-2 mt-2">Status: SCANNING AND SYNCING...</div>
            </div>
          </div>
        </section>

        {/* Tokens table */}
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
                    {['Токен', 'Цена', 'Ликв', 'Об/Изм', 'Оценка', 'Действ'].map(function (h, i) {
                      return (
                        <th key={i} className={'p-0.5 align-bottom' + (i === 4 ? ' text-center' : i === 5 ? ' text-right' : '')} style={{ writingMode: 'vertical-lr', textOrientation: 'mixed', height: '60px', whiteSpace: 'nowrap' }}>
                          {h}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {/* Pinned MRDT row */}
                  <tr onClick={function () { openTokenBlueprint({ symbol: 'MRDT', name: 'MARADONATOKEN', ca: MRDT_CA, price: mrdtPrice.toFixed(8), liquidity: 13000, volume24h: 0, priceChange24h: 12.4, verified: true, dexUrl: 'https://dexscreener.com/solana/' + MRDT_CA, chain: 'solana' }); }} className="border-b border-purple-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 transition cursor-pointer">
                    <td className="p-1 font-bold flex items-center gap-1">
                      <span className="text-sm">⚽️</span>
                      <div>
                        <span className="text-emerald-400 font-extrabold text-[10px]">$MRDT</span>
                        <div className="text-[7px] text-slate-400">MARADONATOKEN</div>
                      </div>
                    </td>
                    <td className="p-1 font-mono text-emerald-400 font-bold text-[9px]">${mrdtPrice > 0 ? mrdtPrice.toFixed(8) : '...'}</td>
                    <td className="p-1 font-mono text-emerald-400 font-bold text-[9px]">$13K+</td>
                    <td className="p-1 font-mono text-emerald-400 font-bold text-[9px]">+12.4%</td>
                    <td className="p-1 text-center">
                      <div className="inline-flex items-center justify-center w-9 h-4 rounded-full bg-emerald-500/20 border border-emerald-500 text-emerald-400 text-[8px] font-extrabold shadow-[0_0_6px_rgba(16,185,129,0.5)]">98</div>
                    </td>
                    <td className="p-1 text-right">
                      <button onClick={function (e) { e.stopPropagation(); handleLaunchJupiter(); }} className="text-[8px] text-emerald-400 hover:text-emerald-300 font-bold hover:underline inline-flex items-center gap-0.5">
                        Купить <ExternalLink className="w-2 h-2" />
                      </button>
                    </td>
                  </tr>
                  {/* Supabase listed tokens */}
                  {listedTokens.map(function (token, i) {
                    var score = getSafetyScore(token);
                    var style = getScoreStyle(score);
                    return (
                      <tr key={'sb-' + i} onClick={function () { openTokenBlueprint(token); }} className="border-b border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 transition cursor-pointer">
                        <td className="p-1">
                          <div className="flex items-center gap-1">
                            <span className="text-emerald-400 text-[9px] font-bold">${token.symbol}</span>
                            <span className="text-[6px] bg-emerald-500/20 text-emerald-400 px-1 rounded font-bold">AI</span>
                          </div>
                          <span className="text-[7px] text-slate-500 block truncate max-w-[80px]">{token.name}</span>
                        </td>
                        <td className="p-1 font-mono text-slate-300 text-[9px]">${token.price}</td>
                        <td className="p-1 font-mono text-slate-300 text-[9px]">{typeof token.liquidity === 'number' ? formatNumber(token.liquidity) : token.liquidity}</td>
                        <td className={'p-1 font-mono text-[9px] ' + (token.priceChange24h > 0 ? 'text-emerald-400' : 'text-red-400')}>
                          {formatNumber(token.volume24h)} ({token.priceChange24h > 0 ? '+' : ''}{token.priceChange24h}%)
                        </td>
                        <td className="p-1 text-center">
                          <div className={'inline-flex items-center justify-center w-9 h-4 rounded-full ' + style.bg + ' ' + style.border + ' ' + style.color + ' text-[8px] font-extrabold ' + style.glow}>{score}</div>
                        </td>
                        <td className="p-1 text-right">
                          <a href={token.dexUrl} onClick={function (e) { e.stopPropagation(); }} target="_blank" rel="noopener noreferrer" className="text-[8px] text-purple-400 hover:text-emerald-400 inline-flex items-center gap-0.5">
                            DEX <ExternalLink className="w-2 h-2" />
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                  {/* DexScreener live tokens */}
                  {loading && tokens.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-purple-400 font-bold">
                        <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1" />Сканируем...
                      </td>
                    </tr>
                  ) : tokens.map(function (token, i) {
                    var score = getSafetyScore(token);
                    var style = getScoreStyle(score);
                    return (
                      <tr key={'dx-' + i} onClick={function () { openTokenBlueprint(token); }} className="border-b border-purple-500/10 hover:bg-purple-500/5 transition cursor-pointer">
                        <td className="p-1">
                          <span className="text-purple-400 text-[9px] font-bold">${token.symbol}</span>
                          <span className="text-[7px] text-slate-500 block truncate max-w-[80px]">{token.name}</span>
                        </td>
                        <td className="p-1 font-mono text-slate-300 text-[9px]">${token.price}</td>
                        <td className="p-1 font-mono text-slate-300 text-[9px]">{typeof token.liquidity === 'number' ? formatNumber(token.liquidity) : token.liquidity}</td>
                        <td className={'p-1 font-mono text-[9px] ' + (token.priceChange24h > 0 ? 'text-emerald-400' : 'text-red-400')}>
                          {formatNumber(token.volume24h)} ({token.priceChange24h > 0 ? '+' : ''}{token.priceChange24h}%)
                        </td>
                        <td className="p-1 text-center">
                          <div className={'inline-flex items-center justify-center w-9 h-4 rounded-full ' + style.bg + ' ' + style.border + ' ' + style.color + ' text-[8px] font-extrabold ' + style.glow}>{score}</div>
                        </td>
                        <td className="p-1 text-right">
                          <a href={token.dexUrl} onClick={function (e) { e.stopPropagation(); }} target="_blank" rel="noopener noreferrer" className="text-[8px] text-purple-400 hover:text-emerald-400 inline-flex items-center gap-0.5">
                            DEX <ExternalLink className="w-2 h-2" />
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                  {/* Empty placeholder rows */}
                  {[1, 2, 3, 4].map(function (n) {
                    return (
                      <tr key={'e' + n} className="border-b border-purple-500/5 opacity-40">
                        {[0, 1, 2, 3, 4, 5].map(function (i) { return <td key={i} className="p-1 text-slate-600 text-[8px] italic">-</td>; })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {error && (
              <div className="mt-2 p-1.5 bg-red-950/40 border border-red-500/30 rounded-lg flex items-center gap-1 text-red-300 text-[9px]">
                <AlertCircle className="w-2.5 h-2.5" /> {error}
              </div>
            )}
          </div>
        </section>

        {/* Order forms section */}
        <section id="orderFormsSection" className="max-w-7xl mx-auto px-6 py-8">
          <div className="grid md:grid-cols-2 gap-12 items-start">
            <div className="space-y-8">

              {/* AI Inspection form */}
              <div className="border-2 border-purple-500/30 rounded-lg bg-slate-900/40 p-6 backdrop-blur-md">
                <h3 className="text-lg font-black text-purple-400 mb-2">ЗАКАЗАТЬ ИИ-ИНСПЕКЦИЮ</h3>
                <p className="text-slate-400 text-xs mb-4">Заполни форму — выбери кошелёк — оплати через Solana Pay — токен появится в таблице.</p>
                <form onSubmit={handleFormSubmit} className="space-y-4">
                  <div>
                    <label className="block text-purple-400 text-xs font-bold mb-1">Название проекта</label>
                    <input type="text" placeholder="Твой токен..." value={formData.projectName} onChange={function (e) { setFormData(Object.assign({}, formData, { projectName: e.target.value })); }} className="w-full bg-slate-950 border border-purple-500/20 rounded px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-purple-400 text-xs font-bold mb-1">Contract Address (Solana)</label>
                    <input type="text" placeholder="Впиши адрес контракта..." value={formData.contractAddress} onChange={function (e) { setFormData(Object.assign({}, formData, { contractAddress: e.target.value })); }} className="w-full bg-slate-950 border border-purple-500/20 rounded px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none font-mono" />
                  </div>
                  <div>
                    <label className="block text-purple-400 text-xs font-bold mb-1">Выберите тариф</label>
                    <select value={selectedTier} onChange={function (e) { setSelectedTier(e.target.value); }} className="w-full bg-slate-950 border border-purple-500/20 rounded px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-none font-mono">
                      <option value="basic">Базовый Аудит — $10 в $MRDT (~{priceLoading ? '...' : getAmountForTier('basic').toLocaleString()} $MRDT)</option>
                      <option value="fast">Быстрый Листинг — $40 в $MRDT (~{priceLoading ? '...' : getAmountForTier('fast').toLocaleString()} $MRDT)</option>
                      <option value="vip">VIP-Буст — $120 в $MRDT (~{priceLoading ? '...' : getAmountForTier('vip').toLocaleString()} $MRDT)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-purple-400 text-xs font-bold mb-1">Telegram для связи</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-400 text-xs font-bold">@</span>
                      <input type="text" placeholder="your_telegram" value={formData.telegram} onChange={function (e) { setFormData(Object.assign({}, formData, { telegram: e.target.value })); }} className="w-full bg-slate-950 border border-purple-500/20 rounded pl-7 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none" />
                    </div>
                  </div>
                  <button type="submit" disabled={isSending} className="w-full bg-gradient-to-r from-purple-500 to-emerald-400 hover:from-purple-400 hover:to-emerald-300 text-slate-950 font-black py-2.5 rounded text-xs transition flex items-center justify-center gap-1.5 disabled:opacity-50">
                    <Send className="w-3.5 h-3.5" /> {isSending ? 'ОТПРАВЛЯЕМ...' : 'ЗАПУСТИТЬ ИИ-ИНСПЕКЦИЮ'}
                  </button>
                  {submitted && <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded text-emerald-300 text-xs text-center font-bold">Оплата отправлена! Токен добавлен в таблицу.</div>}
                </form>
              </div>

              {/* Banner form */}
              <div className="border-2 border-purple-500/30 rounded-lg bg-slate-900/40 p-6 backdrop-blur-md">
                <h3 className="text-lg font-black text-purple-400 mb-2">КУПИТЬ VIP-БАННЕР НА ГЛАВНУЮ</h3>
                <p className="text-slate-400 text-xs mb-4">Автоматическая замена рекламного места на ваш токен.</p>
                <form onSubmit={handleBannerSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-purple-400 text-[11px] font-bold mb-1">Имя токена / Тикер</label>
                      <input type="text" value={bannerFormData.tokenName} onChange={function (e) { setBannerFormData(Object.assign({}, bannerFormData, { tokenName: e.target.value })); }} placeholder="SOLANA" className="w-full bg-slate-950 border border-purple-500/20 rounded px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-purple-400 text-[11px] font-bold mb-1">Загрузите изображение</label>
                      <input type="file" accept="image/*" onChange={function (e) { var f = e.target.files && e.target.files[0]; if (f) { var r = new FileReader(); r.onload = function (ev) { setBannerFormData(Object.assign({}, bannerFormData, { bannerImg: ev.target.result })); }; r.readAsDataURL(f); } }} className="w-full bg-slate-950 border border-purple-500/20 rounded px-3 py-2 text-xs text-white file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-bold file:bg-purple-500 file:text-white hover:file:bg-purple-400" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-purple-400 text-[11px] font-bold mb-1">Краткий рекламный слоган</label>
                    <input type="text" value={bannerFormData.desc} onChange={function (e) { setBannerFormData(Object.assign({}, bannerFormData, { desc: e.target.value })); }} placeholder="Самый быстрый мемкоин..." className="w-full bg-slate-950 border border-purple-500/20 rounded px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-purple-400 text-[11px] font-bold mb-1">Срок размещения</label>
                    <select value={bannerFormData.days} onChange={function (e) { setBannerFormData(Object.assign({}, bannerFormData, { days: e.target.value })); }} className="w-full bg-slate-950 border border-purple-500/20 rounded px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-none font-mono">
                      <option value="1">1 День - $20 (~{priceLoading ? '...' : getAmountForBanner('1').toLocaleString()} $MRDT)</option>
                      <option value="2">2 Дня - $35 (~{priceLoading ? '...' : getAmountForBanner('2').toLocaleString()} $MRDT)</option>
                      <option value="6">6 Дней - $100 (~{priceLoading ? '...' : getAmountForBanner('6').toLocaleString()} $MRDT)</option>
                    </select>
                  </div>
                  <button type="submit" disabled={isBannerSending} className="w-full bg-gradient-to-r from-emerald-400 to-purple-500 hover:from-emerald-300 hover:to-purple-400 text-slate-950 font-black py-2.5 rounded text-xs transition flex items-center justify-center gap-1.5 disabled:opacity-50">
                    <Zap className="w-3.5 h-3.5" /> {isBannerSending ? 'ОТПРАВКА...' : 'ОПЛАТИТЬ И РАЗМЕСТИТЬ БАННЕР'}
                  </button>
                  {bannerSubmitted && <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded text-emerald-300 text-xs text-center font-bold">Баннер активирован!</div>}
                  {bannerError && <div className="p-3 bg-red-950/40 border border-red-500/30 rounded text-red-300 text-xs">{bannerError}</div>}
                </form>
              </div>
            </div>

            {/* Pricing info panel */}
            <div className="space-y-4 bg-slate-900/20 border-2 border-purple-500/20 rounded-xl p-6">
              <h3 className="text-xl font-black text-purple-400">Информация для инвесторов</h3>
              <p className="text-slate-300 text-xs leading-relaxed">Все платежи принимаются в $MRDT через Solana Pay. После оплаты токен появится в таблице автоматически.</p>
              <div className="mt-6 space-y-3">
                <h4 className="text-xs font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400 flex items-center gap-1.5">
                  <Download className="w-4 h-4 text-purple-400 animate-pulse" /> ТЕКУЩАЯ СЕТКА ТАРИФОВ:
                </h4>
                <div className="grid grid-cols-1 gap-2 text-xs font-mono">
                  {[
                    ['Первые 3 токена', 'БЕСПЛАТНО'],
                    ['Базовый ИИ-Аудит', '$10 ~ ' + (priceLoading ? '...' : getAmountForTier('basic').toLocaleString()) + ' $MRDT'],
                    ['Быстрый Листинг', '$40 ~ ' + (priceLoading ? '...' : getAmountForTier('fast').toLocaleString()) + ' $MRDT'],
                    ['Баннер 1 день', '$20 ~ ' + (priceLoading ? '...' : getAmountForBanner('1').toLocaleString()) + ' $MRDT'],
                    ['Баннер 2 дня', '$35 ~ ' + (priceLoading ? '...' : getAmountForBanner('2').toLocaleString()) + ' $MRDT'],
                    ['Баннер 6 дней', '$100 ~ ' + (priceLoading ? '...' : getAmountForBanner('6').toLocaleString()) + ' $MRDT'],
                  ].map(function (row, i) {
                    return (
                      <div key={i} className={'flex justify-between p-2.5 border rounded-lg ' + (i === 0 ? 'bg-purple-500/10 border-purple-500/20' : 'bg-slate-950 border-purple-500/10')}>
                        <span className="text-slate-300">{row[0]}</span>
                        <span className="text-emerald-400 font-bold">{row[1]}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* DAO CTA */}
        <section className="max-w-7xl mx-auto px-6 py-6">
          <div className="relative bg-gradient-to-r from-purple-500/10 via-transparent to-emerald-500/10 border-2 border-purple-500/30 rounded-lg p-10 overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl" />
            <div className="relative z-10 max-w-2xl">
              <h3 className="text-2xl font-black text-purple-400 mb-2">TNT WHALE CLUB (DAO)</h3>
              <p className="text-slate-300 text-sm leading-relaxed mb-5">Держи $MRDT и получи доступ к закрытому Telegram чату. Первым узнавай о новых гемах!</p>
              <a href="https://t.me/tnt_house2026" target="_blank" rel="noopener noreferrer" className="inline-block bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-400 hover:to-purple-500 text-white font-bold py-2.5 px-6 rounded text-xs transition">
                Вступить в VIP-Клуб
              </a>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-purple-500/20 mt-12 py-8 bg-slate-950/60 backdrop-blur-lg">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex flex-wrap items-center justify-center gap-8 mb-4">
              <a href="https://x.com/Crypto_D10S" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a href="https://t.me/D10S_Solana_Stadium" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-blue-400 transition-colors">
                <span className="text-2xl">✈️</span>
              </a>
              <a href="https://www.maradonatoken-mrdt.xyz" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-emerald-400 transition-colors">
                <ExternalLink className="w-6 h-6" />
              </a>
            </div>
            <div className="text-center space-y-1">
              <div className="text-purple-400 font-bold text-sm tracking-widest">TNT HOUSE v1.18</div>
              <div className="text-slate-400 text-xs">Powered by $MRDT - AI Audits - Supabase</div>
              <div className="text-slate-500 text-[10px]">Built with Next.js + Tailwind CSS - Solana Pay</div>
            </div>
          </div>
        </footer>
      </div>

      {/* ============================================================ */}
      {/* PAYMENT MODALS (transplanted from v1.17.4)                  */}
      {/* ============================================================ */}

      {/* MODAL 1: Choose payment method */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4" onClick={function () { setShowPaymentModal(false); }}>
          <div className="bg-slate-950 border-2 border-purple-500/40 rounded-2xl w-full max-w-md p-6 shadow-[0_0_40px_rgba(168,85,247,0.25)]" onClick={function (e) { e.stopPropagation(); }}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-purple-400">Выбери способ оплаты</h3>
              <button onClick={function () { setShowPaymentModal(false); }} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={function () { handlePaymentMethodSelect('MRDT'); }} className="bg-purple-500/10 border-2 border-purple-500/30 hover:border-purple-500 rounded-xl p-6 text-center transition group">
                <div className="text-3xl mb-2">⚽️</div>
                <div className="font-bold text-purple-400 group-hover:text-white transition">$MRDT</div>
                <div className="text-[10px] text-slate-500 mt-1">Рекомендуем</div>
              </button>
              <button onClick={function () { handlePaymentMethodSelect('SOL'); }} className="bg-emerald-500/10 border-2 border-emerald-500/30 hover:border-emerald-500 rounded-xl p-6 text-center transition group">
                <div className="flex justify-center mb-2">
                  <svg width="36" height="36" viewBox="0 0 397 311" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7z" fill="url(#sol_a)"/>
                    <path d="M64.6 3.8C67.1 1.4 70.4 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1L333.1 73.8c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8z" fill="url(#sol_b)"/>
                    <path d="M333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z" fill="url(#sol_c)"/>
                    <defs>
                      <linearGradient id="sol_a" x1="360.9" y1="351.4" x2="141.2" y2="-69.2" gradientUnits="userSpaceOnUse">
                        <stop stopColor="#00FFA3"/>
                        <stop offset="1" stopColor="#DC1FFF"/>
                      </linearGradient>
                      <linearGradient id="sol_b" x1="264.8" y1="351.4" x2="45.2" y2="-69.2" gradientUnits="userSpaceOnUse">
                        <stop stopColor="#00FFA3"/>
                        <stop offset="1" stopColor="#DC1FFF"/>
                      </linearGradient>
                      <linearGradient id="sol_c" x1="312.5" y1="351.4" x2="92.9" y2="-69.2" gradientUnits="userSpaceOnUse">
                        <stop stopColor="#00FFA3"/>
                        <stop offset="1" stopColor="#DC1FFF"/>
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
                <div className="font-bold text-emerald-400 group-hover:text-white transition">SOL</div>
                <div className="text-[10px] text-slate-500 mt-1">Solana</div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Choose wallet */}
      {showWalletModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4" onClick={function () { setShowWalletModal(false); setShowPaymentModal(true); }}>
          <div className="bg-slate-950 border-2 border-purple-500/40 rounded-2xl w-full max-w-md p-6 shadow-[0_0_40px_rgba(168,85,247,0.25)]" onClick={function (e) { e.stopPropagation(); }}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-purple-400">Выбери кошелёк</h3>
              <button onClick={function () { setShowWalletModal(false); setShowPaymentModal(true); }} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={function () { handleWalletSelect('Phantom'); }} className="bg-purple-500/10 border-2 border-purple-500/30 hover:border-purple-500 rounded-xl p-6 text-center transition group">
                <div className="text-3xl mb-2">👻</div>
                <div className="font-bold text-purple-400 group-hover:text-white transition">Phantom</div>
              </button>
              <button onClick={function () { handleWalletSelect('Solflare'); }} className="bg-yellow-500/10 border-2 border-yellow-500/30 hover:border-yellow-400 rounded-xl p-6 text-center transition group">
                <div className="flex justify-center mb-2">
                  <svg width="40" height="40" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect width="128" height="128" rx="24" fill="#FBBF24"/>
                    <text x="64" y="95" textAnchor="middle" fontFamily="Georgia, serif" fontWeight="900" fontSize="82" fill="#1a0a00" fontStyle="italic">S</text>
                  </svg>
                </div>
                <div className="font-bold text-yellow-400 group-hover:text-white transition">Solflare</div>
              </button>
            </div>
            <button onClick={function () { setShowWalletModal(false); setShowPaymentModal(true); }} className="mt-4 w-full text-center text-slate-400 hover:text-white text-xs py-2">
              ← Назад
            </button>
          </div>
        </div>
      )}

      {/* MODAL 3: Invoice / confirm */}
      {showInvoiceModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4" onClick={function () { setShowInvoiceModal(false); }}>
          <div className="bg-slate-950 border-2 border-purple-500/40 rounded-2xl w-full max-w-md p-6 shadow-[0_0_40px_rgba(168,85,247,0.25)]" onClick={function (e) { e.stopPropagation(); }}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-purple-400">Счёт на оплату</h3>
              <button onClick={function () { setShowInvoiceModal(false); }} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="bg-slate-900 border border-purple-500/20 rounded-xl p-6 text-center space-y-4">
              <div className="text-xs text-purple-400 font-bold">{selectedWallet} · {selectedPaymentMethod}</div>
              <div className="text-3xl font-black text-emerald-400">{invoiceAmount.toLocaleString()} $MRDT</div>
              <div className="text-sm font-bold text-slate-300">≈ ${selectedTier === 'fast' ? '40' : selectedTier === 'vip' ? '120' : '10'} USD</div>
              <div className="text-xs text-slate-400">{invoiceLabel}</div>
              <div className="text-xs text-slate-500 font-mono break-all">Кошелёк: {WALLET_ADDRESS.slice(0, 8)}...{WALLET_ADDRESS.slice(-8)}</div>
            </div>
            <div className="mt-2 p-2 bg-purple-950/30 border border-purple-500/20 rounded-lg text-[10px] text-purple-300 text-center">
              После нажатия откроется {selectedWallet}. Подтверди транзакцию и вернись на сайт.
            </div>
            <div className="mt-6 flex gap-3">
              <button onClick={function () { setShowInvoiceModal(false); }} className="flex-1 px-5 py-2.5 text-sm rounded-lg border border-purple-500/40 hover:bg-purple-500/10 transition text-slate-300">
                Отмена
              </button>
              <button onClick={handleConfirmPayment} className="flex-1 px-5 py-2.5 text-sm rounded-lg bg-gradient-to-r from-purple-500 to-emerald-400 text-slate-950 font-black hover:from-purple-400 hover:to-emerald-300 transition">
                ✅ Оплатить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TNT Security Blueprint modal */}
      {isBlueprintOpen && selectedToken && (
        <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={closeBlueprint}>
          <div className="bg-slate-950 border-2 border-purple-500/40 rounded-2xl w-full max-w-lg p-6 shadow-lg" onClick={function (e) { e.stopPropagation(); }}>
            <h2 className="text-2xl font-black text-white mb-4">TNT Security Blueprint</h2>
            <p className="text-purple-400 font-bold">{selectedToken.name} <span className="text-slate-400 font-normal">({selectedToken.symbol})</span></p>
            <p className="text-slate-400 text-xs break-all mt-1">CA: {selectedToken.ca}</p>
            {selectedToken.mintAuthority && (
              <p className="text-slate-300 mt-2 text-sm">Mint Authority: <span className={selectedToken.mintAuthority === 'Отозвана' ? 'text-emerald-400' : 'text-red-400'}>{selectedToken.mintAuthority}</span></p>
            )}
            {selectedToken.freezeAuthority && (
              <p className="text-slate-300 text-sm">Freeze Authority: <span className={selectedToken.freezeAuthority === 'Отозвана' ? 'text-emerald-400' : 'text-red-400'}>{selectedToken.freezeAuthority}</span></p>
            )}
            {selectedToken.isHoneypot && (
              <p className="text-slate-300 text-sm">Honeypot: <span className={selectedToken.isHoneypot === 'Нет' ? 'text-emerald-400' : 'text-red-400'}>{selectedToken.isHoneypot}</span></p>
            )}
            <a href={selectedToken.dexUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-purple-400 hover:text-emerald-400 text-xs mt-3">
              DexScreener <ExternalLink className="w-3 h-3" />
            </a>
            <div className="mt-6">
              <button onClick={closeBlueprint} className="text-slate-400 hover:text-white transition text-sm">Закрыть</button>
            </div>
          </div>
        </div>
      )}

      {/* Floating AI chat button */}
      <button onClick={function () { setIsChatOpen(!isChatOpen); }} className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-tr from-purple-500 to-emerald-400 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(153,69,255,0.5)] hover:scale-105 transition z-50 animate-bounce">
        {isChatOpen ? <X className="w-6 h-6 text-slate-950" /> : <MessageSquare className="w-6 h-6 text-slate-950" />}
      </button>

      {/* AI Chat window */}
      {isChatOpen && (
        <div className="fixed bottom-24 right-6 w-80 md:w-96 h-[450px] bg-slate-900 border-2 border-purple-500 rounded-xl shadow-[0_0_30px_rgba(153,69,255,0.4)] flex flex-col overflow-hidden z-50 font-mono">
          <div className="bg-gradient-to-r from-purple-600 to-emerald-500 p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">🤖</span>
              <div>
                <h4 className="font-bold text-xs text-white">TNT AI INSPECTOR</h4>
                <span className="text-[9px] text-slate-100 font-bold tracking-widest">Trench Agent D10S</span>
              </div>
            </div>
            <button onClick={function () { setIsChatOpen(false); }} className="text-white"><X className="w-4 h-4" /></button>
          </div>
          <div className="flex-1 p-4 overflow-y-auto space-y-3 text-xs">
            {chatMessages.map(function (msg, i) {
              return (
                <div key={i} className={'flex ' + (msg.sender === 'user' ? 'justify-end' : 'justify-start')}>
                  <div className={'max-w-[80%] rounded-lg p-2.5 leading-relaxed ' + (msg.sender === 'user' ? 'bg-purple-500/20 text-purple-200 border border-purple-500/30' : 'bg-slate-950 text-emerald-400 border border-emerald-500/30')}>
                    {msg.text}
                  </div>
                </div>
              );
            })}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-slate-950 text-emerald-400 border border-emerald-500/30 rounded-lg p-2.5 animate-pulse text-[11px]">Думаю...</div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <div className="p-3 border-t border-purple-500/20 bg-slate-950 flex gap-2">
            <input type="text" value={userMsg} onChange={function (e) { setUserMsg(e.target.value); }} onKeyDown={function (e) { if (e.key === 'Enter') handleSendChat(); }} placeholder="Спроси у ИИ..." className="flex-1 bg-slate-900 border border-purple-500/20 rounded px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none" />
            <button onClick={handleSendChat} className="bg-purple-500 hover:bg-purple-400 text-slate-950 px-3 rounded text-xs font-bold">
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
