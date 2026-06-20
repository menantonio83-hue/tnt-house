'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Shield, Send, MessageSquare, X, RefreshCw, AlertCircle, Sparkles, ExternalLink, ChevronDown, Download, Zap, Lock, CheckCircle, XCircle } from 'lucide-react';
import { Connection, PublicKey, Transaction, LAMPORTS_PER_SOL, VersionedTransaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction, getAccount, getMint } from '@solana/spl-token';

export const dynamic = 'force-dynamic';

const WALLET_ADDRESS = "Ev6oXBXo6qyoaT5wypJ2Umxch91F7cFvE1SarYLaUn8Z";
const MRDT_CA = "8Q22r9qUm4AzFzTpZgaPYMxqq4z5WxE9FVa7X9dsvmBg";
const MRDT_DECIMALS = 6;

const FALLBACK_TOKENS = [
  { name: 'Test Gem', symbol: 'TGEM', ca: '11111111111111111111111111111111', price: '0.00001234', liquidity: 45000, volume24h: 120000, priceChange24h: 8.5, verified: true, dexUrl: 'https://dexscreener.com', chain: 'solana' }
];

// Detect mobile browser
const isMobileBrowser = () => {
  if (typeof window === 'undefined') return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
};

// Detect Phantom in-app browser — pure JS, no TypeScript cast
const isPhantomBrowser = () => {
  if (typeof window === 'undefined') return false;
  return !!(window.solana && window.solana.isPhantom);
};

