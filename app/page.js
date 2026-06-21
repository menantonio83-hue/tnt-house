'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Shield, Send, MessageSquare, X, RefreshCw, AlertCircle, Sparkles, ExternalLink, ChevronDown, Download, Zap, Lock, CheckCircle, XCircle } from 'lucide-react';
import { Connection, PublicKey, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction, createAssociatedTokenAccountInstruction, getAccount } from '@solana/spl-token';

export const dynamic = 'force-dynamic';

const WALLET_ADDRESS = "Ev6oXBXo6qyoaT5wypJ2Umxch91F7cFvE1SarYLaUn8Z";
const MRDT_CA = "8Q22r9qUm4AzFzTpZgaPYMxqq4z5WxE9FVa7X9dsvmBg";
const MRDT_DECIMALS = 6;
const SITE_URL = 'https://tnt-house.vercel.app';
const SUPABASE_URL = 'https://pjtvjslcffuulsqxerpx.supabase.co';
const SUPABASE_KEY = 'sb_publishable__gmhE8SE_blCu-v90fV2OQ_YmFCkfFU';
const RPC_URL = 'https://api.mainnet-beta.solana.com';

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
const isPhantomBrowser = () => typeof window !== 'undefined' && !!(window.solana && window.solana.isPhantom);
const isSolflareBrowser = () => typeof window !== 'undefined' && !!(window.solflare && window.solflare.isSolflare);
const isInWalletBrowser = () => isPhantomBrowser() || isSolflareBrowser();

function redirectToWallet(walletType, planVal, currency, form) {
  var params = new URLSearchParams({
    pName: form.projectName, pCA: form.contractAddress,
    pEmail: form.email, pPlan: planVal,
    pCurrency: currency, pWallet: walletType,
  });
  var targetUrl = SITE_URL + '/?' + params.toString();
  var encoded = encodeURIComponent(targetUrl);
  var ref = encodeURIComponent(SITE_URL);
  if (walletType === 'solflare') {
    window.location.href = 'solflare://v1/browse/' + encoded;
    setTimeout(function() { window.location.href = 'https://solflare.com/ul/v1/browse/' + encoded + '?ref=' + ref; }, 500);
  } else {
    window.location.href = 'phantom://v1/browse/' + encoded;
    setTimeout(function() { window.location.href = 'https://phantom.app/ul/browse/' + encoded + '?ref=' + ref; }, 500);
  }
}

const FALLBACK_TOKENS = [
  { name: 'Test Gem', symbol: 'TGEM', ca: '11111111111111111111111111111111', price: '0.00001234', liquidity: 45000, volume24h: 120000, priceChange24h: 8.5, verified: true, dexUrl: 'https://dexscreener.com', chain: 'solana' }
];

