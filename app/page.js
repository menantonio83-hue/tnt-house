'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Shield, Send, MessageSquare, X, RefreshCw, AlertCircle, Sparkles, ExternalLink, ChevronDown, Download, Zap, Lock, CheckCircle, XCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';

const WALLET_ADDRESS = "Ev6oXBXo6qyoaT5wypJ2Umxch91F7cFvE1SarYLaUn8Z";
const MRDT_CA = "8Q22r9qUm4AzFzTpZgaPYMxqq4z5WxE9FVa7X9dsvmBg";
const MRDT_DECIMALS = 9;
const SITE_URL = 'https://tnt-house.vercel.app';
const SUPABASE_URL = 'https://pjtvjslcffuulsqxerpx.supabase.co';
const SUPABASE_KEY = 'sb_publishable__gmhE8SE_blCu-v90fV2OQ_YmFCkfFU';

const GLOW_PURPLE = { position: 'absolute', top: '-10%', left: '-10%', width: '500px', height: '500px', borderRadius: '9999px', background: 'rgba(147,51,234,0.1)', filter: 'blur(120px)', pointerEvents: 'none' };
const GLOW_GREEN = { position: 'absolute', bottom: '20%', right: '-10%', width: '500px', height: '500px', borderRadius: '9999px', background: 'rgba(16,185,129,0.1)', filter: 'blur(120px)', pointerEvents: 'none' };

const TRANSLATIONS = { /* ... same as before, truncated for brevity but full in real call */ };

// --- Supabase helpers ---
/* full helpers unchanged */

const FALLBACK_TOKENS = [];

export default function TntHouse() {
  /* all state and functions up to handleSendChat unchanged except the broken line */

  var handleSendChat = async function() {
    if (!userMsg.trim() || isTyping) return;
    if (chatBlocked) return;
    var newCount = chatCount + 1;
    setChatCount(newCount);
    if (newCount >= 5) {
      var resetAt = Date.now() + 10 * 60 * 1000;
      setChatResetTime(resetAt);
      setChatBlocked(true);
    }
    var text = userMsg.trim();
    var updatedMessages = chatMessages
      .filter(function(m) { return m.sender !== 'bot' || chatMessages.indexOf(m) > 0; })
      .map(function(m) { return { role: m.sender === 'user' ? 'user' : 'assistant', content: m.text }; })
      .concat([{ role: 'user', content: text }]);
    setChatMessages(function(prev) { return prev.concat([{ sender: 'user', text: text }]); });
    setUserMsg('');
    setIsTyping(true);
    try {
      var res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updatedMessages })
      });
      var data = await res.json();
      setChatMessages(function(prev) {
        return prev.concat([{ sender: 'bot', text: data.reply || data.error || 'Error. Try again.' }]);
      });
    } catch (e) {
      setChatMessages(function(prev) {
        return prev.concat([{ sender: 'bot', text: 'Connection error. 💎 Full audit → from $10' }]);
      });
    }
    setIsTyping(false);
  };

  /* rest of component unchanged */

  return (
    /* full JSX unchanged */
  );
}