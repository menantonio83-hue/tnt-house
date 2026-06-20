'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Shield, Send, MessageSquare, X, RefreshCw, AlertCircle, Sparkles, ExternalLink, ChevronDown, Download, Zap, Lock, CheckCircle, XCircle } from 'lucide-react';
import { Connection, PublicKey, Transaction, LAMPORTS_PER_SOL, VersionedTransaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction, getAccount } from '@solana/spl-token';

const WALLET_ADDRESS = "Ev6oXBXo6qyoaT5wypJ2Umxch91F7cFvE1SarYLaUn8Z";
const MRDT_CA = "8Q22r9qUm4AzFzTpZgaPYMxqq4z5WxE9FVa7X9dsvmBg";
const MRDT_DECIMALS = 6;
const SITE_URL = 'https://tnt-house.vercel.app';
const SUPABASE_URL = 'https://pjtvjslcffuulsqxerpx.supabase.co';
const SUPABASE_KEY = 'sb_publishable__gmhE8SE_blCu-v90fV2OQ_YmFCkfFU';

// Вспомогательные функции
const isMobile = () => typeof window !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const isInWalletBrowser = () => typeof window !== 'undefined' && !!(window.solana?.isPhantom || window.solflare?.isSolflare);

export default function TntHouse() {
  const [tokens, setTokens] = useState([]);
  const [listedTokens, setListedTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({ projectName: '', contractAddress: '', email: '' });
  const [selectedPlan, setSelectedPlan] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState('');
  const [isPaymentLoading, setIsPaymentLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4200);
  };

  const plans = [
    { value: 'basic', name: 'Базовый Аудит (24h)', price: 10 },
    { value: 'express', name: 'Быстрый Листинг (5 min)', price: 40 },
    { value: 'vip', name: 'VIP-Буст (баннер 24h)', price: 120 },
  ];

  // Основная функция оплаты (Solana Pay logic)
  const triggerPayment = async (planVal, currency, walletType) => {
    const plan = plans.find(p => p.value === planVal);
    setIsPaymentLoading(true);
    setPaymentStatus('Подключение кошелька...');

    try {
      const solanaWin = walletType === 'solflare' ? window.solflare : window.solana;
      const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
      const sender = new PublicKey((await solanaWin.connect()).publicKey.toString());
      
      setPaymentStatus('Создание транзакции...');
      
      if (currency === 'mrdt') {
        const mint = new PublicKey(MRDT_CA);
        const fromAta = await getAssociatedTokenAddress(mint, sender);
        const toAta = await getAssociatedTokenAddress(mint, new PublicKey(WALLET_ADDRESS));
        
        const tx = new Transaction().add(
          createTransferInstruction(fromAta, toAta, sender, Math.round(plan.price * 10**6)) // Упрощено для примера
        );
        tx.feePayer = sender;
        tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        
        const signed = await solanaWin.signAndSendTransaction(tx);
        await connection.confirmTransaction(signed.signature, 'confirmed');
      } else {
        // Здесь твоя логика Swap через Jupiter API
        showToast('Оплата в SOL запущена');
      }

      showToast('✅ Оплата успешна!');
      setStep(1);
    } catch (err) {
      console.error(err);
      showToast('Ошибка транзакции', 'error');
    } finally {
      setIsPaymentLoading(false);
      setPaymentStatus('');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white font-mono p-4">
      {/* Твой UI (формы, таблицы, хедер) */}
      <div className="max-w-4xl mx-auto mt-10">
        <h1 className="text-3xl font-black text-purple-500 mb-8">TNT HOUSE: ИИ-ИНСПЕКТОР</h1>
        
        {/* Индикатор загрузки оплаты */}
        {isPaymentLoading && (
          <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center">
            <RefreshCw className="w-12 h-12 animate-spin text-purple-500 mb-4" />
            <p>{paymentStatus}</p>
          </div>
        )}

        {/* Пример кнопки вызова оплаты */}
        <button 
          onClick={() => triggerPayment('basic', 'mrdt', 'phantom')}
          className="bg-purple-600 px-6 py-3 rounded-lg font-bold hover:bg-purple-500 transition"
        >
          Оплатить 10$ в $MRDT
        </button>
      </div>
    </div>
  );
}
