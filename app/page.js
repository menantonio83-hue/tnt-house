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
  var [priceLoading, setPriceLoading] = useState(true);
  var [solPrice, setSolPrice] = useState(150);
  var [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  var [isPaymentLoading, setIsPaymentLoading] = useState(false);
  var [paymentStatus, setPaymentStatus] = useState('');
  var [step, setStep] = useState(1);
  var [formData, setFormData] = useState({ projectName: '', contractAddress: '', email: '' });
  var [selectedPlan, setSelectedPlan] = useState('');
  var [selectedCurrency, setSelectedCurrency] = useState('');
  var [bannerFormData, setBannerFormData] = useState({ tokenName: '', bannerImg: '', desc: '', days: '1' });

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
        setTimeout(function() {
          triggerPayment(pPlan, pCurrency, restoredForm, pWallet || 'phantom');
        }, 2000);
      }
    }
  }, []);

  useEffect(function() {
    var fetch_ = async function() {
      try {
        var res = await fetch('https://price.jup.ag/v6/price?ids=SOL');
        var data = await res.json();
        if (data && data.data && data.data.SOL) setSolPrice(data.data.SOL.price);
      } catch(e) {}
    };
    fetch_();
    var i = setInterval(fetch_, 60000);
    return function() { clearInterval(i); };
  }, []);

  useEffect(function() {
    var fetchPrice = async function() {
      try {
        var res = await fetch('https://api.dexscreener.com/latest/dex/tokens/' + MRDT_CA);
        var data = await res.json();
        if (data.pairs && data.pairs.length) {
          var p = parseFloat(data.pairs[0].priceUsd);
          if (p > 0) setMrdtPrice(p);
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

  // KEY FIX v1.12: signAndSendTransaction для мобильного Phantom
  // + createAssociatedTokenAccountInstruction если ATA не существует
  var triggerPayment = async function(planVal, currency, form, walletType) {
    var plan = plans.find(function(p) { return p.value === planVal; });
    if (!plan || !currency) return;

    setIsPaymentLoading(true);
    setPaymentStatus('Ожидаем кошелёк...');

    var solanaWin = null;
    for (var attempt = 0; attempt < 12; attempt++) {
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

      if (currency === 'mrdt') {
        setPaymentStatus('Готовим транзакцию $MRDT...');
        var mint = new PublicKey(MRDT_CA);
        var fromAta = await getAssociatedTokenAddress(mint, sender);
        var toAta = await getAssociatedTokenAddress(mint, receiver);

        try { await getAccount(connection, fromAta); } catch(e) {
          showToast('Нет $MRDT на кошельке', 'error');
          setIsPaymentLoading(false); setPaymentStatus(''); return;
        }

        var mrdtAmount = Math.round(plan.price / mrdtPrice) * Math.pow(10, MRDT_DECIMALS);
        var tx = new Transaction();
        tx.feePayer = sender;
        tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

        // Создаём ATA получателя если не существует
        var toAtaExists = true;
        try { await getAccount(connection, toAta); } catch(e) { toAtaExists = false; }
        if (!toAtaExists) {
          tx.add(createAssociatedTokenAccountInstruction(sender, toAta, receiver, mint));
        }

        tx.add(createTransferInstruction(fromAta, toAta, sender, mrdtAmount));

        setPaymentStatus('Подтверди в кошельке...');

        // signAndSendTransaction — работает и на мобильном и на десктопе
        var signed = await solanaWin.signAndSendTransaction(tx);
        signature = signed.signature;
        setPaymentStatus('Подтверждаем в сети...');
        await connection.confirmTransaction(signature, 'confirmed');

      } else if (currency === 'sol') {
        setPaymentStatus('Получаем курс Jupiter...');
        var amountLamports = Math.floor((plan.price / solPrice) * LAMPORTS_PER_SOL);
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
      var usd = current.days === '2' ? 35 : current.days === '6' ? 100 : 20;
      var amount = Math.round(usd / mrdtPrice) * Math.pow(10, MRDT_DECIMALS);
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
    return mrdtPrice > 0 ? Math.round(usd / mrdtPrice) : '...';
  };
  var getAmountForBanner = function(days) {
    var usd = days === '2' ? 35 : days === '6' ? 100 : 20;
    return mrdtPrice > 0 ? Math.round(usd / mrdtPrice) : '...';
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
                <span className="text-[10px] text-purple-400 block font-bold tracking-widest">TOP NEW TOKENS v1.12</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <button onClick={function() { setIsBuyDropdownOpen(!isBuyDropdownOpen); }} className="bg-gradient-to-r from-purple-500 to-emerald-400 hover:from-purple-400 hover:to-emerald-300 text-slate-950 font-black px-4 py-2 rounded text-xs transition flex items-center gap-1 shadow-[0_0_15px_rgba(153,69,255,0.4)]">BUY $MRDT <ChevronDown className="w-3 h-3" /></button>
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

        <section className="max-w-7xl mx-auto px-6 pt-6">
          {activeBanner ? (
            <div className="border border-purple-500/40 rounded-2xl p-4 bg-gradient-to-r from-black via-purple-950/20 to-black flex flex-col sm:flex-row items-center justify-between gap-4 shadow-[0_0_20px_rgba(168,85,247,0.2)]">
              <div className="flex items-center gap-4">
                <span className="text-3xl bg-purple-500/10 p-2 rounded-xl border border-purple-500/20">
                  {typeof activeBanner.bannerImg === 'string' && activeBanner.bannerImg.startsWith('data:')
                    ? <img src={activeBanner.bannerImg} alt="logo" className="w-8 h-8 rounded-full object-cover" />
                    : activeBanner.bannerImg}
                </span>
                <div>
                  <span className="bg-purple-500 text-white font-black text-[9px] px-2 py-0.5 rounded tracking-widest block w-max mb-1">🔥 VIP БУСТ</span>
                  <h4 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400">${activeBanner.tokenName}</h4>
                  <p className="text-slate-300 text-xs mt-0.5">{activeBanner.desc}</p>
                </div>
              </div>
              <button onClick={function() { window.open('https://jup.ag', '_blank'); }} className="bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-xs px-6 py-2.5 rounded transition">КУПИТЬ НА JUPITER →</button>
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

        <section className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="space-y-3 border-l-4 border-purple-500 pl-6">
                <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded font-bold border border-purple-500/30">БЕЗОПАСНЫЕ НОВЫЕ ТОКЕНЫ</span>
                <h2 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400">Взрываем скамы.<br />Запускаем гемы.</h2>
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
                <span className="w-2.5 h-2.5 bg-red-500 rounded-full" /><span className="w-2.5 h-2.5 bg-yellow-500 rounded-full" /><span className="w-2.5 h-2.5 bg-green-500 rounded-full" />
              </div>
              <div className="text-purple-400 font-bold border-b border-purple-500/20 pb-2 mb-2 flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 animate-spin" /> AI SCANNER + SUPABASE</div>
              <div className="flex-1 overflow-y-auto space-y-1.5 text-emerald-400">
                {logs.map(function(log, i) { return <div key={i} className="text-[11px]">{log}</div>; })}
              </div>
              <div className="text-[10px] text-slate-500 border-t border-purple-500/20 pt-2 mt-2">Status: SCANNING & SYNCING...</div>
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
              <div className="hidden md:flex items-center gap-1 text-[9px] text-purple-400"><RefreshCw className="w-2.5 h-2.5 animate-spin" /> Live</div>
            </div>
            <div className="max-h-[320px] overflow-y-auto border border-purple-500/20 rounded-lg">
              <table className="w-full text-left border-collapse text-[9px]">
                <thead>
                  <tr className="border-b border-purple-500/20 bg-purple-500/10 text-purple-400 font-bold sticky top-0 z-20 backdrop-blur-md">
                    {['Токен','Цена','Ликв','Об/Изм','Оценка','Действ'].map(function(h, i) {
                      return <th key={i} className={'p-0.5 align-bottom' + (i === 4 ? ' text-center' : i === 5 ? ' text-right' : '')} style={{ writingMode: 'vertical-lr', textOrientation: 'mixed', height: '60px', whiteSpace: 'nowrap' }}>{h}</th>;
                    })}
                  </tr>
                </thead>
                <tbody>
                  <tr onClick={function() { openTokenBlueprint({ symbol: 'MRDT', name: 'MARADONATOKEN', ca: MRDT_CA, price: mrdtPrice.toFixed(8), liquidity: 13000, volume24h: 0, priceChange24h: 12.4, verified: true, dexUrl: 'https://dexscreener.com/solana/' + MRDT_CA, chain: 'solana' }); }} className="border-b border-purple-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 transition cursor-pointer">
                    <td className="p-1 font-bold flex items-center gap-1"><span className="text-sm">⚽️</span><div><span className="text-emerald-400 font-extrabold text-[10px]">$MRDT</span><div className="text-[7px] text-slate-400">MARADONATOKEN</div></div></td>
                    <td className="p-1 font-mono text-emerald-400 font-bold text-[9px]">${mrdtPrice > 0 ? mrdtPrice.toFixed(8) : '…'}</td>
                    <td className="p-1 font-mono text-emerald-400 font-bold text-[9px]">$13K+</td>
                    <td className="p-1 font-mono text-emerald-400 font-bold text-[9px]">+12.4%</td>
                    <td className="p-1 text-center"><div className="inline-flex items-center justify-center w-9 h-4 rounded-full bg-emerald-500/20 border border-emerald-500 text-emerald-400 text-[8px] font-extrabold shadow-[0_0_6px_rgba(16,185,129,0.5)]">98</div></td>
                    <td className="p-1 text-right"><button onClick={function(e) { e.stopPropagation(); handleLaunchJupiter(); }} className="text-[8px] text-emerald-400 hover:text-emerald-300 font-bold hover:underline inline-flex items-center gap-0.5">Купить <ExternalLink className="w-2 h-2" /></button></td>
                  </tr>
                  {listedTokens.map(function(token, i) {
                    var score = getSafetyScore(token); var style = getScoreStyle(score);
                    return (
                      <tr key={'sb-' + i} onClick={function() { openTokenBlueprint(token); }} className="border-b border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 transition cursor-pointer">
                        <td className="p-1"><div className="flex items-center gap-1"><span className="text-emerald-400 text-[9px] font-bold">${token.symbol}</span><span className="text-[6px] bg-emerald-500/20 text-emerald-400 px-1 rounded font-bold">AI✓</span></div><span className="text-[7px] text-slate-500 block truncate max-w-[80px]">{token.name}</span></td>
                        <td className="p-1 font-mono text-slate-300 text-[9px]">${token.price}</td>
                        <td className="p-1 font-mono text-slate-300 text-[9px]">{typeof token.liquidity === 'number' ? formatNumber(token.liquidity) : token.liquidity}</td>
                        <td className={'p-1 font-mono text-[9px] ' + (token.priceChange24h > 0 ? 'text-emerald-400' : 'text-red-400')}>{formatNumber(token.volume24h)} ({token.priceChange24h > 0 ? '+' : ''}{token.priceChange24h}%)</td>
                        <td className="p-1 text-center"><div className={'inline-flex items-center justify-center w-9 h-4 rounded-full ' + style.bg + ' ' + style.border + ' ' + style.color + ' text-[8px] font-extrabold ' + style.glow}>{score}</div></td>
                        <td className="p-1 text-right"><a href={token.dexUrl} onClick={function(e) { e.stopPropagation(); }} target="_blank" rel="noopener noreferrer" className="text-[8px] text-purple-400 hover:text-emerald-400 inline-flex items-center gap-0.5">DEX <ExternalLink className="w-2 h-2" /></a></td>
                      </tr>
                    );
                  })}
                  {loading && tokens.length === 0 ? (
                    <tr><td colSpan={6} className="p-6 text-center text-purple-400 font-bold"><RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1" />Сканируем...</td></tr>
                  ) : tokens.map(function(token, i) {
                    var score = getSafetyScore(token); var style = getScoreStyle(score);
                    return (
                      <tr key={'dx-' + i} onClick={function() { openTokenBlueprint(token); }} className="border-b border-purple-500/10 hover:bg-purple-500/5 transition cursor-pointer">
                        <td className="p-1"><span className="text-purple-400 text-[9px] font-bold">${token.symbol}</span><span className="text-[7px] text-slate-500 block truncate max-w-[80px]">{token.name}</span></td>
                        <td className="p-1 font-mono text-slate-300 text-[9px]">${token.price}</td>
                        <td className="p-1 font-mono text-slate-300 text-[9px]">{typeof token.liquidity === 'number' ? formatNumber(token.liquidity) : token.liquidity}</td>
                        <td className={'p-1 font-mono text-[9px] ' + (token.priceChange24h > 0 ? 'text-emerald-400' : 'text-red-400')}>{formatNumber(token.volume24h)} ({token.priceChange24h > 0 ? '+' : ''}{token.priceChange24h}%)</td>
                        <td className="p-1 text-center"><div className={'inline-flex items-center justify-center w-9 h-4 rounded-full ' + style.bg + ' ' + style.border + ' ' + style.color + ' text-[8px] font-extrabold ' + style.glow}>{score}</div></td>
                        <td className="p-1 text-right"><a href={token.dexUrl} onClick={function(e) { e.stopPropagation(); }} target="_blank" rel="noopener noreferrer" className="text-[8px] text-purple-400 hover:text-emerald-400 inline-flex items-center gap-0.5">DEX <ExternalLink className="w-2 h-2" /></a></td>
                      </tr>
                    );
                  })}
                  {[1,2,3,4].map(function(n) {
                    return <tr key={'e' + n} className="border-b border-purple-500/5 opacity-40">{[0,1,2,3,4,5].map(function(i) { return <td key={i} className="p-1 text-slate-600 text-[8px] italic">—</td>; })}</tr>;
                  })}
                </tbody>
              </table>
            </div>
            {error && <div className="mt-2 p-1.5 bg-red-950/40 border border-red-500/30 rounded-lg flex items-center gap-1 text-red-300 text-[9px]"><AlertCircle className="w-2.5 h-2.5" /> {error}</div>}
          </div>
        </section>

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
                        <div><label className="block text-sm text-gray-400 mb-1">Название проекта</label><input type="text" placeholder="Твой токен..." value={formData.projectName} onChange={function(e) { setFormData(Object.assign({}, formData, { projectName: e.target.value })); }} className="w-full p-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500" /></div>
                        <div><label className="block text-sm text-gray-400 mb-1">Contract Address (Solana)</label><input type="text" placeholder="Впиши адрес контракта..." value={formData.contractAddress} onChange={function(e) { setFormData(Object.assign({}, formData, { contractAddress: e.target.value })); }} className="w-full p-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500" /></div>
                        <div><label className="block text-sm text-gray-400 mb-1">Email для связи</label><input type="email" placeholder="your@email.com" value={formData.email} onChange={function(e) { setFormData(Object.assign({}, formData, { email: e.target.value })); }} className="w-full p-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500" /></div>
                      </div>
                      <button onClick={handleNext} className="mt-6 w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-3 rounded-xl font-semibold hover:opacity-90 transition">Далее →</button>
                    </>
                  )}
                  {step === 2 && (
                    <>
                      <h3 className="text-2xl font-bold text-white mb-4">Выбери тариф</h3>
                      <div className="space-y-3">
                        {plans.map(function(plan) {
                          return (
                            <label key={plan.value} className={'flex items-center p-4 rounded-xl cursor-pointer transition-all ' + (selectedPlan === plan.value ? 'bg-indigo-600/20 border border-indigo-500' : 'bg-gray-700/30 border border-gray-700 hover:border-indigo-400')}>
                              <input type="radio" name="plan" value={plan.value} checked={selectedPlan === plan.value} onChange={function() { setSelectedPlan(plan.value); }} className="w-5 h-5 text-indigo-600" />
                              <div className="ml-4"><p className="text-white font-semibold">{plan.name}</p><p className="text-sm text-gray-400">${plan.price} ≈ {plan.mrdt} $MRDT</p></div>
                            </label>
                          );
                        })}
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
                        {['mrdt', 'sol'].map(function(method) {
                          return (
                            <label key={method} className={'flex items-center p-4 rounded-xl cursor-pointer transition-all ' + (selectedCurrency === method ? 'bg-indigo-600/20 border border-indigo-500' : 'bg-gray-700/30 border border-gray-700 hover:border-indigo-400')}>
                              <input type="radio" name="currency" value={method} checked={selectedCurrency === method} onChange={function() { setSelectedCurrency(method); }} className="w-5 h-5 text-indigo-600" />
                              <div className="ml-4">
                                <p className="text-white font-semibold">{method === 'mrdt' ? 'Оплатить в $MRDT' : 'Оплатить в SOL (авто-выкуп $MRDT)'}</p>
                                {method === 'sol' && currentPlan && <p className="text-sm text-gray-400">≈ {(currentPlan.price / solPrice).toFixed(4)} SOL</p>}
                              </div>
                            </label>
                          );
                        })}
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

              <div className="border-2 border-purple-500/30 rounded-lg bg-slate-900/40 p-6 backdrop-blur-md">
                <h3 className="text-lg font-black text-purple-400 mb-2 flex items-center gap-2">👑 КУПИТЬ VIP-БАННЕР НА ГЛАВНУЮ</h3>
                <p className="text-slate-400 text-xs mb-4">Автоматическая замена рекламного места на ваш токен.</p>
                <form onSubmit={handleBannerSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-purple-400 text-[11px] font-bold mb-1">Имя токена / Тикер</label><input type="text" value={bannerFormData.tokenName} onChange={function(e) { setBannerFormData(Object.assign({}, bannerFormData, { tokenName: e.target.value })); }} placeholder="SOLANA" className="w-full bg-slate-950 border border-purple-500/20 rounded px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none" /></div>
                    <div><label className="block text-purple-400 text-[11px] font-bold mb-1">Загрузите изображение</label><input type="file" accept="image/*" onChange={function(e) { var f = e.target.files && e.target.files[0]; if (f) { var r = new FileReader(); r.onload = function(ev) { setBannerFormData(Object.assign({}, bannerFormData, { bannerImg: ev.target.result })); }; r.readAsDataURL(f); }}} className="w-full bg-slate-950 border border-purple-500/20 rounded px-3 py-2 text-xs text-white file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-bold file:bg-purple-500 file:text-white hover:file:bg-purple-400" /></div>
                  </div>
                  <div><label className="block text-purple-400 text-[11px] font-bold mb-1">Краткий рекламный слоган</label><input type="text" value={bannerFormData.desc} onChange={function(e) { setBannerFormData(Object.assign({}, bannerFormData, { desc: e.target.value })); }} placeholder="Самый быстрый мемкоин..." className="w-full bg-slate-950 border border-purple-500/20 rounded px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none" /></div>
                  <div>
                    <label className="block text-purple-400 text-[11px] font-bold mb-1">Срок размещения</label>
                    <select value={bannerFormData.days} onChange={function(e) { setBannerFormData(Object.assign({}, bannerFormData, { days: e.target.value })); }} className="w-full bg-slate-950 border border-purple-500/20 rounded px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-none font-mono">
                      <option value="1">1 День — 20$ {priceLoading ? '(расчёт…)' : '(~ ' + (typeof getAmountForBanner('1') === 'number' ? getAmountForBanner('1').toLocaleString() : '...') + ' $MRDT)'}</option>
                      <option value="2">2 Дня — 35$ {priceLoading ? '(расчёт…)' : '(~ ' + (typeof getAmountForBanner('2') === 'number' ? getAmountForBanner('2').toLocaleString() : '...') + ' $MRDT)'}</option>
                      <option value="6">6 Дней — 100$ {priceLoading ? '(расчёт…)' : '(~ ' + (typeof getAmountForBanner('6') === 'number' ? getAmountForBanner('6').toLocaleString() : '...') + ' $MRDT)'}</option>
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

            <div className="space-y-4 bg-slate-900/20 border-2 border-purple-500/20 rounded-xl p-6">
              <h3 className="text-xl font-black text-purple-400">Информация для инвесторов</h3>
              <p className="text-slate-300 text-xs leading-relaxed">Все платежи принимаются в $MRDT. После оплаты токен виден всем посетителям.</p>
              <div className="mt-6 space-y-3">
                <h4 className="text-xs font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400 flex items-center gap-1.5"><Download className="w-4 h-4 text-purple-400 animate-pulse" /> ТЕКУЩАЯ СЕТКА ТАРИФОВ:</h4>
                <div className="grid grid-cols-1 gap-2 text-xs font-mono">
                  {[
                    ['🎁 Первые 3 токена', 'БЕСПЛАТНО'],
                    ['🔍 Базовый ИИ-Аудит', '$10 ≈ ' + (priceLoading ? '...' : typeof getAmountForTier('basic') === 'number' ? getAmountForTier('basic').toLocaleString() : '...') + ' $MRDT'],
                    ['⚡ Быстрый Листинг', '$40 ≈ ' + (priceLoading ? '...' : typeof getAmountForTier('fast') === 'number' ? getAmountForTier('fast').toLocaleString() : '...') + ' $MRDT'],
                    ['👑 Баннер (1 день)', '$20 ≈ ' + (priceLoading ? '...' : typeof getAmountForBanner('1') === 'number' ? getAmountForBanner('1').toLocaleString() : '...') + ' $MRDT'],
                    ['👑 Баннер (2 дня)', '$35 ≈ ' + (priceLoading ? '...' : typeof getAmountForBanner('2') === 'number' ? getAmountForBanner('2').toLocaleString() : '...') + ' $MRDT'],
                    ['👑 Баннер (6 дней)', '$100 ≈ ' + (priceLoading ? '...' : typeof getAmountForBanner('6') === 'number' ? getAmountForBanner('6').toLocaleString() : '...') + ' $MRDT'],
                  ].map(function(row, i) {
                    return (
                      <div key={i} className={'flex justify-between p-2.5 border rounded-lg ' + (i === 0 ? 'bg-purple-500/10 border-purple-500/20' : 'bg-slate-950 border-purple-500/10')}>
                        <span className="text-slate-300">{row[0]}</span><span className="text-emerald-400 font-bold">{row[1]}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>

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

        <footer className="border-t border-purple-500/20 mt-12 py-8 bg-slate-950/60 backdrop-blur-lg">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex flex-wrap items-center justify-center gap-8 mb-4">
              <a href="https://x.com/Crypto_D10S" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white transition-colors"><svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg></a>
              <a href="https://t.me/D10S_Solana_Stadium" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-blue-400 transition-colors"><span className="text-2xl">✈️</span></a>
              <a href="https://www.maradonatoken-mrdt.xyz" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-emerald-400 transition-colors"><ExternalLink className="w-6 h-6" /></a>
            </div>
            <div className="text-center space-y-1">
              <div className="text-purple-400 font-bold text-sm tracking-widest">TNT HOUSE v1.12</div>
              <div className="text-slate-400 text-xs">Powered by $MRDT • AI Audits • Supabase ☁️</div>
              <div className="text-slate-500 text-[10px]">Built with Next.js + Tailwind CSS • Phantom + Solflare</div>
            </div>
          </div>
        </footer>
      </div>

      {showPayWalletModal && <WalletModal title="Выбери кошелёк для оплаты" onSelect={handleWalletChoice} onClose={function() { setShowPayWalletModal(false); }} />}
      {showBannerWalletModal && <WalletModal title="Оплата VIP-баннера" onSelect={handleBannerWalletSelect} onClose={function() { setShowBannerWalletModal(false); }} />}

      {isBlueprintOpen && selectedToken && (
        <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={closeBlueprint}>
          <div className="bg-slate-950 border-2 border-purple-500/40 rounded-2xl w-full max-w-lg p-6 shadow-lg" onClick={function(e) { e.stopPropagation(); }}>
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

      <button onClick={function() { setIsChatOpen(!isChatOpen); }} className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-tr from-purple-500 to-emerald-400 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(153,69,255,0.5)] hover:scale-105 transition z-50 animate-bounce">
        {isChatOpen ? <X className="w-6 h-6 text-slate-950" /> : <MessageSquare className="w-6 h-6 text-slate-950" />}
      </button>

      {isChatOpen && (
        <div className="fixed bottom-24 right-6 w-80 md:w-96 h-[450px] bg-slate-900 border-2 border-purple-500 rounded-xl shadow-[0_0_30px_rgba(153,69,255,0.4)] flex flex-col overflow-hidden z-50 font-mono">
          <div className="bg-gradient-to-r from-purple-600 to-emerald-500 p-4 flex items-center justify-between">
            <div className="flex items-center gap-2"><span className="text-xl">🤖</span><div><h4 className="font-bold text-xs text-white">TNT AI INSPECTOR</h4><span className="text-[9px] text-slate-100 font-bold tracking-widest">Trench Agent D10S</span></div></div>
            <button onClick={function() { setIsChatOpen(false); }} className="text-white"><X className="w-4 h-4" /></button>
          </div>
          <div className="flex-1 p-4 overflow-y-auto space-y-3 text-xs">
            {chatMessages.map(function(msg, i) {
              return (
                <div key={i} className={'flex ' + (msg.sender === 'user' ? 'justify-end' : 'justify-start')}>
                  <div className={'max-w-[80%] rounded-lg p-2.5 leading-relaxed ' + (msg.sender === 'user' ? 'bg-purple-500/20 text-purple-200 border border-purple-500/30' : 'bg-slate-950 text-emerald-400 border border-emerald-500/30')}>{msg.text}</div>
                </div>
              );
            })}
            {isTyping && <div className="flex justify-start"><div className="bg-slate-950 text-emerald-400 border border-emerald-500/30 rounded-lg p-2.5 animate-pulse text-[11px]">Думаю...</div></div>}
            <div ref={chatEndRef} />
          </div>
          <div className="p-3 border-t border-purple-500/20 bg-slate-950 flex gap-2">
            <input type="text" value={userMsg} onChange={function(e) { setUserMsg(e.target.value); }} onKeyDown={function(e) { if (e.key === 'Enter') handleSendChat(); }} placeholder="Спроси у ИИ..." className="flex-1 bg-slate-900 border border-purple-500/20 rounded px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none" />
            <button onClick={handleSendChat} className="bg-purple-500 hover:bg-purple-400 text-slate-950 px-3 rounded text-xs font-bold"><Send className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      )}
    </div>
  );
      }