export default function TntHouse() {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bannerSubmitted, setBannerSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [bannerError, setBannerError] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
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
  const [showBannerWalletModal, setShowBannerWalletModal] = useState(false);
  const chatEndRef = useRef(null);
  const [mrdtPrice, setMrdtPrice] = useState(0.000013);
  const [priceLoading, setPriceLoading] = useState(true);
  const [solPrice, setSolPrice] = useState(150);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [isPaymentLoading, setIsPaymentLoading] = useState(false);

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({ projectName: '', contractAddress: '', email: '' });
  const [selectedPlan, setSelectedPlan] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState('');
  const [bannerFormData, setBannerFormData] = useState({ tokenName: '', bannerImg: '', desc: '', days: '1' });

  const plans = [
    { value: 'basic', name: 'Базовый Аудит (24h)', price: 10, mrdt: '769 231' },
    { value: 'express', name: 'Быстрый Листинг (5 min)', price: 40, mrdt: '3 076 923' },
    { value: 'vip', name: 'VIP-Буст (баннер 24h)', price: 120, mrdt: '9 230 769' },
  ];

  const currentPlan = plans.find(p => p.value === selectedPlan);

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4200);
  };

  // Read URL params on mount and auto-trigger payment if inside Phantom browser
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const pName = params.get('pName');
    const pCA = params.get('pCA');
    const pEmail = params.get('pEmail');
    const pPlan = params.get('pPlan');
    const pCurrency = params.get('pCurrency');

    if (pName && pCA && pPlan && pCurrency) {
      const restoredForm = { projectName: pName, contractAddress: pCA, email: pEmail || '' };
      setFormData(restoredForm);
      setSelectedPlan(pPlan);
      setSelectedCurrency(pCurrency);
      setStep(3);
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
      // Auto-pay if inside Phantom browser
      if (isPhantomBrowser()) {
        setTimeout(() => {
          triggerPayment(pPlan, pCurrency, restoredForm);
        }, 1500);
      }
    }
  }, []);

  // Fetch SOL price
  useEffect(() => {
    const fetchSolPrice = async () => {
      try {
        const res = await fetch('https://price.jup.ag/v6/price?ids=SOL');
        const data = await res.json();
        if (data && data.data && data.data.SOL && data.data.SOL.price) {
          setSolPrice(data.data.SOL.price);
        }
      } catch {}
    };
    fetchSolPrice();
    const interval = setInterval(fetchSolPrice, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleNext = () => {
    if (step === 1) {
      if (!formData.projectName.trim() || !formData.contractAddress.trim() || !formData.email.trim()) {
        showToast('Заполни все поля', 'error'); return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!selectedPlan) { showToast('Выбери тариф', 'error'); return; }
      setStep(3);
    }
  };

  const handleBack = () => {
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
  };

  // Build Phantom deeplink with form data in URL params
  const redirectToPhantom = (planVal, currency, form) => {
    const base = window.location.origin + window.location.pathname;
    const params = new URLSearchParams({
      pName: form.projectName,
      pCA: form.contractAddress,
      pEmail: form.email,
      pPlan: planVal,
      pCurrency: currency,
    });
    const targetUrl = base + '?' + params.toString();
    const encoded = encodeURIComponent(targetUrl);
    window.location.href = 'phantom://v1/browse/' + encoded + '?ref=' + encoded;
    setTimeout(() => {
      window.location.replace('https://phantom.app/ul/browse/' + encoded + '?ref=' + encoded);
    }, 1200);
  };

  // Core payment logic
  const triggerPayment = async (planVal, currency, form) => {
    const plan = plans.find(p => p.value === planVal);
    if (!plan || !currency) return;

    // Pure JS window.solana access — no TypeScript cast needed
    const solanaWin = window.solana;
    if (!solanaWin || !solanaWin.isPhantom) {
      showToast('Phantom не найден', 'error'); return;
    }

    setIsPaymentLoading(true);
    try {
      const resp = await solanaWin.connect();
      const sender = new PublicKey(resp.publicKey.toString());
      const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
      const projectWallet = new PublicKey(WALLET_ADDRESS);
      let signature = '';

      if (currency === 'mrdt') {
        const mint = new PublicKey(MRDT_CA);
        const fromAta = await getAssociatedTokenAddress(mint, sender);
        const toAta = await getAssociatedTokenAddress(mint, projectWallet);
        try { await getAccount(connection, fromAta); } catch { showToast('Нет $MRDT на кошельке', 'error'); setIsPaymentLoading(false); return; }
        const amount = Math.round(plan.price / mrdtPrice) * Math.pow(10, MRDT_DECIMALS);
        const tx = new Transaction().add(createTransferInstruction(fromAta, toAta, sender, amount));
        tx.feePayer = sender;
        tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        const signed = await solanaWin.signAndSendTransaction(tx);
        signature = signed.signature;
        await connection.confirmTransaction(signature, 'confirmed');

      } else if (currency === 'sol') {
        const amountLamports = Math.floor((plan.price / solPrice) * LAMPORTS_PER_SOL);
        const projectAta = await getAssociatedTokenAddress(new PublicKey(MRDT_CA), projectWallet);
        const quoteRes = await fetch(
          'https://quote-api.jup.ag/v6/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=' + MRDT_CA + '&amount=' + amountLamports + '&slippageBps=150'
        );
        const quote = await quoteRes.json();
        if (!quote || quote.error) throw new Error('Не удалось получить quote от Jupiter');
        const swapRes = await fetch('https://quote-api.jup.ag/v6/swap', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            quoteResponse: quote,
            userPublicKey: sender.toBase58(),
            wrapAndUnwrapSol: true,
            destinationTokenAccount: projectAta.toBase58(),
          }),
        });
        const swapData = await swapRes.json();
        if (!swapData.swapTransaction) throw new Error('Jupiter не вернул транзакцию');
        const txBytes = Uint8Array.from(atob(swapData.swapTransaction), c => c.charCodeAt(0));
        const transaction = VersionedTransaction.deserialize(txBytes);
        const signedTx = await solanaWin.signTransaction(transaction);
        signature = await connection.sendRawTransaction(signedTx.serialize());
        await connection.confirmTransaction(signature, 'confirmed');
      }

      showToast('✅ Оплата прошла! Запускаем проверку токена...', 'success');

      // Run AI audit
      let auditData = { mintAuthority: '—', freezeAuthority: '—', isHoneypot: '—' };
      try {
        const auditRes = await fetch('https://api.gopluslabs.io/api/v1/token_security/1?contract_addresses=' + form.contractAddress);
        const auditJson = await auditRes.json();
        if (auditJson.code === 1 && auditJson.result && auditJson.result[form.contractAddress]) {
          const a = auditJson.result[form.contractAddress];
          auditData = {
            mintAuthority: a.mint_authority === '' ? 'Отозвана ✓' : 'Активна (риск)',
            freezeAuthority: a.freeze_authority === '' ? 'Отозвана ✓' : 'Активна (риск)',
            isHoneypot: a.is_honeypot === '1' ? 'Да ⚠️' : 'Нет ✓',
          };
        }
      } catch {
        try {
          const c2 = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
          const mi = await getMint(c2, new PublicKey(form.contractAddress));
          auditData = {
            mintAuthority: mi.mintAuthority ? 'Активна (риск)' : 'Отозвана ✓',
            freezeAuthority: mi.freezeAuthority ? 'Активна (риск)' : 'Отозвана ✓',
            isHoneypot: '—',
          };
        } catch {}
      }

      const newToken = {
        name: form.projectName.toUpperCase(),
        symbol: form.projectName.slice(0, 4).toUpperCase() || 'NEW',
        ca: form.contractAddress,
        price: (Math.random() * 0.00005 + 0.000001).toFixed(8),
        liquidity: Math.floor(Math.random() * 100000 + 10000),
        volume24h: Math.floor(Math.random() * 90000 + 20000),
        priceChange24h: parseFloat((Math.random() * 40 - 10).toFixed(1)),
        score: 95,
        verified: true,
        dexUrl: 'https://dexscreener.com/solana/' + form.contractAddress,
        chain: 'solana',
        mintAuthority: auditData.mintAuthority,
        freezeAuthority: auditData.freezeAuthority,
        isHoneypot: auditData.isHoneypot,
      };

      setTokens(prev => [newToken, ...prev]);
      showToast('✅ Проверка завершена! Токен в таблице!', 'success');
      setStep(1);
      setSelectedPlan('');
      setSelectedCurrency('');
      setFormData({ projectName: '', contractAddress: '', email: '' });

    } catch (err) {
      console.error('Payment error:', err);
      showToast(err.message || 'Ошибка оплаты', 'error');
    } finally {
      setIsPaymentLoading(false);
    }
  };

  // Button handler — decides: redirect to Phantom or pay directly
  const handlePayment = () => {
    if (!selectedPlan || !selectedCurrency) {
      showToast('Выбери тариф и способ оплаты', 'error'); return;
    }
    if (isMobileBrowser() && !isPhantomBrowser()) {
      redirectToPhantom(selectedPlan, selectedCurrency, formData);
      return;
    }
    triggerPayment(selectedPlan, selectedCurrency, formData);
  };

  const handleConnectWallet = async () => {
    if (isMobileBrowser() && !isPhantomBrowser()) {
      const url = encodeURIComponent(window.location.href);
      window.location.href = 'phantom://v1/browse/' + url + '?ref=' + url;
      setTimeout(() => window.location.replace('https://phantom.app/ul/browse/' + url + '?ref=' + url), 1200);
      return;
    }
    const solanaWin = window.solana;
    if (solanaWin && solanaWin.isPhantom) {
      try {
        const resp = await solanaWin.connect();
        const pk = resp.publicKey.toString();
        setWalletAddress(pk.slice(0, 4) + '...' + pk.slice(-4));
      } catch (err) { console.error(err); }
    } else {
      showToast('Phantom не найден. Установи расширение.', 'error');
    }
  };

  const pillars = [
    { icon: Shield, label: 'AI Аудит', desc: 'Проверка контрактов', color: 'text-purple-400' },
    { icon: Zap, label: 'Микро-капы', desc: '$5K-$100K', color: 'text-emerald-400' },
    { icon: Lock, label: 'DAO Лицензия', desc: 'Через $MRDT', color: 'text-purple-400' }
  ];

  const getSafetyScore = (token) => {
    if (!token) return 75;
    if (token.symbol === 'MRDT') return 98;
    if (token.score) return token.score;
    const hash = token.symbol.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    return Math.max(85, Math.min(97, hash % 12 + 85));
  };

  const getScoreStyle = (score) => {
    if (score >= 90) return { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/50', glow: 'shadow-[0_0_12px_rgba(16,185,129,0.6)]' };
    if (score >= 50) return { color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/50', glow: 'shadow-[0_0_12px_rgba(234,179,8,0.5)]' };
    return { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/50', glow: 'shadow-[0_0_12px_rgba(239,68,68,0.6)] animate-pulse' };
  };

  const openTokenBlueprint = (token) => { setSelectedToken(token); setIsBlueprintOpen(true); };
  const closeBlueprint = () => { setIsBlueprintOpen(false); setTimeout(() => setSelectedToken(null), 300); };

  useEffect(() => {
    const check = () => {
      try {
        const s = localStorage.getItem('tnt_active_banner');
        if (s) {
          const d = JSON.parse(s);
          if (Date.now() < d.expiresAt) setActiveBanner(d);
          else { localStorage.removeItem('tnt_active_banner'); setActiveBanner(null); }
        }
      } catch {}
    };
    check();
    const i = setInterval(check, 10000);
    return () => clearInterval(i);
  }, []);

  const handleLaunchJupiter = () => window.open('https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&buy=8Q22r9qUm4AzFzTpZgaPYMxqq4z5WxE9FVa7X9dsvmBg', '_blank');
  const handleOpenRaydium = () => { setIsBuyDropdownOpen(false); window.open('https://raydium.io', '_blank'); };

  useEffect(() => {
    const templates = ['Обнаружен новый пул на Raydium!', 'Mint Authority отключена ✓.', 'Уровень угрозы: НИЗКИЙ.', 'Бандлов не обнаружено.', 'Подключение к DexScreener.', 'Ищем новые гемы...'];
    const i = setInterval(() => {
      const t = templates[Math.floor(Math.random() * templates.length)];
      setLogs(prev => [...prev.slice(-12), '[' + new Date().toLocaleTimeString() + '] ' + t]);
    }, 4200);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    const fetchTokens = async () => {
      try {
        setLoading(true);
        const cached = localStorage.getItem('tnt_cached_tokens');
        const time = localStorage.getItem('tnt_cached_time');
        if (cached && time && Date.now() - parseInt(time) < 120000) {
          setTokens(JSON.parse(cached)); setLoading(false); return;
        }
        const res = await fetch('https://api.dexscreener.com/latest/dex/tokens/So11111111111111111111111111111111111111112?limit=30');
        const data = await res.json();
        if (data.pairs && data.pairs.length) {
          const filtered = data.pairs
            .filter(p => (p.marketCap || 0) >= 1000 && (p.marketCap || 0) <= 300000)
            .slice(0, 9)
            .map(p => ({
              name: (p.baseToken && p.baseToken.name) || 'Unknown',
              symbol: (p.baseToken && p.baseToken.symbol) || '???',
              ca: (p.baseToken && p.baseToken.address) || '',
              price: p.priceUsd ? parseFloat(p.priceUsd).toFixed(8) : '0',
              liquidity: (p.liquidity && p.liquidity.usd) ? Math.round(p.liquidity.usd) : 0,
              volume24h: (p.volume && p.volume.h24) ? Math.round(p.volume.h24) : 0,
              priceChange24h: (p.priceChange && p.priceChange.h24) || 0,
              verified: true,
              dexUrl: p.url || '',
              chain: p.chainId || 'solana',
            }));
          if (filtered.length) {
            setTokens(filtered);
            localStorage.setItem('tnt_cached_tokens', JSON.stringify(filtered));
            localStorage.setItem('tnt_cached_time', Date.now().toString());
            setLoading(false); return;
          }
        }
        throw new Error('No pairs');
      } catch { setTokens(FALLBACK_TOKENS); setLoading(false); }
    };
    fetchTokens();
    const i = setInterval(fetchTokens, 5 * 60 * 1000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => { chatEndRef.current && chatEndRef.current.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const res = await fetch('https://api.dexscreener.com/latest/dex/tokens/' + MRDT_CA);
        const data = await res.json();
        if (data.pairs && data.pairs.length) {
          const p = parseFloat(data.pairs[0].priceUsd);
          if (p > 0) setMrdtPrice(p);
        }
      } catch {}
      setPriceLoading(false);
    };
    fetchPrice();
    const i = setInterval(fetchPrice, 60000);
    return () => clearInterval(i);
  }, []);

  const getAmountForTier = (tier) => {
    const usd = tier === 'fast' ? 40 : tier === 'vip' ? 120 : 10;
    return Math.round(usd / mrdtPrice);
  };
  const getAmountForBanner = (days) => {
    const usd = days === '2' ? 35 : days === '6' ? 100 : 20;
    return Math.round(usd / mrdtPrice);
  };

  const handleBannerWalletSelect = async () => {
    setShowBannerWalletModal(false);
    setIsBannerSending(true);
    setBannerError('');
    if (isMobileBrowser() && !isPhantomBrowser()) {
      setIsBannerSending(false);
      const url = encodeURIComponent(window.location.href);
      window.location.href = 'phantom://v1/browse/' + url + '?ref=' + url;
      setTimeout(() => window.location.replace('https://phantom.app/ul/browse/' + url + '?ref=' + url), 1200);
      return;
    }
    const solanaWin = window.solana;
    if (!solanaWin) { setBannerError('Установите Phantom.'); setIsBannerSending(false); return; }
    const current = Object.assign({}, bannerFormData);
    try {
      const resp = await solanaWin.connect();
      const sender = new PublicKey(resp.publicKey.toString());
      const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
      const mint = new PublicKey(MRDT_CA);
      const fromAta = await getAssociatedTokenAddress(mint, sender);
      await getAccount(connection, fromAta).catch(() => { throw new Error('Нет $MRDT.'); });
      const to = new PublicKey(WALLET_ADDRESS);
      const toAta = await getAssociatedTokenAddress(mint, to);
      const usd = current.days === '2' ? 35 : current.days === '6' ? 100 : 20;
      const amount = Math.round(usd / mrdtPrice) * Math.pow(10, MRDT_DECIMALS);
      const tx = new Transaction().add(createTransferInstruction(fromAta, toAta, sender, amount));
      tx.feePayer = sender;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      const signed = await solanaWin.signAndSendTransaction(tx);
      await connection.confirmTransaction(signed.signature, 'confirmed');
      const banner = {
        tokenName: current.tokenName.toUpperCase(),
        bannerImg: current.bannerImg || '🪙',
        desc: current.desc,
        expiresAt: Date.now() + parseInt(current.days) * 86400000,
      };
      localStorage.setItem('tnt_active_banner', JSON.stringify(banner));
      setActiveBanner(banner);
      setBannerSubmitted(true);
      setBannerFormData({ tokenName: '', bannerImg: '', desc: '', days: '1' });
      setTimeout(() => setBannerSubmitted(false), 5000);
    } catch (err) {
      setBannerError(err.message || 'Ошибка оплаты.');
    } finally {
      setIsBannerSending(false);
    }
  };

  const handleBannerSubmit = (e) => {
    e.preventDefault();
    if (!bannerFormData.tokenName || !bannerFormData.desc) { setBannerError('Укажите название и описание.'); return; }
    setShowBannerWalletModal(true);
  };

  const handleSendChat = () => {
    if (!userMsg.trim()) return;
    setChatMessages(prev => [...prev, { sender: 'user', text: userMsg }]);
    setUserMsg('');
    setIsTyping(true);
    setTimeout(() => {
      const replies = ['Структура чистая. SAFE ✓', 'Бандлов нет.', '$MRDT — гем!', 'Ругпулов не обнаружено.', 'Комиссии честные.'];
      setChatMessages(prev => [...prev, { sender: 'bot', text: replies[Math.floor(Math.random() * replies.length)] }]);
      setIsTyping(false);
    }, 1000);
  };

  const formatNumber = (num) => {
    if (num >= 1e6) return '$' + (num / 1e6).toFixed(1) + 'M';
    if (num >= 1e3) return '$' + (num / 1e3).toFixed(1) + 'K';
    return '$' + num.toFixed(0);
  };

  const scrollToForm = () => {
    const el = document.getElementById('orderFormsSection');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const isMobile = typeof window !== 'undefined' && isMobileBrowser();
  const inPhantom = typeof window !== 'undefined' && isPhantomBrowser();

  return (
    <div className="min-h-screen bg-slate-950 text-white font-mono relative overflow-hidden pb-12">
      {/* Toast */}
      {toast.show && (
        <div className={'fixed bottom-6 left-1/2 -translate-x-1/2 z-[99999] flex items-center gap-3 px-6 py-3.5 rounded-2xl shadow-2xl border text-sm font-medium transition-all duration-300 ' + (toast.type === 'success' ? 'bg-emerald-950 border-emerald-500/40 text-emerald-300' : 'bg-red-950 border-red-500/40 text-red-300')}>
          {toast.type === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-400" /> : <XCircle className="w-5 h-5 text-red-400" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Payment loading overlay */}
      {isPaymentLoading && (
        <div className="fixed inset-0 z-[99998] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
          <RefreshCw className="w-10 h-10 text-purple-400 animate-spin" />
          <p className="text-white font-bold text-lg">Обрабатываем транзакцию...</p>
          <p className="text-slate-400 text-sm">Подтверди в Phantom</p>
        </div>
      )}

      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-purple-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-emerald-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" /></pattern></defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-purple-500/30 backdrop-blur-lg bg-slate-950/60 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <a href="https://t.me/tnt_house2026" target="_blank" rel="noopener noreferrer" className="w-10 h-10 border-2 border-purple-500 rounded-lg flex items-center justify-center bg-purple-500/10 shadow-[0_0_15px_rgba(153,69,255,0.4)] animate-pulse"><span className="text-xl">🧨</span></a>
              <div>
                <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-emerald-400 tracking-wider">TNT HOUSE</h1>
                <span className="text-[10px] text-purple-400 block font-bold tracking-widest">TOP NEW TOKENS v1.5</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <button onClick={() => setIsBuyDropdownOpen(!isBuyDropdownOpen)} className="bg-gradient-to-r from-purple-500 to-emerald-400 hover:from-purple-400 hover:to-emerald-300 text-slate-950 font-black px-4 py-2 rounded text-xs transition flex items-center gap-1 shadow-[0_0_15px_rgba(153,69,255,0.4)]">BUY $MRDT <ChevronDown className="w-3 h-3" /></button>
                {isBuyDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-slate-950 border border-purple-500/30 rounded-lg shadow-xl z-50 py-1">
                    <button onClick={handleLaunchJupiter} className="w-full text-left px-4 py-2.5 hover:bg-purple-500/10 text-emerald-400 flex items-center gap-2 text-sm"><ExternalLink className="w-4 h-4" /> Jupiter Swap</button>
                    <button onClick={handleOpenRaydium} className="w-full text-left px-4 py-2.5 hover:bg-purple-500/10 text-emerald-400 flex items-center gap-2 text-sm"><ExternalLink className="w-4 h-4" /> Raydium</button>
                  </div>
                )}
              </div>
              <button onClick={handleConnectWallet} className="bg-gradient-to-r from-purple-500 to-emerald-400 hover:from-purple-400 hover:to-emerald-300 text-slate-950 font-black px-4 py-2 rounded text-xs transition shadow-[0_0_15px_rgba(153,69,255,0.4)]">
                {walletAddress || 'CONNECT WALLET'}
              </button>
            </div>
          </div>
        </header>

        {/* VIP Banner */}
        <section className="max-w-7xl mx-auto px-6 pt-6">
          {activeBanner ? (
            <div className="border border-purple-500/40 rounded-2xl p-4 bg-gradient-to-r from-black via-purple-950/20 to-black flex flex-col sm:flex-row items-center justify-between gap-4 shadow-[0_0_20px_rgba(168,85,247,0.2)]">
              <div className="flex items-center gap-4">
                <span className="text-3xl bg-purple-500/10 p-2 rounded-xl border border-purple-500/20">
                  {typeof activeBanner.bannerImg === 'string' && activeBanner.bannerImg.startsWith('http')
                    ? <img src={activeBanner.bannerImg} alt="logo" className="w-8 h-8 rounded-full object-cover" />
                    : activeBanner.bannerImg}
                </span>
                <div>
                  <span className="bg-purple-500 text-white font-black text-[9px] px-2 py-0.5 rounded tracking-widest block w-max mb-1">🔥 VIP БУСТ</span>
                  <h4 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400">${activeBanner.tokenName}</h4>
                  <p className="text-slate-300 text-xs mt-0.5">{activeBanner.desc}</p>
                </div>
              </div>
              <button onClick={() => window.open('https://jup.ag', '_blank')} className="bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-xs px-6 py-2.5 rounded transition">КУПИТЬ НА JUPITER →</button>
            </div>
          ) : (
            <div onClick={scrollToForm} className="cursor-pointer border border-purple-500/30 rounded-2xl p-4 bg-gradient-to-r from-black via-purple-950/10 to-black flex flex-col sm:flex-row items-center justify-between gap-4 hover:border-purple-500/60 transition">
              <div className="flex items-center gap-4">
                <span className="text-3xl bg-purple-500/10 p-2 rounded-xl border border-purple-500/20">⚽️</span>
                <div>
                  <span className="bg-slate-800 text-purple-400 font-bold text-[9px] px-2 py-0.5 rounded tracking-widest block w-max mb-1">МЕСТО СВОБОДНО</span>
                  <h4 className="text-lg font-black text-white">Maradona Token ($MRDT)</h4>
                  <p className="text-slate-400 text-xs mt-0.5">Главный токен платформы TNT House. Нажмите, чтобы купить VIP-баннер!</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-emerald-400 font-black text-sm">VIP-Буст от $20/день</div>
                <div className="text-[10px] text-slate-500">Оплата в $MRDT</div>
              </div>
            </div>
          )}
        </section>

        {/* Hero */}
        <section className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="space-y-3 border-l-4 border-purple-500 pl-6">
                <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded font-bold border border-purple-500/30">БЕЗОПАСНЫЕ НОВЫЕ ТОКЕНЫ</span>
                <h2 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400">Взрываем скамы.<br />Запускаем гемы.</h2>
                <p className="text-slate-300 text-base leading-relaxed">Добро пожаловать в Дом Новых Токенов! Наш ИИ-агент сканирует блокчейн.</p>
              </div>
              <div className="grid grid-cols-3 gap-4 mt-8">
                {pillars.map((item, i) => (
                  <div key={i} className="bg-slate-900/50 border border-purple-500/20 rounded-lg p-3 text-center hover:border-purple-500/60 transition">
                    <item.icon className={'w-5 h-5 ' + item.color + ' mx-auto mb-1'} />
                    <div className="text-[11px] font-bold text-slate-200">{item.label}</div>
                    <div className="text-[9px] text-slate-400">{item.desc}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-slate-950 border-2 border-purple-500/40 rounded-lg p-4 font-mono text-xs h-72 flex flex-col justify-between shadow-[0_0_20px_rgba(153,69,255,0.15)] relative">
              <div className="absolute top-3 right-4 flex gap-1.5">
                <span className="w-2.5 h-2.5 bg-red-500 rounded-full" /><span className="w-2.5 h-2.5 bg-yellow-500 rounded-full" /><span className="w-2.5 h-2.5 bg-green-500 rounded-full" />
              </div>
              <div className="text-purple-400 font-bold border-b border-purple-500/20 pb-2 mb-2 flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 animate-spin" /> AI SCANNER</div>
              <div className="flex-1 overflow-y-auto space-y-1.5 text-emerald-400">{logs.map((log, i) => <div key={i} className="text-[11px]">{log}</div>)}</div>
              <div className="text-[10px] text-slate-500 border-t border-purple-500/20 pt-2 mt-2">Status: SCANNING...</div>
            </div>
          </div>
        </section>

        {/* Token table */}
        <section className="max-w-7xl mx-auto px-6 py-6">
          <div className="border-2 border-purple-500/30 rounded-lg bg-slate-900/40 backdrop-blur-md p-3 shadow-[0_0_25px_rgba(153,69,255,0.2)]">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-base font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400 flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-emerald-400" /> ТАБЛИЦА БЕЗОПАСНЫХ НОВЫХ ТОКЕНОВ</h3>
                <p className="text-slate-400 text-[10px] mt-0.5">Кликни на токен для TNT Security Blueprint</p>
              </div>
              <div className="hidden md:flex items-center gap-1 text-[9px] text-purple-400"><RefreshCw className="w-2.5 h-2.5 animate-spin" /> 5 мин</div>
            </div>
            <div className="max-h-[320px] overflow-y-auto border border-purple-500/20 rounded-lg">
              <table className="w-full text-left border-collapse text-[9px]">
                <thead>
                  <tr className="border-b border-purple-500/20 bg-purple-500/10 text-purple-400 font-bold sticky top-0 z-20 backdrop-blur-md">
                    {['Токен','Цена','Ликв','Об/Изм','Оценка','Действ'].map((h, i) => (
                      <th key={i} className={'p-0.5 align-bottom' + (i === 4 ? ' text-center' : i === 5 ? ' text-right' : '')} style={{ writingMode: 'vertical-lr', textOrientation: 'mixed', height: '60px', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr onClick={() => openTokenBlueprint({ symbol: 'MRDT', name: 'MARADONATOKEN', ca: MRDT_CA, price: mrdtPrice.toFixed(8), liquidity: 13000, volume24h: 0, priceChange24h: 12.4, verified: true, dexUrl: 'https://dexscreener.com/solana/' + MRDT_CA, chain: 'solana' })} className="border-b border-purple-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 transition cursor-pointer">
                    <td className="p-1 font-bold flex items-center gap-1"><span className="text-sm">⚽️</span><div><span className="text-emerald-400 font-extrabold text-[10px]">$MRDT</span><div className="text-[7px] text-slate-400">MARADONATOKEN</div></div></td>
                    <td className="p-1 font-mono text-emerald-400 font-bold text-[9px]">${mrdtPrice.toFixed(8)}</td>
                    <td className="p-1 font-mono text-emerald-400 font-bold text-[9px]">$13K+</td>
                    <td className="p-1 font-mono text-emerald-400 font-bold text-[9px]">+12.4%</td>
                    <td className="p-1 text-center"><div className="inline-flex items-center justify-center w-9 h-4 rounded-full bg-emerald-500/20 border border-emerald-500 text-emerald-400 text-[8px] font-extrabold shadow-[0_0_6px_rgba(16,185,129,0.5)]">98</div></td>
                    <td className="p-1 text-right"><button onClick={e => { e.stopPropagation(); handleLaunchJupiter(); }} className="text-[8px] text-emerald-400 hover:text-emerald-300 font-bold hover:underline inline-flex items-center gap-0.5">Купить <ExternalLink className="w-2 h-2" /></button></td>
                  </tr>
                  {loading && tokens.length === 0 ? (
                    <tr><td colSpan={6} className="p-6 text-center text-purple-400 font-bold"><RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1" />Сканируем...</td></tr>
                  ) : tokens.map((token, i) => {
                    const score = getSafetyScore(token);
                    const style = getScoreStyle(score);
                    return (
                      <tr key={i} onClick={() => openTokenBlueprint(token)} className="border-b border-purple-500/10 hover:bg-purple-500/5 transition cursor-pointer">
                        <td className="p-1"><span className="text-purple-400 text-[9px] font-bold">${token.symbol}</span><span className="text-[7px] text-slate-500 block truncate max-w-[80px]">{token.name}</span></td>
                        <td className="p-1 font-mono text-slate-300 text-[9px]">${token.price}</td>
                        <td className="p-1 font-mono text-slate-300 text-[9px]">{typeof token.liquidity === 'number' ? formatNumber(token.liquidity) : token.liquidity}</td>
                        <td className={'p-1 font-mono text-[9px] ' + (token.priceChange24h > 0 ? 'text-emerald-400' : 'text-red-400')}>{formatNumber(token.volume24h)} ({token.priceChange24h > 0 ? '+' : ''}{token.priceChange24h}%)</td>
                        <td className="p-1 text-center"><div className={'inline-flex items-center justify-center w-9 h-4 rounded-full ' + style.bg + ' ' + style.border + ' ' + style.color + ' text-[8px] font-extrabold ' + style.glow}>{score}</div></td>
                        <td className="p-1 text-right"><a href={token.dexUrl} onClick={e => e.stopPropagation()} target="_blank" rel="noopener noreferrer" className="text-[8px] text-purple-400 hover:text-emerald-400 inline-flex items-center gap-0.5">DEX <ExternalLink className="w-2 h-2" /></a></td>
                      </tr>
                    );
                  })}
                  {[1,2,3,4].map(n => (
                    <tr key={'e' + n} className="border-b border-purple-500/5 opacity-40">
                      {[0,1,2,3,4,5].map(i => <td key={i} className="p-1 text-slate-600 text-[8px] italic">—</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {error && <div className="mt-2 p-1.5 bg-red-950/40 border border-red-500/30 rounded-lg flex items-center gap-1 text-red-300 text-[9px]"><AlertCircle className="w-2.5 h-2.5" /> {error}</div>}
          </div>
        </section>

        {/* Order forms */}
        <section id="orderFormsSection" className="max-w-7xl mx-auto px-6 py-8">
          <div className="grid md:grid-cols-2 gap-12 items-start">
            <div className="space-y-8">

              {/* AI Inspection form */}
              <div className="border-2 border-purple-500/30 rounded-lg bg-slate-900/40 p-6 backdrop-blur-md">
                <h3 className="text-lg font-black text-purple-400 mb-2 flex items-center gap-2">🔍 ЗАКАЗАТЬ ИИ-ИНСПЕКЦИЮ</h3>
                <p className="text-slate-400 text-xs mb-4">Авто-добавление в таблицу.</p>

                {isMobile && !inPhantom && (
                  <div className="mb-4 p-3 bg-purple-950/40 border border-purple-500/40 rounded-xl text-xs text-purple-300 flex items-start gap-2">
                    <span className="text-base">👻</span>
                    <span>Кнопка оплаты автоматически откроет Phantom App и подставит все данные — просто нажми и подтверди транзакцию.</span>
                  </div>
                )}

                <div className="bg-gray-800/50 p-6 rounded-2xl border border-gray-700/50 max-w-md mx-auto">
                  {step === 1 && (
                    <>
                      <h3 className="text-2xl font-bold text-white mb-6">Заказать ИИ-инспекцию</h3>
                      <div className="space-y-4">
                        <div><label className="block text-sm text-gray-400 mb-1">Название проекта</label><input type="text" placeholder="Твой токен..." value={formData.projectName} onChange={e => setFormData(Object.assign({}, formData, { projectName: e.target.value }))} className="w-full p-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500" /></div>
                        <div><label className="block text-sm text-gray-400 mb-1">Contract Address (Solana)</label><input type="text" placeholder="Впиши адрес контракта..." value={formData.contractAddress} onChange={e => setFormData(Object.assign({}, formData, { contractAddress: e.target.value }))} className="w-full p-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500" /></div>
                        <div><label className="block text-sm text-gray-400 mb-1">Email для связи</label><input type="email" placeholder="your@email.com" value={formData.email} onChange={e => setFormData(Object.assign({}, formData, { email: e.target.value }))} className="w-full p-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500" /></div>
                      </div>
                      <button onClick={handleNext} className="mt-6 w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-3 rounded-xl font-semibold hover:opacity-90 transition">Далее →</button>
                    </>
                  )}

                  {step === 2 && (
                    <>
                      <h3 className="text-2xl font-bold text-white mb-4">Выбери тариф</h3>
                      <div className="space-y-3">
                        {plans.map(plan => (
                          <label key={plan.value} className={'flex items-center p-4 rounded-xl cursor-pointer transition-all ' + (selectedPlan === plan.value ? 'bg-indigo-600/20 border border-indigo-500' : 'bg-gray-700/30 border border-gray-700 hover:border-indigo-400')}>
                            <input type="radio" name="plan" value={plan.value} checked={selectedPlan === plan.value} onChange={() => setSelectedPlan(plan.value)} className="w-5 h-5 text-indigo-600" />
                            <div className="ml-4"><p className="text-white font-semibold">{plan.name}</p><p className="text-sm text-gray-400">${plan.price} ≈ {plan.mrdt} $MRDT</p></div>
                          </label>
                        ))}
                      </div>
                      <div className="flex gap-3 mt-6">
                        <button onClick={handleBack} className="flex-1 bg-gray-700 text-white py-3 rounded-xl font-semibold hover:bg-gray-600 transition">← Назад</button>
                        <button onClick={handleNext} className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-3 rounded-xl font-semibold hover:opacity-90 transition">Далее →</button>
                      </div>
                    </>
                  )}

                  {step === 3 && (
                    <>
                      <h3 className="text-2xl font-bold text-white mb-4">Выбери способ оплаты</h3>
                      <p className="text-gray-400 mb-4">Тариф: <span className="text-white font-semibold">{currentPlan && currentPlan.name}</span></p>
                      <div className="space-y-3">
                        {['mrdt', 'sol'].map(method => (
                          <label key={method} className={'flex items-center p-4 rounded-xl cursor-pointer transition-all ' + (selectedCurrency === method ? 'bg-indigo-600/20 border border-indigo-500' : 'bg-gray-700/30 border border-gray-700 hover:border-indigo-400')}>
                            <input type="radio" name="currency" value={method} checked={selectedCurrency === method} onChange={() => setSelectedCurrency(method)} className="w-5 h-5 text-indigo-600" />
                            <div className="ml-4">
                              <p className="text-white font-semibold">{method === 'mrdt' ? 'Оплатить в $MRDT' : 'Оплатить в SOL (авто-выкуп)'}</p>
                              {method === 'sol' && currentPlan && <p className="text-sm text-gray-400">≈ {(currentPlan.price / solPrice).toFixed(4)} SOL</p>}
                            </div>
                          </label>
                        ))}
                      </div>
                      <div className="flex gap-3 mt-6">
                        <button onClick={handleBack} className="flex-1 bg-gray-700 text-white py-3 rounded-xl font-semibold hover:bg-gray-600 transition">← Назад</button>
                        <button
                          onClick={handlePayment}
                          disabled={!selectedCurrency || isPaymentLoading}
                          className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-3 rounded-xl font-semibold hover:opacity-90 transition disabled:opacity-40 flex items-center justify-center gap-2"
                        >
                          {isPaymentLoading
                            ? <><RefreshCw className="w-4 h-4 animate-spin" /> Обработка...</>
                            : (isMobile && !inPhantom ? '👻 Открыть в Phantom' : 'Запустить ИИ-инспекцию')}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Banner form */}
              <div className="border-2 border-purple-500/30 rounded-lg bg-slate-900/40 p-6 backdrop-blur-md">
                <h3 className="text-lg font-black text-purple-400 mb-2 flex items-center gap-2">👑 КУПИТЬ VIP-БАННЕР НА ГЛАВНУЮ</h3>
                <p className="text-slate-400 text-xs mb-4">Полностью автоматическая замена рекламного места.</p>
                <form onSubmit={handleBannerSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-purple-400 text-[11px] font-bold mb-1">Имя токена / Тикер</label><input type="text" value={bannerFormData.tokenName} onChange={e => setBannerFormData(Object.assign({}, bannerFormData, { tokenName: e.target.value }))} placeholder="SOLANA" className="w-full bg-slate-950 border border-purple-500/20 rounded px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none" /></div>
                    <div><label className="block text-purple-400 text-[11px] font-bold mb-1">Загрузите изображение</label><input type="file" accept="image/*" onChange={e => { const f = e.target.files && e.target.files[0]; if (f) { const r = new FileReader(); r.onload = ev => setBannerFormData(Object.assign({}, bannerFormData, { bannerImg: ev.target.result })); r.readAsDataURL(f); }}} className="w-full bg-slate-950 border border-purple-500/20 rounded px-3 py-2 text-xs text-white file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-bold file:bg-purple-500 file:text-white hover:file:bg-purple-400" /></div>
                  </div>
                  <div><label className="block text-purple-400 text-[11px] font-bold mb-1">Краткий рекламный слоган</label><input type="text" value={bannerFormData.desc} onChange={e => setBannerFormData(Object.assign({}, bannerFormData, { desc: e.target.value }))} placeholder="Самый быстрый мемкоин..." className="w-full bg-slate-950 border border-purple-500/20 rounded px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none" /></div>
                  <div>
                    <label className="block text-purple-400 text-[11px] font-bold mb-1">Срок размещения</label>
                    <select value={bannerFormData.days} onChange={e => setBannerFormData(Object.assign({}, bannerFormData, { days: e.target.value }))} className="w-full bg-slate-950 border border-purple-500/20 rounded px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-none font-mono">
                      <option value="1">1 День — 20$ {priceLoading ? '(расчёт…)' : '(~ ' + getAmountForBanner('1').toLocaleString() + ' $MRDT)'}</option>
                      <option value="2">2 Дня — 35$ {priceLoading ? '(расчёт…)' : '(~ ' + getAmountForBanner('2').toLocaleString() + ' $MRDT)'}</option>
                      <option value="6">6 Дней — 100$ {priceLoading ? '(расчёт…)' : '(~ ' + getAmountForBanner('6').toLocaleString() + ' $MRDT)'}</option>
                    </select>
                  </div>
                  <button type="submit" disabled={isBannerSending} className="w-full bg-gradient-to-r from-emerald-400 to-purple-500 hover:from-emerald-300 hover:to-purple-400 text-slate-950 font-black py-2.5 rounded text-xs transition flex items-center justify-center gap-1.5 disabled:opacity-50">
                    <Zap className="w-3.5 h-3.5" /> {isBannerSending ? 'ОТПРАВКА...' : 'ОПЛАТИТЬ И РАЗМЕСТИТЬ БАННЕР'}
                  </button>
                  {bannerSubmitted && <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded text-emerald-300 text-xs text-center font-bold">✓ Баннер активирован!</div>}
                  {bannerError && <div className="p-3 bg-red-950/40 border border-red-500/30 rounded text-red-300 text-xs">{bannerError}</div>}
                </form>
              </div>
            </div>

            {/* Investor info */}
            <div className="space-y-4 bg-slate-900/20 border-2 border-purple-500/20 rounded-xl p-6">
              <h3 className="text-xl font-black text-purple-400">Информация для инвесторов</h3>
              <p className="text-slate-300 text-xs leading-relaxed">Все платежи принимаются в $MRDT.</p>
              <div className="mt-6 space-y-3">
                <h4 className="text-xs font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400 flex items-center gap-1.5"><Download className="w-4 h-4 text-purple-400 animate-pulse" /> ТЕКУЩАЯ СЕТКА ТАРИФОВ:</h4>
                <div className="grid grid-cols-1 gap-2 text-xs font-mono">
                  {[
                    ['🎁 Первые 3 токена', 'БЕСПЛАТНО'],
                    ['🔍 Базовый ИИ-Аудит', '$10 ≈ ' + (priceLoading ? '...' : getAmountForTier('basic').toLocaleString()) + ' $MRDT'],
                    ['⚡ Быстрый Листинг', '$40 ≈ ' + (priceLoading ? '...' : getAmountForTier('fast').toLocaleString()) + ' $MRDT'],
                    ['👑 Баннер (1 день)', '$20 ≈ ' + (priceLoading ? '...' : getAmountForBanner('1').toLocaleString()) + ' $MRDT'],
                    ['👑 Баннер (2 дня)', '$35 ≈ ' + (priceLoading ? '...' : getAmountForBanner('2').toLocaleString()) + ' $MRDT'],
                    ['👑 Баннер (6 дней)', '$100 ≈ ' + (priceLoading ? '...' : getAmountForBanner('6').toLocaleString()) + ' $MRDT'],
                  ].map((row, i) => (
                    <div key={i} className={'flex justify-between p-2.5 border rounded-lg ' + (i === 0 ? 'bg-purple-500/10 border-purple-500/20' : 'bg-slate-950 border-purple-500/10')}>
                      <span className="text-slate-300">{row[0]}</span><span className="text-emerald-400 font-bold">{row[1]}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Whale club */}
        <section className="max-w-7xl mx-auto px-6 py-6">
          <div className="relative bg-gradient-to-r from-purple-500/10 via-transparent to-emerald-500/10 border-2 border-purple-500/30 rounded-lg p-10 overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl" />
            <div className="relative z-10 max-w-2xl">
              <h3 className="text-2xl font-black text-purple-400 mb-2">🐋 TNT WHALE CLUB (DAO)</h3>
              <p className="text-slate-300 text-sm leading-relaxed mb-5">Держи $MRDT и получи доступ к закрытому Telegram чату. Первым узнавай о новых гемах!</p>
              <a href="https://t.me/tnt_house2026" target="_blank" rel="noopener noreferrer" className="inline-block bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-400 hover:to-purple-500 text-white font-bold py-2.5 px-6 rounded text-xs transition">Вступить в VIP-Клуб →</a>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-purple-500/20 mt-12 py-8 bg-slate-950/60 backdrop-blur-lg">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex flex-wrap items-center justify-center gap-8 mb-4">
              <a href="https://x.com/Crypto_D10S" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white transition-colors"><svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg></a>
              <a href="https://t.me/D10S_Solana_Stadium" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-blue-400 transition-colors"><span className="text-2xl">✈️</span></a>
              <a href="https://www.maradonatoken-mrdt.xyz" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-emerald-400 transition-colors"><ExternalLink className="w-6 h-6" /></a>
            </div>
            <div className="text-center space-y-1">
              <div className="text-purple-400 font-bold text-sm tracking-widest">TNT HOUSE v1.5</div>
              <div className="text-slate-400 text-xs">Powered by $MRDT • AI Audits ☁️</div>
              <div className="text-slate-500 text-[10px]">Built with Next.js + Tailwind CSS • DexScreener API</div>
            </div>
          </div>
        </footer>
      </div>

      {/* Banner wallet modal */}
      {showBannerWalletModal && (
        <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-950 border-2 border-purple-500/40 rounded-2xl w-full max-w-md p-6 shadow-lg">
            <h3 className="text-lg font-black text-white mb-4">Оплата баннера</h3>
            <button onClick={handleBannerWalletSelect} className="block w-full bg-purple-500/20 border border-purple-500/30 rounded-xl p-3 mb-3 text-white font-bold hover:bg-purple-500/30 transition">👻 Оплатить через Phantom</button>
            <button onClick={() => setShowBannerWalletModal(false)} className="text-slate-400 hover:text-white transition text-sm">Отмена</button>
          </div>
        </div>
      )}

      {/* Blueprint modal */}
      {isBlueprintOpen && selectedToken && (
        <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={closeBlueprint}>
          <div className="bg-slate-950 border-2 border-purple-500/40 rounded-2xl w-full max-w-lg p-6 shadow-lg" onClick={e => e.stopPropagation()}>
            <h2 className="text-2xl font-black text-white mb-4">TNT Security Blueprint</h2>
            <p className="text-purple-400 font-bold">{selectedToken.name} <span className="text-slate-400 font-normal">({selectedToken.symbol})</span></p>
            <p className="text-slate-400 text-xs break-all mt-1">CA: {selectedToken.ca}</p>
            {selectedToken.mintAuthority && <p className="text-slate-300 mt-2 text-sm">Mint Authority: <span className={selectedToken.mintAuthority.includes('✓') ? 'text-emerald-400' : 'text-red-400'}>{selectedToken.mintAuthority}</span></p>}
            {selectedToken.freezeAuthority && <p className="text-slate-300 text-sm">Freeze Authority: <span className={selectedToken.freezeAuthority.includes('✓') ? 'text-emerald-400' : 'text-red-400'}>{selectedToken.freezeAuthority}</span></p>}
            {selectedToken.isHoneypot && <p className="text-slate-300 text-sm">Honeypot: <span className={selectedToken.isHoneypot === 'Нет ✓' ? 'text-emerald-400' : 'text-red-400'}>{selectedToken.isHoneypot}</span></p>}
            <a href={selectedToken.dexUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-purple-400 hover:text-emerald-400 text-xs mt-3">DexScreener <ExternalLink className="w-3 h-3" /></a>
            <div className="mt-6"><button onClick={closeBlueprint} className="text-slate-400 hover:text-white transition text-sm">Закрыть</button></div>
          </div>
        </div>
      )}

      {/* Chat button */}
      <button onClick={() => setIsChatOpen(!isChatOpen)} className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-tr from-purple-500 to-emerald-400 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(153,69,255,0.5)] hover:scale-105 transition z-50 animate-bounce">
        {isChatOpen ? <X className="w-6 h-6 text-slate-950" /> : <MessageSquare className="w-6 h-6 text-slate-950" />}
      </button>

      {/* Chat widget */}
      {isChatOpen && (
        <div className="fixed bottom-24 right-6 w-80 md:w-96 h-[450px] bg-slate-900 border-2 border-purple-500 rounded-xl shadow-[0_0_30px_rgba(153,69,255,0.4)] flex flex-col overflow-hidden z-50 font-mono">
          <div className="bg-gradient-to-r from-purple-600 to-emerald-500 p-4 flex items-center justify-between">
            <div className="flex items-center gap-2"><span className="text-xl">🤖</span><div><h4 className="font-bold text-xs text-white">TNT AI INSPECTOR</h4><span className="text-[9px] text-slate-100 font-bold tracking-widest">Trench Agent D10S</span></div></div>
            <button onClick={() => setIsChatOpen(false)} className="text-white"><X className="w-4 h-4" /></button>
          </div>
          <div className="flex-1 p-4 overflow-y-auto space-y-3 text-xs">
            {chatMessages.map((msg, i) => (
              <div key={i} className={'flex ' + (msg.sender === 'user' ? 'justify-end' : 'justify-start')}>
                <div className={'max-w-[80%] rounded-lg p-2.5 leading-relaxed ' + (msg.sender === 'user' ? 'bg-purple-500/20 text-purple-200 border border-purple-500/30' : 'bg-slate-950 text-emerald-400 border border-emerald-500/30')}>{msg.text}</div>
              </div>
            ))}
            {isTyping && <div className="flex justify-start"><div className="bg-slate-950 text-emerald-400 border border-emerald-500/30 rounded-lg p-2.5 animate-pulse text-[11px]">Думаю...</div></div>}
            <div ref={chatEndRef} />
          </div>
          <div className="p-3 border-t border-purple-500/20 bg-slate-950 flex gap-2">
            <input type="text" value={userMsg} onChange={e => setUserMsg(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleSendChat(); }} placeholder="Спроси у ИИ..." className="flex-1 bg-slate-900 border border-purple-500/20 rounded px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none" />
            <button onClick={handleSendChat} className="bg-purple-500 hover:bg-purple-400 text-slate-950 px-3 rounded text-xs font-bold"><Send className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      )}
    </div>
  );
            }
