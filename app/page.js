'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Shield,
  Send,
  MessageSquare,
  X,
  RefreshCw,
  AlertCircle,
  Sparkles,
  ExternalLink,
  ChevronDown,
  Download,
  Zap,
  Lock,
  CheckCircle,
  XCircle,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

const WALLET_ADDRESS = 'Ev6oXBXo6qyoaT5wypJ2Umxch91F7cFvE1SarYLaUn8Z';
const MRDT_CA = '8Q22r9qUm4AzFzTpZgaPYMxqq4z5WxE9FVa7X9dsvmBg';
const USDC_CA = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // official Circle USDC mint (Solana mainnet)
const MRDT_DECIMALS = 9;
const SITE_URL = 'https://tnt-house.vercel.app';
const SUPABASE_URL = 'https://pjtvjslcffuulsqxerpx.supabase.co';
const SUPABASE_KEY = 'sb_publishable__gmhE8SE_blCu-v90fV2OQ_YmFCkfFU';

const GLOW_PURPLE = {
  position: 'absolute',
  top: '-10%',
  left: '-10%',
  width: '500px',
  height: '500px',
  borderRadius: '9999px',
  background: 'rgba(147,51,234,0.1)',
  filter: 'blur(120px)',
  pointerEvents: 'none',
};
const GLOW_GREEN = {
  position: 'absolute',
  bottom: '20%',
  right: '-10%',
  width: '500px',
  height: '500px',
  borderRadius: '9999px',
  background: 'rgba(16,185,129,0.1)',
  filter: 'blur(120px)',
  pointerEvents: 'none',
};

const TRANSLATIONS = {
  en: {
    flag: '🇬🇧',
    name: 'EN',
    tagline: 'TOP NEW TOKENS',
    heroTitle: 'Exploding scams. Launching gems.',
    heroSub: 'Welcome to the Home of New Tokens! Our AI agent scans the blockchain.',
    pillar1: 'AI Audit',
    pillar1sub: 'Contract security check',
    pillar2: 'Micro-caps',
    pillar2sub: '$5K-$100K',
    pillar3: 'DAO License',
    pillar3sub: 'Via $MRDT',
    tableTitle: 'SAFE NEW TOKENS TABLE',
    tableClick: 'Click token for TNT Security Blueprint',
    scanning: 'Scanning...',
    formTitle: 'ORDER AI INSPECTION',
    formFreeLeft: 'free slots left! Fill the form — audit starts immediately.',
    formPaid: 'Fill the form — choose wallet — pay via Solana Pay — token appears in table.',
    fieldProject: 'Project Name',
    fieldProjectPH: 'Your token...',
    fieldCA: 'Contract Address (Solana)',
    fieldCAPH: 'Enter contract address...',
    fieldTier: 'Select tier',
    tierBasic: 'Basic Audit',
    tierFast: 'Fast Listing',
    tierVIP: 'VIP Boost',
    fieldTelegram: 'Telegram handle',
    btnFreeAudit: '🎁 LAUNCH FREE AUDIT',
    btnAudit: 'LAUNCH AI INSPECTION',
    btnLaunching: 'LAUNCHING...',
    bannerTitle: 'BUY VIP BANNER',
    bannerSub: 'Your token replaces the ad slot automatically.',
    fieldTokenName: 'Token name / Ticker',
    fieldUpload: 'Upload image',
    fieldSlogan: 'Short ad slogan',
    fieldSloganPH: 'The fastest memecoin...',
    fieldDuration: 'Duration',
    dur1: '1 Day',
    dur2: '2 Days',
    dur6: '6 Days',
    btnBanner: 'PAY AND PLACE BANNER',
    btnSlotTaken: '🔒 SLOT TAKEN',
    btnSending: 'SENDING...',
    slotAvailIn: 'Slot available in',
    investorTitle: 'Investor Information',
    investorSub:
      'All payments accepted in $MRDT / SOL / USDC via Solana Pay. After payment, token appears in table automatically.',
    pricingTitle: 'CURRENT PRICING:',
    first10: '🎁 First 10 tokens',
    free: 'FREE',
    daoTitle: 'TNT WHALE CLUB (DAO)',
    daoText:
      'Questions about audits, listings or $MRDT? Write to our admin in Telegram — we reply fast. 🚀',
    daoBtn: '💬 Ask Admin in Telegram',
    choosePayment: 'Choose payment method',
    recommended: 'Recommended',
    chooseWallet: 'Choose wallet',
    back: '← Back',
    invoice: 'Payment Invoice',
    invoiceBanner: 'Invoice — VIP Banner',
    cancel: 'Cancel',
    payNow: '✅ Pay Now',
    bannerLive: 'Banner goes live automatically after payment 🚀',
    waitPayment: 'Waiting for Payment',
    waitSub:
      "Complete the transaction in your wallet and return here. We'll detect it automatically.",
    checkingBC: 'Checking blockchain... attempt',
    timeoutIn: 'Timeout in',
    min: 'min',
    payConfirmed: 'Payment Confirmed!',
    bannerLiveMsg: 'Your banner is now live for all visitors.',
    tokenAdded: 'Token added to the safety table.',
    payNotDetected: 'Payment Not Detected',
    payNotMsg:
      "We couldn't confirm your payment within 5 minutes. If you paid, contact admin in Telegram.",
    contactAdmin: 'Contact Admin',
    close: 'Close',
    slotAvailable: 'SLOT AVAILABLE',
    slotAvailClick: 'Click to buy VIP banner!',
    vipBoostFrom: 'VIP Boost from $20/day',
    payInMrdt: 'Payment in $MRDT / SOL / USDC',
    buyOnJupiter: 'BUY ON JUPITER',
    safetyScore: 'Safety Score',
    ironclad: 'Ironclad Safe ★',
    moderate: 'Moderate Risk ⚠️',
    highRisk: 'High Risk 🚨',
    mintAuth: 'Mint Authority',
    freezeAuth: 'Freeze Authority',
    honeypot: 'Honeypot',
    price: 'Price',
    liquidity: 'Liquidity',
    volume24h: 'Volume 24h',
    noFreeSlots: 'no slots',
    questions: 'questions',
    limitReached: 'Message limit reached. Unlocks in',
    orderAudit: '💎 Order full audit from $10',
    pasteCa: 'Paste CA or ask a question...',
    analyzing: 'Analyzing...',
    fillFields: 'Fill all fields',
    priceError: 'Price error, try later',
  },
  es: {
    flag: '🇪🇸',
    name: 'ES',
    tagline: 'NUEVOS TOKENS',
    heroTitle: 'Destruyendo scams. Lanzando gems.',
    heroSub: '¡Bienvenido a la Casa de Nuevos Tokens! Nuestro agente IA escanea la blockchain.',
    pillar1: 'Auditoría IA',
    pillar1sub: 'Seguridad de contratos',
    pillar2: 'Micro-caps',
    pillar2sub: '$5K-$100K',
    pillar3: 'Licencia DAO',
    pillar3sub: 'Vía $MRDT',
    tableTitle: 'TABLA DE TOKENS SEGUROS',
    tableClick: 'Toca un token para TNT Security Blueprint',
    scanning: 'Escaneando...',
    formTitle: 'PEDIR INSPECCIÓN IA',
    formFreeLeft: 'lugares gratis! Llena el formulario.',
    formPaid: 'Llena el formulario — elige billetera — paga — el token aparece en la tabla.',
    fieldProject: 'Nombre del proyecto',
    fieldProjectPH: 'Tu token...',
    fieldCA: 'Dirección del Contrato (Solana)',
    fieldCAPH: 'Ingresa la dirección...',
    fieldTier: 'Selecciona plan',
    tierBasic: 'Auditoría Básica',
    tierFast: 'Listado Rápido',
    tierVIP: 'VIP Boost',
    fieldTelegram: 'Usuario de Telegram',
    btnFreeAudit: '🎁 AUDITORÍA GRATIS',
    btnAudit: 'INICIAR INSPECCIÓN IA',
    btnLaunching: 'ENVIANDO...',
    bannerTitle: 'COMPRAR BANNER VIP',
    bannerSub: 'Tu token reemplaza el espacio publicitario automáticamente.',
    fieldTokenName: 'Nombre del token / Ticker',
    fieldUpload: 'Subir imagen',
    fieldSlogan: 'Eslogan publicitario',
    fieldSloganPH: 'El memecoin más rápido...',
    fieldDuration: 'Duración',
    dur1: '1 Día',
    dur2: '2 Días',
    dur6: '6 Días',
    btnBanner: 'PAGAR Y COLOCAR BANNER',
    btnSlotTaken: '🔒 LUGAR OCUPADO',
    btnSending: 'ENVIANDO...',
    slotAvailIn: 'Lugar disponible en',
    investorTitle: 'Información para Inversores',
    investorSub: 'Todos los pagos se aceptan en $MRDT / SOL / USDC vía Solana Pay.',
    pricingTitle: 'PRECIOS ACTUALES:',
    first10: '🎁 Primeros 10 tokens',
    free: 'GRATIS',
    daoTitle: 'TNT WHALE CLUB (DAO)',
    daoText: '¿Preguntas sobre auditorías o $MRDT? Escríbenos en Telegram. 🚀',
    daoBtn: '💬 Contactar Admin',
    choosePayment: 'Elige método de pago',
    recommended: 'Recomendado',
    chooseWallet: 'Elige billetera',
    back: '← Volver',
    invoice: 'Factura de Pago',
    invoiceBanner: 'Factura — Banner VIP',
    cancel: 'Cancelar',
    payNow: '✅ Pagar Ahora',
    bannerLive: 'El banner se activa automáticamente después del pago 🚀',
    waitPayment: 'Esperando Pago',
    waitSub: 'Completa la transacción en tu billetera y regresa aquí.',
    checkingBC: 'Verificando blockchain... intento',
    timeoutIn: 'Tiempo límite en',
    min: 'min',
    payConfirmed: '¡Pago Confirmado!',
    bannerLiveMsg: 'Tu banner está activo para todos los visitantes.',
    tokenAdded: 'Token añadido a la tabla de seguridad.',
    payNotDetected: 'Pago No Detectado',
    payNotMsg: 'No pudimos confirmar tu pago en 5 minutos.',
    contactAdmin: 'Contactar Admin',
    close: 'Cerrar',
    slotAvailable: 'LUGAR DISPONIBLE',
    slotAvailClick: '¡Haz clic para comprar banner VIP!',
    vipBoostFrom: 'VIP Boost desde $20/día',
    payInMrdt: 'Pago en $MRDT / SOL / USDC',
    buyOnJupiter: 'COMPRAR EN JUPITER',
    safetyScore: 'Puntuación de Seguridad',
    ironclad: 'Totalmente Seguro ★',
    moderate: 'Riesgo Moderado ⚠️',
    highRisk: 'Alto Riesgo 🚨',
    mintAuth: 'Mint Authority',
    freezeAuth: 'Freeze Authority',
    honeypot: 'Honeypot',
    price: 'Precio',
    liquidity: 'Liquidez',
    volume24h: 'Volumen 24h',
    noFreeSlots: 'sin lugares',
    questions: 'preguntas',
    limitReached: 'Límite de mensajes alcanzado. Se desbloquea en',
    orderAudit: '💎 Pedir auditoría desde $10',
    pasteCa: 'Pega CA o haz una pregunta...',
    analyzing: 'Analizando...',
    fillFields: 'Completa todos los campos',
    priceError: 'Error de precio',
  },
  fr: {
    flag: '🇫🇷',
    name: 'FR',
    tagline: 'NOUVEAUX TOKENS',
    heroTitle: 'Détruire les arnaques. Lancer des gems.',
    heroSub: 'Bienvenue à la Maison des Nouveaux Tokens ! Notre agent IA scanne la blockchain.',
    pillar1: 'Audit IA',
    pillar1sub: 'Sécurité des contrats',
    pillar2: 'Micro-caps',
    pillar2sub: '$5K-$100K',
    pillar3: 'Licence DAO',
    pillar3sub: 'Via $MRDT',
    tableTitle: 'TABLE DES TOKENS SÉCURISÉS',
    tableClick: 'Cliquez sur un token pour le Blueprint',
    scanning: 'Analyse...',
    formTitle: 'COMMANDER UNE INSPECTION IA',
    formFreeLeft: 'places gratuites! Remplissez le formulaire.',
    formPaid: 'Remplissez — choisissez un portefeuille — payez — le token apparaît.',
    fieldProject: 'Nom du projet',
    fieldProjectPH: 'Votre token...',
    fieldCA: 'Adresse du Contrat (Solana)',
    fieldCAPH: 'Entrez adresse...',
    fieldTier: 'Choisir le plan',
    tierBasic: 'Audit Basique',
    tierFast: 'Listing Rapide',
    tierVIP: 'VIP Boost',
    fieldTelegram: 'Pseudo Telegram',
    btnFreeAudit: '🎁 AUDIT GRATUIT',
    btnAudit: 'LANCER INSPECTION IA',
    btnLaunching: 'ENVOI...',
    bannerTitle: 'ACHETER BANNIÈRE VIP',
    bannerSub: 'Votre token remplace automatiquement espace publicitaire.',
    fieldTokenName: 'Nom du token / Ticker',
    fieldUpload: 'Télécharger image',
    fieldSlogan: 'Slogan publicitaire',
    fieldSloganPH: 'Le memecoin le plus rapide...',
    fieldDuration: 'Durée',
    dur1: '1 Jour',
    dur2: '2 Jours',
    dur6: '6 Jours',
    btnBanner: 'PAYER ET PLACER LA BANNIÈRE',
    btnSlotTaken: '🔒 EMPLACEMENT OCCUPÉ',
    btnSending: 'ENVOI...',
    slotAvailIn: 'Emplacement disponible dans',
    investorTitle: 'Informations Investisseurs',
    investorSub: 'Tous les paiements sont acceptés en $MRDT / SOL / USDC via Solana Pay.',
    pricingTitle: 'TARIFS ACTUELS:',
    first10: '🎁 10 premiers tokens',
    free: 'GRATUIT',
    daoTitle: 'TNT WHALE CLUB (DAO)',
    daoText: 'Questions sur les audits ou $MRDT ? Écrivez à notre admin sur Telegram. 🚀',
    daoBtn: '💬 Contacter Admin',
    choosePayment: 'Choisir méthode de paiement',
    recommended: 'Recommandé',
    chooseWallet: 'Choisir portefeuille',
    back: '← Retour',
    invoice: 'Facture de Paiement',
    invoiceBanner: 'Facture — Bannière VIP',
    cancel: 'Annuler',
    payNow: '✅ Payer Maintenant',
    bannerLive: 'La bannière est activée automatiquement après paiement 🚀',
    waitPayment: 'En attente du Paiement',
    waitSub: 'Complétez la transaction et revenez ici.',
    checkingBC: 'Vérification blockchain... tentative',
    timeoutIn: 'Délai dans',
    min: 'min',
    payConfirmed: 'Paiement Confirmé!',
    bannerLiveMsg: 'Votre bannière est en ligne pour tous les visiteurs.',
    tokenAdded: 'Token ajouté à la table.',
    payNotDetected: 'Paiement Non Détecté',
    payNotMsg: 'Nous ne pouvons pas confirmer votre paiement en 5 minutes.',
    contactAdmin: 'Contacter Admin',
    close: 'Fermer',
    slotAvailable: 'EMPLACEMENT DISPONIBLE',
    slotAvailClick: 'Cliquez pour acheter la bannière VIP!',
    vipBoostFrom: 'VIP Boost à partir de $20/jour',
    payInMrdt: 'Paiement en $MRDT / SOL / USDC',
    buyOnJupiter: 'ACHETER SUR JUPITER',
    safetyScore: 'Score de Sécurité',
    ironclad: 'Totalement Sécurisé ★',
    moderate: 'Risque Modéré ⚠️',
    highRisk: 'Risque Élevé 🚨',
    mintAuth: 'Mint Authority',
    freezeAuth: 'Freeze Authority',
    honeypot: 'Honeypot',
    price: 'Prix',
    liquidity: 'Liquidité',
    volume24h: 'Volume 24h',
    noFreeSlots: 'plus de places',
    questions: 'questions',
    limitReached: 'Limite de messages atteinte. Débloqué dans',
    orderAudit: '💎 Commander audit dès $10',
    pasteCa: 'Collez CA ou posez une question...',
    analyzing: 'Analyse...',
    fillFields: 'Remplissez tous les champs',
    priceError: 'Erreur de prix',
  },
  el: {
    flag: '🇬🇷',
    name: 'EL',
    tagline: 'ΝΕΑ TOKENS',
    heroTitle: 'Σπάζουμε scams. Λανσάρουμε gems.',
    heroSub: 'Καλώς ήρθατε στο Σπίτι Νέων Tokens! Ο AI πράκτοράς μας σαρώνει το blockchain.',
    pillar1: 'AI Έλεγχος',
    pillar1sub: 'Ασφάλεια συμβολαίων',
    pillar2: 'Micro-caps',
    pillar2sub: '$5K-$100K',
    pillar3: 'Άδεια DAO',
    pillar3sub: 'Μέσω $MRDT',
    tableTitle: 'ΠΙΝΑΚΑΣ ΑΣΦΑΛΩΝ TOKENS',
    tableClick: 'Κλικ σε token για TNT Security Blueprint',
    scanning: 'Σάρωση...',
    formTitle: 'ΠΑΡΑΓΓΕΛΙΑ AI ΕΠΙΘΕΩΡΗΣΗΣ',
    formFreeLeft: 'δωρεάν θέσεις! Συμπλήρωσε τη φόρμα.',
    formPaid: 'Συμπλήρωσε — επίλεξε πορτοφόλι — πλήρωσε.',
    fieldProject: 'Όνομα Έργου',
    fieldProjectPH: 'Το token σου...',
    fieldCA: 'Διεύθυνση Συμβολαίου (Solana)',
    fieldCAPH: 'Εισαγωγή διεύθυνσης...',
    fieldTier: 'Επιλογή πλάνου',
    tierBasic: 'Βασικός Έλεγχος',
    tierFast: 'Γρήγορη Καταχώρηση',
    tierVIP: 'VIP Boost',
    fieldTelegram: 'Χρήστης Telegram',
    btnFreeAudit: '🎁 ΔΩΡΕΑΝ ΕΛΕΓΧΟΣ',
    btnAudit: 'ΕΚΚΙΝΗΣΗ AI ΕΠΙΘΕΩΡΗΣΗΣ',
    btnLaunching: 'ΑΠΟΣΤΟΛΗ...',
    bannerTitle: 'ΑΓΟΡΑ VIP BANNER',
    bannerSub: 'Το token σου αντικαθιστά αυτόματα τη διαφήμιση.',
    fieldTokenName: 'Όνομα token / Ticker',
    fieldUpload: 'Ανέβασμα εικόνας',
    fieldSlogan: 'Σύντομο σλόγκαν',
    fieldSloganPH: 'Το γρηγορότερο memecoin...',
    fieldDuration: 'Διάρκεια',
    dur1: '1 Ημέρα',
    dur2: '2 Ημέρες',
    dur6: '6 Ημέρες',
    btnBanner: 'ΠΛΗΡΩΜΗ ΚΑΙ ΤΟΠΟΘΕΤΗΣΗ BANNER',
    btnSlotTaken: '🔒 ΘΕΣΗ ΚΑΤΕΙΛΗΜΜΕΝΗ',
    btnSending: 'ΑΠΟΣΤΟΛΗ...',
    slotAvailIn: 'Θέση διαθέσιμη σε',
    investorTitle: 'Πληροφορίες Επενδυτών',
    investorSub: 'Όλες οι πληρωμές γίνονται σε $MRDT / SOL / USDC μέσω Solana Pay.',
    pricingTitle: 'ΤΡΕΧΟΥΣΕΣ ΤΙΜΕΣ:',
    first10: '🎁 Πρώτα 10 tokens',
    free: 'ΔΩΡΕΑΝ',
    daoTitle: 'TNT WHALE CLUB (DAO)',
    daoText: 'Ερωτήσεις για ελέγχους ή $MRDT; Γράψτε μας στο Telegram. 🚀',
    daoBtn: '💬 Επικοινωνία Admin',
    choosePayment: 'Επιλογή μεθόδου πληρωμής',
    recommended: 'Προτεινόμενο',
    chooseWallet: 'Επιλογή πορτοφολιού',
    back: '← Πίσω',
    invoice: 'Τιμολόγιο Πληρωμής',
    invoiceBanner: 'Τιμολόγιο — VIP Banner',
    cancel: 'Ακύρωση',
    payNow: '✅ Πληρωμή Τώρα',
    bannerLive: 'Το banner ενεργοποιείται αυτόματα μετά την πληρωμή 🚀',
    waitPayment: 'Αναμονή Πληρωμής',
    waitSub: 'Ολοκλήρωσε τη συναλλαγή και επέστρεψε εδώ.',
    checkingBC: 'Έλεγχος blockchain... προσπάθεια',
    timeoutIn: 'Λήξη σε',
    min: 'λεπτά',
    payConfirmed: 'Πληρωμή Επιβεβαιώθηκε!',
    bannerLiveMsg: 'Το banner σου είναι ενεργό για όλους τους επισκέπτες.',
    tokenAdded: 'Token προστέθηκε στον πίνακα.',
    payNotDetected: 'Πληρωμή Δεν Εντοπίστηκε',
    payNotMsg: 'Δεν μπορέσαμε να επιβεβαιώσουμε την πληρωμή σε 5 λεπτά.',
    contactAdmin: 'Επικοινωνία Admin',
    close: 'Κλείσιμο',
    slotAvailable: 'ΘΕΣΗ ΔΙΑΘΕΣΙΜΗ',
    slotAvailClick: 'Κλικ για αγορά VIP banner!',
    vipBoostFrom: 'VIP Boost από $20/ημέρα',
    payInMrdt: 'Πληρωμή σε $MRDT / SOL / USDC',
    buyOnJupiter: 'ΑΓΟΡΑ ΣΤΟ JUPITER',
    safetyScore: 'Βαθμολογία Ασφαλείας',
    ironclad: 'Απολύτως Ασφαλές ★',
    moderate: 'Μέτριος Κίνδυνος ⚠️',
    highRisk: 'Υψηλός Κίνδυνος 🚨',
    mintAuth: 'Mint Authority',
    freezeAuth: 'Freeze Authority',
    honeypot: 'Honeypot',
    price: 'Τιμή',
    liquidity: 'Ρευστότητα',
    volume24h: 'Όγκος 24ω',
    noFreeSlots: 'χωρίς θέσεις',
    questions: 'ερωτήσεις',
    limitReached: 'Το όριο μηνυμάτων εξαντλήθηκε. Ξεκλειδώνει σε',
    orderAudit: '💎 Παραγγελία ελέγχου από $10',
    pasteCa: 'Επικόλληση CA ή ερώτηση...',
    analyzing: 'Ανάλυση...',
    fillFields: 'Συμπλήρωσε όλα τα πεδία',
    priceError: 'Σφάλμα τιμής',
  },
  ru: {
    flag: '🇷🇺',
    name: 'RU',
    tagline: 'НОВЫЕ ТОКЕНЫ',
    heroTitle: 'Взрываем скамы. Запускаем гемы.',
    heroSub: 'Добро пожаловать в Дом Новых Токенов! Наш ИИ-агент сканирует блокчейн.',
    pillar1: 'ИИ Аудит',
    pillar1sub: 'Безопасность контрактов',
    pillar2: 'Микро-капы',
    pillar2sub: '$5K-$100K',
    pillar3: 'DAO Лицензия',
    pillar3sub: 'Через $MRDT',
    tableTitle: 'ТАБЛИЦА БЕЗОПАСНЫХ ТОКЕНОВ',
    tableClick: 'Нажмите на токен для TNT Security Blueprint',
    scanning: 'Сканирование...',
    formTitle: 'ЗАКАЗАТЬ ИИ-ИНСПЕКЦИЮ',
    formFreeLeft: 'бесплатных мест! Заполни форму — аудит запустится сразу.',
    formPaid: 'Заполни форму — выбери кошелёк — оплати — токен появится в таблице.',
    fieldProject: 'Название проекта',
    fieldProjectPH: 'Твой токен...',
    fieldCA: 'Адрес контракта (Solana)',
    fieldCAPH: 'Введи адрес контракта...',
    fieldTier: 'Выбери тариф',
    tierBasic: 'Базовый Аудит',
    tierFast: 'Быстрый Листинг',
    tierVIP: 'VIP-Буст',
    fieldTelegram: 'Telegram для связи',
    btnFreeAudit: '🎁 БЕСПЛАТНЫЙ АУДИТ',
    btnAudit: 'ЗАПУСТИТЬ ИИ-ИНСПЕКЦИЮ',
    btnLaunching: 'ОТПРАВЛЯЕМ...',
    bannerTitle: 'КУПИТЬ VIP-БАННЕР',
    bannerSub: 'Твой токен автоматически заменит рекламное место.',
    fieldTokenName: 'Название / Тикер токена',
    fieldUpload: 'Загрузить изображение',
    fieldSlogan: 'Краткий рекламный слоган',
    fieldSloganPH: 'Самый быстрый мемкоин...',
    fieldDuration: 'Срок размещения',
    dur1: '1 День',
    dur2: '2 Дня',
    dur6: '6 Дней',
    btnBanner: 'ОПЛАТИТЬ И РАЗМЕСТИТЬ БАННЕР',
    btnSlotTaken: '🔒 МЕСТО ЗАНЯТО',
    btnSending: 'ОТПРАВКА...',
    slotAvailIn: 'Место освободится через',
    investorTitle: 'Информация для инвесторов',
    investorSub:
      'Все платежи принимаются в $MRDT / SOL / USDC через Solana Pay. После оплаты токен появится в таблице автоматически.',
    pricingTitle: 'ТЕКУЩИЕ ТАРИФЫ:',
    first10: '🎁 Первые 10 токенов',
    free: 'БЕСПЛАТНО',
    daoTitle: 'TNT WHALE CLUB (DAO)',
    daoText: 'Вопросы об аудитах, листинге или $MRDT? Пишите нашему админу в Telegram. 🚀',
    daoBtn: '💬 Написать Админу',
    choosePayment: 'Выбери способ оплаты',
    recommended: 'Рекомендуем',
    chooseWallet: 'Выбери кошелёк',
    back: '← Назад',
    invoice: 'Счёт на оплату',
    invoiceBanner: 'Счёт — VIP-Баннер',
    cancel: 'Отмена',
    payNow: '✅ Оплатить',
    bannerLive: 'Баннер появится автоматически после оплаты 🚀',
    waitPayment: 'Ожидание оплаты',
    waitSub: 'Подтверди транзакцию в кошельке и вернись сюда.',
    checkingBC: 'Проверяем блокчейн... попытка',
    timeoutIn: 'Таймаут через',
    min: 'мин',
    payConfirmed: 'Оплата подтверждена!',
    bannerLiveMsg: 'Твой баннер активен для всех посетителей.',
    tokenAdded: 'Токен добавлен в таблицу безопасности.',
    payNotDetected: 'Оплата не обнаружена',
    payNotMsg: 'Не смогли подтвердить оплату за 5 минут. Если заплатил — напиши админу.',
    contactAdmin: 'Написать Админу',
    close: 'Закрыть',
    slotAvailable: 'МЕСТО СВОБОДНО',
    slotAvailClick: 'Нажмите, чтобы купить VIP-баннер!',
    vipBoostFrom: 'VIP-Буст от $20/день',
    payInMrdt: 'Оплата в $MRDT / SOL / USDC',
    buyOnJupiter: 'КУПИТЬ НА JUPITER',
    safetyScore: 'Оценка безопасности',
    ironclad: 'Железобетонно безопасно ★',
    moderate: 'Умеренный риск ⚠️',
    highRisk: 'Высокий риск 🚨',
    mintAuth: 'Mint Authority',
    freezeAuth: 'Freeze Authority',
    honeypot: 'Honeypot',
    price: 'Цена',
    liquidity: 'Ликвидность',
    volume24h: 'Объём 24ч',
    noFreeSlots: 'мест нет',
    questions: 'вопросов',
    limitReached: 'Лимит сообщений исчерпан. Разблокировка через',
    orderAudit: '💎 Заказать полный аудит от $10',
    pasteCa: 'Вставь CA или задай вопрос...',
    analyzing: 'Анализирую...',
    fillFields: 'Заполни все поля',
    priceError: 'Ошибка цены, попробуй позже',
  },
};

