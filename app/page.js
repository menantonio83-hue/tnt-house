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

export default function TntHouse() {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
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
  const [solPrice, setSolPrice] = useState(150);

  // Toast system
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4200);
  };

  // Form states
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({ projectName: '', contractAddress: '', email: '' });
  const [selectedPlan, setSelectedPlan] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState('');

  const [bannerFormData, setBannerFormData] = useState({ tokenName: '', bannerImg: '', desc: '', days: '1' });

  const plans = [
    { value: 'basic', name: 'Базовый Аудит (24h)', price: 10, mrdt: '769231' },
    { value: 'express', name: 'Быстрый Листинг (5 min)', price: 40, mrdt: '3076923' },
    { value: 'vip', name: 'VIP-Буст (баннер 24h)', price: 120, mrdt: '9230769' },
  ];

  // Fetch SOL price
  useEffect(() => {
    const fetchSolPrice = async () => {
      try {
        const res = await fetch('https://price.jup.ag/v6/price?ids=SOL');
        const data = await res.json();
        if (data?.data?.SOL?.price) setSolPrice(data.data.SOL.price);
      } catch (e) {}
    };
    fetchSolPrice();
    const interval = setInterval(fetchSolPrice, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleNext = () => {
    if (step === 1) {
      if (!formData.projectName.trim() || !formData.contractAddress.trim() || !formData.email.trim()) {
        showToast('Заполни все поля', 'error');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!selectedPlan) return showToast('Выбери тариф', 'error');
      setStep(3);
    }
  };

  const handleBack = () => {
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
  };

  const getAmountForTier = (planValue) => {
    const plan = plans.find(p => p.value === planValue);
    return plan ? Math.round(plan.price / mrdtPrice) : 0;
  };

  const getAmountForBanner = (days) => {
    const usd = days === '2' ? 35 : days === '6' ? 100 : 20;
    return Math.round(usd / mrdtPrice);
  };

  // === СИМУЛЯЦИЯ ОПЛАТЫ (как просил пользователь) ===
  const handlePayment = async () => {
    if (!selectedPlan || !selectedCurrency) {
      showToast('Выбери тариф и способ оплаты', 'error');
      return;
    }

    // СИМУЛЯЦИЯ УСПЕШНОЙ ОПЛАТЫ (без реального кошелька и Jupiter)
    showToast('✅ Оплата прошла! $MRDT отправлен на кошелёк проекта (СИМУЛЯЦИЯ)', 'success');

    setStep(1);
    setSelectedPlan('');
    setSelectedCurrency('');
    setFormData({ projectName: '', contractAddress: '', email: '' });
  };

  // ... остальной код оставлен как есть (fetchTokens, analyze и т.д.)

  return (
    <div className="min-h-screen bg-slate-950 text-white font-mono relative overflow-hidden pb-12">
      {/* Весь JSX из оригинала */}
    </div>
  );
}