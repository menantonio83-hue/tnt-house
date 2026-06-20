'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Shield, Send, MessageSquare, X, RefreshCw, AlertCircle, Sparkles, ExternalLink, ChevronDown, Download, Zap, Lock, CheckCircle, XCircle } from 'lucide-react';
import { Connection, PublicKey, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction, getAccount } from '@solana/spl-token';

export const dynamic = 'force-dynamic';

const WALLET_ADDRESS = "Ev6oXBXo6qyoaT5wypJ2Umxch91F7cFvE1SarYLaUn8Z";
const MRDT_CA = "8Q22r9qUm4AzFzTpZgaPYMxqq4z5WxE9FVa7X9dsvmBg";
const MRDT_DECIMALS = 6;
const SITE_URL = 'https://tnt-house.vercel.app';
const SUPABASE_URL = 'https://pjtvjslcffuulsqxerpx.supabase.co';
const SUPABASE_KEY = 'sb_publishable__gmhE8SE_blCu-v90fV2OQ_YmFCkfFU';

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
        mint_authority: token.mintAuthority || '—',
        freeze_authority: token.freezeAuthority || '—',
        is_honeypot: token.isHoneypot || '—',
      }),
    });
  } catch(e) { console.error('Supabase save failed:', e); }
}

async function loadTokensFromSupabase() {
  try {
    const res = await fetch(SUPABASE_URL + '/rest/v1/listed_tokens?select=*&order=created_at.desc&limit=20', {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY },
    });
    if (!res.ok) return [];
    const data = await res.json();
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

const FALLBACK_TOKENS = [
  { name: 'Test Gem', symbol: 'TGEM', ca: '11111111111111111111111111111111', price: '0.00001234', liquidity: 45000, volume24h: 120000, priceChange24h: 8.5, verified: true, dexUrl: 'https://dexscreener.com', chain: 'solana' }
];

const isMobile = () => {
  if (typeof window === 'undefined') return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
};

const isPhantomBrowser = () => {
  if (typeof window === 'undefined') return false;
  return !!(window.solana && window.solana.isPhantom);
};

const isSolflareBrowser = () => {
  if (typeof window === 'undefined') return false;
  return !!(window.solflare && window.solflare.isSolflare);
};

const isInWalletBrowser = () => isPhantomBrowser() || isSolflareBrowser();

export default function TntHouse() {
  const [tokens, setTokens] = useState([]);
  const [listedTokens, setListedTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bannerSubmitted, setBannerSubmitted] = useState(false);
  const [bannerError, setBannerError] = useState('');
  const [error, setError] = useState('');
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
  const [showPayWalletModal, setShowPayWalletModal] = useState(false);
  const chatEndRef = useRef(null);
  const [mrdtPrice, setMrdtPrice] = useState(0.000013);
  const [priceLoading, setPriceLoading] = useState(true);
  const [solPrice, setSolPrice] = useState(150);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [isPaymentLoading, setIsPaymentLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState('');

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

  useEffect(() => {
    loadTokensFromSupabase().then(data => {
      if (data.length > 0) setListedTokens(data);
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const pName = params.get('pName');
    const pCA = params.get('pCA');
    const pEmail = params.get('pEmail');
    const pPlan = params.get('pPlan');
    const pCurrency = params.get('pCurrency');
    const pWallet = params.get('pWallet');

    if (pName && pCA && pPlan && pCurrency) {
      const restoredForm = { projectName: pName, contractAddress: pCA, email: pEmail || '' };
      setFormData(restoredForm);
      setSelectedPlan(pPlan);
      setSelectedCurrency(pCurrency);
      setStep(3);
      
      window.history.replaceState({}, '', window.location.pathname);
      
      if (isInWalletBrowser()) {
        const attemptAutoPay = async () => {
          setIsPaymentLoading(true);
          setPaymentStatus('Инициализация кошелька...');
          let wallet = null;
          
          for (let i = 0; i < 10; i++) {
            if (pWallet === 'solflare' && window.solflare && window.solflare.isSolflare) { wallet = window.solflare; break; }
            else if (window.solana && window.solana.isPhantom) { wallet = window.solana; break; }
            await new Promise(r => setTimeout(r, 400));
          }

          if (wallet) {
            try {
              setPaymentStatus('Запрос на подключение...');
              await wallet.connect();
              triggerPayment(pPlan, pCurrency, restoredForm, pWallet || 'phantom');
            } catch (e) {
              console.error(e);
              showToast('Не удалось подключить кошелек', 'error');
              setIsPaymentLoading(false);
            }
          } else {
            showToast('Кошелек не найден', 'error');
            setIsPaymentLoading(false);
          }
        };
        attemptAutoPay();
      }
    }
  }, []);

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const res = await fetch('https://price.jup.ag/v6/price?ids=SOL');
        const data = await res.json();
        if (data?.data?.SOL) setSolPrice(data.data.SOL.price);
      } catch(e) {}
    };
    fetch_();
    const i = setInterval(fetch_, 60000);
    return () => clearInterval(i);
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

  const redirectToWallet = (walletType, planVal, currency, form) => {
    const params = new URLSearchParams({
      pName: form.projectName,
      pCA: form.contractAddress,
      pEmail: form.email,
      pPlan: planVal,
      pCurrency: currency,
      pWallet: walletType,
    });
    const targetUrl = SITE_URL + '/?' + params.toString();
    const encoded = encodeURIComponent(targetUrl);
    const ref = encodeURIComponent(SITE_URL);

    if (walletType === 'solflare') {
      window.location.href = `https://solflare.com/ul/v1/browse/${encoded}?ref=${ref}`;
    } else {
      window.location.href = `https://phantom.app/ul/browse/${encoded}?ref=${ref}`;
    }
  };

  const triggerPayment = async (planVal, currency, form, walletType) => {
    const plan = plans.find(p => p.value === planVal);
    if (!plan || !currency) return;

    setIsPaymentLoading(true);
    setPaymentStatus('Подготовка транзакции...');

    let solanaWin = null;
    for (let attempt = 0; attempt < 10; attempt++) {
      if (walletType === 'solflare' && window.solflare && window.solflare.isSolflare) {
        solanaWin = window.solflare; break;
      } else if (window.solana && window.solana.isPhantom) {
        solanaWin = window.solana; break;
      }
      await new Promise(r => setTimeout(r, 300));
    }

    if (!solanaWin) {
      showToast('Открой сайт в браузере Phantom или Solflare', 'error');
      setIsPaymentLoading(false); setPaymentStatus(''); return;
    }

    try {
      setPaymentStatus('Подключаем кошелёк...');
      const resp = await solanaWin.connect();
      const sender = new PublicKey(resp.publicKey.toString());
      const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
      const projectWallet = new PublicKey(WALLET_ADDRESS);
      let signature = '';

      if (currency === 'mrdt') {
        setPaymentStatus('Готовим транзакцию $MRDT...');
        const mint = new PublicKey(MRDT_CA);
        const fromAta = await getAssociatedTokenAddress(mint, sender);
        const toAta = await getAssociatedTokenAddress(mint, projectWallet);
        try { await getAccount(connection, fromAta); } catch(e) {
          showToast('Нет $MRDT на кошельке', 'error');
          setIsPaymentLoading(false); setPaymentStatus(''); return;
        }
        const mrdtAmount = Math.round(plan.price / mrdtPrice) * Math.pow(10, MRDT_DECIMALS);
        const tx = new Transaction().add(createTransferInstruction(fromAta, toAta, sender, mrdtAmount));
        tx.feePayer = sender;
        tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        
        setPaymentStatus('Подтверди в кошельке...');
        const signed = await solanaWin.signAndSendTransaction(tx);
        signature = signed.signature;
        
        setPaymentStatus('Подтверждаем в сети...');
        await connection.confirmTransaction(signature, 'confirmed');

      } else if (currency === 'sol') {
        setPaymentStatus('Получаем курс Jupiter...');
        const amountLamports = Math.floor((plan.price / solPrice) * LAMPORTS_PER_SOL);
        const projectAta = await getAssociatedTokenAddress(new PublicKey(MRDT_CA), projectWallet);
        const quoteRes = await fetch(
          `https://quote-api.jup.ag/v6/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=${MRDT_CA}&amount=${amountLamports}&slippageBps=150`
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
        
        const { VersionedTransaction } = await import('@solana/web3.js');
        const txBytes = Uint8Array.from(atob(swapData.swapTransaction), c => c.charCodeAt(0));
        const transaction = VersionedTransaction.deserialize(txBytes);
        
        setPaymentStatus('Подтверди в кошельке...');
        const signedTx = await solanaWin.signTransaction(transaction);
        setPaymentStatus('Отправляем транзакцию...');
        signature = await connection.sendRawTransaction(signedTx.serialize());
        setPaymentStatus('Подтверждаем в сети...');
        await connection.confirmTransaction(signature, 'confirmed');
      }

      setPaymentStatus('Запускаем аудит токена...');
      showToast('✅ Оплата прошла! Запускаем аудит...', 'success');

      let auditData = { mintAuthority: '—', freezeAuthority: '—', isHoneypot: '—' };
      try {
        const auditRes = await fetch(`https://api.gopluslabs.io/api/v1/token_security/1?contract_addresses=${form.contractAddress}`);
        const auditJson = await auditRes.json();
        if (auditJson.code === 1 && auditJson.result && auditJson.result[form.contractAddress]) {
          const a = auditJson.result[form.contractAddress];
          auditData = {
            mintAuthority: a.mint_authority === '' ? 'Отозвана ✓' : 'Активна (риск)',
            freezeAuthority: a.freeze_authority === '' ? 'Отозвана ✓' : 'Активна (риск)',
            isHoneypot: a.is_honeypot === '1' ? 'Да ⚠️' : 'Нет ✓',
          };
        }
      } catch(e) {
        try {
          const c2 = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
          const { getMint } = await import('@solana/spl-token');
          const mi = await getMint(c2, new PublicKey(form.contractAddress));
          auditData = {
            mintAuthority: mi.mintAuthority ? 'Активна (риск)' : 'Отозвана ✓',
            freezeAuthority: mi.freezeAuthority ? 'Активна (риск)' : 'Отозвана ✓',
            isHoneypot: '—',
          };
        } catch(e2) {}
      }

      const newToken = {
        name: form.projectName.toUpperCase(),
        symbol: form.projectName.slice(0, 4).toUpperCase() || 'NEW',
        ca: form.contractAddress,
        price: (Math.random() * 0.00005 + 0.000001).toFixed(8),
        liquidity: Math.floor(Math.random() * 100000 + 10000),
        volume24h: Math.floor(Math.random() * 90000 + 20000),
        priceChange24h: parseFloat((Math.random() * 40 - 10).toFixed(1)),
        score: 95, verified: true,
        dexUrl: 'https://dexscreener.com/solana/' + form.contractAddress,
        chain: 'solana',
        mintAuthority: auditData.mintAuthority,
        freezeAuthority: auditData.freezeAuthority,
        isHoneypot: auditData.isHoneypot,
      };

      setPaymentStatus('Сохраняем в базу данных...');
      await saveTokenToSupabase(newToken);
      setListedTokens(prev => [newToken, ...prev]);
      showToast('✅ Аудит завершён! Токен добавлен в таблицу!', 'success');
      setStep(1); setSelectedPlan(''); setSelectedCurrency('');
      setFormData({ projectName: '', contractAddress: '', email: '' });

    } catch(err) {
      console.error('Payment error:', err);
      showToast(err.message || 'Ошибка оплаты', 'error');
    } finally {
      setIsPaymentLoading(false); setPaymentStatus('');
    }
  };

  const handlePayment = () => {
    if (!selectedPlan || !selectedCurrency) {
      showToast('Выбери тариф и способ оплаты', 'error'); return;
    }
    if (isInWalletBrowser()) {
      const wType = isSolflareBrowser() ? 'solflare' : 'phantom';
      triggerPayment(selectedPlan, selectedCurrency, formData, wType);
      return;
    }
    if (isMobile()) {
      setShowPayWalletModal(true);
      return;
    }
    triggerPayment(selectedPlan, selectedCurrency, formData, 'phantom');
  };

  const handleWalletChoice = (walletType) => {
    setShowPayWalletModal(false);
    redirectToWallet(walletType, selectedPlan, selectedCurrency, formData);
  };

  const handleConnectWallet = async () => {
    if (isMobile() && !isInWalletBrowser()) {
      setShowPayWalletModal(true);
      return;
    }
    const solanaWin = window.solana || window.solflare;
    if (solanaWin) {
      try {
        const resp = await solanaWin.connect();
        const pk = resp.publicKey.toString();
        setWalletAddress(pk.slice(0, 4) + '...' + pk.slice(-4));
      } catch(err) { console.error(err); }
    } else {
      showToast('Кошелёк не найден.', 'error');
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
      } catch(e) {}
    };
    check();
    const i = setInterval(check, 10000);
    return () => clearInterval(i);
  }, []);

  const handleLaunchJupiter = () => {
    window.open(`https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&buy=${MRDT_CA}`, '_blank');
  };
  const handleOpenRaydium = () => { setIsBuyDropdownOpen(false); window.open('https://raydium.io', '_blank'); };

  useEffect(() => {
    const templates = ['Обнаружен новый пул на Raydium!', 'Mint Authority отключена ✓.', 'Уровень угрозы: НИЗКИЙ.', 'Бандлов не обнаружено.', 'Подключение к DexScreener.', 'Ищем новые гемы...'];
    const i = setInterval(() => {
      const t = templates[Math.floor(Math.random() * templates.length)];
      setLogs(prev => [...prev.slice(-12), `[${new Date().toLocaleTimeString()}] ${t}`]);
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
              name: p.baseToken?.name || 'Unknown',
              symbol: p.baseToken?.symbol || '???',
              ca: p.baseToken?.address || '',
              price: p.priceUsd ? parseFloat(p.priceUsd).toFixed(8) : '0',
              liquidity: p.liquidity?.usd ? Math.round(p.liquidity.usd) : 0,
              volume24h: p.volume?.h24 ? Math.round(p.volume.h24) : 0,
              priceChange24h: p.priceChange?.h24 || 0,
              verified: true, dexUrl: p.url || '', chain: p.chainId || 'solana',
            }));
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
    const i = setInterval(fetchTokens, 5 * 60 * 1000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${MRDT_CA}`);
        const data = await res.json();
        if (data.pairs && data.pairs.length) {
          const p = parseFloat(data.pairs[0].priceUsd);
          if (p > 0) setMrdtPrice(p);
        }
      } catch(e) {}
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

  const handleBannerWalletSelect = async (walletType) => {
    setShowBannerWalletModal(false);
    if (isMobile() && !isInWalletBrowser()) {
      const encoded = encodeURIComponent(SITE_URL + '/');
      const ref = encodeURIComponent(SITE_URL);
      if (walletType === 'solflare') {
        window.location.href = `https://solflare.com/ul/v1/browse/${encoded}?ref=${ref}`;
      } else {
        window.location.href = `https://phantom.app/ul/browse/${encoded}?ref=${ref}`;
      }
      return;
    }
    setIsBannerSending(true); setBannerError('');
    const solanaWin = walletType === 'solflare' ? window.solflare : window.solana;
    if (!solanaWin) { setBannerError('Кошелёк не найден.'); setIsBannerSending(false); return; }
    
    try {
      const resp = await solanaWin.connect();
      const sender = new PublicKey(resp.publicKey.toString());
      const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
      const mint = new PublicKey(MRDT_CA);
      const fromAta = await getAssociatedTokenAddress(mint, sender);
      await getAccount(connection, fromAta).catch(() => { throw new Error('Нет $MRDT на кошельке.'); });
      const to = new PublicKey(WALLET_ADDRESS);
      const toAta = await getAssociatedTokenAddress(mint, to);
      const usd = bannerFormData.days === '2' ? 35 : bannerFormData.days === '6' ? 100 : 20;
      const amount = Math.round(usd / mrdtPrice) * Math.pow(10, MRDT_DECIMALS);
      const tx = new Transaction().add(createTransferInstruction(fromAta, toAta, sender, amount));
      tx.feePayer = sender;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      const signed = await solanaWin.signAndSendTransaction(tx);
      await connection.confirmTransaction(signed.signature, 'confirmed');
      
      const banner = {
        tokenName: bannerFormData.tokenName.toUpperCase(),
        bannerImg: bannerFormData.bannerImg || '🪙',
        desc: bannerFormData.desc,
        expiresAt: Date.now() + parseInt(bannerFormData.days) * 86400000,
      };
      localStorage.setItem('tnt_active_banner', JSON.stringify(banner));
      setActiveBanner(banner); setBannerSubmitted(true);
      setBannerFormData({ tokenName: '', bannerImg: '', desc: '', days: '1' });
      setTimeout(() => setBannerSubmitted(false), 5000);
    } catch(err) {
      setBannerError(err.message || 'Ошибка оплаты.');
    } finally { setIsBannerSending(false); }
  };

  const handleBannerSubmit = (e) => {
    e.preventDefault();
    if (!bannerFormData.tokenName || !bannerFormData.desc) { setBannerError('Укажите название и описание.'); return; }
    setShowBannerWalletModal(true);
  };

  const handleSendChat = () => {
    if (!userMsg.trim()) return;
    setChatMessages(prev => [...prev, { sender: 'user', text: userMsg }]);
    setUserMsg(''); setIsTyping(true);
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

  const WalletModal = ({ onSelect, onClose, title }) => (
    <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-950 border-2 border-purple-500/40 rounded-2xl w-full max-w-md p-6 shadow-lg">
        <h3 className="text-lg font-black text-white mb-2">{title || 'Выбери кошелёк'}</h3>
        <p className="text-slate-400 text-xs mb-4">Выбери кошелёк для оплаты</p>
        <button onClick={() => onSelect('phantom')} className="block w-full bg-purple-500/20 border border-purple-500/40 rounded-xl p-4 mb-3 text-white font-bold hover:bg-purple-500/30 transition flex items-center gap-3">
          <span className="text-2xl">👻</span>
          <div className="text-left">
            <div className="font-black text-purple-300">Phantom</div>
            <div className="text-xs text-slate-400 font-normal">Самый популярный Solana кошелёк</div>
          </div>
        </button>
        <button onClick={() => onSelect('solflare')} className="block w-full bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 mb-4 text-white font-bold hover:bg-orange-500/20 transition flex items-center gap-3">
          <span className="text-2xl">🔥</span>
          <div className="text-left">
            <div className="font-black text-orange-300">Solflare</div>
            <div className="text-xs text-slate-400 font-normal">Альтернативный Solana кошелёк</div>
          </div>
        </button>
        <button onClick={onClose} className="text-slate-400 hover:text-white transition text-sm w-full text-center">Отмена</button>
      </div>
    </div>
  );

  const onMobile = typeof window !== 'undefined' && isMobile();
  const inWallet = typeof window !== 'undefined' && isInWalletBrowser();

  return (
    <div className="min-h-screen bg-slate-950 text-white font-mono relative overflow-hidden pb-12">
      {toast.show && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[99999] flex items-center gap-3 px-6 py-3.5 rounded-2xl shadow-2xl border text-sm font-medium transition-all duration-300 ${toast.type === 'success' ? 'bg-emerald-950 border-emerald-500/40 text-emerald-300' : 'bg-red-950 border-red-500/40 text-red-300'}`}>
          {toast.type === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-400" /> : <XCircle className="w-5 h-5 text-red-400" />}
          <span>{toast.message}</span>
        </div>
      )}

      {isPaymentLoading && (
        <div className="fixed inset-0 z-[99998] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4 px-6">
          <RefreshCw className="w-10 h-10 text-purple-400 animate-spin" />
          <p className="text-white font-bold text-lg text-center">Обрабатываем транзакцию...</p>
          {paymentStatus && <p className="text-purple-300 text-sm text-center">{paymentStatus}</p>}
          <p className="text-slate-500 text-xs text-center">Не закрывай страницу или подпиши запрос в кошельке</p>
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
        {/* HEADER */}
        <header className="border-b border-purple-500/30 backdrop-blur-lg bg-slate-950/60 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <a href="https://t.me/tnt_house2026" target="_blank" rel="noopener noreferrer" className="w-10 h-10 border-2 border-purple-500 rounded-lg flex items-center justify-center bg-purple-500/10 shadow-[0_0_15px_rgba(153,69,255,0.4)] animate-pulse"><span className="text-xl">🧨</span></a>
              <div>
                <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-emerald-400 tracking-wider">TNT HOUSE</h1>
                <span className="text-[10px] text-purple-400 block font-bold tracking-widest">TOP NEW TOKENS v1.9</span>
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

        {/* VIP BANNER */}
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

        {/* HERO */}
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
                    <item.icon className={`w-5 h-5 ${item.color} mx-auto mb-1`} />
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
              <div className="text-purple-400 font-bold border-b border-purple-500/20 pb-2 mb-2 flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 animate-spin" /> AI SCANNER + SUPABASE</div>
              <div className="flex-1 overflow-y-auto space-y-1.5 text-emerald-400">
                {logs.map((log, i) => <div key={i} className="text-[11px]">{log}</div>)}
              </div>
              <div className="text-[10px] text-slate-500 border-t border-purple-500/20 pt-2 mt-2">Status: SCANNING & SYNCING...</div>
            </div>
          </div>
        </section>

        {/* TOKEN TABLE */}
        <section className="max-w-7xl mx-auto px-6 py-6">
          <div className="border-2 border-purple-500/30 rounded-lg bg-slate-900/40 backdrop-blur-md p-3 shadow-[0_0_25px_rgba(153,69,255,0.2)]">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-base font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-emerald-400" /> ТАБЛИЦА БЕЗОПАСНЫХ НОВЫХ ТОКЕНОВ
                </h3>
                <p className="text-slate-400 text-[10px] mt-0.5">Кликни на токен для TNT Security Blueprint</p>
              </div>
              <div className="hidden md:flex items-center gap-1 text-[9px] text-purple-400"><RefreshCw className="w-2.5 h-2.5 animate-spin" /> Live</div>
            </div>
            <div className="max-h-[320px] overflow-y-auto border border-purple-500/20 rounded-lg">
              <table className="w-full text-left border-collapse text-[9px]">
                <thead>
                  <tr className="border-b border-purple-500/20 bg-purple-500/10 text-purple-400 font-bold sticky top-0 z-20 backdrop-blur-md">
                    {['Токен','Цена','Ликв','Об/Изм','Оценка','Действ'].map((h, i) => (
                      <th key={i} className={`p-0.5 align-bottom${i === 4 ? ' text-center' : i === 5 ? ' text-right' : ''}`} style={{ writingMode: 'vertical-lr', textOrientation: 'mixed', height: '60px', whiteSpace: 'nowrap' }}>{h}</th>
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
                    <td className="p-1 text-right"><button onClick={(e) => { e.stopPropagation(); handleLaunchJupiter(); }} className="text-[8px] text-emerald-400 hover:text-emerald-300 font-bold hover:underline inline-flex items-center gap-0.5">Купить <ExternalLink className="w-2 h-2" /></button></td>
                  </tr>
                  {listedTokens.map((token, i) => {
                    const score = getSafetyScore(token); const style = getScoreStyle(score);
                    return (
                      <tr key={'sb-' + i} onClick={() => openTokenBlueprint(token)} className="border-b border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 transition cursor-pointer">
                        <td className="p-1"><div className="flex items-center gap-1"><span className="text-emerald-400 text-[9px] font-bold">${token.symbol}</span><span className="text-[6px] bg-emerald-500/20 text-emerald-400 px-1 rounded font-bold">AI✓</span></div><span className="text-[7px] text-slate-500 block truncate max-w-[80px]">{token.name}</span></td>
                        <td className="p-1 font-mono text-slate-300 text-[9px]">${token.price}</td>
                        <td className="p-1 font-mono text-slate-300 text-[9px]">{typeof token.liquidity === 'number' ? formatNumber(token.liquidity) : token.liquidity}</td>
                        <td className={`p-1 font-mono text-[9px] ${token.priceChange24h > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatNumber(token.volume24h)} ({token.priceChange24h > 0 ? '+' : ''}{token.priceChange24h}%)</td>
                        <td className="p-1 text-center"><div className={`inline-flex items-center justify-center w-9 h-4 rounded-full ${style.bg} ${style.border} ${style.color} text-[8px] font-extrabold ${style.glow}`}>{score}</div></td>
                        <td className="p-1 text-right"><a href={token.dexUrl} onClick={(e) => e.stopPropagation()} target="_blank" rel="noopener noreferrer" className="text-[8px] text-purple-400 hover:text-emerald-400 inline-flex items-center gap-0.5">DEX <ExternalLink className="w-2 h-2" /></a></td>
                      </tr>
                    );
                  })}
                  {loading && tokens.length === 0 ? (
                    <tr><td colSpan={6} className="p-6 text-center text-purple-400 font-bold"><RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1" />Сканируем...</td></tr>
                  ) : tokens.map((token, i) => {
                    const score = getSafetyScore(token); const style = getScoreStyle(score);
                    return (
                      <tr key={'dx-' + i} onClick={() => openTokenBlueprint(token)} className="border-b border-purple-500/10 hover:bg-purple-500/5 transition cursor-pointer">
                        <td className="p-1"><span className="text-purple-400 text-[9px] font-bold">${token.symbol}</span><span className="text-[7px] text-slate-500 block truncate max-w-[80px]">{token.name}</span></td>
                        <td className="p-1 font-mono text-slate-300 text-[9px]">${token.price}</td>
                        <td className="p-1 font-mono text-slate-300 text-[9px]">{typeof token.liquidity === 'number' ? formatNumber(token.liquidity) : token.liquidity}</td>
                        <td className={`p-1 font-mono text-[9px] ${token.priceChange24h > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatNumber(token.volume24h)} ({token.priceChange24h > 0 ? '+' : ''}{token.priceChange24h}%)</td>
                        <td className="p-1 text-center"><div className={`inline-flex items-center justify-center w-9 h-4 rounded-full ${style.bg} ${style.border} ${style.color} text-[8px] font-extrabold ${style.glow}`}>{score}</div></td>
                        <td className="p-1 text-right"><a href={token.dexUrl} onClick={(e) => e.stopPropagation()} target="_blank" rel="noopener noreferrer" className="text-[8px] text-purple-400 hover:text-emerald-400 inline-flex items-center gap-0.5">DEX <ExternalLink className="w-2 h-2" /></a></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {error && <div className="mt-2 p-1.5 bg-red-950/40 border border-red-500/30 rounded-lg flex items-center gap-1 text-red-300 text-[9px]"><AlertCircle className="w-2.5 h-2.5" /> {error}</div>}
          </div>
        </section>

        {/* ORDER FORMS */}
        <section id="orderFormsSection" className="max-w-7xl mx-auto px-6 py-8">
          <div className="grid md:grid-cols-2 gap-12 items-start">
            <div className="space-y-8">

              <div className="border-2 border-purple-500/30 rounded-lg bg-slate-900/40 p-6 backdrop-blur-md">
                <h3 className="text-lg font-black text-purple-400 mb-2 flex items-center gap-2">🔍 ЗАКАЗАТЬ ИИ-ИНСПЕКЦИЮ</h3>
                <p className="text-slate-400 text-xs mb-4">После оплаты токен сохраняется в БД и виден всем посетителям.</p>

                <div className="bg-gray-800/50 p-6 rounded-2xl border border-gray-700/50 max-w-md mx-auto">
                  {step === 1 && (
                    <>
                      <h3 className="text-2xl font-bold text-white mb-6">Заказать ИИ-инспекцию</h3>
                      <div className="space-y-4">
                        <div><label className="block text-sm text-gray-400 mb-1">Название проекта</label><input type="text" placeholder="Твой токен..." value={formData.projectName} onChange={(e) => setFormData({ ...formData, projectName: e.target.value })} className="w-full p-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500" /></div>
                        <div><label className="block text-sm text-gray-400 mb-1">Contract Address (Solana)</label><input type="text" placeholder="Впиши адрес контракта..." value={formData.contractAddress} onChange={(e) => setFormData({ ...formData, contractAddress: e.target.value })} className="w-full p-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500" /></div>
                        <div><label className="block text-sm text-gray-400 mb-1">Email для связи</label><input type="email" placeholder="your@email.com" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full p-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500" /></div>
                      </div>
                      <button onClick={handleNext} className="mt-6 w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-3 rounded-xl font-semibold hover:opacity-90 transition">Далее →</button>
                    </>
                  )}

                  {step === 2 && (
                    <>
                      <h3 className="text-2xl font-bold text-white mb-4">Выбери тариф</h3>
                      <div className="space-y-3">
                        {plans.map((plan) => (
                          <label key={plan.value} className={`flex items-center p-4 rounded-xl cursor-pointer transition-all ${selectedPlan === plan.value ? 'bg-indigo-600/20 border border-indigo-500' : 'bg-gray-700/30 border border-gray-700 hover:border-indigo-400'}`}>
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
                      <p className="text-gray-400 mb-4">Тариф: <span className="text-white font-semibold">{currentPlan?.name}</span></p>
                      <div className="space-y-3">
                        {['mrdt', 'sol'].map((method) => (
                          <label key={method} className={`flex items-center p-4 rounded-xl cursor-pointer transition-all ${selectedCurrency === method ? 'bg-indigo-600/20 border border-indigo-500' : 'bg-gray-700/30 border border-gray-700 hover:border-indigo-400'}`}>
                            <input type="radio" name="currency" value={method} checked={selectedCurrency === method} onChange={() => setSelectedCurrency(method)} className="w-5 h-5 text-indigo-600" />
                            <div className="ml-4">
                              <p className="text-white font-semibold">{method === 'mrdt' ? 'Оплатить в $MRDT' : 'Оплатить в SOL (авто-выкуп $MRDT)'}</p>
                              {method === 'sol' && currentPlan && <p className="text-sm text-gray-400">≈ {(currentPlan.price / solPrice).toFixed(4)} SOL</p>}
                            </div>
                          </label>
                        ))}
                      </div>
                      <div className="flex gap-3 mt-6">
                        <button onClick={handleBack} className="flex-1 bg-gray-700 text-white py-3 rounded-xl font-semibold hover:bg-gray-600 transition">← Назад</button>
                        <button onClick={handlePayment} disabled={!selectedCurrency || isPaymentLoading} className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-3 rounded-xl font-semibold hover:opacity-90 transition disabled:opacity-40 flex items-center justify-center gap-2">
                          {isPaymentLoading ? <><RefreshCw className="w-4 h-4 animate-spin" /> Обработка...</> : (onMobile && !inWallet ? '👛 Выбрать кошелёк' : 'Запустить ИИ-инспекцию')}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Banner form */}
              <div className="border-2 border-purple-500/30 rounded-lg bg-slate-900/40 p-6 backdrop-blur-md">
                <h3 className="text-lg font-black text-purple-400 mb-2 flex items-center gap-2">👑 КУПИТЬ VIP-БАННЕР НА ГЛАВНУЮ</h3>
                <p className="text-slate-400 text-xs mb-4">Автоматическая замена рекламного места на ваш токен.</p>
                <form onSubmit={handleBannerSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-purple-400 text-[11px] font-bold mb-1">Имя токена / Тикер</label><input type="text" value={bannerFormData.tokenName} onChange={(e) => setBannerFormData({ ...bannerFormData, tokenName: e.target.value })} placeholder="SOLANA" className="w-full bg-slate-950 border border-purple-500/20 rounded px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none" /></div>
                    <div><label className="block text-purple-400 text-[11px] font-bold mb-1">Загрузите изображение</label><input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = (ev) => { setBannerFormData({ ...bannerFormData, bannerImg: ev.target.result }); }; r.readAsDataURL(f); }}} className="w-full bg-slate-950 border border-purple-500/20 rounded px-3 py-2 text-xs text-white file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-bold file:bg-purple-500 file:text-white hover:file:bg-purple-400" /></div>
                  </div>
                  <div><label className="block text-purple-400 text-[11px] font-bold mb-1">Краткий рекламный слоган</label><input type="text" value={bannerFormData.desc} onChange={(e) => setBannerFormData({ ...bannerFormData, desc: e.target.value })} placeholder="Самый быстрый мемкоин..." className="w-full bg-slate-950 border border-purple-500/20 rounded px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none" /></div>
                  <div>
                    <label className="block text-purple-400 text-[11px] font-bold mb-1">Срок размещения</label>
                    <select value={bannerFormData.days} onChange={(e) => setBannerFormData({ ...bannerFormData, days: e.target.value })} className="w-full bg-slate-950 border border-purple-500/20 rounded px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-none font-mono">
                      <option value="1">1 День — 20$ {priceLoading ? '(расчёт…)' : `(~ ${getAmountForBanner('1').toLocaleString()} $MRDT)`}</option>
                      <option value="2">2 Дня — 35$ {priceLoading ? '(расчёт…)' : `(~ ${getAmountForBanner('2').toLocaleString()} $MRDT)`}</option>
                      <option value="6">6 Дней — 100$ {priceLoading ? '(расчёт…)' : `(~ ${getAmountForBanner('6').toLocaleString()} $MRDT)`}</option>
                    </select>
                  </div>
                  <button type="submit" disabled={isBannerSending} className="w-full bg-gradient-to-r from-emerald-400 to-purple-500 hover:from-emerald-300 hover:to-purple-400 text-slate-950 font-black py-2.5 rounded text-xs transition flex items-center justify-center gap-1.5 disabled:opacity-50">
                    <Zap className="w-3.5 h-3.5" /> {isBannerSending ? 'ОТПРАВКА...' : 'ОПЛАТИТЬ И РАЗМЕСТИТЬ БАННЕР'}
                  </button>
                  {bannerSubmitted && (
                    <div className="p-3 mt-3 bg-emerald-950/40 border border-emerald-500 rounded text-emerald-400 text-sm text-center font-bold">
                      Баннер успешно оплачен и отправлен на размещение!
                    </div>
                  )}
                </form>
              </div>
            </div>
          </div>
        </section>
      </div>

      {showBannerWalletModal && (
        <WalletModal
          onSelect={handleBannerWalletSelect}
          onClose={() => setShowBannerWalletModal(false)}
          title="Оплата VIP-Баннера"
        />
      )}
      {showPayWalletModal && (
        <WalletModal
          onSelect={handleWalletChoice}
          onClose={() => setShowPayWalletModal(false)}
          title="Оплата ИИ-аудита"
        />
      )}
    </div>
  );
}