// --- Supabase helpers ---
// Post a newly-audited token to the Telegram group via /api/sendTelegram.
// Best-effort: failures are logged but never block the audit flow.
async function postAuditToTelegram(token) {
  try {
    await fetch('/api/sendTelegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tokenName: token.name,
        symbol: token.symbol,
        ca: token.ca,
        mintAuthority: token.mintAuthority || 'Unknown',
        freezeAuthority: token.freezeAuthority || 'Unknown',
        top10Percent: token.top10Percent != null ? token.top10Percent : 'N/A',
        liquidityUSD: typeof token.liquidity === 'number' ? token.liquidity : 0,
        lpLocked:
          token.lpLockedPercent != null ? token.lpLockedPercent + '% locked' : 'Unknown',
        dexUrl: token.dexUrl,
      }),
    });
  } catch (e) {
    console.error('Telegram post failed:', e);
  }
}

async function loadTokenVotes() {
  try {
    var res = await fetch(SUPABASE_URL + '/rest/v1/token_votes?select=*', {
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY },
    });
    if (!res.ok) return {};
    var data = await res.json();
    var map = {};
    data.forEach(function (row) {
      map[row.ca] = { upvotes: row.upvotes || 0, downvotes: row.downvotes || 0 };
    });
    return map;
  } catch (e) {
    return {};
  }
}

async function castVoteRpc(ca, direction) {
  try {
    var res = await fetch(SUPABASE_URL + '/rest/v1/rpc/cast_vote', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_KEY,
        Authorization: 'Bearer ' + SUPABASE_KEY,
      },
      body: JSON.stringify({ p_ca: ca, p_direction: direction }),
    });
    if (!res.ok) return null;
    var data = await res.json();
    return data && data[0] ? data[0] : null;
  } catch (e) {
    return null;
  }
}

// Deterministic fallback avatar for tokens without an uploaded logo:
// picks a color from a fixed palette based on a hash of the token symbol,
// so the same token always gets the same color across renders/sessions.
var AVATAR_COLORS = [
  '#a855f7', '#10b981', '#06b6d4', '#f59e0b', '#ef4444',
  '#ec4899', '#3b82f6', '#22c55e', '#eab308', '#8b5cf6',
];
function getAvatarColor(str) {
  var s = str || '?';
  var hash = 0;
  for (var i = 0; i < s.length; i++) {
    hash = s.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function TokenAvatar({ token, size }) {
  var px = size || 20;
  if (token.logoUrl) {
    return (
      <img
        src={token.logoUrl}
        alt=""
        style={{ width: px, height: px }}
        className="rounded-full object-cover border border-purple-500/30 shrink-0"
      />
    );
  }
  var letter = (token.symbol || token.name || '?').charAt(0).toUpperCase();
  var color = getAvatarColor(token.symbol || token.name || token.ca || '');
  return (
    <div
      style={{ width: px, height: px, backgroundColor: color }}
      className="rounded-full flex items-center justify-center text-white font-black shrink-0"
    >
      <span style={{ fontSize: px * 0.5 }}>{letter}</span>
    </div>
  );
}


async function saveTokenToSupabase(token) {
  try {
    await fetch(SUPABASE_URL + '/rest/v1/listed_tokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_KEY,
        Authorization: 'Bearer ' + SUPABASE_KEY,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        name: token.name,
        symbol: token.symbol,
        ca: token.ca,
        price: token.price,
        liquidity: token.liquidity,
        volume24h: token.volume24h,
        price_change_24h: token.priceChange24h,
        score: token.score || 95,
        dex_url: token.dexUrl,
        chain: token.chain || 'solana',
        mint_authority: token.mintAuthority || '-',
        freeze_authority: token.freezeAuthority || '-',
        is_honeypot: token.isHoneypot || '-',
        top10_percent: token.top10Percent != null ? token.top10Percent : null,
        lp_locked_percent: token.lpLockedPercent != null ? token.lpLockedPercent : null,
        holder_count: token.holderCount != null ? token.holderCount : null,
        creator_balance_percent:
          token.creatorBalancePercent != null ? token.creatorBalancePercent : null,
        logo_url: token.logoUrl || null,
        buy_tax_percent: token.buyTaxPercent != null ? token.buyTaxPercent : null,
        sell_tax_percent: token.sellTaxPercent != null ? token.sellTaxPercent : null,
        contract_renounced: token.contractRenounced != null ? token.contractRenounced : null,
        hidden_owner: token.hiddenOwner || null,
        age_days: token.ageDays != null ? token.ageDays : null,
        standard_program: token.standardProgram != null ? token.standardProgram : null,
        permanent_delegate: token.permanentDelegate || null,
      }),
    });
  } catch (e) {
    console.error('Supabase save failed:', e);
  }
}

async function loadTokensFromSupabase() {
  try {
    var res = await fetch(
      SUPABASE_URL + '/rest/v1/listed_tokens?select=*&order=created_at.desc&limit=20',
      { headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY } },
    );
    if (!res.ok) return [];
    var data = await res.json();
    return data.map(function (row) {
      return {
        name: row.name,
        symbol: row.symbol,
        ca: row.ca,
        price: row.price,
        liquidity: row.liquidity,
        volume24h: row.volume24h,
        priceChange24h: row.price_change_24h,
        score: row.score,
        verified: true,
        dexUrl: row.dex_url,
        chain: row.chain,
        mintAuthority: row.mint_authority,
        freezeAuthority: row.freeze_authority,
        isHoneypot: row.is_honeypot,
        top10Percent: row.top10_percent,
        lpLockedPercent: row.lp_locked_percent,
        holderCount: row.holder_count,
        creatorBalancePercent: row.creator_balance_percent,
        logoUrl: row.logo_url || '',
        buyTaxPercent: row.buy_tax_percent,
        sellTaxPercent: row.sell_tax_percent,
        contractRenounced: row.contract_renounced,
        hiddenOwner: row.hidden_owner,
        ageDays: row.age_days,
        standardProgram: row.standard_program,
        permanentDelegate: row.permanent_delegate,
        fromSupabase: true,
      };
    });
  } catch (e) {
    return [];
  }
}

// FEAT v1.76: Multiple VIP banner slots instead of a single one.
// Each slot is a separate row in active_banner (id 1..BANNER_SLOTS).
const BANNER_SLOTS = 3;

async function saveBannerToSupabase(banner, slot) {
  try {
    await fetch(SUPABASE_URL + '/rest/v1/active_banner', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_KEY,
        Authorization: 'Bearer ' + SUPABASE_KEY,
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({
        id: slot || 1,
        token_name: banner.tokenName,
        banner_img: banner.bannerImg || '',
        description: banner.desc,
        expires_at: new Date(banner.expiresAt).toISOString(),
      }),
    });
  } catch (e) {
    console.error('Banner save failed:', e);
  }
}

// Loads all banner slots (ids 1..BANNER_SLOTS) and returns only the
// ones that haven't expired yet, each tagged with its slot number so
// the purchase flow knows which slots are free.
async function loadBannersFromSupabase() {
  try {
    var res = await fetch(
      SUPABASE_URL + '/rest/v1/active_banner?id=lte.' + BANNER_SLOTS + '&select=*',
      { headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY } },
    );
    if (!res.ok) return [];
    var data = await res.json();
    var now = Date.now();
    return (data || [])
      .map(function (row) {
        return {
          slot: row.id,
          tokenName: row.token_name,
          bannerImg: row.banner_img || '',
          desc: row.description,
          expiresAt: new Date(row.expires_at).getTime(),
        };
      })
      .filter(function (b) {
        return b.expiresAt > now;
      });
  } catch (e) {
    return [];
  }
}

const FALLBACK_TOKENS = [];