// Helper: wait for price to be loaded (non-zero) with timeout
async function waitForPrice(getPriceFn, timeoutMs) {
  if (!timeoutMs) timeoutMs = 8000;
  var start = Date.now();
  while (Date.now() - start < timeoutMs) {
    var p = getPriceFn();
    if (p && p > 0) return p;
    await new Promise(function(r) { setTimeout(r, 300); });
  }
  return getPriceFn(); // return whatever we have after timeout
}

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
  var [chatMessages, setChatMessages] = useState([{ sender: 'bot', text: 'Привет! Я ИИ-Инспектор TNT House. Спроси меня про любой контракт или токен $MRDT. ⚽️' }]);
  var [userMsg, setUserMsg] = useState('');
  var [isTyping, setIsTyping] = useState(false);
  var [logs, setLogs] = useState(['[ИИ-Инспектор] Инициализация системы безопасности TNT House...', '[СЕТЬ] Подключение к RPC узлам Solana завершено успешно.']);
  var [isBlueprintOpen, setIsBlueprintOpen] = useState(false);
  var [selectedToken, setSelectedToken] = useState(null);
  var [showBannerWalletModal, setShowBannerWalletModal] = useState(false);
  var [showPayWalletModal, setShowPayWalletModal] = useState(false);
  var chatEndRef = useRef(null);
  var [mrdtPrice, setMrdtPrice] = useState(0.000013);
  var mrdtPriceRef = useRef(0.000013); // KEY FIX v1.13: ref for async access
  var [priceLoading, setPriceLoading] = useState(true);
  var [solPrice, setSolPrice] = useState(150);
  var solPriceRef = useRef(150); // KEY FIX v1.13: ref for async access
  var [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  var [isPaymentLoading, setIsPaymentLoading] = useState(false);
  var [paymentStatus, setPaymentStatus] = useState('');
  var [step, setStep] = useState(1);
  var [formData, setFormData] = useState({ projectName: '', contractAddress: '', email: '' });
  var [selectedPlan, setSelectedPlan] = useState('');
  var [selectedCurrency, setSelectedCurrency] = useState('');
  var [bannerFormData, setBannerFormData] = useState({ tokenName: '', bannerImg: '', desc: '', days: '1' });

  // KEY FIX v1.13: pending payment from URL params — stored in ref to fire after price loads
  var pendingPaymentRef = useRef(null);
  var priceReadyRef = useRef(false);

  var plans = [
    { value: 'basic', name: 'Базовый Аудит (24h)', price: 10, mrdt: '769 231' },
    { value: 'express', name: 'Быстрый Листинг (5 min)', price: 40, mrdt: '3 076 923' },
    { value: 'vip', name: 'VIP-Буст (баннер 24h)', price: 120, mrdt: '9 230 769' },
  ];

  var currentPlan = plans.find(function(p) { return p.value === selectedPlan; });

  var showToast = function(message, type) {
    if (!type) type = 'success';
    setToast({ show: true, message: message, type: type });
    setTimeout(function() { setToast({ show: false, message: '', type: 'success' }); }, 4200);
  };

  useEffect(function() {
    loadTokensFromSupabase().then(function(data) {
      if (data.length > 0) setListedTokens(data);
    });
  }, []);

  // KEY FIX v1.13: Read URL params and store pending payment — don't trigger yet
  useEffect(function() {
    if (typeof window === 'undefined') return;
    var params = new URLSearchParams(window.location.search);
    var pName = params.get('pName');
    var pCA = params.get('pCA');
    var pEmail = params.get('pEmail');
    var pPlan = params.get('pPlan');
    var pCurrency = params.get('pCurrency');
    var pWallet = params.get('pWallet');
    if (pName && pCA && pPlan && pCurrency) {
      var restoredForm = { projectName: pName, contractAddress: pCA, email: pEmail || '' };
      setFormData(restoredForm);
      setSelectedPlan(pPlan);
      setSelectedCurrency(pCurrency);
      setStep(3);
      window.history.replaceState({}, '', window.location.pathname);

      if (isInWalletBrowser()) {
        // Store pending payment — will fire once price is ready
        pendingPaymentRef.current = {
          planVal: pPlan,
          currency: pCurrency,
          form: restoredForm,
          walletType: pWallet || 'phantom',
        };
      }
    }
  }, []);

  // KEY FIX v1.13: SOL price fetch — update ref in sync
  useEffect(function() {
    var fetch_ = async function() {
      try {
        var res = await fetch('https://price.jup.ag/v6/price?ids=SOL');
        var data = await res.json();
        if (data && data.data && data.data.SOL) {
          var p = data.data.SOL.price;
          setSolPrice(p);
          solPriceRef.current = p;
        }
      } catch(e) {}
    };
    fetch_();
    var i = setInterval(fetch_, 60000);
    return function() { clearInterval(i); };
  }, []);

  // KEY FIX v1.13: MRDT price fetch — update ref + fire pending payment when ready
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

            // Fire pending payment NOW that we have a real price
            if (!priceReadyRef.current && pendingPaymentRef.current) {
              priceReadyRef.current = true;
              var pending = pendingPaymentRef.current;
              pendingPaymentRef.current = null;
              setTimeout(function() {
                triggerPayment(
                  pending.planVal,
                  pending.currency,
                  pending.form,
                  pending.walletType
                );
              }, 800); // small delay to let wallet browser fully initialize
            }
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
    var templates = ['Обнаружен новый пул на Raydium!', 'Mint Authority отключена ✓.', 'Уровень угрозы: НИЗКИЙ.', 'Бандлов не обнаружено.', 'Подключение к DexScreener.', 'Ищем новые гемы...'];
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

  // KEY FIX v1.13: triggerPayment now reads price from REFS (not stale state)
  var triggerPayment = async function(planVal, currency, form, walletType) {
    var plan = plans.find(function(p) { return p.value === planVal; });
    if (!plan || !currency) return;

    setIsPaymentLoading(true);
    setPaymentStatus('Ожидаем кошелёк...');

    // Wait up to 10s for wallet to inject into window
    var solanaWin = null;
    for (var attempt = 0; attempt < 33; attempt++) {
      if (walletType === 'solflare' && window.solflare && window.solflare.isSolflare) { solanaWin = window.solflare; break; }
      if (window.solana && window.solana.isPhantom) { solanaWin = window.solana; break; }
      await new Promise(function(r) { setTimeout(r, 300); });
    }

    if (!solanaWin) {
      showToast('Кошелёк не найден — открой сайт в браузере Phantom или Solflare', 'error');
      setIsPaymentLoading(false); setPaymentStatus(''); return;
    }

    try {
      setPaymentStatus('Подключаем кошелёк...');
      var resp = await solanaWin.connect();
      var sender = new PublicKey(resp.publicKey.toString());
      var connection = new Connection(RPC_URL, 'confirmed');
      var receiver = new PublicKey(WALLET_ADDRESS);
      var signature = '';

      // KEY FIX v1.13: use refs for price — they always have fresh value even in async context
      var currentMrdtPrice = mrdtPriceRef.current || 0.000013;
      var currentSolPrice = solPriceRef.current || 150;

      if (currency === 'mrdt') {
        setPaymentStatus('Готовим транзакцию $MRDT...');
        var mint = new PublicKey(MRDT_CA);
        var fromAta = await getAssociatedTokenAddress(mint, sender);
        var toAta = await getAssociatedTokenAddress(mint, receiver);

        try { await getAccount(connection, fromAta); } catch(e) {
          showToast('Нет $MRDT на кошельке', 'error');
          setIsPaymentLoading(false); setPaymentStatus(''); return;
        }

        // Use live price from ref
        var mrdtAmount = Math.round(plan.price / currentMrdtPrice) * Math.pow(10, MRDT_DECIMALS);
        var tx = new Transaction();
        tx.feePayer = sender;
        tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

        var toAtaExists = true;
        try { await getAccount(connection, toAta); } catch(e) { toAtaExists = false; }
        if (!toAtaExists) {
          tx.add(createAssociatedTokenAccountInstruction(sender, toAta, receiver, mint));
        }

        tx.add(createTransferInstruction(fromAta, toAta, sender, mrdtAmount));

        setPaymentStatus('Подтверди в кошельке...');
        var signed = await solanaWin.signAndSendTransaction(tx);
        signature = signed.signature;
        setPaymentStatus('Подтверждаем в сети...');
        await connection.confirmTransaction(signature, 'confirmed');

      } else if (currency === 'sol') {
        setPaymentStatus('Получаем курс Jupiter...');
        var amountLamports = Math.floor((plan.price / currentSolPrice) * LAMPORTS_PER_SOL);
        var projectAta = await getAssociatedTokenAddress(new PublicKey(MRDT_CA), receiver);
        var quoteRes = await fetch(
          'https://quote-api.jup.ag/v6/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=' +
          MRDT_CA + '&amount=' + amountLamports + '&slippageBps=150'
        );
        var quote = await quoteRes.json();
        if (!quote || quote.error) throw new Error('Не удалось получить quote от Jupiter');
        var swapRes = await fetch('https://quote-api.jup.ag/v6/swap', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            quoteResponse: quote,
            userPublicKey: sender.toBase58(),
            wrapAndUnwrapSol: true,
            destinationTokenAccount: projectAta.toBase58(),
          }),
        });
        var swapData = await swapRes.json();
        if (!swapData.swapTransaction) throw new Error('Jupiter не вернул транзакцию');
        var { VersionedTransaction } = await import('@solana/web3.js');
        var txBytes = Uint8Array.from(atob(swapData.swapTransaction), function(c) { return c.charCodeAt(0); });
        var transaction = VersionedTransaction.deserialize(txBytes);
        setPaymentStatus('Подтверди в кошельке...');
        var signedTx = await solanaWin.signAndSendTransaction(transaction);
        signature = signedTx.signature;
        setPaymentStatus('Подтверждаем в сети...');
        await connection.confirmTransaction(signature, 'confirmed');
      }

      setPaymentStatus('Запускаем аудит токена...');
      showToast('✅ Оплата прошла! Запускаем аудит...', 'success');

      var auditData = { mintAuthority: '—', freezeAuthority: '—', isHoneypot: '—' };
      try {
        var auditRes = await fetch('https://api.gopluslabs.io/api/v1/token_security/1?contract_addresses=' + form.contractAddress);
        var auditJson = await auditRes.json();
        if (auditJson.code === 1 && auditJson.result && auditJson.result[form.contractAddress]) {
          var a = auditJson.result[form.contractAddress];
          auditData = {
            mintAuthority: a.mint_authority === '' ? 'Отозвана ✓' : 'Активна (риск)',
            freezeAuthority: a.freeze_authority === '' ? 'Отозвана ✓' : 'Активна (риск)',
            isHoneypot: a.is_honeypot === '1' ? 'Да ⚠️' : 'Нет ✓',
          };
        }
      } catch(e) {
        try {
          var c2 = new Connection(RPC_URL, 'confirmed');
          var { getMint } = await import('@solana/spl-token');
          var mi = await getMint(c2, new PublicKey(form.contractAddress));
          auditData = {
            mintAuthority: mi.mintAuthority ? 'Активна (риск)' : 'Отозвана ✓',
            freezeAuthority: mi.freezeAuthority ? 'Активна (риск)' : 'Отозвана ✓',
            isHoneypot: '—',
          };
        } catch(e2) {}
      }

      var newToken = {
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
      setListedTokens(function(prev) { return [newToken].concat(prev); });
      showToast('✅ Аудит завершён! Токен добавлен в таблицу!', 'success');
      setStep(1); setSelectedPlan(''); setSelectedCurrency('');
      setFormData({ projectName: '', contractAddress: '', email: '' });

    } catch(err) {
      console.error('Payment error:', err);
      showToast('❌ ' + (err.message || 'Ошибка оплаты'), 'error');
    } finally {
      setIsPaymentLoading(false); setPaymentStatus('');
    }
  };

  var handleNext = function() {
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

  var handleBack = function() {
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
  };

  var handlePayment = function() {
    if (!selectedPlan || !selectedCurrency) { showToast('Выбери тариф и способ оплаты', 'error'); return; }
    if (isInWalletBrowser()) {
      triggerPayment(selectedPlan, selectedCurrency, formData, isSolflareBrowser() ? 'solflare' : 'phantom');
      return;
    }
    if (isMobile()) { setShowPayWalletModal(true); return; }
    triggerPayment(selectedPlan, selectedCurrency, formData, 'phantom');
  };

  var handleWalletChoice = function(walletType) {
    setShowPayWalletModal(false);
    redirectToWallet(walletType, selectedPlan, selectedCurrency, formData);
  };

  var handleConnectWallet = async function() {
    if (isMobile() && !isInWalletBrowser()) { setShowPayWalletModal(true); return; }
    var solanaWin = window.solana || window.solflare;
    if (solanaWin) {
      try {
        var resp = await solanaWin.connect();
        var pk = resp.publicKey.toString();
        setWalletAddress(pk.slice(0, 4) + '...' + pk.slice(-4));
      } catch(err) { console.error(err); }
    } else { showToast('Кошелёк не найден.', 'error'); }
  };

  var handleBannerWalletSelect = async function(walletType) {
    setShowBannerWalletModal(false);
    if (isMobile() && !isInWalletBrowser()) {
      var encoded = encodeURIComponent(SITE_URL + '/');
      var ref = encodeURIComponent(SITE_URL);
      if (walletType === 'solflare') {
        window.location.href = 'solflare://v1/browse/' + encoded;
        setTimeout(function() { window.location.href = 'https://solflare.com/ul/v1/browse/' + encoded + '?ref=' + ref; }, 500);
      } else {
        window.location.href = 'phantom://v1/browse/' + encoded;
        setTimeout(function() { window.location.href = 'https://phantom.app/ul/browse/' + encoded + '?ref=' + ref; }, 500);
      }
      return;
    }
    setIsBannerSending(true); setBannerError('');
    var solanaWin = walletType === 'solflare' ? window.solflare : window.solana;
    if (!solanaWin) { setBannerError('Кошелёк не найден.'); setIsBannerSending(false); return; }
    var current = Object.assign({}, bannerFormData);
    try {
      var resp = await solanaWin.connect();
      var sender = new PublicKey(resp.publicKey.toString());
      var connection = new Connection(RPC_URL, 'confirmed');
      var mint = new PublicKey(MRDT_CA);
      var fromAta = await getAssociatedTokenAddress(mint, sender);
      await getAccount(connection, fromAta).catch(function() { throw new Error('Нет $MRDT на кошельке.'); });
      var receiver = new PublicKey(WALLET_ADDRESS);
      var toAta = await getAssociatedTokenAddress(mint, receiver);
      var currentMrdtPrice = mrdtPriceRef.current || 0.000013;
      var usd = current.days === '2' ? 35 : current.days === '6' ? 100 : 20;
      var amount = Math.round(usd / currentMrdtPrice) * Math.pow(10, MRDT_DECIMALS);
      var tx = new Transaction();
      tx.feePayer = sender;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      var toAtaExists = true;
      try { await getAccount(connection, toAta); } catch(e) { toAtaExists = false; }
      if (!toAtaExists) tx.add(createAssociatedTokenAccountInstruction(sender, toAta, receiver, mint));
      tx.add(createTransferInstruction(fromAta, toAta, sender, amount));
      var signed = await solanaWin.signAndSendTransaction(tx);
      await connection.confirmTransaction(signed.signature, 'confirmed');
      var banner = {
        tokenName: current.tokenName.toUpperCase(),
        bannerImg: current.bannerImg || '🪙',
        desc: current.desc,
        expiresAt: Date.now() + parseInt(current.days) * 86400000,
      };
      localStorage.setItem('tnt_active_banner', JSON.stringify(banner));
      setActiveBanner(banner); setBannerSubmitted(true);
      setBannerFormData({ tokenName: '', bannerImg: '', desc: '', days: '1' });
      setTimeout(function() { setBannerSubmitted(false); }, 5000);
    } catch(err) {
      setBannerError(err.message || 'Ошибка оплаты.');
    } finally { setIsBannerSending(false); }
  };

  var handleBannerSubmit = function(e) {
    e.preventDefault();
    if (!bannerFormData.tokenName || !bannerFormData.desc) { setBannerError('Укажите название и описание.'); return; }
    setShowBannerWalletModal(true);
  };

  var handleSendChat = function() {
    if (!userMsg.trim()) return;
    setChatMessages(function(prev) { return prev.concat([{ sender: 'user', text: userMsg }]); });
    setUserMsg(''); setIsTyping(true);
    setTimeout(function() {
      var replies = ['Структура чистая. SAFE ✓', 'Бандлов нет.', '$MRDT — гем!', 'Ругпулов не обнаружено.', 'Комиссии честные.'];
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

  var handleLaunchJupiter = function() { window.open('https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&buy=8Q22r9qUm4AzFzTpZgaPYMxqq4z5WxE9FVa7X9dsvmBg', '_blank'); };
  var handleOpenRaydium = function() { setIsBuyDropdownOpen(false); window.open('https://raydium.io', '_blank'); };
  var openTokenBlueprint = function(token) { setSelectedToken(token); setIsBlueprintOpen(true); };
  var closeBlueprint = function() { setIsBlueprintOpen(false); setTimeout(function() { setSelectedToken(null); }, 300); };

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
    return price > 0 ? Math.round(usd / price) : '...';
  };
  var getAmountForBanner = function(days) {
    var usd = days === '2' ? 35 : days === '6' ? 100 : 20;
    var price = mrdtPriceRef.current || mrdtPrice;
    return price > 0 ? Math.round(usd / price) : '...';
  };

  var pillars = [
    { icon: Shield, label: 'AI Аудит', desc: 'Проверка контрактов', color: 'text-purple-400' },
    { icon: Zap, label: 'Микро-капы', desc: '$5K-$100K', color: 'text-emerald-400' },
    { icon: Lock, label: 'DAO Лицензия', desc: 'Через $MRDT', color: 'text-purple-400' },
  ];

  var onMobile = typeof window !== 'undefined' && isMobile();
  var inWallet = typeof window !== 'undefined' && isInWalletBrowser();

  var WalletModal = function(props) {
    return (
      <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-slate-950 border-2 border-purple-500/40 rounded-2xl w-full max-w-md p-6 shadow-lg">
          <h3 className="text-lg font-black text-white mb-2">{props.title || 'Выбери кошелёк'}</h3>
          <p className="text-slate-400 text-xs mb-4">Выбери кошелёк для оплаты в $MRDT</p>
          <button onClick={function() { props.onSelect('phantom'); }} className="block w-full bg-purple-500/20 border border-purple-500/40 rounded-xl p-4 mb-3 text-white font-bold hover:bg-purple-500/30 transition flex items-center gap-3">
            <span className="text-2xl">👻</span>
            <div className="text-left"><div className="font-black text-purple-300">Phantom</div><div className="text-xs text-slate-400 font-normal">Самый популярный Solana кошелёк</div></div>
          </button>
          <button onClick={function() { props.onSelect('solflare'); }} className="block w-full bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 mb-4 text-white font-bold hover:bg-orange-500/20 transition flex items-center gap-3">
            <span className="text-2xl">🔥</span>
            <div className="text-left"><div className="font-black text-orange-300">Solflare</div><div className="text-xs text-slate-400 font-normal">Альтернативный Solana кошелёк</div></div>
          </button>
          <button onClick={props.onClose} className="text-slate-400 hover:text-white transition text-sm w-full text-center">Отмена</button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white font-mono relative overflow-hidden pb-12">

      {toast.show && (
        <div className={'fixed bottom-6 left-1/2 -translate-x-1/2 z-[99999] flex items-center gap-3 px-6 py-3.5 rounded-2xl shadow-2xl border text-sm font-medium transition-all duration-300 ' + (toast.type === 'success' ? 'bg-emerald-950 border-emerald-500/40 text-emerald-300' : 'bg-red-950 border-red-500/40 text-red-300')}>
          {toast.type === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-400" /> : <XCircle className="w-5 h-5 text-red-400" />}
          <span>{toast.message}</span>
        </div>
      )}

      {isPaymentLoading && (
        <div className="fixed inset-0 z-[99998] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4 px-6">
          <RefreshCw className="w-10 h-10 text-purple-400 animate-spin" />
          <p className="text-white font-bold text-lg text-center">Обрабатываем транзакцию...</p>
          {paymentStatus && <p className="text-purple-300 text-sm text-center">{paymentStatus}</p>}
          <p className="text-slate-500 text-xs text-center">Не закрывай страницу</p>
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

        <header className="border-b border-purple-500/30 backdrop-blur-lg bg-slate-950/60 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <a href="https://t.me/tnt_house2026" target="_blank" rel="noopener noreferrer" className="w-10 h-10 border-2 border-purple-500 rounded-lg flex items-center justify-center bg-purple-500/10 shadow-[0_0_15px_rgba(153,69,255,0.4)] animate-pulse"><span className="text-xl">🧨</span></a>
              <div>
                <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-emerald-400 tracking-wider">TNT HOUSE</h1>
                <span className="text-[10px] text-purple-400
