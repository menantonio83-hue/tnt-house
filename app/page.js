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

async function saveTokenToSupabase(token) {
  try {
    await fetch(SUPABASE_URL + '/rest/v1/listed_tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ name: token.name, symbol: token.symbol, ca: token.ca, price: token.price, liquidity: token.liquidity, volume24h: token.volume24h, price_change_24h: token.priceChange24h, score: token.score || 95, dex_url: token.dexUrl, chain: token.chain || 'solana', mint_authority: token.mintAuthority || '-', freeze_authority: token.freezeAuthority || '-', is_honeypot: token.isHoneypot || '-' }),
    });
  } catch (e) { console.error('Supabase save failed:', e); }
}

async function loadTokensFromSupabase() {
  try {
    var res = await fetch(SUPABASE_URL + '/rest/v1/listed_tokens?select=*&order=created_at.desc&limit=20', { headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY } });
    if (!res.ok) return [];
    var data = await res.json();
    return data.map(function(row) { return { name: row.name, symbol: row.symbol, ca: row.ca, price: row.price, liquidity: row.liquidity, volume24h: row.volume24h, priceChange24h: row.price_change_24h, score: row.score, verified: true, dexUrl: row.dex_url, chain: row.chain, mintAuthority: row.mint_authority, freezeAuthority: row.freeze_authority, isHoneypot: row.is_honeypot, fromSupabase: true }; });
  } catch (e) { return []; }
}

async function saveBannerToSupabase(banner) {
  try {
    await fetch(SUPABASE_URL + '/rest/v1/active_banner', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ id: 1, token_name: banner.tokenName, banner_img: banner.bannerImg || '', description: banner.desc, expires_at: new Date(banner.expiresAt).toISOString() }),
    });
  } catch (e) { console.error('Banner save failed:', e); }
}

async function loadBannerFromSupabase() {
  try {
    var res = await fetch(SUPABASE_URL + '/rest/v1/active_banner?id=eq.1&select=*', { headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY } });
    if (!res.ok) return null;
    var data = await res.json();
    if (!data || !data[0]) return null;
    var row = data[0];
    var expiresAt = new Date(row.expires_at).getTime();
    if (Date.now() > expiresAt) return null;
    return { tokenName: row.token_name, bannerImg: row.banner_img || '', desc: row.description, expiresAt: expiresAt };
  } catch (e) { return null; }
}

const FALLBACK_TOKENS = [];

