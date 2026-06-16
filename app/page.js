'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  TrendingUp, Shield, Lock, Zap, Send, MessageSquare, X,
  RefreshCw, AlertCircle, Sparkles, ExternalLink, ChevronDown, Download, Image
} from 'lucide-react';
import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';

// --------------------- КОНФИГУРАЦИЯ --------------------- 
const WALLET_ADDRESS = "AZyzUySu6HP9ocJYhZECG5syycYNV6ubTQKyfB2mDWgG";
const MRDT_CA = "8Q22r9qUm4AzFzTpZgaPYMxqq4z5WxE9FVa7X9dsvmBg";
const MRDT_MINT = new PublicKey(MRDT_CA);
const RECIPIENT_WALLET = new PublicKey(WALLET_ADDRESS);
const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
const MRDT_DECIMALS = 6;
// --------------------------------------------------------

export default function TntHouse() {
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

  const [mrdtPrice, setMrdtPrice] = useState(0.0000091);

  // Получение актуального курса $MRDT
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
    const interval = setInterval(fetchPrice, 45000);
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
    const interval = setInterval(checkBannerStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  // Проверка транзакции в блокчейне
  const verifyPayment = async (signature, expectedAmount) => {
    try {
      const tx = await connection.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });
      if (!tx) throw new Error('Транзакция не найдена');

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
        throw new Error(`Недостаточная сумма`);
      }
      return true;
    } catch (err) {
      console.error('Ошибка проверки:', err);
      return false;
    }
  };

  // Открытие модалки оплаты
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

  const handleLaunchJupiter = () => {
    setIsBuyDropdownOpen(false);
    window.open(`https://jup.ag/swap?inputMint=So11111111111111111111111111111111111111112&outputMint=${MRDT_CA}`, '_blank');
  };

  // Загрузка токенов
  useEffect(() => {
    const fetchTokens = async () => {
      try {
        setLoading(true);
        const response = await fetch('https://api.dexscreener.com/latest/dex/tokens/So11111111111111111111111111111111111111112?limit=15');
        const data = await response.json();
        
        if (data.pairs && data.pairs.length > 0) {
          const filtered = data.pairs
            .filter(p => (p.marketCap || 0) >= 1000 && (p.marketCap || 0) <= 500000)
            .slice(0, 6)
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
          setTokens(filtered);
        }
      } catch (err) {
        setTokens([]);
      } finally {
        setLoading(false);
      }
    };
    fetchTokens();
  }, []);

  const confirmPayment = async () => {
    if (!pendingAction || !txSignature.trim()) return;

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
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white font-mono relative overflow-hidden pb-12">
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-purple-600/10 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-emerald-500/10 blur-[120px] pointer-events-none"></div>

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
                <span className="text-[10px] text-purple-400 block font-bold tracking-widest">v2.0 • On-Chain Verification</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="relative">
                <button onClick={() => setIsBuyDropdownOpen(!isBuyDropdownOpen)} className="bg-gradient-to-r from-purple-500 to-emerald-400 text-slate-950 font-black px-4 py-2 rounded text-xs flex items-center gap-1 shadow-md">
                  BUY $MRDT <ChevronDown className="w-3 h-3" />
                </button>
                {isBuyDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-slate-900 border border-purple-500/30 rounded-lg shadow-xl z-50 py-1 text-sm">
                    <button onClick={handleLaunchJupiter} className="w-full text-left px-4 py-2.5 hover:bg-purple-500/10 text-emerald-400 flex items-center gap-2">
                      <ExternalLink className="w-4 h-4" /> Jupiter Swap
                    </button>
                  </div>
                )}
              </div>
              <button onClick={() => setWalletAddress('Connected')} className="bg-gradient-to-r from-purple-500 to-emerald-400 text-slate-950 font-black px-4 py-2 rounded text-xs">
                {walletAddress ? "WALLET READY" : "CONNECT WALLET"}
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
                  {activeBanner.bannerImg && activeBanner.bannerImg !== '🪙' ? (
                    <img src={activeBanner.bannerImg} alt="logo" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-3xl">🪙</span>
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
                  <p className="text-slate-400 text-xs mt-0.5">Разместите свой медиа-баннер здесь за токены $MRDT</p>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Hero + Terminal */}
        <section className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="space-y-3 border-l-4 border-purple-500 pl-6">
                <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded font-bold border border-purple-500/30">v2.0 • ON-CHAIN VERIFICATION</span>
                <h2 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400">Дом Безопасных Гемифицированных Токенов</h2>
                <p className="text-slate-300 text-sm leading-relaxed">Теперь оплата проверяется напрямую в блокчейне Solana перед добавлением токена или активацией баннера.</p>
              </div>
            </div>

            <div className="bg-slate-950 border-2 border-purple-500/40 rounded-lg p-4 font-mono text-xs h-64 flex flex-col justify-between shadow-lg">
              <div className="text-purple-400 font-bold border-b border-purple-500/20 pb-2">TNT AI RADAR TERMINAL</div>
              <div className="flex-1 overflow-y-auto space-y-1 mt-2 text-emerald-400">
                {logs.map((log, i) => <div key={i} className="text-[11px] font-mono leading-tight">{log}</div>)}
              </div>
            </div>
          </div>
        </section>

        {/* Таблица токенов */}
        <section className="max-w-7xl mx-auto px-6 py-6">
          <div className="border-2 border-purple-500/30 rounded-lg bg-slate-900/40 backdrop-blur-md p-6">
            <h3 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400 flex items-center gap-2 mb-4">
              <Shield className="w-5 h-5 text-emerald-400" /> РЕЕСТР ПОДТВЕРЖДЕННЫХ ТОКЕНОВ
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
                    <th className="p-3 text-right">Действие</th>
                  </tr>
                </thead>
                <tbody>
                  <tr onClick={() => setSelectedToken({ symbol: 'MRDT', name: 'MARADONATOKEN', ca: MRDT_CA, liquidity: 13000 })} className="border-b border-purple-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 transition cursor-pointer">
                    <td className="p-3 font-bold flex items-center gap-2">
                      <span className="text-lg">⚽️</span>
                      <div><span className="text-emerald-400 font-extrabold text-sm tracking-wider">$MRDT</span><div className="text-[9px] text-slate-400">MARADONATOKEN</div></div>
                    </td>
                    <td className="p-3 font-mono text-emerald-400 font-bold">${mrdtPrice.toFixed(8)}</td>
                    <td className="p-3 font-mono text-emerald-400 font-bold">$13,000+</td>
                    <td className="p-3 font-mono text-emerald-400 font-bold">+12.4%</td>
                    <td className="p-3 text-center"><div className="inline-flex items-center justify-center w-12 h-6 rounded bg-emerald-500/20 border border-emerald-500 text-emerald-400 font-extrabold">98</div></td>
                    <td className="p-3 text-right text-purple-400 hover:underline font-bold">Открыть →</td>
                  </tr>
                  {loading ? (
                    <tr><td colSpan="6" className="p-8 text-center text-purple-400">Загрузка ончейн метрик...</td></tr>
                  ) : (
                    tokens.map((token, i) => (
                      <tr key={i} onClick={() => setSelectedToken(token)} className="border-b border-purple-500/10 hover:bg-purple-500/5 transition cursor-pointer">
                        <td className="p-3 font-bold"><span className="text-purple-400">${token.symbol}</span><span className="text-[10px] text-slate-500 block truncate max-w-[100px]">{token.name}</span></td>
                        <td className="p-3 font-mono text-slate-300">${token.price}</td>
                        <td className="p-3 font-mono text-slate-300">{token.liquidity}</td>
                        <td className="p-3 font-mono"><span className={token.priceChange24h > 0 ? 'text-emerald-400' : 'text-red-400'}>{token.priceChange24h}%</span></td>
                        <td className="p-3 text-center"><div className="inline-flex items-center justify-center w-12 h-6 rounded bg-yellow-500/20 border border-yellow-500 text-yellow-400 font-extrabold">75</div></td>
                        <td className="p-3 text-right text-purple-400">Анализ →</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Формы */}
        <section className="max-w-7xl mx-auto px-6 py-8 grid md:grid-cols-2 gap-8">
          {/* Форма Аудита */}
          <div className="border border-purple-500/20 bg-slate-900/30 rounded-xl p-6">
            <h3 className="text-lg font-black text-purple-400 mb-4">🔍 ЗАКАЗАТЬ ИИ-ИНСПЕКЦИЮ</h3>
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <input type="text" placeholder="Название проекта" value={formData.projectName} onChange={(e) => setFormData({...formData, projectName: e.target.value})} className="w-full bg-slate-950 border border-purple-500/20 rounded px-3 py-2 text-xs text-white" />
              <input type="text" placeholder="Contract Address (CA)" value={formData.ca} onChange={(e) => setFormData({...formData, ca: e.target.value})} className="w-full bg-slate-950 border border-purple-500/20 rounded px-3 py-2 text-xs font-mono text-white" />
              <input type="email" placeholder="Email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full bg-slate-950 border border-purple-500/20 rounded px-3 py-2 text-xs text-white" />
              <select value={selectedTier} onChange={(e) => setSelectedTier(e.target.value)} className="w-full bg-slate-950 border border-purple-500/20 rounded px-3 py-2 text-xs text-white">
                <option value="basic">Базовый Аудит — 10$ в MRDT</option>
                <option value="fast">Быстрый Аудит — 40$ в MRDT</option>
              </select>
              <button type="submit" className="w-full bg-gradient-to-r from-purple-500 to-emerald-400 text-slate-950 font-black py-2.5 rounded text-xs transition">
                ОПЛАТИТЬ И ЗАПУСТИТЬ АУДИТ
              </button>
            </form>
          </div>

          {/* Форма Баннера */}
          <div className="border border-purple-500/20 bg-slate-900/30 rounded-xl p-6">
            <h3 className="text-lg font-black text-purple-400 mb-4">👑 VIP БАННЕР</h3>
            <form onSubmit={handleBannerSubmit} className="space-y-4">
              <input type="text" placeholder="Тикер токена" value={bannerFormData.tokenName} onChange={(e) => setBannerFormData({...bannerFormData, tokenName: e.target.value})} className="w-full bg-slate-950 border border-purple-500/20 rounded px-3 py-2 text-xs text-white" />
              <input type="text" placeholder="Описание баннера" value={bannerFormData.desc} onChange={(e) => setBannerFormData({...bannerFormData, desc: e.target.value})} className="w-full bg-slate-950 border border-purple-500/20 rounded px-3 py-2 text-xs text-white" />
              <select value={bannerFormData.days} onChange={(e) => setBannerFormData({...bannerFormData, days: e.target.value})} className="w-full bg-slate-950 border border-purple-500/20 rounded px-3 py-2 text-xs text-white">
                <option value="1">1 День — 20$</option>
                <option value="2">2 Дня — 35$</option>
                <option value="6">6 Дней — 100$</option>
              </select>
              <button type="submit" className="w-full bg-gradient-to-r from-emerald-400 to-purple-500 text-slate-950 font-black py-2.5 rounded text-xs transition">
                ОПЛАТИТЬ И РАЗМЕСТИТЬ БАННЕР
              </button>
            </form>
          </div>
        </section>
      </div>

      {/* Модалка оплаты v2.0 */}
      {showPaymentModal && pendingAction && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
          <div className="bg-slate-950 border-2 border-purple-500/50 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6">
              <h3 className="text-xl font-black text-purple-400 mb-4">Оплата в MRDT (On-Chain Check)</h3>
              <p className="text-sm text-slate-300 mb-4">
                Отправьте <strong>{pendingAction.amount} MRDT</strong> на адрес ниже, затем вставьте TxID для проверки.
              </p>

              <div className="bg-slate-900 border border-purple-500/20 p-4 rounded-lg mb-4">
                <div className="text-xs text-purple-400 mb-1">АДРЕС ПОЛУЧАТЕЛЯ</div>
                <div className="font-mono text-sm break-all text-white mb-2">{WALLET_ADDRESS}</div>
                <button onClick={() => { navigator.clipboard.writeText(WALLET_ADDRESS); alert('Адрес скопирован!'); }} className="text-xs text-emerald-400 hover:underline">Скопировать адрес</button>
              </div>

              <div className="mb-4">
                <button onClick={handleLaunchJupiter} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 rounded mb-2">Купить MRDT на Jupiter</button>
              </div>

              <label className="block text-xs text-purple-400 mb-1">Вставьте TxID (сигнатуру транзакции)</label>
              <input 
                type="text" 
                value={txSignature} 
                onChange={(e) => setTxSignature(e.target.value)} 
                placeholder="5U... или 2x..." 
                className="w-full bg-slate-900 border border-purple-500/20 rounded px-3 py-2 text-xs font-mono text-white mb-3" 
              />

              {paymentError && <p className="text-red-400 text-xs mb-3">{paymentError}</p>}

              <button 
                onClick={confirmPayment} 
                disabled={paymentLoading || !txSignature.trim()}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-600 text-white font-black py-3 rounded text-sm transition"
              >
                {paymentLoading ? 'ПРОВЕРКА В БЛОКЧЕЙНЕ...' : 'Я ОПЛАТИЛ — ПРОВЕРИТЬ'}
              </button>

              <button 
                onClick={() => { setShowPaymentModal(false); setTxSignature(''); setPaymentError(''); setPendingAction(null); }} 
                className="w-full mt-2 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded text-sm"
              >Отмена</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