export default function TntHouse() {
  var [tokens, setTokens] = useState([]);
  var [listedTokens, setListedTokens] = useState([]);
  var [tokenVotes, setTokenVotes] = useState({}); // { [ca]: { upvotes, downvotes } }
  var [tableSearch, setTableSearch] = useState('');
  var [tableSort, setTableSort] = useState('default'); // default | score | volume | liquidity
  var [watchlist, setWatchlist] = useState([]); // array of CA strings, persisted to localStorage
  var [showWatchlistOnly, setShowWatchlistOnly] = useState(false);
  var [votedTokens, setVotedTokens] = useState({}); // { [ca]: 'up' | 'down' } — this browser's own votes
  var [loading, setLoading] = useState(true);
  var [error, setError] = useState('');
  var [isBuyDropdownOpen, setIsBuyDropdownOpen] = useState(false);
  var [activeBanners, setActiveBanners] = useState([]);
  var [bannerDisplayIndex, setBannerDisplayIndex] = useState(0);
  var [bannerCountdown, setBannerCountdown] = useState('');
  var [isBlueprintOpen, setIsBlueprintOpen] = useState(false);
  var [selectedToken, setSelectedToken] = useState(null);
  var [clusterResult, setClusterResult] = useState(null);
  var [clusterLoading, setClusterLoading] = useState(false);
  var [mrdtPrice, setMrdtPrice] = useState(0.000013);
  var mrdtPriceRef = useRef(0.000013);
  // FIX v1.45: track SOL/USD price so SOL payments charge the correct SOL amount
  // instead of accidentally reusing the MRDT token amount.
  var [solPrice, setSolPrice] = useState(85);
  var solPriceRef = useRef(85);
  var [priceLoading, setPriceLoading] = useState(true);
  var [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  var [lang, setLang] = useState('en');
  var t = TRANSLATIONS[lang] || TRANSLATIONS.en;
  var [formData, setFormData] = useState({
    projectName: '',
    contractAddress: '',
    telegram: '',
    logoImg: '',
  });
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
  var [deeplinkFallbackUri, setDeeplinkFallbackUri] = useState('');
  var [bannerFormData, setBannerFormData] = useState({
    tokenName: '',
    bannerImg: '',
    desc: '',
    days: '1',
  });
  var [bannerSubmitted, setBannerSubmitted] = useState(false);
  var [bannerError, setBannerError] = useState('');
  var [isBannerSending, setIsBannerSending] = useState(false);
  var [isChatOpen, setIsChatOpen] = useState(false);
  var [chatMessages, setChatMessages] = useState([
    {
      sender: 'bot',
      text: "Hey! I'm TNT House AI Inspector 🤖\n\nAsk me anything about TNT House, $MRDT or token audits — paste a CA for a quick breakdown.",
    },
  ]);
  var [userMsg, setUserMsg] = useState('');
  var [isTyping, setIsTyping] = useState(false);
  var chatEndRef = useRef(null);
  var [chatCount, setChatCount] = useState(0);
  var [chatResetTime, setChatResetTime] = useState(null);
  var [chatBlocked, setChatBlocked] = useState(false);
  var [chatTimer, setChatTimer] = useState('');
  var [logs, setLogs] = useState([
    '[AI-Inspector] Initializing TNT House security system...',
    '[NET] Connected to Solana RPC nodes successfully.',
  ]);

  var showToast = function (message, type) {
    if (!type) type = 'success';
    setToast({ show: true, message: message, type: type });
    setTimeout(function () {
      setToast({ show: false, message: '', type: 'success' });
    }, 4200);
  };

  // FEAT v1.77: table search + sort — filters by name/symbol/CA substring
  // match, then sorts by the chosen column. Applied to both the
  // Supabase-listed (audited) tokens and the live DexScreener feed.
  var filterAndSortTokens = function (list) {
    var query = tableSearch.trim().toLowerCase();
    var filtered = query
      ? list.filter(function (tk) {
          return (
            (tk.name && tk.name.toLowerCase().includes(query)) ||
            (tk.symbol && tk.symbol.toLowerCase().includes(query)) ||
            (tk.ca && tk.ca.toLowerCase().includes(query))
          );
        })
      : list;
    if (showWatchlistOnly) {
      filtered = filtered.filter(function (tk) {
        return watchlist.includes(tk.ca);
      });
    }
    if (tableSort === 'default') return filtered;
    var sorted = filtered.slice();
    if (tableSort === 'score') {
      sorted.sort(function (a, b) {
        return getSafetyScore(b) - getSafetyScore(a);
      });
    } else if (tableSort === 'volume') {
      sorted.sort(function (a, b) {
        return (b.volume24h || 0) - (a.volume24h || 0);
      });
    } else if (tableSort === 'liquidity') {
      sorted.sort(function (a, b) {
        var aLiq = typeof a.liquidity === 'number' ? a.liquidity : 0;
        var bLiq = typeof b.liquidity === 'number' ? b.liquidity : 0;
        return bLiq - aLiq;
      });
    }
    return sorted;
  };

  var getSafetyScore = function (token) {
    if (!token) return 75;
    if (token.symbol === 'MRDT') return 98;
    if (token.score) return token.score;
    var hash = token.symbol.split('').reduce(function (a, b) {
      return a + b.charCodeAt(0);
    }, 0);
    return Math.max(85, Math.min(97, (hash % 12) + 85));
  };

  var getScoreStyle = function (score) {
    if (score >= 90)
      return {
        color: 'text-emerald-400',
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/50',
        glow: 'shadow-[0_0_12px_rgba(16,185,129,0.6)]',
      };
    if (score >= 50)
      return {
        color: 'text-yellow-400',
        bg: 'bg-yellow-500/10',
        border: 'border-yellow-500/50',
        glow: 'shadow-[0_0_12px_rgba(234,179,8,0.5)]',
      };
    return {
      color: 'text-red-400',
      bg: 'bg-red-500/10',
      border: 'border-red-500/50',
      glow: 'shadow-[0_0_12px_rgba(239,68,68,0.6)] animate-pulse',
    };
  };

  // FIX v1.37: Always fallback to 0.000013 so division never yields NaN/Infinity
  var getSafePrice = function () {
    var p = mrdtPriceRef.current || mrdtPrice || 0.000013;
    if (!isFinite(p) || p <= 0) return 0.000013;
    return p;
  };

  var getAmountForTier = function (tier) {
    var usd = tier === 'fast' ? 25 : tier === 'vip' ? 75 : 10;
    var price = getSafePrice();
    return Math.round(usd / price);
  };

  var getAmountForBanner = function (days) {
    var usd = days === '2' ? 35 : days === '6' ? 100 : 20;
    var price = getSafePrice();
    return Math.round(usd / price);
  };

  // FIX v1.45: returns SOL amount (not MRDT) for a given USD price, used when
  // the user selects SOL as the payment method instead of $MRDT.
  var getSafeSolPrice = function () {
    var p = solPriceRef.current || solPrice || 85;
    if (!isFinite(p) || p <= 0) return 85;
    return p;
  };
  var getSOLAmountForUsd = function (usd) {
    // FIX v0.1.2: return a real Number (not a .toFixed string). The
    // verify-payment API rejects any expectedAmount that isn't typeof
    // 'number', so a stringified amount made SOL verification fail 100% of
    // the time regardless of whether the payment actually arrived.
    var raw = usd / getSafeSolPrice();
    return parseFloat(raw.toFixed(6));
  };
  // Display-only formatted string version, used purely for UI text.
  var formatSOLAmount = function (usd) {
    return getSOLAmountForUsd(usd).toFixed(6);
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
    window.open(
      'https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&buy=8Q22r9qUm4AzFzTpZgaPYMxqq4z5WxE9FVa7X9dsvmBg',
      '_blank',
    );
  };
  var handleOpenRaydium = function () {
    setIsBuyDropdownOpen(false);
    window.open(
      'https://raydium.io/liquidity/increase/?mode=add&pool_id=6cMTXZyCrnut7Lv39qt4dqEARbC2jbebvhzdCR1t2HEV',
      '_blank',
    );
  };
  var openTokenBlueprint = function (token) {
    setSelectedToken(token);
    setIsBlueprintOpen(true);
    setClusterResult(null);
  };
  var checkClusters = async function () {
    if (!selectedToken || clusterLoading) return;
    setClusterLoading(true);
    setClusterResult(null);
    try {
      var res = await fetch('/api/cluster-check?ca=' + selectedToken.ca);
      var data = await res.json();
      setClusterResult(data);
    } catch (e) {
      setClusterResult({ error: 'Check failed. Try again.' });
    }
    setClusterLoading(false);
  };
  var closeBlueprint = function () {
    setIsBlueprintOpen(false);
    setTimeout(function () {
      setSelectedToken(null);
    }, 300);
  };

  var pillars = [
    { icon: Shield, label: t.pillar1, desc: t.pillar1sub, color: 'text-purple-400' },
    { icon: Zap, label: t.pillar2, desc: t.pillar2sub, color: 'text-emerald-400' },
    { icon: Lock, label: t.pillar3, desc: t.pillar3sub, color: 'text-purple-400' },
  ];

  // Load listed tokens from Supabase on mount
  useEffect(function () {
    loadTokensFromSupabase().then(function (data) {
      if (data.length > 0) setListedTokens(data);
      setFreeSlots(Math.max(0, FREE_TOTAL - data.length));
    });
  }, []);

  // Load token votes + this browser's own past votes (localStorage) on mount
  useEffect(function () {
    loadTokenVotes().then(function (map) {
      setTokenVotes(map);
    });
    try {
      var stored = localStorage.getItem('tnt_voted_tokens');
      if (stored) setVotedTokens(JSON.parse(stored));
    } catch (e) {}
    try {
      var storedWatchlist = localStorage.getItem('tnt_watchlist');
      if (storedWatchlist) setWatchlist(JSON.parse(storedWatchlist));
    } catch (e) {}
  }, []);

  // Toggle a token's watchlist (starred) state, persisted to localStorage —
  // no account/backend needed, just per-browser favorites.
  var toggleWatchlist = function (ca) {
    setWatchlist(function (prev) {
      var next = prev.includes(ca) ? prev.filter(function (c) { return c !== ca; }) : prev.concat([ca]);
      try {
        localStorage.setItem('tnt_watchlist', JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  var handleVote = async function (ca, direction) {
    // One vote per token per browser
    if (votedTokens[ca]) {
      showToast('Already voted for this token', 'error');
      return;
    }
    // Optimistic UI update
    setTokenVotes(function (prev) {
      var current = prev[ca] || { upvotes: 0, downvotes: 0 };
      var updated = Object.assign({}, current);
      if (direction === 'up') updated.upvotes = current.upvotes + 1;
      else updated.downvotes = current.downvotes + 1;
      var next = Object.assign({}, prev);
      next[ca] = updated;
      return next;
    });
    var newVoted = Object.assign({}, votedTokens);
    newVoted[ca] = direction;
    setVotedTokens(newVoted);
    try {
      localStorage.setItem('tnt_voted_tokens', JSON.stringify(newVoted));
    } catch (e) {}
    var result = await castVoteRpc(ca, direction);
    if (result) {
      setTokenVotes(function (prev) {
        var next = Object.assign({}, prev);
        next[ca] = { upvotes: result.upvotes, downvotes: result.downvotes };
        return next;
      });
    }
  };

  // FIX v1.55: Jupiter Price API v3 — single request, both MRDT + SOL.
  // Jupiter aggregates all Solana DEXes: same price the user sees in Jupiter swap UI.
  // Public endpoint, no API key: https://lite-api.jup.ag/price/v3?ids=MINT1,MINT2
  var SOL_MINT = 'So11111111111111111111111111111111111111112';
  useEffect(function () {
    var fetchPrice = async function () {
      try {
        var res = await fetch(
          'https://lite-api.jup.ag/price/v3?ids=' + MRDT_CA + ',' + SOL_MINT
        );
        var data = await res.json();
        if (data && data[MRDT_CA] && data[MRDT_CA].usdPrice) {
          var p = parseFloat(data[MRDT_CA].usdPrice);
          if (isFinite(p) && p > 0) { setMrdtPrice(p); mrdtPriceRef.current = p; }
        }
        if (data && data[SOL_MINT] && data[SOL_MINT].usdPrice) {
          var sp = parseFloat(data[SOL_MINT].usdPrice);
          if (isFinite(sp) && sp > 0) { setSolPrice(sp); solPriceRef.current = sp; }
        }
      } catch (e) {}
      setPriceLoading(false);
    };
    fetchPrice();
    var i = setInterval(fetchPrice, 60000);
    return function () { clearInterval(i); };
  }, []);

  // Rotating terminal log messages
  useEffect(function () {
    var templates = [
      'New pool detected on Raydium!',
      'Mint Authority disabled ✓',
      'Threat level: LOW.',
      'No bundles detected.',
      'Connected to DexScreener.',
      'Searching for new gems...',
      '[SUPABASE] Sync complete ✓',
    ];
    var i = setInterval(function () {
      var msg = templates[Math.floor(Math.random() * templates.length)];
      setLogs(function (prev) {
        return prev.slice(-12).concat(['[' + new Date().toLocaleTimeString() + '] ' + msg]);
      });
    }, 4200);
    return function () {
      clearInterval(i);
    };
  }, []);

  // Fetch live DexScreener tokens (micro-cap filter)
  useEffect(function () {
    var fetchTokens = async function () {
      try {
        setLoading(true);
        var cached = localStorage.getItem('tnt_cached_tokens');
        var time = localStorage.getItem('tnt_cached_time');
        if (cached && time && Date.now() - parseInt(time) < 120000) {
          setTokens(JSON.parse(cached));
          setLoading(false);
          return;
        }
        var res = await fetch(
          'https://api.dexscreener.com/latest/dex/tokens/So11111111111111111111111111111111111111112?limit=30',
        );
        var data = await res.json();
        if (data.pairs && data.pairs.length) {
          var filtered = data.pairs
            .filter(function (p) {
              return (p.marketCap || 0) >= 1000 && (p.marketCap || 0) <= 300000;
            })
            .slice(0, 9)
            .map(function (p) {
              return {
                name: (p.baseToken && p.baseToken.name) || 'Unknown',
                symbol: (p.baseToken && p.baseToken.symbol) || '???',
                ca: (p.baseToken && p.baseToken.address) || '',
                price: p.priceUsd ? parseFloat(p.priceUsd).toFixed(8) : '0',
                liquidity: p.liquidity && p.liquidity.usd ? Math.round(p.liquidity.usd) : 0,
                volume24h: p.volume && p.volume.h24 ? Math.round(p.volume.h24) : 0,
                priceChange24h: (p.priceChange && p.priceChange.h24) || 0,
                verified: true,
                dexUrl: p.url || '',
                chain: p.chainId || 'solana',
              };
            });
          if (filtered.length) {
            setTokens(filtered);
            localStorage.setItem('tnt_cached_tokens', JSON.stringify(filtered));
            localStorage.setItem('tnt_cached_time', Date.now().toString());
            setLoading(false);
            return;
          }
        }
        throw new Error('No pairs');
      } catch (e) {
        setTokens(FALLBACK_TOKENS);
        setLoading(false);
      }
    };
    fetchTokens();
    var i = setInterval(fetchTokens, 5 * 60 * 1000);
    return function () {
      clearInterval(i);
    };
  }, []);

  // Auto-scroll chat to bottom
  useEffect(
    function () {
      if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    },
    [chatMessages],
  );

  // Load banners (all slots) + countdown timer + auto-rotate display
  useEffect(function () {
    var fetchBanners = async function () {
      var banners = await loadBannersFromSupabase();
      setActiveBanners(banners);
    };
    fetchBanners();
    var pollInterval = setInterval(fetchBanners, 30000);
    var countdownInterval = setInterval(function () {
      setActiveBanners(function (current) {
        var now = Date.now();
        var stillActive = current.filter(function (b) {
          return b.expiresAt > now;
        });
        if (stillActive.length === 0) {
          setBannerCountdown('');
          return stillActive;
        }
        // Countdown shown is for the soonest slot to free up (relevant
        // for the "all slots taken, next one free in..." purchase prompt).
        var soonest = stillActive.reduce(function (min, b) {
          return b.expiresAt < min.expiresAt ? b : min;
        }, stillActive[0]);
        var msLeft = soonest.expiresAt - now;
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
        return stillActive;
      });
    }, 1000);
    // Rotate between multiple active banners every 6s.
    var rotateInterval = setInterval(function () {
      setBannerDisplayIndex(function (i) {
        return i + 1;
      });
    }, 6000);
    return function () {
      clearInterval(pollInterval);
      clearInterval(countdownInterval);
      clearInterval(rotateInterval);
    };
  }, []);

  var handleFormSubmit = function (e) {
    e.preventDefault();
    if (!formData.projectName || !formData.contractAddress || !formData.telegram) {
      showToast(t.fillFields, 'error');
      return;
    }
    if (freeSlots > 0) {
      setIsSending(true);
      runAuditAndSave(formData.contractAddress, formData.projectName, true, formData.logoImg);
      return;
    }
    var mrdtAmount = getAmountForTier(selectedTier);
    // FIX v1.37: Guard against zero/invalid amount before opening payment modal
    if (!mrdtAmount || mrdtAmount <= 0) {
      showToast(t.priceError, 'error');
      return;
    }
    var tierName = selectedTier === 'fast' ? 'Fast' : selectedTier === 'vip' ? 'VIP' : 'Basic';
    var usd = selectedTier === 'fast' ? 25 : selectedTier === 'vip' ? 75 : 10;
    setInvoiceAmount(mrdtAmount);
    setInvoiceUsd(usd);
    setInvoiceLabel('TNT House ' + tierName + ' Audit - ' + formData.projectName);
    setShowPaymentModal(true);
  };

  var handlePaymentMethodSelect = function (method) {
    setSelectedPaymentMethod(method);
    setShowPaymentModal(false);
    setShowWalletModal(true);
  };
  var handleWalletSelect = function (wallet) {
    setSelectedWallet(wallet);
    setShowWalletModal(false);
    setShowInvoiceModal(true);
  };

  // Run RugCheck + DexScreener audit
  var runAuditAndSave = async function (ca, projectName, isFree, logoImg) {
    var auditResult = {
      score: 75,
      mintAuthority: 'Unknown',
      freezeAuthority: 'Unknown',
      isHoneypot: 'Unknown',
      top10Percent: null,
      lpLockedPercent: null,
      holderCount: null,
      creatorBalancePercent: null,
      buyTaxPercent: null,
      sellTaxPercent: null,
      contractRenounced: null,
      hiddenOwner: 'Unknown',
    };
    var dexData = { price: '0.00000000', liquidity: 0, volume24h: 0, priceChange24h: 0, ageDays: null };
    try {
      setLogs(function (prev) {
        return prev.slice(-12).concat(['[AUDIT] RugCheck API request for ' + ca + '...']);
      });
      // FIX v1.66: use the FULL /report endpoint instead of /report/summary.
      // The summary endpoint doesn't include topHolders/markets data, which
      // forced Holders/LP Lock fields to always show "Unknown" for every
      // token except MRDT (which had manually hardcoded real numbers).
      // The full report includes real, computable holder concentration and
      // LP-lock data for every audited token, not just MRDT.
      var rugRes = await fetch('https://api.rugcheck.xyz/v1/tokens/' + ca + '/report', {
        headers: { Accept: 'application/json' },
      });
      if (rugRes.ok) {
        var rugData = await rugRes.json();
        var normalizedScore = Math.min(
          100,
          Math.max(0, Math.round(100 - (rugData.score || 0) / 10)),
        );
        var risks = rugData.risks || [];

        // Real top-10 holder concentration, computed from actual holder list.
        var top10Percent = null;
        if (Array.isArray(rugData.topHolders) && rugData.topHolders.length > 0) {
          var sumPct = rugData.topHolders.slice(0, 10).reduce(function (acc, h) {
            return acc + (typeof h.pct === 'number' ? h.pct : 0);
          }, 0);
          top10Percent = Math.round(sumPct * 10) / 10;
        }

        // Real total holder count, if RugCheck reports it.
        var holderCount = null;
        if (typeof rugData.totalHolders === 'number') {
          holderCount = rugData.totalHolders;
        } else if (Array.isArray(rugData.topHolders)) {
          holderCount = rugData.topHolders.length;
        }

        // Real LP-locked percentage, averaged across reported markets.
        var lpLockedPercent = null;
        if (Array.isArray(rugData.markets) && rugData.markets.length > 0) {
          var lpVals = rugData.markets
            .map(function (m) {
              return m && m.lp && typeof m.lp.lpLockedPct === 'number' ? m.lp.lpLockedPct : null;
            })
            .filter(function (v) {
              return v !== null;
            });
          if (lpVals.length > 0) {
            lpLockedPercent =
              Math.round((lpVals.reduce(function (a, b) { return a + b; }, 0) / lpVals.length) * 10) / 10;
          }
        }

        var creatorBalancePercent =
          rugData.creatorBalance && rugData.token && rugData.token.supply
            ? Math.round((rugData.creatorBalance / rugData.token.supply) * 1000) / 10
            : null;

        // Real transfer fee (Token-2022 tax), if the mint has one. Most
        // SPL tokens don't — leave null (shown as "Unknown", not "0%",
        // since we can't distinguish "no tax extension" from "API didn't
        // report it" with full certainty).
        var buyTaxPercent = null;
        var sellTaxPercent = null;
        if (rugData.transferFee && typeof rugData.transferFee.pct === 'number') {
          buyTaxPercent = rugData.transferFee.pct;
          sellTaxPercent = rugData.transferFee.pct;
        }

        var mintRevoked = !risks.some(function (r) {
          return r.name && r.name.toLowerCase().includes('mint');
        });
        var freezeRevoked = !risks.some(function (r) {
          return r.name && r.name.toLowerCase().includes('freeze');
        });
        // Derived, not invented: "renounced" here just means both mint and
        // freeze authority are revoked — a real, checkable on-chain fact.
        var contractRenounced = mintRevoked && freezeRevoked;

        // Real check: does this mint use Solana's standard, audited Token
        // Program (or Token-2022), or some custom/unknown program? A
        // non-standard program is a real red flag worth surfacing —
        // Solana doesn't have EVM-style "verified source code", so this
        // is the honest equivalent for this chain.
        var STANDARD_TOKEN_PROGRAMS = [
          'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
          'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',
        ];
        var standardProgram =
          rugData.tokenProgram && STANDARD_TOKEN_PROGRAMS.includes(rugData.tokenProgram)
            ? true
            : rugData.tokenProgram
              ? false
              : null;

        // Hidden owner / proxy risk — only flagged if RugCheck actually
        // lists such a risk; otherwise we don't know either way (shown
        // as "Unknown", not a false "No").
        var hasOwnerRisk = risks.some(function (r) {
          return (
            r.name &&
            (r.name.toLowerCase().includes('proxy') || r.name.toLowerCase().includes('owner'))
          );
        });
        var hiddenOwner = hasOwnerRisk ? 'Yes ⚠️' : 'No ✓';

        // Permanent Delegate check (Token-2022 extension). A permanent
        // delegate can transfer or burn ANY holder's tokens without their
        // permission — a serious, real scam vector that bypasses normal
        // mint/freeze checks entirely. Only flagged if RugCheck's risk
        // list actually names it; same "don't assume No falsely" pattern
        // as the other checks above.
        var hasPermanentDelegate = risks.some(function (r) {
          return r.name && r.name.toLowerCase().includes('delegate');
        });
        var permanentDelegate = hasPermanentDelegate ? 'Yes 🚨' : 'No ✓';

        auditResult = {
          score: normalizedScore,
          mintAuthority: mintRevoked ? 'Revoked ✓' : 'Active ⚠️',
          freezeAuthority: freezeRevoked ? 'Revoked ✓' : 'Active ⚠️',
          isHoneypot: risks.some(function (r) {
            return r.name && r.name.toLowerCase().includes('honeypot');
          })
            ? 'Yes 🚨'
            : 'No ✓',
          top10Percent: top10Percent,
          lpLockedPercent: lpLockedPercent,
          holderCount: holderCount,
          creatorBalancePercent: creatorBalancePercent,
          buyTaxPercent: buyTaxPercent,
          sellTaxPercent: sellTaxPercent,
          contractRenounced: contractRenounced,
          hiddenOwner: hiddenOwner,
          standardProgram: standardProgram,
          permanentDelegate: permanentDelegate,
        };
        setLogs(function (prev) {
          return prev
            .slice(-12)
            .concat(['[AUDIT ✓] ' + projectName + ' — Score: ' + normalizedScore]);
        });
      }
    } catch (e) {
      setLogs(function (prev) {
        return prev.slice(-12).concat(['[AUDIT] Error: ' + e.message]);
      });
    }
    try {
      var dexRes = await fetch('https://api.dexscreener.com/latest/dex/tokens/' + ca);
      var dexJson = await dexRes.json();
      // FIX: filter to Solana pairs only — DexScreener can return pairs
      // from other chains sharing the same token address format, which
      // would silently show wrong price/liquidity/volume data.
      var solPairs = (dexJson.pairs || []).filter(function (p) {
        return p.chainId === 'solana';
      });
      if (solPairs.length > 0) {
        // Prefer the pair with the highest liquidity, not just pairs[0].
        var pair = solPairs.reduce(function (best, p) {
          var bestLiq = best.liquidity && best.liquidity.usd ? best.liquidity.usd : 0;
          var pLiq = p.liquidity && p.liquidity.usd ? p.liquidity.usd : 0;
          return pLiq > bestLiq ? p : best;
        }, solPairs[0]);
        dexData = {
          price: pair.priceUsd ? parseFloat(pair.priceUsd).toFixed(8) : '0.00000000',
          liquidity: pair.liquidity && pair.liquidity.usd ? Math.round(pair.liquidity.usd) : 0,
          volume24h: pair.volume && pair.volume.h24 ? Math.round(pair.volume.h24) : 0,
          priceChange24h: pair.priceChange && pair.priceChange.h24 ? pair.priceChange.h24 : 0,
          // Real token age, computed from the pair's actual creation
          // timestamp — not estimated or invented.
          ageDays: pair.pairCreatedAt
            ? Math.floor((Date.now() - pair.pairCreatedAt) / 86400000)
            : null,
        };
      }
    } catch (e) {}

    var tokenData = {
      name: projectName.toUpperCase(),
      symbol: projectName.slice(0, 4).toUpperCase() || 'NEW',
      ca: ca,
      price: dexData.price,
      liquidity: dexData.liquidity,
      volume24h: dexData.volume24h,
      priceChange24h: dexData.priceChange24h,
      score: auditResult.score,
      verified: true,
      dexUrl: 'https://dexscreener.com/solana/' + ca,
      chain: 'solana',
      mintAuthority: auditResult.mintAuthority,
      freezeAuthority: auditResult.freezeAuthority,
      isHoneypot: auditResult.isHoneypot,
      top10Percent: auditResult.top10Percent,
      lpLockedPercent: auditResult.lpLockedPercent,
      holderCount: auditResult.holderCount,
      creatorBalancePercent: auditResult.creatorBalancePercent,
      logoUrl: logoImg || '',
      buyTaxPercent: auditResult.buyTaxPercent,
      sellTaxPercent: auditResult.sellTaxPercent,
      contractRenounced: auditResult.contractRenounced,
      hiddenOwner: auditResult.hiddenOwner,
      ageDays: dexData.ageDays,
      standardProgram: auditResult.standardProgram,
      permanentDelegate: auditResult.permanentDelegate,
    };

    if (isFree) {
      saveTokenToSupabase(tokenData);
      postAuditToTelegram(tokenData);
      setListedTokens(function (prev) {
        return [tokenData].concat(prev);
      });
      setFreeSlots(function (prev) {
        return Math.max(0, prev - 1);
      });
      setSubmitted(true);
      setFormData({ projectName: '', contractAddress: '', telegram: '', logoImg: '' });
      showToast('🎁 Free audit complete! Score: ' + auditResult.score, 'success');
      setIsSending(false);
      setTimeout(function () {
        setSubmitted(false);
      }, 5000);
    }

    return tokenData;
  };

  // FIX v1.63: Navigate IMMEDIATELY (synchronously) instead of via setTimeout.
  // Root cause of the "0 amount" bug: delaying window.location.href inside
  // setTimeout breaks the browser's "direct user gesture" trust chain on
  // Android (especially Samsung Internet). Once that trust is lost, the OS
  // intent resolver sometimes opens Phantom via a generic app-launch that
  // drops the ENTIRE query string (amount, spl-token, label, message) while
  // keeping only the recipient (which lives in the URI path, before "?").
  // That exactly matches the symptom: correct recipient shown, but amount=0
  // and default/last-used token, as if Phantom got no query params at all.
  var openDeeplink = function (uri) {
    window.location.href = uri;
    // Show fallback after 2s if protocol handler didn't fire
    setTimeout(function () {
      setDeeplinkFallbackUri(uri);
    }, 2000);
  };

  // FIX v1.49: REVERT v1.47's switch to Transaction Request API. Real-world
  // testing showed Phantom now actively BLOCKS our Transaction Request URI
  // with "This dApp may be malicious" on BOTH domains (tnt-house.vercel.app
  // AND tnt-audit.com) — it killed payments that previously worked fine.
  // Confirmed via Solscan: a real MRDT payment completed successfully on
  // the OLD static transfer-request URI before today's change. Going back
  // to that proven format. The known remaining issue is that Phantom
  // sometimes shows 0 for the SOL amount specifically (not MRDT) on this
  // static format — tracked separately, NOT a reason to keep the
  // Transaction Request approach, which blocks payments entirely.
  //
  // FIX v1.3 (USDC): the earlier Blowfish appeal (ticket #11857) was
  // rejected, and real-world testing (July 2026) confirmed Transaction
  // Request is STILL being hard-blocked by Phantom's "malicious dApp"
  // check for SOL payments. Switching handleConfirmPayment /
  // handleBannerPaymentSubmit back to THIS static builder for good —
  // static Transfer Request URIs don't ask the wallet to fetch and
  // blind-sign a server-built tx, which is exactly the pattern Blowfish
  // flags. This function now also supports USDC (spl-token = USDC_CA).
  var buildTransferRequestUri = function (amount, method, label, message) {
    var isSol = method === 'SOL';
    var splTokenCA = method === 'USDC' ? USDC_CA : MRDT_CA;
    var isUsdc = method === 'USDC';
    var amountStr = isSol
      ? parseFloat(amount).toFixed(6)
      : isUsdc
        ? (Math.round(amount * 100) / 100).toFixed(2) // USDC: 2 decimals
        : String(Math.round(amount)); // MRDT: always a whole token amount
    // FIX v1.58: for SPL tokens, put spl-token BEFORE amount.
    // Phantom on Android sometimes parses URI params sequentially — seeing
    // spl-token first lets it correctly identify the token context before
    // reading amount, preventing the amount from being silently dropped (0).
    if (isSol) {
      return (
        'solana:' + WALLET_ADDRESS +
        '?amount=' + amountStr +
        '&label=' + encodeURIComponent(label) +
        '&message=' + encodeURIComponent(message)
      );
    } else {
      return (
        'solana:' + WALLET_ADDRESS +
        '?spl-token=' + splTokenCA +
        '&amount=' + amountStr +
        '&label=' + encodeURIComponent(label) +
        '&message=' + encodeURIComponent(message)
      );
    }
  };

  // FIX v1.65: Solana Pay TRANSACTION REQUEST (not Transfer Request).
  // Instead of asking the wallet to parse an `amount` query param (proven
  // unreliable — wallet shows 0), the wallet fetches this link, POSTs its
  // public key to our /api/pay route, and OUR SERVER builds and returns a
  // fully-formed transaction with the exact amount already baked in as a
  // real instruction. The wallet just has to simulate + sign it — there is
  // no query-param parsing step for the amount to get lost in.
  //
  // NOTE v1.3: kept for reference / potential future use (e.g. if Blowfish
  // whitelists us later), but NO LONGER CALLED — see buildTransferRequestUri
  // above for why.
  var buildTransactionRequestUri = function (amount, method, label) {
    var origin = window.location.origin;
    var link =
      origin + '/api/pay?amount=' + encodeURIComponent(amount) +
      '&method=' + encodeURIComponent(method) +
      '&label=' + encodeURIComponent(label);
    return 'solana:' + encodeURIComponent(link);
  };

  var handleConfirmPayment = async function () {
    // FIX v1.37: Double-check amount is valid before launching wallet deeplink
    if (!invoiceAmount || invoiceAmount <= 0) {
      showToast(t.priceError, 'error');
      setShowInvoiceModal(false);
      return;
    }
    // FIX v1.45: capture method/wallet into locals BEFORE resetting state,
    // so the URI builder below always uses the value the user actually picked.
    var paymentMethod = selectedPaymentMethod;
    var auditAmount = invoiceAmount;
    var auditUsd = invoiceUsd;
    var label = invoiceLabel;
    var isSol = paymentMethod === 'SOL';
    var isUsdc = paymentMethod === 'USDC';
    // USDC is a 1:1 USD stablecoin — no conversion needed, unlike SOL (price-dependent)
    // or MRDT (priced via mrdt_per_usd rate).
    var payAmount = isSol ? getSOLAmountForUsd(auditUsd) : isUsdc ? auditUsd : auditAmount;
    var verifyMethod = isSol ? 'SOL' : isUsdc ? 'USDC' : 'MRDT';
    var ca = formData.contractAddress;
    var projectName = formData.projectName;
    var logoImg = formData.logoImg;
    // FIX v1.3: back to static Transfer Request — Transaction Request gets
    // hard-blocked by Phantom's Blowfish "malicious dApp" check (Blowfish
    // appeal #11857 was rejected). See buildTransferRequestUri comment.
    var uri = buildTransferRequestUri(payAmount, verifyMethod, label, label);
    openDeeplink(uri);
    setShowInvoiceModal(false);
    setIsSending(true);
    var tokenData = await runAuditAndSave(ca, projectName, false, logoImg);
    setFormData({ projectName: '', contractAddress: '', telegram: '', logoImg: '' });
    setSelectedPaymentMethod(null);
    setSelectedWallet(null);
    setInvoiceAmount(0);
    setInvoiceUsd(0);
    setInvoiceLabel('');
    setIsSending(false);
    // FIX v0.1.2: MRDT and SOL are now two fully independent payment paths —
    // each has its own amount AND is verified against its own currency on
    // the backend (method param), so neither can block or interfere with
    // the other. Previously both always verified against the MRDT amount,
    // which made SOL payments impossible to confirm.
    startPaymentVerification('audit', payAmount, null, tokenData, verifyMethod);
  };

  var handleBannerSubmit = function (e) {
    e.preventDefault();
    if (!bannerFormData.tokenName || !bannerFormData.desc) {
      setBannerError('Enter token name and description.');
      return;
    }
    if (activeBanners.length >= BANNER_SLOTS) {
      setBannerError(t.btnSlotTaken + ' ' + bannerCountdown);
      return;
    }
    var mrdtAmount = getAmountForBanner(bannerFormData.days);
    // FIX v1.37: Guard against zero/invalid amount
    if (!mrdtAmount || mrdtAmount <= 0) {
      setBannerError('Price error, try later.');
      return;
    }
    var usd = bannerFormData.days === '2' ? 35 : bannerFormData.days === '6' ? 100 : 20;
    setBannerInvoiceAmount(mrdtAmount);
    setBannerInvoiceUsd(usd);
    setBannerError('');
    setShowBannerPaymentModal(true);
  };

  var handleBannerPaymentMethodSelect = function (method) {
    setSelectedBannerPaymentMethod(method);
    setShowBannerPaymentModal(false);
    setShowBannerWalletModal(true);
  };
  var handleBannerWalletSelect = function (wallet) {
    setSelectedBannerWallet(wallet);
    setShowBannerWalletModal(false);
    setShowBannerInvoiceModal(true);
  };

  // FIX v0.1.2: added `method` param ('MRDT' | 'SOL') — this makes audit and
  // banner payments in SOL vs MRDT two fully independent verification flows.
  // Previously `method` was never sent to the API, so it silently fell back
  // to "check both currencies" while still comparing against the MRDT amount
  // even for SOL payments — meaning SOL payments could never verify correctly
  // because received SOL (e.g. 0.23) was compared against an MRDT number
  // (e.g. 1538461). Each currency now has its own expected amount and its
  // own verification path that never touches the other.
  var startPaymentVerification = function (type, expectedAmount, bannerData, auditData, method) {
    var startTime = Date.now();
    setVerifyStartTime(startTime);
    setVerifyType(type);
    setVerifyStatus('waiting');
    setVerifyAttempts(0);
    setShowVerifyModal(true);
    if (bannerData) setPendingBannerData(bannerData);
    if (auditData) setPendingAuditData(auditData);
    var attempts = 0;
    var maxAttempts = 30;
    if (verifyIntervalRef.current) clearInterval(verifyIntervalRef.current);
    var interval = setInterval(async function () {
      attempts++;
      setVerifyAttempts(attempts);
      try {
        var res = await fetch('/api/verify-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            expectedAmount: expectedAmount,
            since: startTime,
            method: method,
          }),
        });
        var data = await res.json();
        if (data.verified) {
          clearInterval(interval);
          verifyIntervalRef.current = null;
          setVerifyStatus('success');
          if (type === 'banner' && bannerData) {
            await saveBannerToSupabase(bannerData, bannerData.slot);
            setActiveBanners(function (prev) {
              return prev
                .filter(function (b) {
                  return b.slot !== bannerData.slot;
                })
                .concat([bannerData]);
            });
            showToast('✅ Payment confirmed! Banner is live for everyone.', 'success');
          } else if (type === 'audit' && auditData) {
            saveTokenToSupabase(auditData);
            postAuditToTelegram(auditData);
            setListedTokens(function (prev) {
              return [auditData].concat(prev);
            });
            showToast('✅ Payment confirmed! Token added. Score: ' + auditData.score, 'success');
          }
          setTimeout(function () {
            setShowVerifyModal(false);
          }, 3000);
          return;
        }
        // FIX v1.44: Show API error reason in UI instead of silently ignoring
        if (data.reason) {
          console.log('[Verify] Attempt ' + attempts + ': ' + data.reason);
        }
      } catch (e) {
        // FIX v1.44: Log fetch errors so user can see what's happening
        console.error('[Verify] Network error on attempt ' + attempts + ':', e.message || e);
        if (attempts >= 5) {
          setVerifyStatus('slow');
        }
      }
      if (attempts >= maxAttempts) {
        clearInterval(interval);
        verifyIntervalRef.current = null;
        setVerifyStatus('failed');
      }
    }, 10000);
    verifyIntervalRef.current = interval;
  };

  // Cleanup payment verification interval on unmount
  useEffect(function () {
    return function () {
      if (verifyIntervalRef.current) clearInterval(verifyIntervalRef.current);
    };
  }, []);

  var handleBannerConfirmPayment = function () {
    // FIX v1.37: Guard against zero/invalid banner amount before launching wallet deeplink
    if (!bannerInvoiceAmount || bannerInvoiceAmount <= 0) {
      setBannerError('Price error. Try later or contact admin.');
      setShowBannerInvoiceModal(false);
      return;
    }
    // FIX v1.45: capture method into local before resetting state below.
    var paymentMethod = selectedBannerPaymentMethod;
    var mrdtAmount = bannerInvoiceAmount;
    var bannerUsd = bannerInvoiceUsd;
    // Pick the first free slot (1..BANNER_SLOTS) not currently occupied.
    var takenSlots = activeBanners.map(function (b) {
      return b.slot;
    });
    var assignedSlot = 1;
    for (var s = 1; s <= BANNER_SLOTS; s++) {
      if (takenSlots.indexOf(s) === -1) {
        assignedSlot = s;
        break;
      }
    }
    var banner = {
      slot: assignedSlot,
      tokenName: bannerFormData.tokenName.toUpperCase(),
      bannerImg: bannerFormData.bannerImg || '',
      desc: bannerFormData.desc,
      expiresAt: Date.now() + parseInt(bannerFormData.days) * 86400000,
    };
    var label = 'TNT House VIP Banner ' + bannerFormData.days + 'd';
    var isSol = paymentMethod === 'SOL';
    var isUsdc = paymentMethod === 'USDC';
    var payAmount = isSol ? getSOLAmountForUsd(bannerUsd) : isUsdc ? bannerUsd : mrdtAmount;
    var verifyMethod = isSol ? 'SOL' : isUsdc ? 'USDC' : 'MRDT';
    // FIX v1.3: back to static Transfer Request — Transaction Request gets
    // hard-blocked by Phantom's Blowfish "malicious dApp" check (Blowfish
    // appeal #11857 was rejected). See buildTransferRequestUri comment.
    var uri = buildTransferRequestUri(payAmount, verifyMethod, label, label);
    openDeeplink(uri);
    setShowBannerInvoiceModal(false);
    setIsBannerSending(true);
    setBannerFormData({ tokenName: '', bannerImg: '', desc: '', days: '1' });
    setSelectedBannerPaymentMethod(null);
    setSelectedBannerWallet(null);
    setBannerInvoiceAmount(0);
    setBannerInvoiceUsd(0);
    setIsBannerSending(false);
    // FIX v0.1.2: build payAmount/method BEFORE calling startPaymentVerification,
    // and pass method through so SOL banner payments verify against the SOL
    // amount on the backend instead of silently comparing against MRDT.
    startPaymentVerification('banner', payAmount, banner, null, verifyMethod);
  };

  // Chat countdown timer for rate limiting
  useEffect(
    function () {
      var interval = setInterval(function () {
        if (!chatResetTime) return;
        var msLeft = chatResetTime - Date.now();
        if (msLeft <= 0) {
          setChatBlocked(false);
          setChatCount(0);
          setChatResetTime(null);
          setChatTimer('');
        } else {
          var m = Math.floor(msLeft / 60000);
          var s = Math.floor((msLeft % 60000) / 1000);
          setChatTimer(m + 'm ' + (s < 10 ? '0' : '') + s + 's');
        }
      }, 1000);
      return function () {
        clearInterval(interval);
      };
    },
    [chatResetTime],
  );

  var handleSendChat = async function () {
    if (!userMsg.trim() || isTyping) return;
    if (chatBlocked) return;
    var newCount = chatCount + 1;
    setChatCount(newCount);
    if (newCount >= 30) {
      var resetAt = Date.now() + 10 * 60 * 1000;
      setChatResetTime(resetAt);
      setChatBlocked(true);
    }
    var text = userMsg.trim();
    var updatedMessages = chatMessages
      .filter(function (m) {
        return m.sender !== 'bot' || chatMessages.indexOf(m) > 0;
      })
      .map(function (m) {
        return { role: m.sender === 'user' ? 'user' : 'assistant', content: m.text };
      })
      .concat([{ role: 'user', content: text }]);
    setChatMessages(function (prev) {
      return prev.concat([{ sender: 'user', text: text }]);
    });
    setUserMsg('');
    setIsTyping(true);
    try {
      var res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updatedMessages }),
      });
      var data = await res.json();
      setChatMessages(function (prev) {
        return prev.concat([
          { sender: 'bot', text: data.reply || data.error || 'Error. Try again.' },
        ]);
      });
    } catch (e) {
      setChatMessages(function (prev) {
        return prev.concat([{ sender: 'bot', text: 'Connection error. 💎 Full audit → from $10' }]);
      });
    }
    setIsTyping(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white font-mono relative overflow-hidden pb-12">
      {/* Toast notification */}
      {toast.show && (
        <div
          className={
            'fixed bottom-6 left-1/2 -translate-x-1/2 z-[99999] flex items-center gap-3 px-6 py-3.5 rounded-2xl shadow-2xl border text-sm font-medium transition-all duration-300 ' +
            (toast.type === 'success'
              ? 'bg-emerald-950 border-emerald-500/40 text-emerald-300'
              : 'bg-red-950 border-red-500/40 text-red-300')
          }
        >
          {toast.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-emerald-400" />
          ) : (
            <XCircle className="w-5 h-5 text-red-400" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Background glows */}
      <div style={GLOW_PURPLE} />
      <div style={GLOW_GREEN} />
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
        {/* ═══ HEADER ═══ */}
        <header className="border-b border-purple-500/30 backdrop-blur-lg bg-slate-950/60 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
            <div className="flex items-center gap-3 -ml-2 sm:-ml-3">
              {/* TNT House single shield logo — all text merged inside one big shield, no separate small icon */}
              <a
                href="https://t.me/tnt_house2026"
                target="_blank"
                rel="noopener noreferrer"
                className="w-24 h-28 sm:w-28 sm:h-32 flex items-center justify-center shrink-0 relative"
              >
                <svg viewBox="0 0 100 116" className="w-full h-full drop-shadow-[0_0_10px_rgba(153,69,255,0.6)]">
                  <defs>
                    <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#a855f7" />
                      <stop offset="100%" stopColor="#22d3ee" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M50 2 L94 20 V54 C94 84 74 104 50 114 C26 104 6 84 6 54 V20 Z"
                    fill="rgba(10,10,20,0.6)"
                    stroke="url(#shieldGrad)"
                    strokeWidth="4"
                  />
                </svg>
                {/* Text overlay inside the shield: TNT HOUSE + tagline, replaces the separate <h1>/<span> block */}
                <div className="absolute inset-0 flex flex-col items-center justify-center px-2 text-center pointer-events-none">
                  <span className="text-[13px] sm:text-[15px] font-black leading-tight text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400 tracking-wide">
                    TNT
                  </span>
                  <span className="text-[13px] sm:text-[15px] font-black leading-tight text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400 tracking-wide -mt-0.5">
                    HOUSE
                  </span>
                  <span className="text-[6px] sm:text-[7px] text-purple-300 font-bold tracking-widest mt-1 leading-tight">
                    TOP NEW
                  </span>
                  <span className="text-[6px] sm:text-[7px] text-purple-300 font-bold tracking-widest leading-tight">
                    TOKENS
                  </span>
                  <span className="text-[6px] sm:text-[7px] text-cyan-400 font-bold tracking-widest mt-0.5 leading-tight">
                    v0.1.2
                  </span>
                </div>
              </a>
            </div>

            {/* Language switcher */}
            <div className="flex items-center gap-0.5 mr-1">
              {Object.keys(TRANSLATIONS).map(function (l) {
                return (
                  <button
                    key={l}
                    onClick={function () {
                      setLang(l);
                    }}
                    title={TRANSLATIONS[l].name}
                    className={
                      'text-base px-1 py-0.5 rounded transition ' +
                      (lang === l ? 'opacity-100 scale-110' : 'opacity-40 hover:opacity-80')
                    }
                  >
                    {TRANSLATIONS[l].flag}
                  </button>
                );
              })}
            </div>

            {/* BUY $MRDT dropdown */}
            <div className="relative">
              <button
                onClick={function () {
                  setIsBuyDropdownOpen(!isBuyDropdownOpen);
                }}
                className="bg-gradient-to-r from-purple-500 to-emerald-400 hover:from-purple-400 hover:to-emerald-300 text-slate-950 font-black px-4 py-2 rounded text-xs transition flex items-center gap-1 shadow-[0_0_15px_rgba(153,69,255,0.4)]"
              >
                BUY $MRDT <ChevronDown className="w-3 h-3" />
              </button>
              {isBuyDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-slate-950 border border-purple-500/30 rounded-lg shadow-xl z-50 py-1">
                  <button
                    onClick={handleLaunchJupiter}
                    className="w-full text-left px-4 py-2.5 hover:bg-purple-500/10 text-emerald-400 flex items-center gap-2 text-sm"
                  >
                    <ExternalLink className="w-4 h-4" /> Jupiter Swap
                  </button>
                  <button
                    onClick={handleOpenRaydium}
                    className="w-full text-left px-4 py-2.5 hover:bg-purple-500/10 text-emerald-400 flex items-center gap-2 text-sm"
                  >
                    <ExternalLink className="w-4 h-4" /> Raydium
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ═══ VIP BANNER SECTION ═══ */}
        <section className="max-w-7xl mx-auto px-6 pt-6">
          {activeBanners.length > 0 ? (
            <>
              {(function () {
                var displayedBanner = activeBanners[bannerDisplayIndex % activeBanners.length];
                return (
                  <div className="relative border border-purple-500/40 rounded-2xl overflow-hidden shadow-[0_0_30px_rgba(168,85,247,0.25)] min-h-[160px]">
                    {displayedBanner.bannerImg && displayedBanner.bannerImg.startsWith('data:') ? (
                      <div className="absolute inset-0">
                        <img
                          src={displayedBanner.bannerImg}
                          alt="banner"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/20" />
                      </div>
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-r from-black via-purple-950/30 to-black" />
                    )}
                    <div className="absolute top-3 left-3">
                      <span className="bg-purple-500 text-white font-black text-[9px] px-2 py-0.5 rounded tracking-widest">
                        VIP BOOST
                      </span>
                    </div>
                    {activeBanners.length > 1 && (
                      <div className="absolute top-3 right-3 flex gap-1">
                        {activeBanners.map(function (_, i) {
                          return (
                            <span
                              key={i}
                              className={
                                'w-1.5 h-1.5 rounded-full ' +
                                (i === bannerDisplayIndex % activeBanners.length
                                  ? 'bg-emerald-400'
                                  : 'bg-white/30')
                              }
                            />
                          );
                        })}
                      </div>
                    )}
                    <div className="relative z-10 p-4 pt-16">
                      <h4 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-300 to-emerald-300">
                        ${displayedBanner.tokenName}
                      </h4>
                      <p className="text-slate-300 text-xs mt-0.5">{displayedBanner.desc}</p>
                      {activeBanners.length < BANNER_SLOTS && (
                        <p className="text-[10px] text-emerald-400 mt-1">
                          {BANNER_SLOTS - activeBanners.length} banner slot
                          {BANNER_SLOTS - activeBanners.length > 1 ? 's' : ''} still available!
                        </p>
                      )}
                    </div>
                  </div>
                );
              })()}
              <div className="grid grid-cols-3 gap-2 mt-2">
                <button
                  onClick={handleLaunchJupiter}
                  className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-emerald-400 hover:from-purple-400 hover:to-emerald-300 text-slate-950 font-black text-[11px] transition shadow-[0_0_12px_rgba(153,69,255,0.4)]"
                >
                  <ExternalLink className="w-3 h-3" /> {t.buyOnJupiter}
                </button>
                <a
                  href="https://www.maradonatoken-mrdt.xyz"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-purple-500/40 hover:border-purple-400 text-purple-300 hover:text-white font-bold text-[11px] transition text-center"
                >
                  <ExternalLink className="w-3 h-3 shrink-0" /> Official Site
                </a>
                <button
                  onClick={function () {
                    openTokenBlueprint({
                      symbol: 'MRDT',
                      name: 'MARADONATOKEN',
                      ca: MRDT_CA,
                      price: mrdtPrice.toFixed(8),
                      liquidity: 13000,
                      volume24h: 0,
                      priceChange24h: 12.4,
                      verified: true,
                      dexUrl: 'https://dexscreener.com/solana/' + MRDT_CA,
                      chain: 'solana',
                    });
                  }}
                  className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-emerald-500/40 hover:border-emerald-400 text-emerald-400 hover:text-white font-bold text-[11px] transition"
                >
                  ⚽️ $MRDT Info
                </button>
              </div>
            </>
          ) : (
            <div
              onClick={scrollToForm}
              className="cursor-pointer border border-purple-500/30 rounded-2xl p-4 bg-gradient-to-r from-black via-purple-950/10 to-black flex flex-col sm:flex-row items-center justify-between gap-4 hover:border-purple-500/60 transition"
            >
              <div className="flex items-center gap-4">
                <span className="text-3xl bg-purple-500/10 p-2 rounded-xl border border-purple-500/20">
                  ⚽️
                </span>
                <div>
                  <span className="bg-slate-800 text-purple-400 font-bold text-[9px] px-2 py-0.5 rounded tracking-widest block w-max mb-1">
                    {t.slotAvailable}
                  </span>
                  <h4 className="text-lg font-black text-white">Maradona Token ($MRDT)</h4>
                  <p className="text-slate-400 text-xs mt-0.5">{t.slotAvailClick}</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-emerald-400 font-black text-sm">{t.vipBoostFrom}</div>
                <div className="text-[10px] text-slate-500">{t.payInMrdt}</div>
              </div>
            </div>
          )}
        </section>

        {/* ═══ HERO SECTION ═══ */}
        <section className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="space-y-3 border-l-4 border-purple-500 pl-6">
                <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded font-bold border border-purple-500/30">
                  SAFE NEW TOKENS
                </span>
                <h2 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400">
                  {t.heroTitle}
                </h2>
                <p className="text-slate-300 text-base leading-relaxed">{t.heroSub}</p>
              </div>
              <div className="grid grid-cols-3 gap-4 mt-8">
                {pillars.map(function (item, i) {
                  return (
                    <div
                      key={i}
                      className="bg-slate-900/50 border border-purple-500/20 rounded-lg p-3 text-center hover:border-purple-500/60 transition"
                    >
                      <item.icon className={'w-5 h-5 ' + item.color + ' mx-auto mb-1'} />
                      <div className="text-[11px] font-bold text-slate-200">{item.label}</div>
                      <div className="text-[9px] text-slate-400">{item.desc}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Terminal log widget */}
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
                {logs.map(function (log, i) {
                  return (
                    <div key={i} className="text-[11px]">
                      {log}
                    </div>
                  );
                })}
              </div>
              <div className="text-[10px] text-slate-500 border-t border-purple-500/20 pt-2 mt-2">
                Status: SCANNING AND SYNCING...
              </div>
            </div>
          </div>
        </section>

        {/* ═══ TOKEN TABLE ═══ */}
        <section className="max-w-7xl mx-auto px-6 py-6">
          <div
            className="border-2 border-cyan-400/40 rounded-lg bg-slate-950/60 backdrop-blur-md p-3 shadow-[0_0_30px_rgba(34,211,238,0.25)]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(34,211,238,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.06) 1px, transparent 1px)',
              backgroundSize: '18px 18px',
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-base font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-cyan-400" /> {t.tableTitle}
                </h3>
                <p className="text-slate-400 text-[10px] mt-0.5">{t.tableClick}</p>
              </div>
              <div className="hidden md:flex items-center gap-1 text-[9px] text-cyan-400">
                <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Live
              </div>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <input
                type="text"
                value={tableSearch}
                onChange={function (e) {
                  setTableSearch(e.target.value);
                }}
                placeholder="🔍 Search name, ticker or CA..."
                className="flex-1 bg-slate-950 border border-cyan-400/25 rounded-lg px-2.5 py-1.5 text-[10px] text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
              />
              <select
                value={tableSort}
                onChange={function (e) {
                  setTableSort(e.target.value);
                }}
                className="bg-slate-950 border border-cyan-400/25 rounded-lg px-2 py-1.5 text-[10px] text-cyan-300 focus:border-cyan-400 focus:outline-none"
              >
                <option value="default">Sort: Newest</option>
                <option value="score">Sort: Score</option>
                <option value="volume">Sort: Volume</option>
                <option value="liquidity">Sort: Liquidity</option>
              </select>
              <button
                onClick={function () {
                  setShowWatchlistOnly(!showWatchlistOnly);
                }}
                title="Show only my watchlist"
                className={
                  'shrink-0 px-2 py-1.5 rounded-lg border text-[10px] font-bold transition ' +
                  (showWatchlistOnly
                    ? 'bg-yellow-500/20 border-yellow-400 text-yellow-300'
                    : 'bg-slate-950 border-cyan-400/25 text-slate-400 hover:text-yellow-300')
                }
              >
                ⭐ {watchlist.length > 0 ? watchlist.length : ''}
              </button>
            </div>
            <div className="max-h-[320px] overflow-y-auto border border-cyan-400/25 rounded-lg">
              <table className="w-full text-left border-collapse text-[9px]">
                <thead>
                  <tr className="border-b border-cyan-400/25 bg-cyan-500/10 text-cyan-300 font-bold sticky top-0 z-20 backdrop-blur-md">
                    {['Token', 'Price', 'Liq', 'Vol/Chg', 'Score', 'Action'].map(function (h, i) {
                      return (
                        <th
                          key={i}
                          className={
                            'p-1.5 text-[9px] font-bold whitespace-nowrap' +
                            (i === 4 ? ' text-center' : i === 5 ? ' text-right' : ' text-left')
                          }
                        >
                          {h}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {/* Pinned MRDT row */}
                  <tr
                    onClick={function () {
                      openTokenBlueprint({
                        symbol: 'MRDT',
                        name: 'MARADONATOKEN',
                        ca: MRDT_CA,
                        price: mrdtPrice.toFixed(8),
                        liquidity: 13000,
                        volume24h: 0,
                        priceChange24h: 12.4,
                        verified: true,
                        dexUrl: 'https://dexscreener.com/solana/' + MRDT_CA,
                        chain: 'solana',
                      });
                    }}
                    className="border-b border-purple-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 transition cursor-pointer"
                  >
                    <td className="p-1 font-bold flex items-center gap-1">
                      <span className="text-sm">⚽️</span>
                      <div>
                        <span className="text-emerald-400 font-extrabold text-[10px]">$MRDT</span>
                        <div className="text-[7px] text-slate-400">MARADONATOKEN</div>
                      </div>
                    </td>
                    <td className="p-1 font-mono text-emerald-400 font-bold text-[9px]">
                      ${mrdtPrice > 0 ? mrdtPrice.toFixed(8) : '...'}
                    </td>
                    <td className="p-1 font-mono text-emerald-400 font-bold text-[9px]">$13K+</td>
                    <td className="p-1 font-mono text-emerald-400 font-bold text-[9px]">+12.4%</td>
                    <td className="p-1 text-center">
                      <div className="inline-flex items-center justify-center w-9 h-4 rounded-full bg-emerald-500/20 border border-emerald-500 text-emerald-400 text-[8px] font-extrabold shadow-[0_0_6px_rgba(16,185,129,0.5)]">
                        98
                      </div>
                    </td>
                    <td className="p-1 text-right">
                      <button
                        onClick={function (e) {
                          e.stopPropagation();
                          handleLaunchJupiter();
                        }}
                        className="text-[8px] text-emerald-400 hover:text-emerald-300 font-bold hover:underline inline-flex items-center gap-0.5"
                      >
                        Buy <ExternalLink className="w-2 h-2" />
                      </button>
                    </td>
                  </tr>

                  {/* Supabase listed tokens */}
                  {filterAndSortTokens(listedTokens).map(function (token, i) {
                    var score = getSafetyScore(token);
                    var style = getScoreStyle(score);
                    return (
                      <tr
                        key={'sb-' + i}
                        onClick={function () {
                          openTokenBlueprint(token);
                        }}
                        className="border-b border-cyan-400/15 bg-cyan-500/5 hover:bg-cyan-500/10 transition cursor-pointer"
                      >
                        <td className="p-1">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={function (e) {
                                e.stopPropagation();
                                toggleWatchlist(token.ca);
                              }}
                              className="shrink-0 text-[10px] leading-none"
                            >
                              {watchlist.includes(token.ca) ? '⭐' : '☆'}
                            </button>
                            <TokenAvatar token={token} size={16} />
                            <span className="text-cyan-300 text-[9px] font-bold">
                              ${token.symbol}
                            </span>
                            <span className="text-[6px] bg-cyan-500/20 text-cyan-300 px-1 rounded font-bold border border-cyan-400/40 shadow-[0_0_4px_rgba(34,211,238,0.5)]">
                              ✓ AUDITED
                            </span>
                          </div>
                          <span className="text-[7px] text-slate-500 block truncate max-w-[80px]">
                            {token.name}
                          </span>
                        </td>
                        <td className="p-1 font-mono text-slate-300 text-[9px]">${token.price}</td>
                        <td className="p-1 font-mono text-slate-300 text-[9px]">
                          {typeof token.liquidity === 'number'
                            ? formatNumber(token.liquidity)
                            : token.liquidity}
                        </td>
                        <td
                          className={
                            'p-1 font-mono text-[9px] ' +
                            (token.priceChange24h > 0 ? 'text-emerald-400' : 'text-red-400')
                          }
                        >
                          {formatNumber(token.volume24h)} ({token.priceChange24h > 0 ? '+' : ''}
                          {token.priceChange24h}%)
                        </td>
                        <td className="p-1 text-center">
                          <div
                            className={
                              'inline-flex items-center justify-center w-9 h-4 rounded-full ' +
                              style.bg +
                              ' ' +
                              style.border +
                              ' ' +
                              style.color +
                              ' text-[8px] font-extrabold ' +
                              style.glow
                            }
                          >
                            {score}
                          </div>
                        </td>
                        <td className="p-1 text-right">
                          <a
                            href={token.dexUrl}
                            onClick={function (e) {
                              e.stopPropagation();
                            }}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[8px] text-cyan-300 hover:text-cyan-200 inline-flex items-center gap-0.5 border border-cyan-400/40 rounded-full px-1.5 py-0.5"
                          >
                            DEX <ExternalLink className="w-2 h-2" />
                          </a>
                        </td>
                      </tr>
                    );
                  })}

                  {/* Live DexScreener tokens */}
                  {loading && tokens.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-purple-400 font-bold">
                        <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1" />
                        {t.scanning}
                      </td>
                    </tr>
                  ) : (
                    filterAndSortTokens(tokens).map(function (token, i) {
                      var score = getSafetyScore(token);
                      var style = getScoreStyle(score);
                      return (
                        <tr
                          key={'dx-' + i}
                          onClick={function () {
                            openTokenBlueprint(token);
                          }}
                          className="border-b border-cyan-400/10 hover:bg-cyan-500/5 transition cursor-pointer"
                        >
                          <td className="p-1">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={function (e) {
                                  e.stopPropagation();
                                  toggleWatchlist(token.ca);
                                }}
                                className="shrink-0 text-[10px] leading-none"
                              >
                                {watchlist.includes(token.ca) ? '⭐' : '☆'}
                              </button>
                              <TokenAvatar token={token} size={16} />
                              <span className="text-purple-300 text-[9px] font-bold">
                                ${token.symbol}
                              </span>
                            </div>
                            <span className="text-[7px] text-slate-500 block truncate max-w-[80px]">
                              {token.name}
                            </span>
                          </td>
                          <td className="p-1 font-mono text-slate-300 text-[9px]">
                            ${token.price}
                          </td>
                          <td className="p-1 font-mono text-slate-300 text-[9px]">
                            {typeof token.liquidity === 'number'
                              ? formatNumber(token.liquidity)
                              : token.liquidity}
                          </td>
                          <td
                            className={
                              'p-1 font-mono text-[9px] ' +
                              (token.priceChange24h > 0 ? 'text-emerald-400' : 'text-red-400')
                            }
                          >
                            {formatNumber(token.volume24h)} ({token.priceChange24h > 0 ? '+' : ''}
                            {token.priceChange24h}%)
                          </td>
                          <td className="p-1 text-center">
                            <div
                              className={
                                'inline-flex items-center justify-center w-9 h-4 rounded-full ' +
                                style.bg +
                                ' ' +
                                style.border +
                                ' ' +
                                style.color +
                                ' text-[8px] font-extrabold ' +
                                style.glow
                              }
                            >
                              {score}
                            </div>
                          </td>
                          <td className="p-1 text-right">
                            <a
                              href={token.dexUrl}
                              onClick={function (e) {
                                e.stopPropagation();
                              }}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[8px] text-purple-400 hover:text-emerald-400 inline-flex items-center gap-0.5"
                            >
                              DEX <ExternalLink className="w-2 h-2" />
                            </a>
                          </td>
                        </tr>
                      );
                    })
                  )}

                  {/* Empty placeholder rows */}
                  {[1, 2, 3, 4].map(function (n) {
                    return (
                      <tr key={'e' + n} className="border-b border-purple-500/5 opacity-40">
                        {[0, 1, 2, 3, 4, 5].map(function (i) {
                          return (
                            <td key={i} className="p-1 text-slate-600 text-[8px] italic">
                              -
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ═══ Community Voting — vote for your favorite listed token ═══ */}
            {listedTokens.length > 0 && (
              <div className="mt-3 border border-purple-500/20 rounded-lg p-3 bg-slate-900/40">
                <h4 className="text-[10px] font-black text-purple-400 mb-2 flex items-center gap-1">
                  🗳️ Vote for your favorite token
                </h4>
                <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                  {listedTokens.map(function (token, i) {
                    var votes = tokenVotes[token.ca] || { upvotes: 0, downvotes: 0 };
                    var myVote = votedTokens[token.ca];
                    return (
                      <div
                        key={'vote-' + i}
                        className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-slate-950/60 border border-purple-500/10"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="text-emerald-400 text-[9px] font-bold">
                            ${token.symbol}
                          </span>
                          <span className="text-slate-500 text-[8px] ml-1 truncate">
                            {token.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={function () {
                              handleVote(token.ca, 'up');
                            }}
                            disabled={!!myVote}
                            className={
                              'flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-bold transition ' +
                              (myVote === 'up'
                                ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500'
                                : myVote
                                  ? 'text-slate-600 cursor-not-allowed'
                                  : 'text-emerald-400 hover:bg-emerald-500/10 border border-emerald-500/30')
                            }
                          >
                            <ArrowUp className="w-2.5 h-2.5" /> {votes.upvotes}
                          </button>
                          <button
                            onClick={function () {
                              handleVote(token.ca, 'down');
                            }}
                            disabled={!!myVote}
                            className={
                              'flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-bold transition ' +
                              (myVote === 'down'
                                ? 'bg-red-500/30 text-red-300 border border-red-500'
                                : myVote
                                  ? 'text-slate-600 cursor-not-allowed'
                                  : 'text-red-400 hover:bg-red-500/10 border border-red-500/30')
                            }
                          >
                            <ArrowDown className="w-2.5 h-2.5" /> {votes.downvotes}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {error && (
              <div className="mt-2 p-1.5 bg-red-950/40 border border-red-500/30 rounded-lg flex items-center gap-1 text-red-300 text-[9px]">
                <AlertCircle className="w-2.5 h-2.5" /> {error}
              </div>
            )}
          </div>
        </section>

        {/* ═══ ORDER FORMS + PRICING ═══ */}
        <section id="orderFormsSection" className="max-w-7xl mx-auto px-6 py-8">
          <div className="grid md:grid-cols-2 gap-12 items-start">
            <div className="space-y-8">
              {/* Audit form */}
              <div className="border-2 border-purple-500/30 rounded-lg bg-slate-900/40 p-6 backdrop-blur-md">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-lg font-black text-purple-400">{t.formTitle}</h3>
                  {freeSlots > 0 ? (
                    <div className="bg-emerald-500/20 border border-emerald-500/40 rounded-lg px-2 py-1 text-center">
                      <div className="text-emerald-400 font-black text-sm">
                        {freeSlots}/{FREE_TOTAL}
                      </div>
                      <div className="text-[9px] text-emerald-500">free</div>
                    </div>
                  ) : (
                    <div className="bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-center">
                      <div className="text-slate-400 font-black text-sm">0/{FREE_TOTAL}</div>
                      <div className="text-[9px] text-slate-500">no slots</div>
                    </div>
                  )}
                </div>
                <p className="text-slate-400 text-xs mb-4">
                  {freeSlots > 0 ? '🎁 ' + freeSlots + ' ' + t.formFreeLeft : t.formPaid}
                </p>
                <form onSubmit={handleFormSubmit} className="space-y-4">
                  <div>
                    <label className="block text-purple-400 text-xs font-bold mb-1">
                      {t.fieldProject}
                    </label>
                    <input
                      type="text"
                      placeholder={t.fieldProjectPH}
                      value={formData.projectName}
                      onChange={function (e) {
                        setFormData(Object.assign({}, formData, { projectName: e.target.value }));
                      }}
                      className="w-full bg-slate-950 border border-purple-500/20 rounded px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-purple-400 text-xs font-bold mb-1">
                      {t.fieldCA}
                    </label>
                    <input
                      type="text"
                      placeholder={t.fieldCAPH}
                      value={formData.contractAddress}
                      onChange={function (e) {
                        setFormData(
                          Object.assign({}, formData, { contractAddress: e.target.value }),
                        );
                      }}
                      className="w-full bg-slate-950 border border-purple-500/20 rounded px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-purple-400 text-xs font-bold mb-1">
                      Token Logo (optional)
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={function (e) {
                        var f = e.target.files && e.target.files[0];
                        if (f) {
                          var r = new FileReader();
                          r.onload = function (ev) {
                            setFormData(
                              Object.assign({}, formData, { logoImg: ev.target.result }),
                            );
                          };
                          r.readAsDataURL(f);
                        }
                      }}
                      className="w-full bg-slate-950 border border-purple-500/20 rounded px-3 py-2 text-xs text-white file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-bold file:bg-gradient-to-r file:from-purple-500 file:to-emerald-400 file:text-slate-950 hover:file:from-purple-400 hover:file:to-emerald-300"
                    />
                    {!formData.logoImg && (
                      <p className="text-slate-500 text-[9px] mt-1">
                        No logo? We'll auto-generate one from the token name.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-purple-400 text-xs font-bold mb-1">
                      {t.fieldTier}
                    </label>
                    <select
                      value={selectedTier}
                      onChange={function (e) {
                        setSelectedTier(e.target.value);
                      }}
                      className="w-full bg-slate-950 border border-purple-500/20 rounded px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-none font-mono"
                    >
                      <option value="basic">
                        {t.tierBasic} — ~$10 $MRDT/SOL/USDC
                      </option>
                      <option value="fast">
                        {t.tierFast} — ~$25 $MRDT/SOL/USDC
                      </option>
                      <option value="vip">
                        {t.tierVIP} — ~$75 $MRDT/SOL/USDC
                      </option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-purple-400 text-xs font-bold mb-1">
                      {t.fieldTelegram}
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-400 text-xs font-bold">
                        @
                      </span>
                      <input
                        type="text"
                        placeholder="your_telegram"
                        value={formData.telegram}
                        onChange={function (e) {
                          setFormData(Object.assign({}, formData, { telegram: e.target.value }));
                        }}
                        className="w-full bg-slate-950 border border-purple-500/20 rounded pl-7 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={isSending}
                    className={
                      'w-full font-black py-2.5 rounded text-xs transition flex items-center justify-center gap-1.5 disabled:opacity-50 ' +
                      (freeSlots > 0
                        ? 'bg-gradient-to-r from-emerald-400 to-purple-500 hover:from-emerald-300 hover:to-purple-400 text-slate-950'
                        : 'bg-gradient-to-r from-purple-500 to-emerald-400 hover:from-purple-400 hover:to-emerald-300 text-slate-950')
                    }
                  >
                    <Send className="w-3.5 h-3.5" />
                    {isSending ? t.btnLaunching : freeSlots > 0 ? t.btnFreeAudit : t.btnAudit}
                  </button>
                  {submitted && (
                    <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded text-emerald-300 text-xs text-center font-bold">
                      Payment sent! Token added to table.
                    </div>
                  )}
                </form>
              </div>

              {/* Banner form */}
              <div className="border-2 border-purple-500/30 rounded-lg bg-slate-900/40 p-6 backdrop-blur-md">
                <h3 className="text-lg font-black text-purple-400 mb-2">{t.bannerTitle}</h3>
                <p className="text-slate-400 text-xs mb-4">{t.bannerSub}</p>
                <form onSubmit={handleBannerSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-purple-400 text-[11px] font-bold mb-1">
                        {t.fieldTokenName}
                      </label>
                      <input
                        type="text"
                        value={bannerFormData.tokenName}
                        onChange={function (e) {
                          setBannerFormData(
                            Object.assign({}, bannerFormData, { tokenName: e.target.value }),
                          );
                        }}
                        placeholder="SOLANA"
                        className="w-full bg-slate-950 border border-purple-500/20 rounded px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-purple-400 text-[11px] font-bold mb-1">
                        {t.fieldUpload}
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={function (e) {
                          var f = e.target.files && e.target.files[0];
                          if (f) {
                            var r = new FileReader();
                            r.onload = function (ev) {
                              setBannerFormData(
                                Object.assign({}, bannerFormData, { bannerImg: ev.target.result }),
                              );
                            };
                            r.readAsDataURL(f);
                          }
                        }}
                        className="w-full bg-slate-950 border border-purple-500/20 rounded px-3 py-2 text-xs text-white file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-bold file:bg-gradient-to-r file:from-purple-500 file:to-emerald-400 file:text-slate-950 hover:file:from-purple-400 hover:file:to-emerald-300"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-purple-400 text-[11px] font-bold mb-1">
                      {t.fieldSlogan}
                    </label>
                    <input
                      type="text"
                      value={bannerFormData.desc}
                      onChange={function (e) {
                        setBannerFormData(
                          Object.assign({}, bannerFormData, { desc: e.target.value }),
                        );
                      }}
                      placeholder={t.fieldSloganPH}
                      className="w-full bg-slate-950 border border-purple-500/20 rounded px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-purple-400 text-[11px] font-bold mb-1">
                      {t.fieldDuration}
                    </label>
                    <select
                      value={bannerFormData.days}
                      onChange={function (e) {
                        setBannerFormData(
                          Object.assign({}, bannerFormData, { days: e.target.value }),
                        );
                      }}
                      className="w-full bg-slate-950 border border-purple-500/20 rounded px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-none font-mono"
                    >
                      <option value="1">{t.dur1} - ~$20 $MRDT/SOL/USDC</option>
                      <option value="2">{t.dur2} - ~$35 $MRDT/SOL/USDC</option>
                      <option value="6">{t.dur6} - ~$100 $MRDT/SOL/USDC</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    disabled={isBannerSending || activeBanners.length >= BANNER_SLOTS}
                    className="w-full bg-gradient-to-r from-emerald-400 to-purple-500 hover:from-emerald-300 hover:to-purple-400 text-slate-950 font-black py-2.5 rounded text-xs transition flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    {isBannerSending
                      ? t.btnSending
                      : activeBanners.length >= BANNER_SLOTS
                        ? t.btnSlotTaken
                        : t.btnBanner}
                  </button>
                  {activeBanners.length >= BANNER_SLOTS && bannerCountdown && (
                    <div className="p-2.5 bg-slate-900 border border-purple-500/20 rounded text-center">
                      <p className="text-slate-400 text-[11px]">{t.slotAvailIn}</p>
                      <p className="text-purple-400 font-black text-sm mt-0.5">{bannerCountdown}</p>
                    </div>
                  )}
                  {bannerSubmitted && (
                    <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded text-emerald-300 text-xs text-center font-bold">
                      Banner activated!
                    </div>
                  )}
                  {bannerError && (
                    <div className="p-3 bg-red-950/40 border border-red-500/30 rounded text-red-300 text-xs">
                      {bannerError}
                    </div>
                  )}
                </form>
              </div>
            </div>

            {/* Pricing panel */}
            <div className="space-y-4 bg-slate-900/20 border-2 border-purple-500/20 rounded-xl p-6">
              <h3 className="text-xl font-black text-purple-400">{t.investorTitle}</h3>
              <p className="text-slate-300 text-xs leading-relaxed">{t.investorSub}</p>
              <div className="mt-6 space-y-3">
                <h4 className="text-xs font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400 flex items-center gap-1.5">
                  <Download className="w-4 h-4 text-purple-400 animate-pulse" /> {t.pricingTitle}
                </h4>
                <div className="grid grid-cols-1 gap-2 text-xs font-mono">
                  {[
                    [t.first10, t.free],
                    ['Basic AI Audit', '~$10 $MRDT/SOL/USDC'],
                    ['Fast Listing', '~$25 $MRDT/SOL/USDC'],
                    ['VIP Boost', '~$75 $MRDT/SOL/USDC'],
                    ['Banner 1 day', '~$20 $MRDT/SOL/USDC'],
                    ['Banner 2 days', '~$35 $MRDT/SOL/USDC'],
                    ['Banner 6 days', '~$100 $MRDT/SOL/USDC'],
                  ].map(function (row, i) {
                    var rowCls =
                      'flex justify-between p-2.5 border rounded-lg ' +
                      (i === 0
                        ? 'bg-emerald-500/10 border-emerald-500/30'
                        : 'bg-slate-950 border-purple-500/10');
                    var labelCls = i === 0 ? 'text-emerald-300 font-bold' : 'text-slate-300';
                    var valCls =
                      i === 0 ? 'text-emerald-400 font-black' : 'text-emerald-400 font-bold';
                    return (
                      <div key={i} className={rowCls}>
                        <span className={labelCls}>{row[0]}</span>
                        <span className={valCls}>{row[1]}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ DAO SECTION ═══ */}
        <section className="max-w-7xl mx-auto px-6 py-6">
          <div className="relative bg-gradient-to-r from-purple-500/10 via-transparent to-emerald-500/10 border-2 border-purple-500/30 rounded-lg p-10 overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl" />
            <div className="relative z-10 max-w-2xl">
              <h3 className="text-2xl font-black text-purple-400 mb-2">{t.daoTitle}</h3>
              <p className="text-slate-300 text-sm leading-relaxed mb-5">{t.daoText}</p>
              <a
                href="https://t.me/tnt_house2026"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-400 hover:to-purple-500 text-white font-bold py-2.5 px-6 rounded text-xs transition"
              >
                {t.daoBtn}
              </a>
            </div>
          </div>
        </section>

        {/* ═══ FOOTER ═══ */}
        <footer className="border-t border-purple-500/20 mt-12 py-8 bg-slate-950/60 backdrop-blur-lg">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex flex-wrap items-center justify-center gap-8 mb-4">
              <a
                href="https://x.com/Crypto_D10S"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a
                href="https://t.me/D10S_Solana_Stadium"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-400 hover:text-blue-400 transition-colors"
              >
                <span className="text-2xl">✈️</span>
              </a>
              <a
                href="https://www.maradonatoken-mrdt.xyz"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-400 hover:text-emerald-400 transition-colors"
              >
                <ExternalLink className="w-6 h-6" />
              </a>
            </div>
            <div className="text-center space-y-1">
              <div className="text-purple-400 font-bold text-sm tracking-widest">
                TNT HOUSE v0.1.2
              </div>
              <div className="text-slate-400 text-xs">Powered by $MRDT · AI Audits · Supabase</div>
              <div className="text-slate-500 text-[10px]">
                Built with Next.js + Tailwind CSS · Solana Pay
              </div>
            </div>
          </div>
        </footer>
      </div>

      {/* ═══════════════ PAYMENT MODALS ═══════════════ */}

      {/* Step 1: Choose payment method (Audit) */}
      {showPaymentModal && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
          onClick={function () {
            setShowPaymentModal(false);
          }}
        >
          <div
            className="bg-slate-950 border-2 border-purple-500/40 rounded-2xl w-full max-w-md p-6 shadow-[0_0_40px_rgba(168,85,247,0.25)]"
            onClick={function (e) {
              e.stopPropagation();
            }}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-purple-400">{t.choosePayment}</h3>
              <button
                onClick={function () {
                  setShowPaymentModal(false);
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={function () {
                  handlePaymentMethodSelect('MRDT');
                }}
                className="bg-purple-500/10 border-2 border-purple-500/30 hover:border-purple-500 rounded-xl p-4 text-center transition group"
              >
                <div className="text-3xl mb-2">⚽️</div>
                <div className="font-bold text-purple-400 group-hover:text-white transition text-sm">
                  $MRDT
                </div>
                <div className="text-[9px] text-slate-500 mt-1">{t.recommended}</div>
              </button>
              <button
                onClick={function () {
                  handlePaymentMethodSelect('SOL');
                }}
                className="bg-emerald-500/10 border-2 border-emerald-500/30 hover:border-emerald-500 rounded-xl p-4 text-center transition group"
              >
                <div className="flex justify-center mb-2">
                  <svg
                    width="30"
                    height="30"
                    viewBox="0 0 397 311"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7z"
                      fill="url(#sol_a)"
                    />
                    <path
                      d="M64.6 3.8C67.1 1.4 70.4 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1L333.1 73.8c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8z"
                      fill="url(#sol_b)"
                    />
                    <path
                      d="M333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z"
                      fill="url(#sol_c)"
                    />
                    <defs>
                      <linearGradient
                        id="sol_a"
                        x1="360.9"
                        y1="351.4"
                        x2="141.2"
                        y2="-69.2"
                        gradientUnits="userSpaceOnUse"
                      >
                        <stop stopColor="#00FFA3" />
                        <stop offset="1" stopColor="#DC1FFF" />
                      </linearGradient>
                      <linearGradient
                        id="sol_b"
                        x1="264.8"
                        y1="351.4"
                        x2="45.2"
                        y2="-69.2"
                        gradientUnits="userSpaceOnUse"
                      >
                        <stop stopColor="#00FFA3" />
                        <stop offset="1" stopColor="#DC1FFF" />
                      </linearGradient>
                      <linearGradient
                        id="sol_c"
                        x1="312.5"
                        y1="351.4"
                        x2="92.9"
                        y2="-69.2"
                        gradientUnits="userSpaceOnUse"
                      >
                        <stop stopColor="#00FFA3" />
                        <stop offset="1" stopColor="#DC1FFF" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
                <div className="font-bold text-emerald-400 group-hover:text-white transition text-sm">
                  SOL
                </div>
                <div className="text-[9px] text-slate-500 mt-1">Solana</div>
              </button>
              {/* NEW: USDC payment option — same Transaction Request flow as SOL/MRDT,
                  amount is 1:1 with USD price, no conversion needed. */}
              <button
                onClick={function () {
                  handlePaymentMethodSelect('USDC');
                }}
                className="bg-blue-500/10 border-2 border-blue-500/30 hover:border-blue-500 rounded-xl p-4 text-center transition group"
              >
                <div className="text-3xl mb-2">💵</div>
                <div className="font-bold text-blue-400 group-hover:text-white transition text-sm">
                  USDC
                </div>
                <div className="text-[9px] text-slate-500 mt-1">Stable</div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Choose wallet (Audit) */}
      {showWalletModal && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
          onClick={function () {
            setShowWalletModal(false);
            setShowPaymentModal(true);
          }}
        >
          <div
            className="bg-slate-950 border-2 border-purple-500/40 rounded-2xl w-full max-w-md p-6 shadow-[0_0_40px_rgba(168,85,247,0.25)]"
            onClick={function (e) {
              e.stopPropagation();
            }}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-purple-400">{t.chooseWallet}</h3>
              <button
                onClick={function () {
                  setShowWalletModal(false);
                  setShowPaymentModal(true);
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={function () {
                  handleWalletSelect('Phantom');
                }}
                className="bg-purple-500/10 border-2 border-purple-500/30 hover:border-purple-500 rounded-xl p-6 text-center transition group"
              >
                <div className="text-3xl mb-2">👻</div>
                <div className="font-bold text-purple-400 group-hover:text-white transition">
                  Phantom
                </div>
              </button>
              <button
                onClick={function () {
                  handleWalletSelect('Solflare');
                }}
                className="bg-yellow-500/10 border-2 border-yellow-500/30 hover:border-yellow-400 rounded-xl p-6 text-center transition group"
              >
                <div className="flex justify-center mb-2">
                  <svg
                    width="40"
                    height="40"
                    viewBox="0 0 128 128"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <rect width="128" height="128" rx="24" fill="#FBBF24" />
                    <text
                      x="64"
                      y="95"
                      textAnchor="middle"
                      fontFamily="Georgia, serif"
                      fontWeight="900"
                      fontSize="82"
                      fill="#1a0a00"
                      fontStyle="italic"
                    >
                      S
                    </text>
                  </svg>
                </div>
                <div className="font-bold text-yellow-400 group-hover:text-white transition">
                  Solflare
                </div>
              </button>
            </div>
            <button
              onClick={function () {
                setShowWalletModal(false);
                setShowPaymentModal(true);
              }}
              className="mt-4 w-full text-center text-slate-400 hover:text-white text-xs py-2"
            >
              {t.back}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Invoice (Audit) */}
      {showInvoiceModal && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
          onClick={function () {
            setShowInvoiceModal(false);
          }}
        >
          <div
            className="bg-slate-950 border-2 border-purple-500/40 rounded-2xl w-full max-w-md p-6 shadow-[0_0_40px_rgba(168,85,247,0.25)]"
            onClick={function (e) {
              e.stopPropagation();
            }}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-purple-400">{t.invoice}</h3>
              <button
                onClick={function () {
                  setShowInvoiceModal(false);
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-slate-900 border border-purple-500/20 rounded-xl p-6 text-center space-y-4">
              <div className="text-xs text-purple-400 font-bold">
                {selectedWallet} · {selectedPaymentMethod}
              </div>
              <div className="text-3xl font-black text-emerald-400">
                {selectedPaymentMethod === 'SOL'
                  ? formatSOLAmount(invoiceUsd) + ' SOL'
                  : selectedPaymentMethod === 'USDC'
                    ? invoiceUsd.toFixed(2) + ' USDC'
                    : invoiceAmount.toLocaleString() + ' $MRDT'}
              </div>
              <div className="text-sm font-bold text-slate-300">≈ ${invoiceUsd} USD</div>
              <div className="text-xs text-slate-400">{invoiceLabel}</div>
              <div className="text-xs text-slate-500 font-mono break-all">
                Wallet: {WALLET_ADDRESS.slice(0, 8)}...{WALLET_ADDRESS.slice(-8)}
              </div>
              <button
                onClick={function () {
                  var amtStr =
                    selectedPaymentMethod === 'SOL'
                      ? formatSOLAmount(invoiceUsd)
                      : selectedPaymentMethod === 'USDC'
                        ? invoiceUsd.toFixed(2)
                        : String(invoiceAmount);
                  navigator.clipboard.writeText(amtStr).then(function () {
                    showToast('✅ Amount copied: ' + amtStr, 'success');
                  });
                }}
                className="w-full text-xs px-3 py-2 rounded-lg border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10 transition"
              >
                📋 Copy exact amount
              </button>
            </div>
            <div className="mt-2 p-2 bg-purple-950/30 border border-purple-500/20 rounded-lg text-[10px] text-purple-300 text-center">
              Tapping will open {selectedWallet}. You may see a "domain not yet reviewed" warning — this is expected while Phantom reviews the site; tap "Continue anyway" to proceed.
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={function () {
                  setShowInvoiceModal(false);
                }}
                className="flex-1 px-5 py-2.5 text-sm rounded-lg border border-purple-500/40 hover:bg-purple-500/10 transition text-slate-300"
              >
                {t.cancel}
              </button>
              <button
                onClick={handleConfirmPayment}
                className="flex-1 px-5 py-2.5 text-sm rounded-lg bg-gradient-to-r from-purple-500 to-emerald-400 text-slate-950 font-black hover:from-purple-400 hover:to-emerald-300 transition"
              >
                {t.payNow}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ BANNER PAYMENT MODALS ═══════════════ */}

      {/* Step 1: Choose payment method (Banner) */}
      {showBannerPaymentModal && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
          onClick={function () {
            setShowBannerPaymentModal(false);
          }}
        >
          <div
            className="bg-slate-950 border-2 border-emerald-500/40 rounded-2xl w-full max-w-md p-6 shadow-[0_0_40px_rgba(16,185,129,0.2)]"
            onClick={function (e) {
              e.stopPropagation();
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xl font-black text-emerald-400">VIP Banner Payment</h3>
              <button
                onClick={function () {
                  setShowBannerPaymentModal(false);
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-slate-500 text-xs mb-6">
              Banner goes live on homepage right after payment
            </p>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={function () {
                  handleBannerPaymentMethodSelect('MRDT');
                }}
                className="bg-purple-500/10 border-2 border-purple-500/30 hover:border-purple-500 rounded-xl p-4 text-center transition group"
              >
                <div className="text-3xl mb-2">⚽️</div>
                <div className="font-bold text-purple-400 group-hover:text-white transition text-sm">
                  $MRDT
                </div>
                <div className="text-[9px] text-slate-500 mt-1">{t.recommended}</div>
              </button>
              <button
                onClick={function () {
                  handleBannerPaymentMethodSelect('SOL');
                }}
                className="bg-emerald-500/10 border-2 border-emerald-500/30 hover:border-emerald-500 rounded-xl p-4 text-center transition group"
              >
                <div className="flex justify-center mb-2">
                  <svg
                    width="30"
                    height="30"
                    viewBox="0 0 397 311"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7z"
                      fill="url(#bs1)"
                    />
                    <path
                      d="M64.6 3.8C67.1 1.4 70.4 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1L333.1 73.8c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8z"
                      fill="url(#bs2)"
                    />
                    <path
                      d="M333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z"
                      fill="url(#bs3)"
                    />
                    <defs>
                      <linearGradient
                        id="bs1"
                        x1="360.9"
                        y1="351.4"
                        x2="141.2"
                        y2="-69.2"
                        gradientUnits="userSpaceOnUse"
                      >
                        <stop stopColor="#00FFA3" />
                        <stop offset="1" stopColor="#DC1FFF" />
                      </linearGradient>
                      <linearGradient
                        id="bs2"
                        x1="264.8"
                        y1="351.4"
                        x2="45.2"
                        y2="-69.2"
                        gradientUnits="userSpaceOnUse"
                      >
                        <stop stopColor="#00FFA3" />
                        <stop offset="1" stopColor="#DC1FFF" />
                      </linearGradient>
                      <linearGradient
                        id="bs3"
                        x1="312.5"
                        y1="351.4"
                        x2="92.9"
                        y2="-69.2"
                        gradientUnits="userSpaceOnUse"
                      >
                        <stop stopColor="#00FFA3" />
                        <stop offset="1" stopColor="#DC1FFF" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
                <div className="font-bold text-emerald-400 group-hover:text-white transition text-sm">
                  SOL
                </div>
                <div className="text-[9px] text-slate-500 mt-1">Solana</div>
              </button>
              {/* NEW: USDC option for VIP banner payment — same pattern as audit flow */}
              <button
                onClick={function () {
                  handleBannerPaymentMethodSelect('USDC');
                }}
                className="bg-blue-500/10 border-2 border-blue-500/30 hover:border-blue-500 rounded-xl p-4 text-center transition group"
              >
                <div className="text-3xl mb-2">💵</div>
                <div className="font-bold text-blue-400 group-hover:text-white transition text-sm">
                  USDC
                </div>
                <div className="text-[9px] text-slate-500 mt-1">Stable</div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Choose wallet (Banner) */}
      {showBannerWalletModal && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
          onClick={function () {
            setShowBannerWalletModal(false);
            setShowBannerPaymentModal(true);
          }}
        >
          <div
            className="bg-slate-950 border-2 border-emerald-500/40 rounded-2xl w-full max-w-md p-6 shadow-[0_0_40px_rgba(16,185,129,0.2)]"
            onClick={function (e) {
              e.stopPropagation();
            }}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-emerald-400">{t.chooseWallet}</h3>
              <button
                onClick={function () {
                  setShowBannerWalletModal(false);
                  setShowBannerPaymentModal(true);
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={function () {
                  handleBannerWalletSelect('Phantom');
                }}
                className="bg-purple-500/10 border-2 border-purple-500/30 hover:border-purple-500 rounded-xl p-6 text-center transition group"
              >
                <div className="text-3xl mb-2">👻</div>
                <div className="font-bold text-purple-400 group-hover:text-white transition">
                  Phantom
                </div>
              </button>
              <button
                onClick={function () {
                  handleBannerWalletSelect('Solflare');
                }}
                className="bg-yellow-500/10 border-2 border-yellow-500/30 hover:border-yellow-400 rounded-xl p-6 text-center transition group"
              >
                <div className="flex justify-center mb-2">
                  <svg
                    width="40"
                    height="40"
                    viewBox="0 0 128 128"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <rect width="128" height="128" rx="24" fill="#FBBF24" />
                    <text
                      x="64"
                      y="95"
                      textAnchor="middle"
                      fontFamily="Georgia, serif"
                      fontWeight="900"
                      fontSize="82"
                      fill="#1a0a00"
                      fontStyle="italic"
                    >
                      S
                    </text>
                  </svg>
                </div>
                <div className="font-bold text-yellow-400 group-hover:text-white transition">
                  Solflare
                </div>
              </button>
            </div>
            <button
              onClick={function () {
                setShowBannerWalletModal(false);
                setShowBannerPaymentModal(true);
              }}
              className="mt-4 w-full text-center text-slate-400 hover:text-white text-xs py-2"
            >
              {t.back}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Invoice (Banner) */}
      {showBannerInvoiceModal && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
          onClick={function () {
            setShowBannerInvoiceModal(false);
          }}
        >
          <div
            className="bg-slate-950 border-2 border-emerald-500/40 rounded-2xl w-full max-w-md p-6 shadow-[0_0_40px_rgba(16,185,129,0.2)]"
            onClick={function (e) {
              e.stopPropagation();
            }}
          >
            {' '}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-emerald-400">{t.invoiceBanner}</h3>
              <button
                onClick={function () {
                  setShowBannerInvoiceModal(false);
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {bannerFormData.bannerImg && (
              <div className="flex items-center gap-3 bg-slate-900 border border-emerald-500/20 rounded-xl p-3 mb-4">
                <img
                  src={bannerFormData.bannerImg}
                  alt="banner preview"
                  className="w-12 h-12 rounded-xl object-cover border border-emerald-500/30"
                />
                <div>
                  <div className="text-emerald-400 font-black text-sm">
                    ${bannerFormData.tokenName.toUpperCase()}
                  </div>
                  <div className="text-slate-400 text-xs">{bannerFormData.desc}</div>
                  <div className="text-slate-500 text-[10px]">
                    {bannerFormData.days} {bannerFormData.days === '1' ? 'day' : 'days'}
                  </div>
                </div>
              </div>
            )}
            <div className="bg-slate-900 border border-emerald-500/20 rounded-xl p-6 text-center space-y-3">
              <div className="text-xs text-emerald-400 font-bold">
                {selectedBannerWallet} · {selectedBannerPaymentMethod}
              </div>
              <div className="text-3xl font-black text-emerald-400">
                {selectedBannerPaymentMethod === 'SOL'
                  ? formatSOLAmount(bannerInvoiceUsd) + ' SOL'
                  : selectedBannerPaymentMethod === 'USDC'
                    ? bannerInvoiceUsd.toFixed(2) + ' USDC'
                    : bannerInvoiceAmount.toLocaleString() + ' $MRDT'}
              </div>
              <div className="text-sm font-bold text-slate-300">≈ ${bannerInvoiceUsd} USD</div>
              <div className="text-xs text-slate-500 font-mono break-all">
                Wallet: {WALLET_ADDRESS.slice(0, 8)}...{WALLET_ADDRESS.slice(-8)}
              </div>
              <button
                onClick={function () {
                  var amtStr =
                    selectedBannerPaymentMethod === 'SOL'
                      ? formatSOLAmount(bannerInvoiceUsd)
                      : selectedBannerPaymentMethod === 'USDC'
                        ? bannerInvoiceUsd.toFixed(2)
                        : String(bannerInvoiceAmount);
                  navigator.clipboard.writeText(amtStr).then(function () {
                    showToast('✅ Amount copied: ' + amtStr, 'success');
                  });
                }}
                className="w-full text-xs px-3 py-2 rounded-lg border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10 transition"
              >
                📋 Copy exact amount
              </button>
            </div>
            <div className="mt-2 p-2 bg-emerald-950/30 border border-emerald-500/20 rounded-lg text-[10px] text-emerald-300 text-center">
              {t.bannerLive} You may see a "domain not yet reviewed" warning — tap "Continue anyway" to proceed.
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={function () {
                  setShowBannerInvoiceModal(false);
                }}
                className="flex-1 px-5 py-2.5 text-sm rounded-lg border border-emerald-500/40 hover:bg-emerald-500/10 transition text-slate-300"
              >
                {t.cancel}
              </button>
              <button
                onClick={handleBannerConfirmPayment}
                className="flex-1 px-5 py-2.5 text-sm rounded-lg bg-gradient-to-r from-emerald-400 to-purple-500 text-slate-950 font-black hover:from-emerald-300 hover:to-purple-400 transition"
              >
                {t.payNow}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Payment Verification Modal ═══ */}
      {showVerifyModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-slate-950 border-2 border-purple-500/40 rounded-2xl w-full max-w-sm p-6 shadow-[0_0_40px_rgba(168,85,247,0.25)] text-center">
            {verifyStatus === 'waiting' && (
              <>
                <div className="w-16 h-16 rounded-full border-4 border-purple-500 border-t-transparent animate-spin mx-auto mb-4" />
                <h3 className="text-lg font-black text-white mb-2">{t.waitPayment}</h3>
                <p className="text-slate-400 text-xs mb-4">{t.waitSub}</p>
                <div className="bg-slate-900 rounded-lg p-3 mb-4">
                  <p className="text-[10px] text-slate-500">
                    {t.checkingBC} {verifyAttempts}/30
                  </p>
                  <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2">
                    <div
                      className="bg-purple-500 h-1.5 rounded-full transition-all"
                      style={{ width: Math.round((verifyAttempts / 30) * 100) + '%' }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    {t.timeoutIn} {Math.max(0, 5 - Math.floor(verifyAttempts / 6))} {t.min}
                  </p>
                </div>
                <button
                  onClick={function () {
                    if (verifyIntervalRef.current) clearInterval(verifyIntervalRef.current);
                    setShowVerifyModal(false);
                  }}
                  className="text-slate-500 hover:text-white text-xs"
                >
                  {t.cancel}
                </button>
              </>
            )}
            {verifyStatus === 'success' && (
              <>
                <div className="text-5xl mb-4">✅</div>
                <h3 className="text-lg font-black text-emerald-400 mb-2">{t.payConfirmed}</h3>
                <p className="text-slate-400 text-xs">
                  {verifyType === 'banner' ? t.bannerLiveMsg : t.tokenAdded}
                </p>
              </>
            )}
            {verifyStatus === 'failed' && (
              <>
                <div className="text-5xl mb-4">⏱</div>
                <h3 className="text-lg font-black text-red-400 mb-2">{t.payNotDetected}</h3>
                <p className="text-slate-400 text-xs mb-4">{t.payNotMsg}</p>
                <a
                  href="https://t.me/tnt_house2026"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block bg-purple-500 hover:bg-purple-400 text-white font-bold py-2 px-4 rounded text-xs mb-3"
                >
                  {t.contactAdmin}
                </a>
                <br />
                <button
                  onClick={function () {
                    setShowVerifyModal(false);
                  }}
                  className="text-slate-500 hover:text-white text-xs"
                >
                  {t.close}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ═══ Deeplink Fallback (desktop without wallet extension) ═══ */}
      {deeplinkFallbackUri && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[110] bg-slate-900 border-2 border-yellow-500/50 rounded-2xl p-4 shadow-[0_0_30px_rgba(234,179,8,0.3)] max-w-md w-full">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl">🔗</span>
            <div>
              <p className="text-white font-bold text-sm">Open in wallet</p>
              <p className="text-slate-400 text-xs">
                If wallet didn't open, click below or copy link
              </p>
            </div>
            <button
              onClick={function () {
                setDeeplinkFallbackUri('');
              }}
              className="ml-auto text-slate-500 hover:text-white text-lg"
            >
              ✕
            </button>
          </div>
          <div className="flex gap-2">
            <a
              href={deeplinkFallbackUri}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 bg-gradient-to-r from-purple-500 to-emerald-500 hover:from-purple-400 hover:to-emerald-400 text-white font-bold py-2.5 px-4 rounded-lg text-sm text-center transition"
            >
              🚀 Open Wallet
            </a>
            <button
              onClick={function () {
                navigator.clipboard.writeText(deeplinkFallbackUri).then(function () {
                  showToast('Link copied! Paste in wallet browser.', 'success');
                });
              }}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 px-4 rounded-lg text-sm transition border border-slate-700"
            >
              📋 Copy
            </button>
          </div>
          <p className="text-[10px] text-slate-500 mt-3 text-center">
            Works on mobile with Phantom/Solflare. On desktop, install a Solana wallet extension.
          </p>
        </div>
      )}

      {/* ═══ TNT Security Blueprint Modal ═══ */}
      {isBlueprintOpen && selectedToken && (
        <div
          className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={closeBlueprint}
        >
          <div
            className="bg-slate-950 border-2 border-purple-500/40 rounded-2xl w-full max-w-lg shadow-[0_0_40px_rgba(168,85,247,0.2)] overflow-y-auto max-h-[90vh]"
            onClick={function (e) {
              e.stopPropagation();
            }}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-black text-white">TNT Security Blueprint</h2>
                <button onClick={closeBlueprint} className="text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-lg">
                  {selectedToken.symbol === 'MRDT' ? '⚽️' : '🪙'}
                </div>
                <div>
                  <p className="text-purple-400 font-black text-base">
                    ${selectedToken.symbol}{' '}
                    <span className="text-slate-400 font-normal text-sm">{selectedToken.name}</span>
                  </p>
                  <p className="text-slate-500 text-[10px] font-mono break-all">
                    {selectedToken.ca}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 mb-4 p-3 bg-slate-900 rounded-xl border border-purple-500/20">
                <div
                  className={
                    'w-14 h-14 rounded-full flex items-center justify-center text-xl font-black border-2 shrink-0 ' +
                    (getSafetyScore(selectedToken) >= 90
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                      : getSafetyScore(selectedToken) >= 50
                        ? 'bg-yellow-500/20 border-yellow-500 text-yellow-400'
                        : 'bg-red-500/20 border-red-500 text-red-400')
                  }
                >
                  {getSafetyScore(selectedToken)}
                </div>
                <div>
                  <p className="text-white font-bold text-sm">{t.safetyScore}</p>
                  <p className="text-slate-400 text-xs">
                    {getSafetyScore(selectedToken) >= 90
                      ? t.ironclad
                      : getSafetyScore(selectedToken) >= 50
                        ? t.moderate
                        : t.highRisk}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {[
                  { label: t.price, value: '$' + (selectedToken.price || '0.00000000') },
                  {
                    label: t.liquidity,
                    value: selectedToken.liquidity
                      ? '$' +
                        (selectedToken.liquidity >= 1000
                          ? (selectedToken.liquidity / 1000).toFixed(1) + 'K'
                          : selectedToken.liquidity)
                      : '$0',
                  },
                  {
                    label: t.volume24h,
                    value: selectedToken.volume24h
                      ? '$' +
                        (selectedToken.volume24h >= 1000
                          ? (selectedToken.volume24h / 1000).toFixed(1) + 'K'
                          : selectedToken.volume24h)
                      : '$0',
                  },
                ].map(function (item, i) {
                  return (
                    <div
                      key={i}
                      className="bg-slate-900 border border-purple-500/10 rounded-lg p-2.5 text-center"
                    >
                      <p className="text-slate-500 text-[9px] mb-0.5">{item.label}</p>
                      <p className="text-emerald-400 font-bold text-xs font-mono">{item.value}</p>
                    </div>
                  );
                })}
              </div>
              <div className="space-y-1.5 mb-3">
                {[
                  { label: t.mintAuth, value: selectedToken.mintAuthority },
                  { label: t.freezeAuth, value: selectedToken.freezeAuthority },
                  { label: t.honeypot, value: selectedToken.isHoneypot },
                  {
                    label: 'Top 10 Holders',
                    value:
                      selectedToken.top10Percent != null
                        ? selectedToken.top10Percent + '%'
                        : 'Unknown',
                  },
                  {
                    label: 'Holders',
                    value:
                      selectedToken.symbol === 'MRDT'
                        ? '718 wallets'
                        : selectedToken.holderCount != null
                          ? selectedToken.holderCount + ' wallets'
                          : 'Unknown',
                  },
                  {
                    label: 'LP Lock',
                    value:
                      selectedToken.symbol === 'MRDT'
                        ? '❄️ 670M locked 1yr'
                        : selectedToken.lpLockedPercent != null
                          ? selectedToken.lpLockedPercent + '% locked'
                          : 'Unknown',
                  },
                  {
                    label: 'Buy/Sell Tax',
                    value:
                      selectedToken.buyTaxPercent != null && selectedToken.sellTaxPercent != null
                        ? selectedToken.buyTaxPercent + '% / ' + selectedToken.sellTaxPercent + '%'
                        : 'Unknown',
                  },
                  {
                    label: 'Contract Renounced',
                    value:
                      selectedToken.contractRenounced === true
                        ? 'Yes ✓'
                        : selectedToken.contractRenounced === false
                          ? 'No'
                          : 'Unknown',
                  },
                  {
                    label: 'Hidden Owner / Proxy',
                    value: selectedToken.hiddenOwner || 'Unknown',
                  },
                  {
                    label: 'Token Age',
                    value:
                      selectedToken.ageDays != null
                        ? selectedToken.ageDays + (selectedToken.ageDays === 1 ? ' day' : ' days')
                        : 'Unknown',
                  },
                  {
                    label: 'Dev Wallet %',
                    value:
                      selectedToken.creatorBalancePercent != null
                        ? selectedToken.creatorBalancePercent + '%'
                        : 'Unknown',
                  },
                  {
                    label: 'Token Program',
                    value:
                      selectedToken.standardProgram === true
                        ? 'Standard ✓'
                        : selectedToken.standardProgram === false
                          ? 'Custom ⚠️'
                          : 'Unknown',
                  },
                  {
                    label: 'Permanent Delegate',
                    value: selectedToken.permanentDelegate || 'Unknown',
                  },
                ].map(function (item, i) {
                  if (!item.value) return null;
                  var valueStr = String(item.value);
                  var isUnknown = valueStr === 'Unknown';
                  var isNeutralInfo =
                    item.label === 'Buy/Sell Tax' ||
                    item.label === 'Token Age' ||
                    item.label === 'Dev Wallet %';
                  var isSafe =
                    valueStr.includes('Revoked') ||
                    valueStr.includes('No ✓') ||
                    valueStr.includes('Yes ✓') ||
                    valueStr.includes('Standard ✓') ||
                    valueStr.includes('Burned') ||
                    valueStr.includes('locked') ||
                    valueStr.includes('wallets');
                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between px-3 py-2 bg-slate-900 rounded-lg border border-purple-500/10"
                    >
                      <span className="text-slate-400 text-xs">{item.label}</span>
                      <span
                        className={
                          'text-xs font-bold ' +
                          (isUnknown
                            ? 'text-slate-500'
                            : isNeutralInfo
                              ? 'text-slate-200'
                              : isSafe
                              ? 'text-emerald-400'
                              : 'text-red-400')
                        }
                      >
                        {valueStr}
                      </span>
                    </div>
                  );
                })}
              </div>
              {selectedToken.symbol === 'MRDT' && (
                <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg mb-3">
                  <span className="text-emerald-400 text-sm">✅</span>
                  <span className="text-emerald-400 text-xs font-bold">
                    DexScreener Audit Passed
                  </span>
                </div>
              )}
              <div className="mb-3">
                {!clusterResult && !clusterLoading && (
                  <button
                    onClick={checkClusters}
                    className="w-full text-xs font-bold py-2 rounded-lg border border-purple-500/30 text-purple-300 hover:bg-purple-500/10 transition"
                  >
                    🔍 Check Insider Clusters (top holders)
                  </button>
                  )}
                  {clusterLoading && (
                    <div className="w-full text-xs font-bold py-2 rounded-lg border border-purple-500/30 text-purple-300 flex items-center justify-center gap-1.5">
                      <RefreshCw className="w-3 h-3 animate-spin" /> Tracing on-chain funding — 10-30s...
                    </div>
                  )}
                  {clusterResult && !clusterResult.error && (
                    <div
                      className={
                        'text-xs px-3 py-2 rounded-lg border ' +
                        (clusterResult.clusterCount > 0
                          ? 'bg-red-500/10 border-red-500/30 text-red-300'
                          : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300')
                      }
                    >
                      {clusterResult.clusterCount > 0 ? (
                        <>
                          <div className="font-bold mb-1">
                            🚨 {clusterResult.clusterCount} funding cluster
                            {clusterResult.clusterCount > 1 ? 's' : ''} found
                          </div>
                          {clusterResult.clusters.map(function (c, i) {
                            return (
                              <div key={i} className="text-[10px] font-mono opacity-80">
                                {c.holders.length} wallets funded by {c.funder.slice(0, 6)}...
                                {c.funder.slice(-4)}
                              </div>
                            );
                          })}
                          <div className="text-[9px] mt-1 opacity-70">
                            Same wallet funded multiple top holders — likely same owner.
                          </div>
                        </>
                      ) : (
                        <div className="font-bold">
                          ✓ No shared funding source found among top {clusterResult.checked}{' '}
                          holders
                        </div>
                      )}
                    </div>
                  )}
                  {clusterResult && clusterResult.error && (
                    <div className="text-xs px-3 py-2 rounded-lg border border-slate-600/30 text-slate-400">
                      {clusterResult.error}
                    </div>
                  )}
                </div>
              <div className="flex gap-2">
                <a
                  href={selectedToken.dexUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg border border-purple-500/30 text-purple-400 hover:text-emerald-400 hover:border-emerald-500/30 transition text-xs font-bold"
                >
                  DexScreener <ExternalLink className="w-3 h-3" />
                </a>
                <a
                  href={'https://rugcheck.xyz/tokens/' + selectedToken.ca}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg border border-purple-500/30 text-purple-400 hover:text-emerald-400 hover:border-emerald-500/30 transition text-xs font-bold"
                >
                  RugCheck <ExternalLink className="w-3 h-3" />
                </a>
                {selectedToken.symbol === 'MRDT' ? (
                  <button
                    onClick={handleLaunchJupiter}
                    className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-emerald-400 text-slate-950 font-black text-xs hover:from-purple-400 hover:to-emerald-300 transition"
                  >
                    Buy $MRDT ⚽️
                  </button>
                ) : (
                  <a
                    href={
                      'https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&buy=' +
                      selectedToken.ca
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-emerald-400 text-slate-950 font-black text-xs hover:from-purple-400 hover:to-emerald-300 transition"
                  >
                    Buy ${selectedToken.symbol}
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ AI CHAT WIDGET ═══════════════ */}

      {/* Chat toggle button */}
      <button
        onClick={function () {
          setIsChatOpen(!isChatOpen);
        }}
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-tr from-purple-500 to-emerald-400 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(153,69,255,0.5)] hover:scale-105 transition z-50 animate-bounce"
      >
        {isChatOpen ? (
          <X className="w-6 h-6 text-slate-950" />
        ) : (
          <MessageSquare className="w-6 h-6 text-slate-950" />
        )}
      </button>

      {/* Chat panel */}
      {isChatOpen && (
        <div className="fixed bottom-24 right-6 w-80 md:w-96 h-[450px] bg-slate-900 border-2 border-purple-500 rounded-xl shadow-[0_0_30px_rgba(153,69,255,0.4)] flex flex-col overflow-hidden z-50">
          {/* Chat header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-purple-500/30 bg-slate-950">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-xs font-black text-purple-400">TNT AI Inspector 🤖</span>
            </div>
            <div className="text-[9px] text-slate-500">
              {chatBlocked ? t.limitReached + ' ' + chatTimer : 'Online'}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {chatMessages.map(function (msg, i) {
              return (
                <div
                  key={i}
                  className={'flex ' + (msg.sender === 'user' ? 'justify-end' : 'justify-start')}
                >
                  <div
                    className={
                      'max-w-[85%] px-3 py-2 rounded-xl text-xs whitespace-pre-wrap ' +
                      (msg.sender === 'user'
                        ? 'bg-purple-500 text-white rounded-br-none'
                        : 'bg-slate-800 text-slate-200 rounded-bl-none border border-purple-500/20')
                    }
                  >
                    {msg.text}
                  </div>
                </div>
              );
            })}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-slate-800 border border-purple-500/20 rounded-xl rounded-bl-none px-3 py-2 flex gap-1">
                  <span
                    className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce"
                    style={{ animationDelay: '0ms' }}
                  />
                  <span
                    className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce"
                    style={{ animationDelay: '150ms' }}
                  />
                  <span
                    className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce"
                    style={{ animationDelay: '300ms' }}
                  />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Rate limit banner */}
          {chatBlocked && (
            <div className="px-3 py-2 bg-purple-950/60 border-t border-purple-500/30 text-center">
              <p className="text-[10px] text-purple-300">
                {t.limitReached} <span className="font-black text-purple-400">{chatTimer}</span>
              </p>
              <button
                onClick={scrollToForm}
                className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold mt-0.5"
              >
                {t.orderAudit}
              </button>
            </div>
          )}

          {/* Input row */}
          <div className="flex items-center gap-2 p-3 border-t border-purple-500/30 bg-slate-950">
            <input
              type="text"
              value={userMsg}
              onChange={function (e) {
                setUserMsg(e.target.value);
              }}
              onKeyDown={function (e) {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendChat();
                }
              }}
              disabled={chatBlocked}
              placeholder={chatBlocked ? t.limitReached.slice(0, 30) + '...' : t.pasteCa}
              className="flex-1 bg-slate-900 border border-purple-500/20 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-purple-500 focus:outline-none disabled:opacity-40"
            />
            <button
              onClick={handleSendChat}
              disabled={chatBlocked || isTyping || !userMsg.trim()}
              className="w-8 h-8 bg-gradient-to-tr from-purple-500 to-emerald-400 rounded-lg flex items-center justify-center disabled:opacity-40 transition hover:scale-105"
            >
              <Send className="w-3.5 h-3.5 text-slate-950" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
