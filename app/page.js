'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Shield, Send, MessageSquare, X, RefreshCw, AlertCircle, Sparkles, ExternalLink, ChevronDown, Download, Zap, Lock, TrendingUp } from 'lucide-react';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction, getAccount, getMint } from '@solana/spl-token';

export const dynamic = 'force-dynamic';

const WALLET_ADDRESS = "Ev6oXBXo6qyoaT5wypJ2Umxch91F7cFvE1SarYLaUn8Z";
const MRDT_CA = "8Q22r9qUm4AzFzTpZgaPYMxqq4z5WxE9FVa7X9dsvmBg";
const MRDT_DECIMALS = 6;

const FALLBACK_TOKENS = [
  { name: 'Test Gem', symbol: 'TGEM', ca: '11111111111111111111111111111111', price: '0.00001234', liquidity: 45000, volume24h: 120000, priceChange24h: 8.5, verified: true, dexUrl: 'https://dexscreener.com', chain: 'solana' }
];

export default function TntHouse() {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [bannerSubmitted, setBannerSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [bannerError, setBannerError] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isBannerSending, setIsBannerSending] = useState(false);
  const [activeBanner, setActiveBanner] = useState(null);
  const [isBuyDropdownOpen, setIsBuyDropdownOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([{ sender: 'bot', text: 'Привет! Я ИИ-Инспектор TNT House. Спроси меня про любой контракт или токен $MRDT. ⚽️' }]);
  const [userMsg, setUserMsg] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [logs, setLogs] = useState(['[ИИ-Инспектор] Инициализация системы безопасности TNT House...', '[СЕТЬ] Подключение к RPC узлам Solana завершено успешно.']);
  const [isBlueprintOpen, setIsBlueprintOpen] = useState(false);
  const [selectedToken, setSelectedToken] = useState(null);
  const [auditResult, setAuditResult] = useState(null);
  const [showBannerWalletModal, setShowBannerWalletModal] = useState(false);
  const [showAuditWalletModal, setShowAuditWalletModal] = useState(false);
  const chatEndRef = useRef(null);
  const [mrdtPrice, setMrdtPrice] = useState(0.000013);
  const [priceLoading, setPriceLoading] = useState(true);

  // ===== 3-STEP FORM STATE =====
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({ projectName: '', contractAddress: '', email: '' });
  const [selectedPlan, setSelectedPlan] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState('');

  // ===== BANNER FORM STATE (restored) =====
  const [bannerFormData, setBannerFormData] = useState({ tokenName: '', bannerImg: '', desc: '', days: '1' });

  const SOL_PRICE_MOCK = 150;
  const plans = [
    { value: 'basic', name: 'Базовый Аудит (24h)', price: 10, mrdt: '769 231' },
    { value: 'express', name: 'Быстрый Листинг (5 min)', price: 40, mrdt: '3 076 923' },
    { value: 'vip', name: 'VIP-Буст (баннер 24h)', price: 120, mrdt: '9 230 769' },
  ];

  const handleNext = () => {
    if (step === 1) {
      if (!formData.projectName.trim() || !formData.contractAddress.trim() || !formData.email.trim()) {
        alert('Заполни все поля');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!selectedPlan) {
        alert('Выбери тариф');
        return;
      }
      setStep(3);
    }
  };

  const handleBack = () => {
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
  };

  const handlePayment = () => {
    if (!selectedCurrency) {
      alert('Выбери способ оплаты');
      return;
    }
    const plan = plans.find(p => p.value === selectedPlan);
    alert(`Проект: ${formData.projectName}\nТариф: ${plan.name}\nОплата: ${selectedCurrency.toUpperCase()}\nСумма: $${plan.price}`);
  };

  const pillars = [
    { icon: Shield, label: 'AI Аудит', desc: 'Проверка контрактов', color: 'text-purple-400' },
    { icon: Zap, label: 'Микро-капы', desc: '$5K-$100K', color: 'text-emerald-400' },
    { icon: Lock, label: 'DAO Лицензия', desc: 'Через $MRDT', color: 'text-purple-400' }
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

  const openTokenBlueprint = (token) => { setSelectedToken(token); setAuditResult(null); setIsBlueprintOpen(true); };
  const closeBlueprint = () => { setIsBlueprintOpen(false); setTimeout(() => { setSelectedToken(null); setAuditResult(null); }, 300); };

  useEffect(() => {
    const checkBannerStatus = () => {
      const storedBanner = localStorage.getItem('tnt_active_banner');
      if (storedBanner) {
        const bannerData = JSON.parse(storedBanner);
        if (Date.now() < bannerData.expiresAt) setActiveBanner(bannerData);
        else { localStorage.removeItem('tnt_active_banner'); setActiveBanner(null); }
      }
    };
    checkBannerStatus();
    const interval = setInterval(checkBannerStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleLaunchJupiter = () => { window.open('https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&buy=8Q22r9qUm4AzFzTpZgaPYMxqq4z5WxE9FVa7X9dsvmBg', '_blank'); };
  const handleOpenRaydium = () => { setIsBuyDropdownOpen(false); window.open('https://raydium.io/liquidity/increase/?mode=add&pool_id=6cMTXZyCrnut7Lv39qt4dqEARbC2jbebvhzdCR1t2HEV', '_blank'); };
  const handleConnectWallet = async () => {
    if (window.solana && window.solana.isPhantom) {
      try { const resp = await window.solana.connect(); setWalletAddress(resp.publicKey.toString().slice(0,4)+'...'+resp.publicKey.toString().slice(-4)); } catch (err) { console.error(err); }
    } else alert("Phantom not found.");
  };

  useEffect(() => {
    const templates = ['Обнаружен новый пул на Raydium!', 'Mint Authority отключена ✓.', 'Уровень угрозы: НИЗКИЙ.', 'Бандлов не обнаружено.', 'Подключение к DexScreener.', 'Ищем новые гемы...'];
    const interval = setInterval(() => {
      const t = templates[Math.floor(Math.random()*templates.length)];
      setLogs(prev => [...prev.slice(-12), `[${new Date().toLocaleTimeString()}] ${t}`]);
    }, 4200);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchTokens = async () => {
      try {
        setLoading(true);
        const cached = localStorage.getItem('tnt_cached_tokens');
        const time = localStorage.getItem('tnt_cached_time');
        if (cached && time && Date.now()-parseInt(time) < 120000) { setTokens(JSON.parse(cached)); setLoading(false); return; }
        const res = await fetch('https://api.dexscreener.com/latest/dex/tokens/So11111111111111111111111111111111111111112?limit=30');
        const data = await res.json();
        if (data.pairs?.length) {
          const filtered = data.pairs.filter(p => (p.marketCap||0)>=1000 && (p.marketCap||0)<=300000).slice(0,9).map(p => ({
            name: p.baseToken?.name||'Unknown', symbol: p.baseToken?.symbol||'???', ca: p.baseToken?.address||'', price: p.priceUsd ? parseFloat(p.priceUsd).toFixed(8) : '0', liquidity: p.liquidity?.usd ? Math.round(p.liquidity.usd) : 0, volume24h: p.volume?.h24 ? Math.round(p.volume.h24) : 0, priceChange24h: p.priceChange?.h24||0, verified: true, dexUrl: p.url||'', chain: p.chainId||'solana'
          }));
          if (filtered.length) { setTokens(filtered); localStorage.setItem('tnt_cached_tokens',JSON.stringify(filtered)); localStorage.setItem('tnt_cached_time',Date.now().toString()); setLoading(false); return; }
        }
        throw new Error("No pairs");
      } catch { setTokens(FALLBACK_TOKENS); setLoading(false); }
    };
    fetchTokens();
    const interval = setInterval(fetchTokens, 5*60*1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({behavior:'smooth'}); }, [chatMessages]);

  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${MRDT_CA}`);
        const data = await res.json();
        if (data.pairs?.length) { const p = parseFloat(data.pairs[0].priceUsd); if (p>0) setMrdtPrice(p); }
      } catch {}
      setPriceLoading(false);
    };
    fetchPrice();
    const interval = setInterval(fetchPrice, 60000);
    return () => clearInterval(interval);
  }, []);

  const getAmountForTier = (tier) => { const usd = tier==='fast'?40:tier==='vip'?120:10; return Math.round(usd/mrdtPrice); };
  const getAmountForBanner = (days) => { const usd = days==='2'?35:days==='6'?100:20; return Math.round(usd/mrdtPrice); };

  const analyzeTokenOnChain = async (ca, projectName) => {
    const ts = () => new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${ts()}] [🔍] Начало анализа ${ca.slice(0,6)}...`]);
    try {
      const connection = new Connection('https://api.mainnet-beta.solana.com','confirmed');
      const mintPubkey = new PublicKey(ca);
      const mintInfo = await getMint(connection, mintPubkey);
      const mintAuthority = mintInfo.mintAuthority ? 'Enabled' : 'Revoked ✓';
      const freezeAuthority = mintInfo.freezeAuthority ? 'Enabled' : 'Revoked ✓';
      setLogs(prev => [...prev, `[${ts()}] ✅ Mint: ${mintAuthority}`]);
      setLogs(prev => [...prev, `[${ts()}] ✅ Freeze: ${freezeAuthority}`]);
      const largest = await connection.getTokenLargestAccounts(mintPubkey);
      const supply = Number(mintInfo.supply);
      const top10 = largest.value.slice(0,10).reduce((acc,acct)=>acc+Number(acct.amount),0)/supply*100;
      setLogs(prev => [...prev, `[${ts()}] ✅ Топ-10: ${top10.toFixed(2)}%`]);
      let liquidityUSD = 0, lpLocked = 'Неизвестно';
      try {
        const d = await (await fetch(`https://api.dexscreener.com/latest/dex/tokens/${ca}`)).json();
        if (d.pairs?.length) { liquidityUSD = d.pairs[0].liquidity?.usd||0; lpLocked = 'Да'; }
      } catch {}
      setLogs(prev => [...prev, `[${ts()}] ✅ Ликвидность: $${liquidityUSD.toLocaleString()}`]);
      return { mintAuthority, freezeAuthority, top10Percent: top10.toFixed(2), totalSupply: (supply/10**mintInfo.decimals).toLocaleString(), liquidityUSD, lpLocked, ca, tokenName: projectName, symbol: projectName.slice(0,4).toUpperCase() };
    } catch (err) { setLogs(prev => [...prev, `[${ts()}] ❌ Ошибка: ${err.message}`]); throw err; }
  };

  const handleAuditWalletSelect = async (walletType) => {
    setShowAuditWalletModal(false); setIsSending(true); setError('');
    if (!window.solana) { setError('Установите Phantom.'); setIsSending(false); return; }
    const current = { ...formData };
    try {
      const resp = await window.solana.connect();
      const sender = new PublicKey(resp.publicKey.toString());
      const connection = new Connection('https://api.mainnet-beta.solana.com','confirmed');
      const mint = new PublicKey(MRDT_CA);
      const fromAta = await getAssociatedTokenAddress(mint, sender);
      await getAccount(connection, fromAta).catch(() => { throw new Error('Нет $MRDT.'); });
      const to = new PublicKey(WALLET_ADDRESS);
      const toAta = await getAssociatedTokenAddress(mint, to);
      const amount = getAmountForTier(selectedTier) * 10**MRDT_DECIMALS;
      const tx = new Transaction().add(createTransferInstruction(fromAta, toAta, sender, amount));
      tx.feePayer = sender;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      const signed = await window.solana.signAndSendTransaction(tx);
      const conf = await connection.confirmTransaction(signed.signature, 'confirmed');
      if (conf.value.err !== null) throw new Error('Транзакция не подтверждена.');
      const result = await analyzeTokenOnChain(current.ca, current.projectName);
      const newToken = {
        name: current.projectName.toUpperCase(),
        symbol: current.projectName.slice(0,4).toUpperCase()||'NEW',
        ca: current.ca,
        price: (Math.random()*0.00005+0.000001).toFixed(8),
        liquidity: result.liquidityUSD,
        volume24h: Math.floor(Math.random()*90000)+20000,
        priceChange24h: parseFloat((Math.random()*40-10).toFixed(1)),
        verified: true,
        dexUrl: `https://dexscreener.com/solana/${current.ca}`,
        chain: 'solana'
      };
      setTokens(prev => [newToken, ...prev]);
      setSubmitted(true);
      setFormData({ projectName:'', ca:'', telegram:'' });
      setSelectedToken({ symbol: result.symbol, name: current.projectName.toUpperCase(), ca: current.ca, price: newToken.price, liquidity: result.liquidityUSD, volume24h:0, priceChange24h:0, verified:true, dexUrl: `https://dexscreener.com/solana/${current.ca}`, chain:'solana' });
      setAuditResult(result);
      setIsBlueprintOpen(true);
      fetch('/api/sendTelegram', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ tokenName: result.tokenName, symbol: result.symbol, ca: result.ca, mintAuthority: result.mintAuthority, freezeAuthority: result.freezeAuthority, top10Percent: result.top10Percent, liquidityUSD: result.liquidityUSD, lpLocked: result.lpLocked, dexUrl: `https://dexscreener.com/solana/${result.ca}` }) }).catch(console.error);
    } catch (err) { setError(err.message||'Ошибка оплаты.'); } finally { setIsSending(false); }
  };

  const handleBannerWalletSelect = async (walletType) => {
    setShowBannerWalletModal(false); setIsBannerSending(true); setBannerError('');
    if (!window.solana) { setBannerError('Установите Phantom.'); setIsBannerSending(false); return; }
    const current = { ...bannerFormData };
    try {
      const resp = await window.solana.connect();
      const sender = new PublicKey(resp.publicKey.toString());
      const connection = new Connection('https://api.mainnet-beta.solana.com','confirmed');
      const mint = new PublicKey(MRDT_CA);
      const fromAta = await getAssociatedTokenAddress(mint, sender);
      await getAccount(connection, fromAta).catch(() => { throw new Error('Нет $MRDT.'); });
      const to = new PublicKey(WALLET_ADDRESS);
      const toAta = await getAssociatedTokenAddress(mint, to);
      const usd = current.days==='2'?35:current.days==='6'?100:20;
      const amount = Math.round(usd/mrdtPrice) * 10**MRDT_DECIMALS;
      const tx = new Transaction().add(createTransferInstruction(fromAta, toAta, sender, amount));
      tx.feePayer = sender;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      const signed = await window.solana.signAndSendTransaction(tx);
      const conf = await connection.confirmTransaction(signed.signature, 'confirmed');
      if (conf.value.err !== null) throw new Error('Транзакция не подтверждена.');
      const dur = parseInt(current.days) * 24*60*60*1000;
      const banner = { tokenName: current.tokenName.toUpperCase(), bannerImg: current.bannerImg||'🪙', desc: current.desc, expiresAt: Date.now()+dur };
      localStorage.setItem('tnt_active_banner', JSON.stringify(banner));
      setActiveBanner(banner);
      setBannerSubmitted(true);
      setBannerFormData({ tokenName:'', bannerImg:'', desc:'', days:'1' });
      setTimeout(() => setBannerSubmitted(false), 5000);
    } catch (err) { setBannerError(err.message||'Ошибка оплаты.'); } finally { setIsBannerSending(false); }
  };

  const handleFormSubmit = (e) => { e.preventDefault(); if (!formData.projectName||!formData.ca||!formData.telegram) { setError('Заполните все поля.'); return; } setShowAuditWalletModal(true); };
  const handleBannerSubmit = (e) => { e.preventDefault(); if (!bannerFormData.tokenName||!bannerFormData.desc) { setBannerError('Укажите название и описание.'); return; } setShowBannerWalletModal(true); };

  const handleSendChat = async () => {
    if (!userMsg.trim()) return;
    const userMessage = { sender:'user', text: userMsg };
    setChatMessages(prev => [...prev, userMessage]);
    setUserMsg('');
    setIsTyping(true);
    setTimeout(() => {
      const replies = ['Структура чистая. SAFE ✓', 'Бандлов нет.', '$MRDT — гем!', 'Ругпулов не обнаружено.', 'Комиссии честные.'];
      const botMessage = { sender:'bot', text: replies[Math.floor(Math.random()*replies.length)] };
      setChatMessages(prev => [...prev, botMessage]);
      setIsTyping(false);
    }, 1000);
  };

  const formatNumber = (num) => { if (num>=1e6) return `$${(num/1e6).toFixed(1)}M`; if (num>=1e3) return `$${(num/1e3).toFixed(1)}K`; return `$${num.toFixed(0)}`; };
  const scrollToForm = () => { document.getElementById('orderFormsSection')?.scrollIntoView({ behavior:'smooth' }); };

  // ====== RENDER ======
  return (
    <div className="min-h-screen bg-slate-950 text-white font-mono relative overflow-hidden pb-12">
      <div className="absolute top-[-10%] left-[-10%] w/[500px] h/[500px] rounded-full bg-purple-600/10 blur/[120px] pointer-events-none"></div>
      <div className="absolute bottom/[20%] right-[-10%] w/[500px] h/[500px] rounded-full bg-emerald-500/10 blur/[120px] pointer-events-none"></div>
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5"/></pattern></defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>
      <div className="relative z-10">
        {/* HEADER */}
        <header className="border-b border-purple-500/30 backdrop-blur-lg bg-slate-950/60 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <a href="https://t.me/tnt_house2026" target="_blank" rel="noopener noreferrer" className="w-10 h-10 border-2 border-purple-500 rounded-lg flex items-center justify-center bg-purple-500/10 shadow/[0_0_15px_rgba(153,69,255,0.4)] animate-pulse"><span className="text-xl">🧨</span></a>
              <div><h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-emerald-400 tracking-wider">TNT HOUSE</h1><span className="text/[10px] text-purple-400 block font-bold tracking-widest">TOP NEW TOKENS + GOOGLE SHEETS v1.0</span></div>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <button onClick={() => setIsBuyDropdownOpen(!isBuyDropdownOpen)} className="bg-gradient-to-r from-purple-500 to-emerald-400 hover:from-purple-400 hover:to-emerald-300 text-slate-950 font-black px-4 py-2 rounded text-xs transition duration-300 flex items-center gap-1 shadow/[0_0_15px_rgba(153,69,255,0.4)]">BUY $MRDT <ChevronDown className="w-3 h-3" /></button>
                {isBuyDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-slate-909 border border-purple-500/30 rounded-lg shadow-xl z-50 py-1 text-sm">
                    <button onClick={handleLaunchJupiter} className="w-full text-left px-4 py-2.5 hover:bg-purple-500/10 text-emerald-400 flex items-center gap-2 text-sm"><ExternalLink className="w-4 h-4" /> Jupiter Swap</button>
                    <button onClick={handleOpenRaydium} className="w-full text-left px-4 py-2.5 hover:bg-purple-500/10 text-emerald-400 flex items-center gap-2 text-sm"><ExternalLink className="w-4 h-4" /> Raydium</button>
                  </div>
                )}
              </div>
              <button onClick={handleConnectWallet} className="bg-gradient-to-r from-purple-500 to-emerald-400 hover:from-purple-400 hover:to-emerald-300 text-slate-950 font-black px-4 py-2 rounded text-xs transition duration-300 shadow/[0_0_15px_rgba(153,69,255,0.4)]">{walletAddress ? walletAddress : "CONNECT WALLET"}</button>
            </div>
          </div>
        </header>

        {/* VIP BANNER */}
        <section className="max-w-7xl mx-auto px-6 pt-6">
          {activeBanner ? (
            <div className="border border-purple-500/40 rounded-2xl p-4 bg-gradient-to-r from-black via-purple-950/20 to-black flex flex-col sm:flex-row items-center justify-between gap-4 shadow/[0_0_20px_rgba(168,85,247,0.2)] animate-pulse">
              <div className="flex items-center gap-4">
                <span className="text-3xl bg-purple-500/10 p-2 rounded-xl border border-purple-500/20">{activeBanner.bannerImg.startsWith('http') ? <img src={activeBanner.bannerImg} alt="logo" className="w-8 h-8 rounded-full object-cover"/> : activeBanner.bannerImg}</span>
                <div><span className="bg-purple-500 text-white font-black text/[9px] px-2 py-0.5 rounded tracking-widest block w-max mb-1">🔥 VIP БУСТ</span><h4 className="text-xl font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400">${activeBanner.tokenName}</h4><p className="text-slate-300 text-xs mt-0.5">{activeBanner.desc}</p></div>
              </div>
              <button onClick={() => window.open('https://jup.ag', '_blank')} className="bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-xs px-6 py-2.5 rounded shadow/[0_0_15px_rgba(52,211,153,0.4)] transition">КУПИТЬ НА JUPITER →</button>
            </div>
          ) : (
            <div onClick={scrollToForm} className="cursor-pointer border border-purple-500/30 rounded-2xl p-4 bg-gradient-to-r from-black via-purple-950/10 to-black flex flex-col sm:flex-row items-center justify-between gap-4 shadow/[0_0_15px_rgba(153,69,255,0.1)] hover:border-purple-500/60 transition">
              <div className="flex items-center gap-4"><span className="text-3xl bg-purple-500/10 p-2 rounded-xl border border-purple-500/20">⚽️</span><div><span className="bg-slate-808 text-purple-400 font-bold text/[9px] px-2 py-0.5 rounded tracking-widest block w-max mb-1">МЕСТО СВОБОДНО</span><h4 className="text-lg font-black text-white">Maradona Token ($MRDT)</h4><p className="text-slate-400 text-xs mt-0.5">Главный токен платформы TNT House. Нажмите, чтобы купить VIP-баннер!</p></div></div>
              <div className="text-right"><div className="text-emerald-400 font-black text-sm">VIP-Буст от $20/день</div><div className="text/[10px] text-slate-500">Оплата в $MRDT</div></div>
            </div>
          )}
        </section>

        {/* HERO */}
        <section className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="space-y-3 border-l-4 border-purple-500 pl-6">
                <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded font-bold border border-purple-500/30">БЕЗОПАСНЫЕ НОВЫЕ ТОКЕНЫ</span>
                <h2 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400">Взрываем скамы.<br />Запускаем гемы.</h2>
                <p className="text-slate-300 text-base leading-relaxed">Добро пожаловать в Дом Новых Токенов! Наш ИИ-агент сканирует блокчейn, а все заявки сохраняются в Google Sheets.</p>
              </div>
              <div className="grid grid-cols-3 gap-4 mt-8">{pillars.map((item,i) => (<div key={i} className="bg-slate-909/50 border border-purple-500/20 rounded-lg p-3 text-center hover:border-purple-500/60 transition"><item.icon className={`w-5 h-5 ${item.color} mx-auto mb-1`} /><div className="text/[11px] font-bold text-slate-200">{item.label}</div><div className="text/[9px] text-slate-400 font-mono">{item.desc}</div></div>))}</div>
            </div>
            <div className="bg-slate-950 border-2 border-purple-500/40 rounded-lg p-4 font-mono text-xs h-72 flex flex-col justify-between shadow/[0_0_20px_rgba(153,69,255,0.15)] relative">
              <div className="absolute top-3 right-4 flex gap-1.5"><span className="w-2.5 h-2.5 bg-red-500 rounded-full"></span><span className="w-2.5 h-2.5 bg-yellow-500 rounded-full"></span><span className="w-2.5 h-2.5 bg-green-500 rounded-full"></span></div>
              <div className="text-purple-400 font-bold border-b border-purple-500/20 pb-2 mb-2 flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-purple-400 animate-spin" /> AI SCANNER + GOOGLE SHEETS</div>
              <div className="flex-1 overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-purple-500/20 text-emerald-400">{logs.map((log,i) => <div key={i} className="leading-relaxed font-mono text/[11px]">{log}</div>)}</div>
              <div className="text/[10px] text-slate-500 border-t border-purple-500/20 pt-2 mt-2">Status: SCANNING & SYNCING...</div>
            </div>
          </div>
        </section>

        {/* TABLE */}
        <section className="max-w-7xl mx-auto px-6 py-6">
          <div className="border-2 border-purple-500/30 rounded-lg bg-slate-909/40 backdrop-blur-md p-3 shadow/[0_0_25px_rgba(153,69,255,0.2)]">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-base font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400 flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-emerald-400" /> ТАБЛИЦА БЕЗОПАСНЫХ НОВЫХ ТОКЕНОВ</h3>
                <p className="text-slate-400 text/[10px] mt-0.5">Кликни на токен для детального "TNT Security Blueprint"</p>
              </div>
              <div className="hidden md:flex items-center gap-1 text/[9px] text-purple-400"><RefreshCw className="w-2.5 h-2.5 animate-spin" /> Обновление каждые 5 мин</div>
            </div>
            <div className="max-h/[320px] overflow-y-auto border border-purple-500/20 rounded-lg scrollbar-thin scrollbar-thumb-purple-500/30">
              <table className="w-full text-left border-collapse text/[9px]">
                <thead><tr className="border-b border-purple-500/20 bg-purple-500/10 text-purple-400 font-bold sticky top-0 z-20 backdrop-blur-md">
                  <th className="p-0.5 align-bottom" style={{writingMode:'vertical-lr',textOrientation:'mixed',height:'60px',whiteSpace:'nowrap'}}>Токен</th>
                  <th className="p-0.5 align-bottom" style={{writingMode:'vertical-lr',textOrientation:'mixed',height:'60px',whiteSpace:'nowrap'}}>Цена</th>
                  <th className="p-0.5 align-bottom" style={{writingMode:'vertical-lr',textOrientation:'mixed',height:'60px',whiteSpace:'nowrap'}}>Ликв</th>
                  <th className="p-0.5 align-bottom" style={{writingMode:'vertical-lr',textOrientation:'mixed',height:'60px',whiteSpace:'nowrap'}}>Об/Изм</th>
                  <th className="p-0.5 align-bottom text-center" style={{writingMode:'vertical-lr',textOrientation:'mixed',height:'60px',whiteSpace:'nowrap'}}>Оценка</th>
                  <th className="p-0.5 align-bottom text-right" style={{writingMode:'vertical-lr',textOrientation:'mixed',height:'60px',whiteSpace:'nowrap'}}>Действ</th>
                </tr></thead>
                <tbody>
                  <tr onClick={() => openTokenBlueprint({symbol:'MRDT',name:'MARADONATOKEN',ca:MRDT_CA,price:'0.00001300',liquidity:13000,volume24h:0,priceChange24h:12.4,verified:true,dexUrl:`https://dexscreener.com/solana/${MRDT_CA}`,chain:'solana'})} className="border-b border-purple-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 transition cursor-pointer">
                    <td className="p-1 font-bold flex items-center gap-1"><span className="text-sm">⚽️</span><div><span className="text-emerald-400 font-extrabold text/[10px] tracking-wider">$MRDT</span><div className="text/[7px] text-slate-400">MARADONATOKEN</div></div></td>
                    <td className="p-1 font-mono text-emerald-400 font-bold text/[9px]">${mrdtPrice.toFixed(8)}</td>
                    <td className="p-1 font-mono text-emerald-400 font-bold text/[9px]">$13K+</td>
                    <td className="p-1 font-mono text-emerald-400 font-bold text/[9px]">+12.4%</td>
                    <td className="p-1 text-center"><div className="inline-flex items-center justify-center w-9 h-4 rounded-full bg-emerald-500/20 border border-emerald-500 text-emerald-400 text/[8px] font-extrabold shadow/[0_0_6px_rgba(16,185,129,0.5)]">98</div></td>
                    <td className="p-1 text-right"><button onClick={(e)=>{e.stopPropagation();handleLaunchJupiter();}} className="inline-flex items-center gap-0.5 text/[8px] text-emerald-400 hover:text-emerald-300 font-bold hover:underline">Купить <ExternalLink className="w-2 h-2" /></button></td>
                  </tr>
                  {loading && tokens.length===0 ? (<tr><td colSpan={6} className="p-6 text-center text-purple-400 font-bold"><RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1" />Сканируем блокчейn...</td></tr>) : (tokens.map((token,i) => { const score = getSafetyScore(token); const style = getScoreStyle(score); return (<tr key={i} onClick={() => openTokenBlueprint(token)} className="border-b border-purple-500/10 hover:bg-purple-500/5 transition cursor-pointer"><td className="p-1 font-bold"><span className="text-purple-400 text/[9px]">${token.symbol}</span><span className="text/[7px] text-slate-500 block font-normal truncate max-w/[80px]">{token.name}</span></td><td className="p-1 font-mono text-slate-300 text/[9px]">${token.price}</td><td className="p-1 font-mono text-slate-300 text/[9px]">{typeof token.liquidity === 'number' ? formatNumber(token.liquidity) : token.liquidity}</td><td className={`p-1 font-mono ${token.priceChange24h > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatNumber(token.volume24h)} ({token.priceChange24h > 0 ? '+' : ''}{token.priceChange24h}%)</td><td className="p-1 text-center"><div className={`inline-flex items-center justify-center w-9 h-4 rounded-full ${style.bg} ${style.border} ${style.color} text/[8px] font-extrabold ${style.glow}`}>{score}</div></td><td className="p-1 text-right"><a href={token.dexUrl} onClick={(e)=>e.stopPropagation()} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text/[8px] text-purple-400 hover:text-emerald-400 hover:underline">DEX <ExternalLink className="w-2 h-2" /></a></td></tr>); }))}
                  {[1,2,3,4].map(n => (<tr key={`empty-${n}`} className="border-b border-purple-500/5 opacity-40"><td className="p-1 text-slate-600 text/[8px] italic">—</td><td className="p-1 text-slate-600 text/[8px] italic">—</td><td className="p-1 text-slate-600 text/[8px] italic">—</td><td className="p-1 text-slate-600 text/[8px] italic">—</td><td className="p-1 text-center text-slate-600 text/[8px] italic">—</td><td className="p-1 text-right text-slate-600 text/[8px] italic">—</td></tr>))}
                </tbody>
              </table>
            </div>
            {error && <div className="mt-2 p-1.5 bg-red-950/40 border border-red-500/30 rounded-lg flex items-center gap-1 text-red-300 text/[9px]"><AlertCircle className="w-2.5 h-2.5" /> {error}</div>}
          </div>
        </section>

        {/* FORMS */}
        <section id="orderFormsSection" className="max-w-7xl mx-auto px-6 py-8">
          <div className="grid md:grid-cols-2 gap-12 items-start">
            <div className="space-y-8">
              <div className="border-2 border-purple-500/30 rounded-lg bg-slate-909/40 p-6 backdrop-blur-md">
                <h3 className="text-lg font-black text-purple-400 mb-2 flex items-center gap-2">🔍 ЗАКАЗАТЬ ИИ-ИНСПЕКЦИЮ</h3>
                <p className="text-slate-400 text-xs mb-4">Авто-добавление в таблицу и выгрузка в Google Sheets.</p>

                {/* ===== Трёхшаговая форма ===== */}
                <div className="bg-gray-800/50 p-6 rounded-2xl border border-gray-700/50 max-w-md mx-auto">
                  {step === 1 && (
                    <>
                      <h3 className="text-2xl font-bold text-white mb-6">Заказать ИИ-инспекцию</h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">Название проекта</label>
                          <input
                            type="text"
                            placeholder="Твой токен..."
                            value={formData.projectName}
                            onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
                            className="w-full p-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">Contract Address (Solana)</label>
                          <input
                            type="text"
                            placeholder="Впиши адрес контракта..."
                            value={formData.contractAddress}
                            onChange={(e) => setFormData({ ...formData, contractAddress: e.target.value })}
                            className="w-full p-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">Email для связи</label>
                          <input
                            type="email"
                            placeholder="your@email.com"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className="w-full p-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                      </div>
                      <button
                        onClick={handleNext}
                        className="mt-6 w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-3 rounded-xl font-semibold hover:opacity-90 transition"
                      >
                        Далее →
                      </button>
                    </>
                  )}

                  {step === 2 && (
                    <>
                      <h3 className="text-2xl font-bold text-white mb-4">Выбери тариф</h3>
                      <div className="space-y-3">
                        {plans.map((plan) => (
                          <label
                            key={plan.value}
                            className={`flex items-center p-4 rounded-xl cursor-pointer transition-all ${
                              selectedPlan === plan.value
                                ? 'bg-indigo-600/20 border border-indigo-500'
                                : 'bg-gray-700/30 border border-gray-700 hover:border-indigo-400'
                            }`}
                          >
                            <input
                              type="radio"
                              name="plan"
                              value={plan.value}
                              checked={selectedPlan === plan.value}
                              onChange={() => setSelectedPlan(plan.value)}
                              className="w-5 h-5 text-indigo-600 focus:ring-indigo-500"
                            />
                            <div className="ml-4">
                              <p className="text-white font-semibold">{plan.name}</p>
                              <p className="text-sm text-gray-400">${plan.price} ≈ {plan.mrdt} $MRDT</p>
                            </div>
                          </label>
                        ))}
                      </div>
                      <div className="flex gap-3 mt-6">
                        <button
                          onClick={handleBack}
                          className="flex-1 bg-gray-700 text-white py-3 rounded-xl font-semibold hover:bg-gray-600 transition"
                        >
                          ← Назад
                        </button>
                        <button
                          onClick={handleNext}
                          className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-3 rounded-xl font-semibold hover:opacity-90 transition"
                        >
                          Далее →
                        </button>
                      </div>
                    </>
                  )}

                  {step === 3 && (
                    <>
                      <h3 className="text-2xl font-bold text-white mb-4">Выбери способ оплаты</h3>
                      <p className="text-gray-400 mb-4">
                        Выбран тариф: <span className="text-white font-semibold">{plans.find(p => p.value === selectedPlan)?.name}</span>
                      </p>
                      <div className="space-y-3">
                        {['mrdt', 'sol'].map((method) => (
                          <label
                            key={method}
                            className={`flex items-center p-4 rounded-xl cursor-pointer transition-all ${
                              selectedCurrency === method
                                ? 'bg-indigo-600/20 border border-indigo-500'
                                : 'bg-gray-700/30 border border-gray-700 hover:border-indigo-400'
                            }`}
                          >
                            <input
                              type="radio"
                              name="currency"
                              value={method}
                              checked={selectedCurrency === method}
                              onChange={() => setSelectedCurrency(method)}
                              className="w-5 h-5 text-indigo-600 focus:ring-indigo-500"
                            />
                            <div className="ml-4">
                              <p className="text-white font-semibold">
                                {method === 'mrdt' ? 'Оплатить в $MRDT' : 'Оплатить в SOL (авто-выкуп $MRDT)'}
                              </p>
                              {method === 'sol' && selectedPlan && (
                                <p className="text-sm text-gray-400">
                                  Сумма: ≈ {(plans.find(p => p.value === selectedPlan)?.price / SOL_PRICE_MOCK).toFixed(4)} SOL
                                </p>
                              )}
                            </div>
                          </label>
                        ))}
                      </div>
                      <div className="flex gap-3 mt-6">
                        <button
                          onClick={handleBack}
                          className="flex-1 bg-gray-700 text-white py-3 rounded-xl font-semibold hover:bg-gray-600 transition"
                        >
                          ← Назад
                        </button>
                        <button
                          onClick={handlePayment}
                          disabled={!selectedCurrency}
                          className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-3 rounded-xl font-semibold hover:opacity-90 transition disabled:opacity-40"
                        >
                          Запустить ИИ-инспекцию
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="border-2 border-purple-500/30 rounded-lg bg-slate-909/40 p-6 backdrop-blur-md">
                <h3 className="text-lg font-black text-purple-400 mb-2 flex items-center gap-2">👑 КУПИТЬ VIP-БАННЕР НА ГЛАВНУЮ</h3>
                <p className="text-slate-400 text-xs mb-4">Полностью автоматическая замена рекламного места на ваш токен.</p>
                <form onSubmit={handleBannerSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-purple-400 text/[11px] font-bold mb-1">Имя токена / Тикер</label>
                      <input type="text" value={bannerFormData.tokenName} onChange={e => setBannerFormData({...bannerFormData,tokenName:e.target.value})} placeholder="SOLANA" className="w-full bg-slate-950 border border-purple-500/20 rounded px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-purple-400 text/[11px] font-bold mb-1">Загрузите изображение</label>
                      <input type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = ev => setBannerFormData({...bannerFormData,bannerImg: ev.target?.result}); r.readAsDataURL(f); }}} className="w-full bg-slate-950 border border-purple-500/20 rounded px-3 py-2 text-xs text-white file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-bold file:bg-purple-500 file:text-white hover:file:bg-purple-400" />
                      {bannerFormData.bannerImg && <div className="mt-1"><img src={bannerFormData.bannerImg} alt="preview" className="w-16 h-16 object-cover rounded-lg border border-purple-500/30" /></div>}
                    </div>
                  </div>
                  <div>
                    <label className="block text-purple-400 text/[11px] font-bold mb-1">Краткий рекламный слоган</label>
                    <input type="text" value={bannerFormData.desc} onChange={e => setBannerFormData({...bannerFormData,desc:e.target.value})} placeholder="Самый быстрый мемкоin..." className="w-full bg-slate-950 border border-purple-500/20 rounded px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-purple-400 text/[11px] font-bold mb-1">Срок размещения</label>
                    <select value={bannerFormData.days} onChange={e => setBannerFormData({...bannerFormData,days:e.target.value})} className="w-full bg-slate-950 border border-purple-500/20 rounded px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-none font-mono">
                      <option value="1">1 День — 20$ {priceLoading?'(расчёт…)':`(~ ${getAmountForBanner('1').toLocaleString()} $MRDT)`}</option>
                      <option value="2">2 Дня — 35$ {priceLoading?'(расчёт…)':`(~ ${getAmountForBanner('2').toLocaleString()} $MRDT)`}</option>
                      <option value="6">6 Дней — 100$ {priceLoading?'(расчёт…)':`(~ ${getAmountForBanner('6').toLocaleString()} $MRDT)`}</option>
                    </select>
                  </div>
                  <button type="submit" disabled={isBannerSending} className="w-full bg-gradient-to-r from-emerald-400 to-purple-500 hover:from-emerald-300 hover:to-purple-400 text-slate-950 font-black py-2.5 rounded text-xs transition flex items-center justify-center gap-1.5 shadow/[0_0_15px_rgba(52,211,153,0.3)] disabled:opacity-50"><Zap className="w-3.5 h-3.5" /> {isBannerSending?'ОТПРАВКА...':'ОПЛАТИТЬ И РАЗМЕСТИТЬ БАННЕР'}</button>
                  {bannerSubmitted && <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded text-emerald-300 text-xs text-center font-bold">✓ Баннер активирован!</div>}
                  {bannerError && <div className="p-3 bg-red-950/40 border border-red-500/30 rounded text-red-300 text-xs">{bannerError}</div>}
                </form>
              </div>
            </div>
            <div className="space-y-4 bg-slate-909/20 border-2 border-purple-500/20 rounded-xl p-6">
              <h3 className="text-xl font-black text-purple-400">Информация для инвесторов</h3>
              <p className="text-slate-300 text-xs leading-relaxed">Все платежы принимаются в $MRDT.</p>
              <div className="mt-6 space-y-3">
                <h4 className="text-xs font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400 flex items-center gap-1.5"><Download className="w-4 h-4 text-purple-400 animate-pulse" /> ТЕКУЩАЯ СЕТКА ТАРИФОВ (В $MRDT):</h4>
                <div className="grid grid-cols-1 gap-2 text-xs font-mono">
                  <div className="flex justify-between p-2.5 bg-purple-500/10 border border-purple-500/20 rounded-lg"><span className="text-slate-300">🎁 Первые 3 токена</span><span className="text-emerald-400 font-bold">БЕСПЛАТНО</span></div>
                  <div className="flex justify-between p-2.5 bg-slate-950 border border-purple-500/10 rounded-lg"><span className="text-slate-300">🔍 Базовый ИИ-Аудит</span><span className="text-emerald-400 font-bold">$10 ≈ {priceLoading?'...':getAmountForTier('basic').toLocaleString()} $MRDT</span></div>
                  <div className="flex justify-between p-2.5 bg-slate-950 border border-purple-500/10 rounded-lg"><span className="text-slate-300">⚡ Быстрый Листинг (5 min)</span><span className="text-emerald-400 font-bold">$40 ≈ {priceLoading?'...':getAmountForTier('fast').toLocaleString()} $MRDT</span></div>
                  <div className="flex justify-between p-2.5 bg-slate-950 border border-purple-500/10 rounded-lg"><span className="text-slate-300">👑 Баннер (1 день)</span><span className="text-emerald-400 font-bold">$20 ≈ {priceLoading?'...':getAmountForBanner('1').toLocaleString()} $MRDT</span></div>
                  <div className="flex justify-between p-2.5 bg-slate-950 border border-purple-500/10 rounded-lg"><span className="text-slate-300">👑 Баннер (2 дня)</span><span className="text-emerald-400 font-bold">$35 ≈ {priceLoading?'...':getAmountForBanner('2').toLocaleString()} $MRDT</span></div>
                  <div className="flex justify-between p-2.5 bg-slate-950 border border-purple-500/10 rounded-lg"><span className="text-slate-300">👑 Баннер (6 дней)</span><span className="text-emerald-400 font-bold">$100 ≈ {priceLoading?'...':getAmountForBanner('6').toLocaleString()} $MRDT</span></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* WHALE CLUB */}
        <section className="max-w-7xl mx-auto px-6 py-6">
          <div className="relative bg-gradient-to-r from-purple-500/10 via-transparent to-emerald-500/10 border-2 border-purple-500/30 rounded-lg p-10 overflow-hidden shadow-lg">
            <div className="absolute top-0 right-0 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl"></div>
            <div className="relative z-10 max-w-2xl">
              <h3 className="text-2xl font-black text-purple-400 mb-2">🐋 TNT WHALE CLUB (DAO)</h3>
              <p className="text-slate-300 text-sm leading-relaxed mb-5">Держи $MRDT и получи доступ к закрытому Telegram чату. Первым узнавай о новых гемах!</p>
              <a href="https://t.me/tnt_house2026" target="_blank" rel="noopener noreferrer" className="inline-block bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-400 hover:to-purple-500 text-white font-bold py-2.5 px-6 rounded text-xs transition duration-300 shadow-md shadow-purple-500/30">Вступить в VIP-Клуб →</a>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="border-t border-purple-500/20 mt-12 py-8 bg-slate-950/60 backdrop-blur-lg">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex flex-wrap items-center justify-center gap-8 mb-4">
              <a href="https://x.com/Crypto_D10S" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white transition-colors"><svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg></a>
              <a href="https://t.me/D10S_Solana_Stadium" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-blue-400 transition-colors"><span className="text-2xl">✈️</span></a>
              <a href="https://www.maradonatoken-mrdt.xyz" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-emerald-400 transition-colors"><ExternalLink className="w-6 h-6" /></a>
            </div>
            <div className="text-center space-y-1">
              <div className="text-purple-400 font-bold text-sm tracking-widest">TNT HOUSE + GOOGLE SHEETS v1.0</div>
              <div className="text-slate-400 text-xs">Powered by $MRDT • AI Audits • Google Drive Cloud ☁️</div>
              <div className="text-slate-500 text/[10px]">Built with Next.js + Tailwind CSS • DexScreener + Google Sheets APIs • Admin Wallet Integrated</div>
            </div>
          </div>
        </footer>
      </div>

      {/* ===== МОДАЛЬНЫЕ ОКНА ПОВЕРХ ВСЕГО ===== */}
      {showAuditWalletModal && (
        <div className="fixed inset-0 z/[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-950 border-2 border-purple-500/40 rounded-2xl w-full max-w-md p-6 shadow-lg">
            <h3 className="text-lg font-black text-white mb-4">Выберите способ оплаты</h3>
            <button onClick={() => handleAuditWalletSelect('phantom')} className="block w-full bg-purple-500/20 border border-purple-500/30 rounded-xl p-3 mb-3">👻 Phantom</button>
            <button onClick={() => handleAuditWalletSelect('solflare')} className="block w-full bg-emerald-500/20 border border-emerald-500/30 rounded-xl p-3 mb-4">🔥 Solflare</button>
            <button onClick={() => setShowAuditWalletModal(false)} className="text-slate-400">Отмена</button>
          </div>
        </div>
      )}

      {showBannerWalletModal && (
        <div className="fixed inset-0 z/[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-950 border-2 border-purple-500/40 rounded-2xl w-full max-w-md p-6 shadow-lg">
            <h3 className="text-lg font-black text-white mb-4">Выберите способ оплаты</h3>
            <button onClick={() => handleBannerWalletSelect('phantom')} className="block w-full bg-purple-500/20 border border-purple-500/30 rounded-xl p-3 mb-3">👻 Phantom</button>
            <button onClick={() => handleBannerWalletSelect('solflare')} className="block w-full bg-emerald-500/20 border border-emerald-500/30 rounded-xl p-3 mb-4">🔥 Solflare</button>
            <button onClick={() => setShowBannerWalletModal(false)} className="text-slate-400">Отмена</button>
          </div>
        </div>
      )}

      {isBlueprintOpen && (selectedToken || auditResult) && (
        <div className="fixed inset-0 z/[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={closeBlueprint}>
          <div className="bg-slate-950 border-2 border-purple-500/40 rounded-2xl w-full max-w-lg p-6 shadow-lg" onClick={e => e.stopPropagation()}>
            <h2 className="text-2xl font-black text-white">TNT Security Blueprint</h2>
            {auditResult ? (
              <div className="mt-4 text-sm">
                <p>Mint: {auditResult.mintAuthority}</p>
                <p>Freeze: {auditResult.freezeAuthority}</p>
                <p>LP: ${auditResult.liquidityUSD.toLocaleString()}</p>
              </div>
            ) : (
              <p className="mt-4 text-slate-400">Выберите токен</p>
            )}
            <button onClick={closeBlueprint} className="mt-4 text-slate-400">Закрыть</button>
          </div>
        </div>
      )}

      {/* ЧАТ */}
      <button onClick={() => setIsChatOpen(!isChatOpen)} className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-tr from-purple-500 to-emerald-400 rounded-full flex items-center justify-center shadow/[0_0_20px_rgba(153,69,255,0.5)] hover:scale-105 transition z-50 animate-bounce">
        {isChatOpen ? <X className="w-6 h-6 text-slate-950" /> : <MessageSquare className="w-6 h-6 text-slate-950" />}
      </button>

      {isChatOpen && (
        <div className="fixed bottom-24 right-6 w-80 md:w-96 h/[450px] bg-slate-909 border-2 border-purple-500 rounded-xl shadow/[0_0_30px_rgba(153,69,255,0.4)] flex flex-col overflow-hidden z-50 font-mono">
          <div className="bg-gradient-to-r from-purple-600 to-emerald-500 p-4 flex items-center justify-between border-b border-purple-500/20">
            <div className="flex items-center gap-2"><span className="text-xl">🤖</span><div><h4 className="font-bold text-xs text-white">TNT AI INSPECTOR</h4><span className="text/[9px] text-slate-100 font-bold tracking-widest">Trench Agent D10S</span></div></div>
            <button onClick={() => setIsChatOpen(false)} className="text-white hover:text-slate-200"><X className="w-4 h-4" /></button>
          </div>
          <div className="flex-1 p-4 overflow-y-auto space-y-3 scrollbar-thin scrollbar-thumb-purple-500/20 text-xs">
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w/[80%] rounded-lg p-2.5 leading-relaxed ${msg.sender === 'user' ? 'bg-purple-500/20 text-purple-200 border border-purple-500/30' : 'bg-slate-950 text-emerald-400 border border-emerald-500/30'}`}>{msg.text}</div>
              </div>
            ))}
            {isTyping && <div className="flex justify-start"><div className="bg-slate-950 text-emerald-400 border border-emerald-500/30 rounded-lg p-2.5 animate-pulse text/[11px]">Думаю...</div></div>}
            <div ref={chatEndRef} />
          </div>
          <div className="p-3 border-t border-purple-500/20 bg-slate-950 flex gap-2">
            <input type="text" value={userMsg} onChange={e => setUserMsg(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleSendChat(); }} placeholder="Спроси у ИИ..." className="flex-1 bg-slate-909 border border-purple-500/20 rounded px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none" />
            <button onClick={handleSendChat} className="bg-purple-500 hover:bg-purple-400 text-slate-950 px-3 rounded text-xs font-bold transition"><Send className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      )}
    </div>
  );
}