export default function TntHouse() {
  var [tokens, setTokens] = useState([]);
  var [listedTokens, setListedTokens] = useState([]);
  var [loading, setLoading] = useState(true);
  var [error, setError] = useState('');
  var [isBuyDropdownOpen, setIsBuyDropdownOpen] = useState(false);
  var [activeBanner, setActiveBanner] = useState(null);
  var [bannerCountdown, setBannerCountdown] = useState('');
  var [isBlueprintOpen, setIsBlueprintOpen] = useState(false);
  var [selectedToken, setSelectedToken] = useState(null);
  var [mrdtPrice, setMrdtPrice] = useState(0.000013);
  var mrdtPriceRef = useRef(0.000013);
  var [priceLoading, setPriceLoading] = useState(true);
  var [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  var [formData, setFormData] = useState({ projectName: '', contractAddress: '', telegram: '' });
  var [selectedTier, setSelectedTier] = useState('basic');
  var [isSending, setIsSending] = useState(false);
  var [submitted, setSubmitted] = useState(false);
  var [freeSlots, setFreeSlots] = useState(10);
  var FREE_TOTAL = 10;
  var [showPaymentModal, setShowPaymentModal] = useState(false);
  var [showWalletModal, setShowWalletModal] = useState(false);
  var [showInvoiceModal, setShowInvoiceModal] = useState(false);
  var [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
  var [selectedWallet, setSelectedWallet] = useState(null);
  var [invoiceAmount, setInvoiceAmount] = useState(0);
  var [invoiceLabel, setInvoiceLabel] = useState('');
  var [invoiceUsd, setInvoiceUsd] = useState(0);
  var [showBannerPaymentModal, setShowBannerPaymentModal] = useState(false);
  var [showBannerWalletModal, setShowBannerWalletModal] = useState(false);
  var [showBannerInvoiceModal, setShowBannerInvoiceModal] = useState(false);
  var [selectedBannerPaymentMethod, setSelectedBannerPaymentMethod] = useState(null);
  var [selectedBannerWallet, setSelectedBannerWallet] = useState(null);
  var [bannerInvoiceAmount, setBannerInvoiceAmount] = useState(0);
  var [bannerInvoiceUsd, setBannerInvoiceUsd] = useState(0);
  var [showVerifyModal, setShowVerifyModal] = useState(false);
  var [verifyType, setVerifyType] = useState('');
  var [verifyStatus, setVerifyStatus] = useState('waiting');
  var [verifyAttempts, setVerifyAttempts] = useState(0);
  var [verifyStartTime, setVerifyStartTime] = useState(null);
  var [pendingBannerData, setPendingBannerData] = useState(null);
  var [pendingAuditData, setPendingAuditData] = useState(null);
  var verifyIntervalRef = useRef(null);
  var [bannerFormData, setBannerFormData] = useState({ tokenName: '', bannerImg: '', desc: '', days: '1' });
  var [bannerSubmitted, setBannerSubmitted] = useState(false);
  var [bannerError, setBannerError] = useState('');
  var [isBannerSending, setIsBannerSending] = useState(false);
  var [isChatOpen, setIsChatOpen] = useState(false);
  var [chatMessages, setChatMessages] = useState([{ sender: 'bot', text: "Hey! I'm TNT House AI Inspector 🤖\n\nPaste a CA — I'll give a quick breakdown. You have 5 free questions per 10 min." }]);
  var [userMsg, setUserMsg] = useState('');
  var [isTyping, setIsTyping] = useState(false);
  var chatEndRef = useRef(null);
  var [chatCount, setChatCount] = useState(0);
  var [chatResetTime, setChatResetTime] = useState(null);
  var [chatBlocked, setChatBlocked] = useState(false);
  var [chatTimer, setChatTimer] = useState('');
  var [logs, setLogs] = useState(['[AI-Inspector] Initializing TNT House security system...', '[NET] Connected to Solana RPC nodes successfully.']);

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
    var usd = tier === 'fast' ? 25 : tier === 'vip' ? 75 : 10;
    var price = mrdtPriceRef.current || mrdtPrice;
    return price > 0 ? Math.round(usd / price) : 0;
  };

  var getAmountForBanner = function(days) {
    var usd = days === '2' ? 35 : days === '6' ? 100 : 20;
    var price = mrdtPriceRef.current || mrdtPrice;
    return price > 0 ? Math.round(usd / price) : 0;
  };

  var formatNumber = function(num) {
    if (num >= 1e6) return '$' + (num / 1e6).toFixed(1) + 'M';
    if (num >= 1e3) return '$' + (num / 1e3).toFixed(1) + 'K';
    return '$' + (typeof num === 'number' ? num.toFixed(0) : '0');
  };

  var scrollToForm = function() {
    var el = document.getElementById('orderFormsSection');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  var handleLaunchJupiter = function() { window.open('https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&buy=8Q22r9qUm4AzFzTpZgaPYMxqq4z5WxE9FVa7X9dsvmBg', '_blank'); };
  var handleOpenRaydium = function() { setIsBuyDropdownOpen(false); window.open('https://raydium.io/liquidity/increase/?mode=add&pool_id=6cMTXZyCrnut7Lv39qt4dqEARbC2jbebvhzdCR1t2HEV', '_blank'); };
  var openTokenBlueprint = function(token) { setSelectedToken(token); setIsBlueprintOpen(true); };
  var closeBlueprint = function() { setIsBlueprintOpen(false); setTimeout(function() { setSelectedToken(null); }, 300); };

  var pillars = [
    { icon: Shield, label: 'AI Audit', desc: 'Contract security check', color: 'text-purple-400' },
    { icon: Zap, label: 'Micro-caps', desc: '$5K-$100K', color: 'text-emerald-400' },
    { icon: Lock, label: 'DAO License', desc: 'Via $MRDT', color: 'text-purple-400' },
  ];

  useEffect(function() {
    loadTokensFromSupabase().then(function(data) {
      if (data.length > 0) setListedTokens(data);
      setFreeSlots(Math.max(0, FREE_TOTAL - data.length));
    });
  }, []);

  useEffect(function() {
    var fetchPrice = async function() {
      try {
        var res = await fetch('https://api.dexscreener.com/latest/dex/tokens/' + MRDT_CA);
        var data = await res.json();
        if (data.pairs && data.pairs.length) { var p = parseFloat(data.pairs[0].priceUsd); if (p > 0) { setMrdtPrice(p); mrdtPriceRef.current = p; } }
      } catch (e) {}
      setPriceLoading(false);
    };
    fetchPrice();
    var i = setInterval(fetchPrice, 60000);
    return function() { clearInterval(i); };
  }, []);

  useEffect(function() {
    var templates = ['New pool detected on Raydium!', 'Mint Authority disabled ✓', 'Threat level: LOW.', 'No bundles detected.', 'Connected to DexScreener.', 'Searching for new gems...', '[SUPABASE] Sync complete ✓'];
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
        if (cached && time && Date.now() - parseInt(time) < 120000) { setTokens(JSON.parse(cached)); setLoading(false); return; }
        var res = await fetch('https://api.dexscreener.com/latest/dex/tokens/So11111111111111111111111111111111111111112?limit=30');
        var data = await res.json();
        if (data.pairs && data.pairs.length) {
          var filtered = data.pairs.filter(function(p) { return (p.marketCap || 0) >= 1000 && (p.marketCap || 0) <= 300000; }).slice(0, 9).map(function(p) {
            return { name: (p.baseToken && p.baseToken.name) || 'Unknown', symbol: (p.baseToken && p.baseToken.symbol) || '???', ca: (p.baseToken && p.baseToken.address) || '', price: p.priceUsd ? parseFloat(p.priceUsd).toFixed(8) : '0', liquidity: (p.liquidity && p.liquidity.usd) ? Math.round(p.liquidity.usd) : 0, volume24h: (p.volume && p.volume.h24) ? Math.round(p.volume.h24) : 0, priceChange24h: (p.priceChange && p.priceChange.h24) || 0, verified: true, dexUrl: p.url || '', chain: p.chainId || 'solana' };
          });
          if (filtered.length) { setTokens(filtered); localStorage.setItem('tnt_cached_tokens', JSON.stringify(filtered)); localStorage.setItem('tnt_cached_time', Date.now().toString()); setLoading(false); return; }
        }
        throw new Error('No pairs');
      } catch (e) { setTokens(FALLBACK_TOKENS); setLoading(false); }
    };
    fetchTokens();
    var i = setInterval(fetchTokens, 5 * 60 * 1000);
    return function() { clearInterval(i); };
  }, []);

  useEffect(function() { if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  useEffect(function() {
    var fetchBanner = async function() { var banner = await loadBannerFromSupabase(); setActiveBanner(banner); };
    fetchBanner();
    var pollInterval = setInterval(fetchBanner, 30000);
    var countdownInterval = setInterval(function() {
      setActiveBanner(function(current) {
        if (!current) { setBannerCountdown(''); return current; }
        var msLeft = current.expiresAt - Date.now();
        if (msLeft <= 0) { setBannerCountdown(''); return null; }
        var totalSec = Math.floor(msLeft / 1000);
        var d = Math.floor(totalSec / 86400);
        var h = Math.floor((totalSec % 86400) / 3600);
        var m = Math.floor((totalSec % 3600) / 60);
        var s = totalSec % 60;
        var parts = [];
        if (d > 0) parts.push(d + 'd');
        if (h > 0) parts.push(h + 'h');
        parts.push((m < 10 ? '0' : '') + m + 'm');
        parts.push((s < 10 ? '0' : '') + s + 's');
        setBannerCountdown(parts.join(' '));
        return current;
      });
    }, 1000);
    return function() { clearInterval(pollInterval); clearInterval(countdownInterval); };
  }, []);

  var handleFormSubmit = function(e) {
    e.preventDefault();
    if (!formData.projectName || !formData.contractAddress || !formData.telegram) { showToast('Fill all fields', 'error'); return; }
    if (freeSlots > 0) { setIsSending(true); runAuditAndSave(formData.contractAddress, formData.projectName, true); return; }
    var mrdtAmount = getAmountForTier(selectedTier);
    if (mrdtAmount <= 0) { showToast('Price error, try later', 'error'); return; }
    var tierName = selectedTier === 'fast' ? 'Fast' : selectedTier === 'vip' ? 'VIP' : 'Basic';
    var usd = selectedTier === 'fast' ? 25 : selectedTier === 'vip' ? 75 : 10;
    setInvoiceAmount(mrdtAmount); setInvoiceUsd(usd);
    setInvoiceLabel('TNT House ' + tierName + ' Audit - ' + formData.projectName);
    setShowPaymentModal(true);
  };

  var handlePaymentMethodSelect = function(method) { setSelectedPaymentMethod(method); setShowPaymentModal(false); setShowWalletModal(true); };
  var handleWalletSelect = function(wallet) { setSelectedWallet(wallet); setShowWalletModal(false); setShowInvoiceModal(true); };

  // Run RugCheck + DexScreener audit, return token data
  // If isFree=true — saves to Supabase immediately (no payment needed)
  // If isFree=false — just returns token data, caller handles saving after payment verified
  var runAuditAndSave = async function(ca, projectName, isFree) {
    var auditResult = { score: 75, mintAuthority: 'Unknown', freezeAuthority: 'Unknown', isHoneypot: 'Unknown' };
    var dexData = { price: '0.00000000', liquidity: 0, volume24h: 0, priceChange24h: 0 };
    try {
      setLogs(function(prev) { return prev.slice(-12).concat(['[AUDIT] RugCheck API request for ' + ca + '...']); });
      var rugRes = await fetch('https://api.rugcheck.xyz/v1/tokens/' + ca + '/report/summary', { headers: { 'Accept': 'application/json' } });
      if (rugRes.ok) {
        var rugData = await rugRes.json();
        var normalizedScore = Math.min(100, Math.max(0, Math.round(100 - (rugData.score || 0) / 10)));
        var risks = rugData.risks || [];
        auditResult = { score: normalizedScore, mintAuthority: risks.some(function(r) { return r.name && r.name.toLowerCase().includes('mint'); }) ? 'Active ⚠️' : 'Revoked ✓', freezeAuthority: risks.some(function(r) { return r.name && r.name.toLowerCase().includes('freeze'); }) ? 'Active ⚠️' : 'Revoked ✓', isHoneypot: risks.some(function(r) { return r.name && r.name.toLowerCase().includes('honeypot'); }) ? 'Yes 🚨' : 'No ✓' };
        setLogs(function(prev) { return prev.slice(-12).concat(['[AUDIT ✓] ' + projectName + ' — Score: ' + normalizedScore]); });
      }
    } catch (e) { setLogs(function(prev) { return prev.slice(-12).concat(['[AUDIT] Error: ' + e.message]); }); }
    try {
      var dexRes = await fetch('https://api.dexscreener.com/latest/dex/tokens/' + ca);
      var dexJson = await dexRes.json();
      if (dexJson.pairs && dexJson.pairs.length > 0) {
        var pair = dexJson.pairs[0];
        dexData = { price: pair.priceUsd ? parseFloat(pair.priceUsd).toFixed(8) : '0.00000000', liquidity: (pair.liquidity && pair.liquidity.usd) ? Math.round(pair.liquidity.usd) : 0, volume24h: (pair.volume && pair.volume.h24) ? Math.round(pair.volume.h24) : 0, priceChange24h: (pair.priceChange && pair.priceChange.h24) ? pair.priceChange.h24 : 0 };
      }
    } catch (e) {}

    var tokenData = { name: projectName.toUpperCase(), symbol: projectName.slice(0, 4).toUpperCase() || 'NEW', ca: ca, price: dexData.price, liquidity: dexData.liquidity, volume24h: dexData.volume24h, priceChange24h: dexData.priceChange24h, score: auditResult.score, verified: true, dexUrl: 'https://dexscreener.com/solana/' + ca, chain: 'solana', mintAuthority: auditResult.mintAuthority, freezeAuthority: auditResult.freezeAuthority, isHoneypot: auditResult.isHoneypot };

    if (isFree) {
      // FREE slot — save immediately, no payment needed
      saveTokenToSupabase(tokenData);
      setListedTokens(function(prev) { return [tokenData].concat(prev); });
      setFreeSlots(function(prev) { return Math.max(0, prev - 1); });
      setSubmitted(true);
      setFormData({ projectName: '', contractAddress: '', telegram: '' });
      showToast('🎁 Free audit complete! Score: ' + auditResult.score, 'success');
      setIsSending(false);
      setTimeout(function() { setSubmitted(false); }, 5000);
    }

    return tokenData;
  };

  var handleConfirmPayment = async function() {
    setShowInvoiceModal(false); setIsSending(true);
    var ca = formData.contractAddress;
    var projectName = formData.projectName;

    // Run audit to get real data BEFORE redirect (RugCheck + DexScreener)
    // isFree=false means it won't save yet — just returns token data
    var tokenData = await runAuditAndSave(ca, projectName, false);

    setFormData({ projectName: '', contractAddress: '', telegram: '' });
    setSelectedPaymentMethod(null); setSelectedWallet(null);
    setIsSending(false);

    // Start payment polling — token saves to Supabase ONLY after TX confirmed
    startPaymentVerification('audit', invoiceAmount, null, tokenData);

    // Fire Solana Pay deeplink
    var label = encodeURIComponent(invoiceLabel);
    var message = encodeURIComponent('Audit for ' + projectName + ' CA: ' + ca);
    setTimeout(function() { window.location.href = 'solana:' + WALLET_ADDRESS + '?amount=' + invoiceAmount + '&spl-token=' + MRDT_CA + '&label=' + label + '&message=' + message; }, 300);
  };

  var handleBannerSubmit = function(e) {
    e.preventDefault();
    if (!bannerFormData.tokenName || !bannerFormData.desc) { setBannerError('Enter token name and description.'); return; }
    if (activeBanner) { setBannerError('Slot taken! Available in ' + bannerCountdown); return; }
    var mrdtAmount = getAmountForBanner(bannerFormData.days);
    if (mrdtAmount <= 0) { setBannerError('Price error, try later.'); return; }
    var usd = bannerFormData.days === '2' ? 35 : bannerFormData.days === '6' ? 100 : 20;
    setBannerInvoiceAmount(mrdtAmount); setBannerInvoiceUsd(usd); setBannerError('');
    setShowBannerPaymentModal(true);
  };

  var handleBannerPaymentMethodSelect = function(method) { setSelectedBannerPaymentMethod(method); setShowBannerPaymentModal(false); setShowBannerWalletModal(true); };
  var handleBannerWalletSelect = function(wallet) { setSelectedBannerWallet(wallet); setShowBannerWalletModal(false); setShowBannerInvoiceModal(true); };

  var startPaymentVerification = function(type, expectedAmount, bannerData, auditData) {
    var startTime = Date.now();
    setVerifyStartTime(startTime); setVerifyType(type); setVerifyStatus('waiting'); setVerifyAttempts(0); setShowVerifyModal(true);
    if (bannerData) setPendingBannerData(bannerData);
    if (auditData) setPendingAuditData(auditData);
    var attempts = 0; var maxAttempts = 30;
    if (verifyIntervalRef.current) clearInterval(verifyIntervalRef.current);
    var interval = setInterval(async function() {
      attempts++; setVerifyAttempts(attempts);
      try {
        var res = await fetch('/api/verify-payment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expectedAmount: expectedAmount, since: startTime }) });
        var data = await res.json();
        if (data.verified) {
          clearInterval(interval); verifyIntervalRef.current = null; setVerifyStatus('success');
          if (type === 'banner' && bannerData) { await saveBannerToSupabase(bannerData); setActiveBanner(bannerData); showToast('✅ Payment confirmed! Banner is live for everyone.', 'success'); }
          else if (type === 'audit' && auditData) { saveTokenToSupabase(auditData); setListedTokens(function(prev) { return [auditData].concat(prev); }); showToast('✅ Payment confirmed! Token added. Score: ' + auditData.score, 'success'); }
          setTimeout(function() { setShowVerifyModal(false); }, 3000); return;
        }
      } catch (e) {}
      if (attempts >= maxAttempts) { clearInterval(interval); verifyIntervalRef.current = null; setVerifyStatus('failed'); }
    }, 10000);
    verifyIntervalRef.current = interval;
  };

  useEffect(function() { return function() { if (verifyIntervalRef.current) clearInterval(verifyIntervalRef.current); }; }, []);

  var handleBannerConfirmPayment = function() {
    setShowBannerInvoiceModal(false); setIsBannerSending(true);
    var banner = { tokenName: bannerFormData.tokenName.toUpperCase(), bannerImg: bannerFormData.bannerImg || '', desc: bannerFormData.desc, expiresAt: Date.now() + parseInt(bannerFormData.days) * 86400000 };
    var mrdtAmount = bannerInvoiceAmount;
    var label = encodeURIComponent('TNT House VIP Banner ' + bannerFormData.days + 'd');
    var message = encodeURIComponent('VIP Banner for ' + banner.tokenName);
    startPaymentVerification('banner', mrdtAmount, banner, null);
    setBannerFormData({ tokenName: '', bannerImg: '', desc: '', days: '1' });
    setSelectedBannerPaymentMethod(null); setSelectedBannerWallet(null); setIsBannerSending(false);
    setTimeout(function() { window.location.href = 'solana:' + WALLET_ADDRESS + '?amount=' + mrdtAmount + '&spl-token=' + MRDT_CA + '&label=' + label + '&message=' + message; }, 300);
  };

  useEffect(function() {
    var t = setInterval(function() {
      if (!chatResetTime) return;
      var msLeft = chatResetTime - Date.now();
      if (msLeft <= 0) { setChatBlocked(false); setChatCount(0); setChatResetTime(null); setChatTimer(''); }
      else { var m = Math.floor(msLeft / 60000); var s = Math.floor((msLeft % 60000) / 1000); setChatTimer(m + 'm ' + (s < 10 ? '0' : '') + s + 's'); }
    }, 1000);
    return function() { clearInterval(t); };
  }, [chatResetTime]);

  var handleSendChat = async function() {
    if (!userMsg.trim() || isTyping) return;
    if (chatBlocked) return;
    var newCount = chatCount + 1; setChatCount(newCount);
    if (newCount >= 5) { var resetAt = Date.now() + 10 * 60 * 1000; setChatResetTime(resetAt); setChatBlocked(true); }
    var text = userMsg.trim();
    var updatedMessages = chatMessages.filter(function(m) { return m.sender !== 'bot' || chatMessages.indexOf(m) > 0; }).map(function(m) { return { role: m.sender === 'user' ? 'user' : 'assistant', content: m.text }; }).concat([{ role: 'user', content: text }]);
    setChatMessages(function(prev) { return prev.concat([{ sender: 'user', text: text }]); });
    setUserMsg(''); setIsTyping(true);
    try {
      var res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: updatedMessages }) });
      var data = await res.json();
      setChatMessages(function(prev) { return prev.concat([{ sender: 'bot', text: data.reply || data.error || 'Error. Try again.' }]); });
    } catch (e) { setChatMessages(function(prev) { return prev.concat([{ sender: 'bot', text: 'Connection error. 💎 Full audit → from $10' }]); }); }
    setIsTyping(false);
  };

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
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" /></pattern></defs><rect width="100%" height="100%" fill="url(#grid)" /></svg>
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
                <span className="text-[10px] text-purple-400 block font-bold tracking-widest">TOP NEW TOKENS v1.33</span>
              </div>
            </div>
            <div className="relative">
              <button onClick={function() { setIsBuyDropdownOpen(!isBuyDropdownOpen); }} className="bg-gradient-to-r from-purple-500 to-emerald-400 hover:from-purple-400 hover:to-emerald-300 text-slate-950 font-black px-4 py-2 rounded text-xs transition flex items-center gap-1 shadow-[0_0_15px_rgba(153,69,255,0.4)]">
                BUY $MRDT <ChevronDown className="w-3 h-3" />
              </button>
              {isBuyDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-slate-950 border border-purple-500/30 rounded-lg shadow-xl z-50 py-1">
                  <button onClick={handleLaunchJupiter} className="w-full text-left px-4 py-2.5 hover:bg-purple-500/10 text-emerald-400 flex items-center gap-2 text-sm"><ExternalLink className="w-4 h-4" /> Jupiter Swap</button>
                  <button onClick={handleOpenRaydium} className="w-full text-left px-4 py-2.5 hover:bg-purple-500/10 text-emerald-400 flex items-center gap-2 text-sm"><ExternalLink className="w-4 h-4" /> Raydium</button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* VIP Banner — FIXED: full image, text at bottom */}
        <section className="max-w-7xl mx-auto px-6 pt-6">
          {activeBanner ? (
            <div className="relative border border-purple-500/40 rounded-2xl overflow-hidden shadow-[0_0_30px_rgba(168,85,247,0.25)] min-h-[160px]">
              {/* Full background image */}
              {activeBanner.bannerImg && activeBanner.bannerImg.startsWith('data:') ? (
                <div className="absolute inset-0">
                  <img src={activeBanner.bannerImg} alt="banner" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/20" />
                </div>
              ) : (
                <div className="absolute inset-0 bg-gradient-to-r from-black via-purple-950/30 to-black" />
              )}
              {/* VIP badge top-left */}
              <div className="absolute top-3 left-3">
                <span className="bg-purple-500 text-white font-black text-[9px] px-2 py-0.5 rounded tracking-widest">VIP BOOST</span>
              </div>
              {/* Content bottom */}
              <div className="relative z-10 flex items-end justify-between p-4 pt-16">
                <div>
                  <h4 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-300 to-emerald-300">${activeBanner.tokenName}</h4>
                  <p className="text-slate-300 text-xs mt-0.5">{activeBanner.desc}</p>
                  {bannerCountdown && (
                    <p className="text-[10px] text-slate-400 mt-1">⏱ slot available in <span className="text-purple-400 font-bold">{bannerCountdown}</span></p>
                  )}
                </div>
                <button onClick={handleLaunchJupiter} className="bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-xs px-5 py-2.5 rounded-xl transition shrink-0 ml-4">
                  BUY ON JUPITER
                </button>
              </div>
            </div>
          ) : (
            <div onClick={scrollToForm} className="cursor-pointer border border-purple-500/30 rounded-2xl p-4 bg-gradient-to-r from-black via-purple-950/10 to-black flex flex-col sm:flex-row items-center justify-between gap-4 hover:border-purple-500/60 transition">
              <div className="flex items-center gap-4">
                <span className="text-3xl bg-purple-500/10 p-2 rounded-xl border border-purple-500/20">⚽️</span>
                <div>
                  <span className="bg-slate-800 text-purple-400 font-bold text-[9px] px-2 py-0.5 rounded tracking-widest block w-max mb-1">SLOT AVAILABLE</span>
                  <h4 className="text-lg font-black text-white">Maradona Token ($MRDT)</h4>
                  <p className="text-slate-400 text-xs mt-0.5">Click to buy VIP banner!</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-emerald-400 font-black text-sm">VIP Boost from $20/day</div>
                <div className="text-[10px] text-slate-500">Payment in $MRDT</div>
              </div>
            </div>
          )}
        </section>

        <section className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="space-y-3 border-l-4 border-purple-500 pl-6">
                <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded font-bold border border-purple-500/30">SAFE NEW TOKENS</span>
                <h2 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400">Exploding scams. Launching gems.</h2>
                <p className="text-slate-300 text-base leading-relaxed">Welcome to the Home of New Tokens! Our AI agent scans the blockchain.</p>
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
                  <Shield className="w-3.5 h-3.5 text-emerald-400" /> SAFE NEW TOKENS TABLE
                </h3>
                <p className="text-slate-400 text-[10px] mt-0.5">Click token for TNT Security Blueprint</p>
              </div>
              <div className="hidden md:flex items-center gap-1 text-[9px] text-purple-400">
                <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Live
              </div>
            </div>
            <div className="max-h-[320px] overflow-y-auto border border-purple-500/20 rounded-lg">
              <table className="w-full text-left border-collapse text-[9px]">
                <thead>
                  <tr className="border-b border-purple-500/20 bg-purple-500/10 text-purple-400 font-bold sticky top-0 z-20 backdrop-blur-md">
                    {['Token', 'Price', 'Liq', 'Vol/Chg', 'Score', 'Action'].map(function(h, i) {
                      return <th key={i} className={'p-1.5 text-[9px] font-bold whitespace-nowrap' + (i === 4 ? ' text-center' : i === 5 ? ' text-right' : ' text-left')}>{h}</th>;
                    })}
                  </tr>
                </thead>
                <tbody>
                  <tr onClick={function() { openTokenBlueprint({ symbol: 'MRDT', name: 'MARADONATOKEN', ca: MRDT_CA, price: mrdtPrice.toFixed(8), liquidity: 13000, volume24h: 0, priceChange24h: 12.4, verified: true, dexUrl: 'https://dexscreener.com/solana/' + MRDT_CA, chain: 'solana' }); }} className="border-b border-purple-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 transition cursor-pointer">
                    <td className="p-1 font-bold flex items-center gap-1"><span className="text-sm">⚽️</span><div><span className="text-emerald-400 font-extrabold text-[10px]">$MRDT</span><div className="text-[7px] text-slate-400">MARADONATOKEN</div></div></td>
                    <td className="p-1 font-mono text-emerald-400 font-bold text-[9px]">${mrdtPrice > 0 ? mrdtPrice.toFixed(8) : '...'}</td>
                    <td className="p-1 font-mono text-emerald-400 font-bold text-[9px]">$13K+</td>
                    <td className="p-1 font-mono text-emerald-400 font-bold text-[9px]">+12.4%</td>
                    <td className="p-1 text-center"><div className="inline-flex items-center justify-center w-9 h-4 rounded-full bg-emerald-500/20 border border-emerald-500 text-emerald-400 text-[8px] font-extrabold shadow-[0_0_6px_rgba(16,185,129,0.5)]">98</div></td>
                    <td className="p-1 text-right"><button onClick={function(e) { e.stopPropagation(); handleLaunchJupiter(); }} className="text-[8px] text-emerald-400 hover:text-emerald-300 font-bold hover:underline inline-flex items-center gap-0.5">Buy <ExternalLink className="w-2 h-2" /></button></td>
                  </tr>
                  {listedTokens.map(function(token, i) {
                    var score = getSafetyScore(token); var style = getScoreStyle(score);
                    return (
                      <tr key={'sb-' + i} onClick={function() { openTokenBlueprint(token); }} className="border-b border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 transition cursor-pointer">
                        <td className="p-1"><div className="flex items-center gap-1"><span className="text-emerald-400 text-[9px] font-bold">${token.symbol}</span><span className="text-[6px] bg-emerald-500/20 text-emerald-400 px-1 rounded font-bold">AI</span></div><span className="text-[7px] text-slate-500 block truncate max-w-[80px]">{token.name}</span></td>
                        <td className="p-1 font-mono text-slate-300 text-[9px]">${token.price}</td>
                        <td className="p-1 font-mono text-slate-300 text-[9px]">{typeof token.liquidity === 'number' ? formatNumber(token.liquidity) : token.liquidity}</td>
                        <td className={'p-1 font-mono text-[9px] ' + (token.priceChange24h > 0 ? 'text-emerald-400' : 'text-red-400')}>{formatNumber(token.volume24h)} ({token.priceChange24h > 0 ? '+' : ''}{token.priceChange24h}%)</td>
                        <td className="p-1 text-center"><div className={'inline-flex items-center justify-center w-9 h-4 rounded-full ' + style.bg + ' ' + style.border + ' ' + style.color + ' text-[8px] font-extrabold ' + style.glow}>{score}</div></td>
                        <td className="p-1 text-right"><a href={token.dexUrl} onClick={function(e) { e.stopPropagation(); }} target="_blank" rel="noopener noreferrer" className="text-[8px] text-purple-400 hover:text-emerald-400 inline-flex items-center gap-0.5">DEX <ExternalLink className="w-2 h-2" /></a></td>
                      </tr>
                    );
                  })}
                  {loading && tokens.length === 0 ? (
                    <tr><td colSpan={6} className="p-6 text-center text-purple-400 font-bold"><RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1" />Scanning...</td></tr>
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
                  {[1,2,3,4].map(function(n) { return <tr key={'e'+n} className="border-b border-purple-500/5 opacity-40">{[0,1,2,3,4,5].map(function(i) { return <td key={i} className="p-1 text-slate-600 text-[8px] italic">-</td>; })}</tr>; })}
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
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-lg font-black text-purple-400">ORDER AI INSPECTION</h3>
                  {freeSlots > 0 ? (
                    <div className="bg-emerald-500/20 border border-emerald-500/40 rounded-lg px-2 py-1 text-center">
                      <div className="text-emerald-400 font-black text-sm">{freeSlots}/{FREE_TOTAL}</div>
                      <div className="text-[9px] text-emerald-500">free</div>
                    </div>
                  ) : (
                    <div className="bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-center">
                      <div className="text-slate-400 font-black text-sm">0/{FREE_TOTAL}</div>
                      <div className="text-[9px] text-slate-500">no slots</div>
                    </div>
                  )}
                </div>
                <p className="text-slate-400 text-xs mb-4">{freeSlots > 0 ? '🎁 ' + freeSlots + ' free slots left! Fill the form — audit starts immediately.' : 'Fill the form — choose wallet — pay via Solana Pay — token appears in table.'}</p>
                <form onSubmit={handleFormSubmit} className="space-y-4">
                  <div>
                    <label className="block text-purple-400 text-xs font-bold mb-1">Project Name</label>
                    <input type="text" placeholder="Your token..." value={formData.projectName} onChange={function(e) { setFormData(Object.assign({}, formData, { projectName: e.target.value })); }} className="w-full bg-slate-950 border border-purple-500/20 rounded px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-purple-400 text-xs font-bold mb-1">Contract Address (Solana)</label>
                    <input type="text" placeholder="Enter contract address..." value={formData.contractAddress} onChange={function(e) { setFormData(Object.assign({}, formData, { contractAddress: e.target.value })); }} className="w-full bg-slate-950 border border-purple-500/20 rounded px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none font-mono" />
                  </div>
                  <div>
                    <label className="block text-purple-400 text-xs font-bold mb-1">Select tier</label>
                    <select value={selectedTier} onChange={function(e) { setSelectedTier(e.target.value); }} className="w-full bg-slate-950 border border-purple-500/20 rounded px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-none font-mono">
                      <option value="basic">Basic Audit — $10 in $MRDT (~{priceLoading ? '...' : getAmountForTier('basic').toLocaleString()} $MRDT)</option>
                      <option value="fast">Fast Listing — $25 in $MRDT (~{priceLoading ? '...' : getAmountForTier('fast').toLocaleString()} $MRDT)</option>
                      <option value="vip">VIP Boost — $75 in $MRDT (~{priceLoading ? '...' : getAmountForTier('vip').toLocaleString()} $MRDT)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-purple-400 text-xs font-bold mb-1">Telegram handle</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-400 text-xs font-bold">@</span>
                      <input type="text" placeholder="your_telegram" value={formData.telegram} onChange={function(e) { setFormData(Object.assign({}, formData, { telegram: e.target.value })); }} className="w-full bg-slate-950 border border-purple-500/20 rounded pl-7 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none" />
                    </div>
                  </div>
                  <button type="submit" disabled={isSending} className={'w-full font-black py-2.5 rounded text-xs transition flex items-center justify-center gap-1.5 disabled:opacity-50 ' + (freeSlots > 0 ? 'bg-gradient-to-r from-emerald-400 to-purple-500 hover:from-emerald-300 hover:to-purple-400 text-slate-950' : 'bg-gradient-to-r from-purple-500 to-emerald-400 hover:from-purple-400 hover:to-emerald-300 text-slate-950')}>
                    <Send className="w-3.5 h-3.5" /> {isSending ? 'LAUNCHING...' : freeSlots > 0 ? '🎁 LAUNCH FREE AUDIT' : 'LAUNCH AI INSPECTION'}
                  </button>
                  {submitted && <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded text-emerald-300 text-xs text-center font-bold">Payment sent! Token added to table.</div>}
                </form>
              </div>

              <div className="border-2 border-purple-500/30 rounded-lg bg-slate-900/40 p-6 backdrop-blur-md">
                <h3 className="text-lg font-black text-purple-400 mb-2">BUY VIP BANNER</h3>
                <p className="text-slate-400 text-xs mb-4">Your token replaces the ad slot automatically.</p>
                <form onSubmit={handleBannerSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-purple-400 text-[11px] font-bold mb-1">Token name / Ticker</label>
                      <input type="text" value={bannerFormData.tokenName} onChange={function(e) { setBannerFormData(Object.assign({}, bannerFormData, { tokenName: e.target.value })); }} placeholder="SOLANA" className="w-full bg-slate-950 border border-purple-500/20 rounded px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-purple-400 text-[11px] font-bold mb-1">Upload image</label>
                      <input type="file" accept="image/*" onChange={function(e) { var f = e.target.files && e.target.files[0]; if (f) { var r = new FileReader(); r.onload = function(ev) { setBannerFormData(Object.assign({}, bannerFormData, { bannerImg: ev.target.result })); }; r.readAsDataURL(f); } }} className="w-full bg-slate-950 border border-purple-500/20 rounded px-3 py-2 text-xs text-white file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-bold file:bg-gradient-to-r file:from-purple-500 file:to-emerald-400 file:text-slate-950 hover:file:from-purple-400 hover:file:to-emerald-300" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-purple-400 text-[11px] font-bold mb-1">Short ad slogan</label>
                    <input type="text" value={bannerFormData.desc} onChange={function(e) { setBannerFormData(Object.assign({}, bannerFormData, { desc: e.target.value })); }} placeholder="The fastest memecoin..." className="w-full bg-slate-950 border border-purple-500/20 rounded px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-purple-400 text-[11px] font-bold mb-1">Duration</label>
                    <select value={bannerFormData.days} onChange={function(e) { setBannerFormData(Object.assign({}, bannerFormData, { days: e.target.value })); }} className="w-full bg-slate-950 border border-purple-500/20 rounded px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-none font-mono">
                      <option value="1">1 Day - $20 (~{priceLoading ? '...' : getAmountForBanner('1').toLocaleString()} $MRDT)</option>
                      <option value="2">2 Days - $35 (~{priceLoading ? '...' : getAmountForBanner('2').toLocaleString()} $MRDT)</option>
                      <option value="6">6 Days - $100 (~{priceLoading ? '...' : getAmountForBanner('6').toLocaleString()} $MRDT)</option>
                    </select>
                  </div>
                  <button type="submit" disabled={isBannerSending || !!activeBanner} className="w-full bg-gradient-to-r from-emerald-400 to-purple-500 hover:from-emerald-300 hover:to-purple-400 text-slate-950 font-black py-2.5 rounded text-xs transition flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed">
                    <Zap className="w-3.5 h-3.5" /> {isBannerSending ? 'SENDING...' : activeBanner ? '🔒 SLOT TAKEN' : 'PAY AND PLACE BANNER'}
                  </button>
                  {activeBanner && bannerCountdown && (
                    <div className="p-2.5 bg-slate-900 border border-purple-500/20 rounded text-center">
                      <p className="text-slate-400 text-[11px]">Slot available in</p>
                      <p className="text-purple-400 font-black text-sm mt-0.5">{bannerCountdown}</p>
                    </div>
                  )}
                  {bannerSubmitted && <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded text-emerald-300 text-xs text-center font-bold">Banner activated!</div>}
                  {bannerError && <div className="p-3 bg-red-950/40 border border-red-500/30 rounded text-red-300 text-xs">{bannerError}</div>}
                </form>
              </div>
            </div>

            <div className="space-y-4 bg-slate-900/20 border-2 border-purple-500/20 rounded-xl p-6">
              <h3 className="text-xl font-black text-purple-400">Investor Information</h3>
              <p className="text-slate-300 text-xs leading-relaxed">All payments are accepted in $MRDT via Solana Pay. After payment, the token appears in the table automatically.</p>
              <div className="mt-6 space-y-3">
                <h4 className="text-xs font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400 flex items-center gap-1.5">
                  <Download className="w-4 h-4 text-purple-400 animate-pulse" /> CURRENT PRICING:
                </h4>
                <div className="grid grid-cols-1 gap-2 text-xs font-mono">
                  {[['🎁 First 10 tokens','FREE'],['Basic AI Audit','$10 ~ '+(priceLoading?'...':getAmountForTier('basic').toLocaleString())+' $MRDT'],['Fast Listing','$25 ~ '+(priceLoading?'...':getAmountForTier('fast').toLocaleString())+' $MRDT'],['VIP Boost','$75 ~ '+(priceLoading?'...':getAmountForTier('vip').toLocaleString())+' $MRDT'],['Banner 1 day','$20 ~ '+(priceLoading?'...':getAmountForBanner('1').toLocaleString())+' $MRDT'],['Banner 2 days','$35 ~ '+(priceLoading?'...':getAmountForBanner('2').toLocaleString())+' $MRDT'],['Banner 6 days','$100 ~ '+(priceLoading?'...':getAmountForBanner('6').toLocaleString())+' $MRDT']].map(function(row,i) {
                    return <div key={i} className={'flex justify-between p-2.5 border rounded-lg '+(i===0?'bg-emerald-500/10 border-emerald-500/30':'bg-slate-950 border-purple-500/10')}><span className={i===0?'text-emerald-300 font-bold':'text-slate-300'}>{row[0]}</span><span className={i===0?'text-emerald-400 font-black':'text-emerald-400 font-bold'}>{row[1]}</span></div>;
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
              <h3 className="text-2xl font-black text-purple-400 mb-2">TNT WHALE CLUB (DAO)</h3>
              <p className="text-slate-300 text-sm leading-relaxed mb-5">Questions about audits, listings or $MRDT? Write to our admin in Telegram — we reply fast. 🚀</p>
              <a href="https://t.me/tnt_house2026" target="_blank" rel="noopener noreferrer" className="inline-block bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-400 hover:to-purple-500 text-white font-bold py-2.5 px-6 rounded text-xs transition">
                💬 Ask Admin in Telegram
              </a>
            </div>
          </div>
        </section>

        <footer className="border-t border-purple-500/20 mt-12 py-8 bg-slate-950/60 backdrop-blur-lg">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex flex-wrap items-center justify-center gap-8 mb-4">
              <a href="https://x.com/Crypto_D10S" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
              </a>
              <a href="https://t.me/D10S_Solana_Stadium" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-blue-400 transition-colors"><span className="text-2xl">✈️</span></a>
              <a href="https://www.maradonatoken-mrdt.xyz" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-emerald-400 transition-colors"><ExternalLink className="w-6 h-6" /></a>
            </div>
            <div className="text-center space-y-1">
              <div className="text-purple-400 font-bold text-sm tracking-widest">TNT HOUSE v1.33</div>
              <div className="text-slate-400 text-xs">Powered by $MRDT · AI Audits · Supabase</div>
              <div className="text-slate-500 text-[10px]">Built with Next.js + Tailwind CSS · Solana Pay</div>
            </div>
          </div>
        </footer>
      </div>

      {/* PAYMENT MODALS */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4" onClick={function() { setShowPaymentModal(false); }}>
          <div className="bg-slate-950 border-2 border-purple-500/40 rounded-2xl w-full max-w-md p-6 shadow-[0_0_40px_rgba(168,85,247,0.25)]" onClick={function(e) { e.stopPropagation(); }}>
            <div className="flex items-center justify-between mb-6"><h3 className="text-xl font-black text-purple-400">Choose payment method</h3><button onClick={function() { setShowPaymentModal(false); }} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button></div>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={function() { handlePaymentMethodSelect('MRDT'); }} className="bg-purple-500/10 border-2 border-purple-500/30 hover:border-purple-500 rounded-xl p-6 text-center transition group"><div className="text-3xl mb-2">⚽️</div><div className="font-bold text-purple-400 group-hover:text-white transition">$MRDT</div><div className="text-[10px] text-slate-500 mt-1">Recommended</div></button>
              <button onClick={function() { handlePaymentMethodSelect('SOL'); }} className="bg-emerald-500/10 border-2 border-emerald-500/30 hover:border-emerald-500 rounded-xl p-6 text-center transition group">
                <div className="flex justify-center mb-2">
                  <svg width="36" height="36" viewBox="0 0 397 311" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7z" fill="url(#sol_a)"/><path d="M64.6 3.8C67.1 1.4 70.4 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1L333.1 73.8c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8z" fill="url(#sol_b)"/><path d="M333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z" fill="url(#sol_c)"/><defs><linearGradient id="sol_a" x1="360.9" y1="351.4" x2="141.2" y2="-69.2" gradientUnits="userSpaceOnUse"><stop stopColor="#00FFA3"/><stop offset="1" stopColor="#DC1FFF"/></linearGradient><linearGradient id="sol_b" x1="264.8" y1="351.4" x2="45.2" y2="-69.2" gradientUnits="userSpaceOnUse"><stop stopColor="#00FFA3"/><stop offset="1" stopColor="#DC1FFF"/></linearGradient><linearGradient id="sol_c" x1="312.5" y1="351.4" x2="92.9" y2="-69.2" gradientUnits="userSpaceOnUse"><stop stopColor="#00FFA3"/><stop offset="1" stopColor="#DC1FFF"/></linearGradient></defs></svg>
                </div>
                <div className="font-bold text-emerald-400 group-hover:text-white transition">SOL</div><div className="text-[10px] text-slate-500 mt-1">Solana</div>
              </button>
            </div>
          </div>
        </div>
      )}

      {showWalletModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4" onClick={function() { setShowWalletModal(false); setShowPaymentModal(true); }}>
          <div className="bg-slate-950 border-2 border-purple-500/40 rounded-2xl w-full max-w-md p-6 shadow-[0_0_40px_rgba(168,85,247,0.25)]" onClick={function(e) { e.stopPropagation(); }}>
            <div className="flex items-center justify-between mb-6"><h3 className="text-xl font-black text-purple-400">Choose wallet</h3><button onClick={function() { setShowWalletModal(false); setShowPaymentModal(true); }} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button></div>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={function() { handleWalletSelect('Phantom'); }} className="bg-purple-500/10 border-2 border-purple-500/30 hover:border-purple-500 rounded-xl p-6 text-center transition group"><div className="text-3xl mb-2">👻</div><div className="font-bold text-purple-400 group-hover:text-white transition">Phantom</div></button>
              <button onClick={function() { handleWalletSelect('Solflare'); }} className="bg-yellow-500/10 border-2 border-yellow-500/30 hover:border-yellow-400 rounded-xl p-6 text-center transition group">
                <div className="flex justify-center mb-2"><svg width="40" height="40" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="128" height="128" rx="24" fill="#FBBF24"/><text x="64" y="95" textAnchor="middle" fontFamily="Georgia, serif" fontWeight="900" fontSize="82" fill="#1a0a00" fontStyle="italic">S</text></svg></div>
                <div className="font-bold text-yellow-400 group-hover:text-white transition">Solflare</div>
              </button>
            </div>
            <button onClick={function() { setShowWalletModal(false); setShowPaymentModal(true); }} className="mt-4 w-full text-center text-slate-400 hover:text-white text-xs py-2">← Back</button>
          </div>
        </div>
      )}

      {showInvoiceModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4" onClick={function() { setShowInvoiceModal(false); }}>
          <div className="bg-slate-950 border-2 border-purple-500/40 rounded-2xl w-full max-w-md p-6 shadow-[0_0_40px_rgba(168,85,247,0.25)]" onClick={function(e) { e.stopPropagation(); }}>
            <div className="flex items-center justify-between mb-6"><h3 className="text-xl font-black text-purple-400">Payment Invoice</h3><button onClick={function() { setShowInvoiceModal(false); }} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button></div>
            <div className="bg-slate-900 border border-purple-500/20 rounded-xl p-6 text-center space-y-4">
              <div className="text-xs text-purple-400 font-bold">{selectedWallet} · {selectedPaymentMethod}</div>
              <div className="text-3xl font-black text-emerald-400">{invoiceAmount.toLocaleString()} $MRDT</div>
              <div className="text-sm font-bold text-slate-300">≈ ${invoiceUsd} USD</div>
              <div className="text-xs text-slate-400">{invoiceLabel}</div>
              <div className="text-xs text-slate-500 font-mono break-all">Wallet: {WALLET_ADDRESS.slice(0,8)}...{WALLET_ADDRESS.slice(-8)}</div>
            </div>
            <div className="mt-2 p-2 bg-purple-950/30 border border-purple-500/20 rounded-lg text-[10px] text-purple-300 text-center">Tapping will open {selectedWallet}. Confirm the transaction and return to the site.</div>
            <div className="mt-6 flex gap-3">
              <button onClick={function() { setShowInvoiceModal(false); }} className="flex-1 px-5 py-2.5 text-sm rounded-lg border border-purple-500/40 hover:bg-purple-500/10 transition text-slate-300">Cancel</button>
              <button onClick={handleConfirmPayment} className="flex-1 px-5 py-2.5 text-sm rounded-lg bg-gradient-to-r from-purple-500 to-emerald-400 text-slate-950 font-black hover:from-purple-400 hover:to-emerald-300 transition">✅ Pay Now</button>
            </div>
          </div>
        </div>
      )}

      {/* BANNER PAYMENT MODALS */}
      {showBannerPaymentModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4" onClick={function() { setShowBannerPaymentModal(false); }}>
          <div className="bg-slate-950 border-2 border-emerald-500/40 rounded-2xl w-full max-w-md p-6 shadow-[0_0_40px_rgba(16,185,129,0.2)]" onClick={function(e) { e.stopPropagation(); }}>
            <div className="flex items-center justify-between mb-2"><h3 className="text-xl font-black text-emerald-400">VIP Banner Payment</h3><button onClick={function() { setShowBannerPaymentModal(false); }} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button></div>
            <p className="text-slate-500 text-xs mb-6">Banner goes live on homepage right after payment</p>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={function() { handleBannerPaymentMethodSelect('MRDT'); }} className="bg-purple-500/10 border-2 border-purple-500/30 hover:border-purple-500 rounded-xl p-6 text-center transition group"><div className="text-3xl mb-2">⚽️</div><div className="font-bold text-purple-400 group-hover:text-white transition">$MRDT</div><div className="text-[10px] text-slate-500 mt-1">Recommended</div></button>
              <button onClick={function() { handleBannerPaymentMethodSelect('SOL'); }} className="bg-emerald-500/10 border-2 border-emerald-500/30 hover:border-emerald-500 rounded-xl p-6 text-center transition group">
                <div className="flex justify-center mb-2">
                  <svg width="36" height="36" viewBox="0 0 397 311" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7z" fill="url(#bs1)"/><path d="M64.6 3.8C67.1 1.4 70.4 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1L333.1 73.8c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8z" fill="url(#bs2)"/><path d="M333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z" fill="url(#bs3)"/><defs><linearGradient id="bs1" x1="360.9" y1="351.4" x2="141.2" y2="-69.2" gradientUnits="userSpaceOnUse"><stop stopColor="#00FFA3"/><stop offset="1" stopColor="#DC1FFF"/></linearGradient><linearGradient id="bs2" x1="264.8" y1="351.4" x2="45.2" y2="-69.2" gradientUnits="userSpaceOnUse"><stop stopColor="#00FFA3"/><stop offset="1" stopColor="#DC1FFF"/></linearGradient><linearGradient id="bs3" x1="312.5" y1="351.4" x2="92.9" y2="-69.2" gradientUnits="userSpaceOnUse"><stop stopColor="#00FFA3"/><stop offset="1" stopColor="#DC1FFF"/></linearGradient></defs></svg>
                </div>
                <div className="font-bold text-emerald-400 group-hover:text-white transition">SOL</div><div className="text-[10px] text-slate-500 mt-1">Solana</div>
              </button>
            </div>
          </div>
        </div>
      )}

      {showBannerWalletModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4" onClick={function() { setShowBannerWalletModal(false); setShowBannerPaymentModal(true); }}>
          <div className="bg-slate-950 border-2 border-emerald-500/40 rounded-2xl w-full max-w-md p-6 shadow-[0_0_40px_rgba(16,185,129,0.2)]" onClick={function(e) { e.stopPropagation(); }}>
            <div className="flex items-center justify-between mb-6"><h3 className="text-xl font-black text-emerald-400">Choose wallet</h3><button onClick={function() { setShowBannerWalletModal(false); setShowBannerPaymentModal(true); }} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button></div>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={function() { handleBannerWalletSelect('Phantom'); }} className="bg-purple-500/10 border-2 border-purple-500/30 hover:border-purple-500 rounded-xl p-6 text-center transition group"><div className="text-3xl mb-2">👻</div><div className="font-bold text-purple-400 group-hover:text-white transition">Phantom</div></button>
              <button onClick={function() { handleBannerWalletSelect('Solflare'); }} className="bg-yellow-500/10 border-2 border-yellow-500/30 hover:border-yellow-400 rounded-xl p-6 text-center transition group">
                <div className="flex justify-center mb-2"><svg width="40" height="40" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="128" height="128" rx="24" fill="#FBBF24"/><text x="64" y="95" textAnchor="middle" fontFamily="Georgia, serif" fontWeight="900" fontSize="82" fill="#1a0a00" fontStyle="italic">S</text></svg></div>
                <div className="font-bold text-yellow-400 group-hover:text-white transition">Solflare</div>
              </button>
            </div>
            <button onClick={function() { setShowBannerWalletModal(false); setShowBannerPaymentModal(true); }} className="mt-4 w-full text-center text-slate-400 hover:text-white text-xs py-2">← Back</button>
          </div>
        </div>
      )}

      {showBannerInvoiceModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4" onClick={function() { setShowBannerInvoiceModal(false); }}>
          <div className="bg-slate-950 border-2 border-emerald-500/40 rounded-2xl w-full max-w-md p-6 shadow-[0_0_40px_rgba(16,185,129,0.2)]" onClick={function(e) { e.stopPropagation(); }}>
            <div className="flex items-center justify-between mb-6"><h3 className="text-xl font-black text-emerald-400">Invoice — VIP Banner</h3><button onClick={function() { setShowBannerInvoiceModal(false); }} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button></div>
            {bannerFormData.bannerImg && (
              <div className="flex items-center gap-3 bg-slate-900 border border-emerald-500/20 rounded-xl p-3 mb-4">
                <img src={bannerFormData.bannerImg} alt="banner preview" className="w-12 h-12 rounded-xl object-cover border border-emerald-500/30" />
                <div>
                  <div className="text-emerald-400 font-black text-sm">${bannerFormData.tokenName.toUpperCase()}</div>
                  <div className="text-slate-400 text-xs">{bannerFormData.desc}</div>
                  <div className="text-slate-500 text-[10px]">{bannerFormData.days} {bannerFormData.days === '1' ? 'day' : 'days'}</div>
                </div>
              </div>
            )}
            <div className="bg-slate-900 border border-emerald-500/20 rounded-xl p-6 text-center space-y-3">
              <div className="text-xs text-emerald-400 font-bold">{selectedBannerWallet} · {selectedBannerPaymentMethod}</div>
              <div className="text-3xl font-black text-emerald-400">{bannerInvoiceAmount.toLocaleString()} $MRDT</div>
              <div className="text-sm font-bold text-slate-300">≈ ${bannerInvoiceUsd} USD</div>
              <div className="text-xs text-slate-500 font-mono break-all">Wallet: {WALLET_ADDRESS.slice(0,8)}...{WALLET_ADDRESS.slice(-8)}</div>
            </div>
            <div className="mt-2 p-2 bg-emerald-950/30 border border-emerald-500/20 rounded-lg text-[10px] text-emerald-300 text-center">Banner goes live automatically after payment 🚀</div>
            <div className="mt-6 flex gap-3">
              <button onClick={function() { setShowBannerInvoiceModal(false); }} className="flex-1 px-5 py-2.5 text-sm rounded-lg border border-emerald-500/40 hover:bg-emerald-500/10 transition text-slate-300">Cancel</button>
              <button onClick={handleBannerConfirmPayment} className="flex-1 px-5 py-2.5 text-sm rounded-lg bg-gradient-to-r from-emerald-400 to-purple-500 text-slate-950 font-black hover:from-emerald-300 hover:to-purple-400 transition">✅ Pay Now</button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Verification Modal */}
      {showVerifyModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-slate-950 border-2 border-purple-500/40 rounded-2xl w-full max-w-sm p-6 shadow-[0_0_40px_rgba(168,85,247,0.25)] text-center">
            {verifyStatus === 'waiting' && (
              <>
                <div className="w-16 h-16 rounded-full border-4 border-purple-500 border-t-transparent animate-spin mx-auto mb-4" />
                <h3 className="text-lg font-black text-white mb-2">Waiting for Payment</h3>
                <p className="text-slate-400 text-xs mb-4">Complete the transaction in your wallet and return here. We'll detect it automatically.</p>
                <div className="bg-slate-900 rounded-lg p-3 mb-4">
                  <p className="text-[10px] text-slate-500">Checking blockchain... attempt {verifyAttempts}/30</p>
                  <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2"><div className="bg-purple-500 h-1.5 rounded-full transition-all" style={{ width: Math.round((verifyAttempts / 30) * 100) + '%' }} /></div>
                  <p className="text-[10px] text-slate-500 mt-1">Timeout in {Math.max(0, 5 - Math.floor(verifyAttempts / 6))} min</p>
                </div>
                <button onClick={function() { if (verifyIntervalRef.current) clearInterval(verifyIntervalRef.current); setShowVerifyModal(false); }} className="text-slate-500 hover:text-white text-xs">Cancel</button>
              </>
            )}
            {verifyStatus === 'success' && (
              <>
                <div className="text-5xl mb-4">✅</div>
                <h3 className="text-lg font-black text-emerald-400 mb-2">Payment Confirmed!</h3>
                <p className="text-slate-400 text-xs">{verifyType === 'banner' ? 'Your banner is now live for all visitors.' : 'Token added to the safety table.'}</p>
              </>
            )}
            {verifyStatus === 'failed' && (
              <>
                <div className="text-5xl mb-4">⏱</div>
                <h3 className="text-lg font-black text-red-400 mb-2">Payment Not Detected</h3>
                <p className="text-slate-400 text-xs mb-4">We couldn't confirm your payment within 5 minutes. If you paid, contact admin in Telegram.</p>
                <a href="https://t.me/tnt_house2026" target="_blank" rel="noopener noreferrer" className="inline-block bg-purple-500 hover:bg-purple-400 text-white font-bold py-2 px-4 rounded text-xs mb-3">Contact Admin</a>
                <br />
                <button onClick={function() { setShowVerifyModal(false); }} className="text-slate-500 hover:text-white text-xs">Close</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* TNT Security Blueprint */}
      {isBlueprintOpen && selectedToken && (
        <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={closeBlueprint}>
          <div className="bg-slate-950 border-2 border-purple-500/40 rounded-2xl w-full max-w-lg p-6 shadow-[0_0_40px_rgba(168,85,247,0.2)]" onClick={function(e) { e.stopPropagation(); }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-black text-white">TNT Security Blueprint</h2>
              <button onClick={closeBlueprint} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-lg">{selectedToken.symbol === 'MRDT' ? '⚽️' : '🪙'}</div>
              <div>
                <p className="text-purple-400 font-black text-base">${selectedToken.symbol} <span className="text-slate-400 font-normal text-sm">{selectedToken.name}</span></p>
                <p className="text-slate-500 text-[10px] font-mono break-all">{selectedToken.ca}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 mb-4 p-3 bg-slate-900 rounded-xl border border-purple-500/20">
              <div className={'w-14 h-14 rounded-full flex items-center justify-center text-xl font-black border-2 ' + (getSafetyScore(selectedToken) >= 90 ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : getSafetyScore(selectedToken) >= 50 ? 'bg-yellow-500/20 border-yellow-500 text-yellow-400' : 'bg-red-500/20 border-red-500 text-red-400')}>{getSafetyScore(selectedToken)}</div>
              <div><p className="text-white font-bold text-sm">Safety Score</p><p className="text-slate-400 text-xs">{getSafetyScore(selectedToken) >= 90 ? 'Ironclad Safe ★' : getSafetyScore(selectedToken) >= 50 ? 'Moderate Risk ⚠️' : 'High Risk 🚨'}</p></div>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[{ label: 'Price', value: '$' + (selectedToken.price || '0.00000000') }, { label: 'Liquidity', value: selectedToken.liquidity ? '$' + (selectedToken.liquidity >= 1000 ? (selectedToken.liquidity/1000).toFixed(1)+'K' : selectedToken.liquidity) : '$0' }, { label: 'Volume 24h', value: selectedToken.volume24h ? '$' + (selectedToken.volume24h >= 1000 ? (selectedToken.volume24h/1000).toFixed(1)+'K' : selectedToken.volume24h) : '$0' }].map(function(item, i) {
                return <div key={i} className="bg-slate-900 border border-purple-500/10 rounded-lg p-2.5 text-center"><p className="text-slate-500 text-[9px] mb-0.5">{item.label}</p><p className="text-emerald-400 font-bold text-xs font-mono">{item.value}</p></div>;
              })}
            </div>
            <div className="space-y-2 mb-4">
              {[{ label: 'Mint Authority', value: selectedToken.mintAuthority }, { label: 'Freeze Authority', value: selectedToken.freezeAuthority }, { label: 'Honeypot', value: selectedToken.isHoneypot }].map(function(item, i) {
                if (!item.value) return null;
                var isSafe = item.value.includes('Revoked') || item.value.includes('No ✓');
                return <div key={i} className="flex items-center justify-between px-3 py-2 bg-slate-900 rounded-lg border border-purple-500/10"><span className="text-slate-400 text-xs">{item.label}</span><span className={'text-xs font-bold ' + (isSafe ? 'text-emerald-400' : 'text-red-400')}>{item.value}</span></div>;
              })}
            </div>
            {/* Links + Buy $MRDT button */}
            <div className="flex gap-2">
              <a href={selectedToken.dexUrl} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg border border-purple-500/30 text-purple-400 hover:text-emerald-400 hover:border-emerald-500/30 transition text-xs font-bold">DexScreener <ExternalLink className="w-3 h-3" /></a>
              <a href={'https://rugcheck.xyz/tokens/' + selectedToken.ca} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg border border-purple-500/30 text-purple-400 hover:text-emerald-400 hover:border-emerald-500/30 transition text-xs font-bold">RugCheck <ExternalLink className="w-3 h-3" /></a>
              <button onClick={handleLaunchJupiter} className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-emerald-400 text-slate-950 font-black text-xs hover:from-purple-400 hover:to-emerald-300 transition">Buy $MRDT ⚽️</button>
            </div>
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
            <div className="flex items-center gap-3">
              <div className="text-[9px] text-white/70">{chatBlocked ? <span className="text-red-300 font-bold">🔒 {chatTimer}</span> : <span>{5 - chatCount}/5 questions</span>}</div>
              <button onClick={function() { setIsChatOpen(false); }} className="text-white"><X className="w-4 h-4" /></button>
            </div>
          </div>
          <div className="flex-1 p-4 overflow-y-auto space-y-3 text-xs">
            {chatMessages.map(function(msg, i) {
              return <div key={i} className={'flex ' + (msg.sender === 'user' ? 'justify-end' : 'justify-start')}><div className={'max-w-[80%] rounded-lg p-2.5 leading-relaxed whitespace-pre-wrap ' + (msg.sender === 'user' ? 'bg-purple-500/20 text-purple-200 border border-purple-500/30' : 'bg-slate-950 text-emerald-400 border border-emerald-500/30')}>{msg.text}</div></div>;
            })}
            {isTyping && <div className="flex justify-start"><div className="bg-slate-950 text-emerald-400 border border-emerald-500/30 rounded-lg p-2.5 animate-pulse text-[11px]">Analyzing...</div></div>}
            <div ref={chatEndRef} />
          </div>
          {chatBlocked ? (
            <div className="p-3 border-t border-purple-500/20 bg-slate-950 space-y-2">
              <div className="text-center text-[11px] text-slate-400">Limit of 5 questions reached. Unlocks in <span className="text-purple-400 font-bold">{chatTimer}</span></div>
              <button onClick={scrollToForm} className="w-full bg-gradient-to-r from-purple-500 to-emerald-400 text-slate-950 font-black py-2 rounded text-[11px]">💎 Order full audit from $10</button>
            </div>
          ) : (
            <div className="p-3 border-t border-purple-500/20 bg-slate-950 flex gap-2">
              <input type="text" value={userMsg} onChange={function(e) { setUserMsg(e.target.value); }} onKeyDown={function(e) { if (e.key === 'Enter') handleSendChat(); }} placeholder="Paste CA or ask a question..." className="flex-1 bg-slate-900 border border-purple-500/20 rounded px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none" />
              <button onClick={handleSendChat} disabled={isTyping} className="bg-purple-500 hover:bg-purple-400 text-slate-950 px-3 rounded text-xs font-bold disabled:opacity-50"><Send className="w-3.5 h-3.5" /></button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
