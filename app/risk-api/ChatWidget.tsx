// Version 1.0 — app/risk-api/ChatWidget.tsx
//
// Same pattern as app/page.js's own chat widget (existing file, not
// modified — that one is scoped to the main site's audit/$MRDT product):
// a floating bubble that opens a small chat panel, backed by Groq's
// free llama-3.1-8b-instant via a new, separate API route
// (app/api/risk-api-chat/route.ts) with its own Risk-Data-API-scoped
// system prompt. Client-side rate limit mirrors the main site's
// (30 messages / 10 minutes) — this is a low-stakes marketing chat
// widget, not billing-critical, so a lightweight client-side counter is
// appropriate rather than a server-side one.

'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';
import { useRiskApiLang } from './LangContext';

interface ChatMessage {
  sender: 'user' | 'bot';
  text: string;
}

const RATE_LIMIT_COUNT = 30;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

export default function ChatWidget() {
  const { t } = useRiskApiLang();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userMsg, setUserMsg] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [msgCount, setMsgCount] = useState(0);
  const [resetTime, setResetTime] = useState<number | null>(null);
  const [blocked, setBlocked] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  // Seed the welcome message once we know the current language (avoids
  // a flash of English before the LangContext's browser-detect effect
  // runs, and re-greets in the new language if the visitor switches
  // languages before ever sending a message).
  useEffect(() => {
    setMessages((prev) => {
      if (prev.length > 0) return prev; // don't overwrite an ongoing conversation
      return [{ sender: 'bot', text: t.chatWelcome }];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.chatWelcome]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!resetTime) return;
    const interval = setInterval(() => {
      if (Date.now() >= resetTime) {
        setBlocked(false);
        setMsgCount(0);
        setResetTime(null);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [resetTime]);

  const handleSend = async () => {
    if (!userMsg.trim() || isTyping || blocked) return;

    const newCount = msgCount + 1;
    setMsgCount(newCount);
    if (newCount >= RATE_LIMIT_COUNT) {
      setResetTime(Date.now() + RATE_LIMIT_WINDOW_MS);
      setBlocked(true);
    }

    const text = userMsg.trim();
    const history = messages
      .filter((m, i) => m.sender !== 'bot' || i > 0) // drop the seeded welcome message from what we send upstream
      .map((m) => ({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.text }))
      .concat([{ role: 'user', content: text }]);

    setMessages((prev) => prev.concat([{ sender: 'user', text }]));
    setUserMsg('');
    setIsTyping(true);

    try {
      const res = await fetch('/api/risk-api-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      });
      const data = await res.json();
      setMessages((prev) => prev.concat([{ sender: 'bot', text: data.reply || data.error || 'Error. Try again.' }]));
    } catch {
      setMessages((prev) => prev.concat([{ sender: 'bot', text: t.chatConnectionError }]));
    }
    setIsTyping(false);
  };

  return (
    <>
      {isOpen && (
        <div className="fixed bottom-20 right-4 sm:right-6 z-50 w-[calc(100vw-2rem)] max-w-sm h-[28rem] bg-slate-950 border-2 border-purple-500/40 rounded-lg shadow-[0_0_30px_rgba(153,69,255,0.25)] flex flex-col overflow-hidden font-mono">
          <div className="flex items-center justify-between px-4 py-3 border-b border-purple-500/20 bg-slate-900/60">
            <span className="text-xs font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400">
              {t.chatTitle}
            </span>
            <button onClick={() => setIsOpen(false)} className="text-slate-500 hover:text-white transition">
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
            {messages.map((m, i) => (
              <div
                key={i}
                className={
                  'text-xs rounded-lg px-3 py-2 max-w-[85%] leading-relaxed ' +
                  (m.sender === 'user'
                    ? 'bg-purple-500/20 text-purple-100 ml-auto'
                    : 'bg-slate-900 border border-purple-500/10 text-slate-300')
                }
              >
                {m.text}
              </div>
            ))}
            {isTyping && <div className="text-xs text-slate-500 px-3 py-2">···</div>}
            <div ref={endRef} />
          </div>

          <div className="flex items-center gap-2 p-3 border-t border-purple-500/20">
            <input
              type="text"
              value={userMsg}
              onChange={(e) => setUserMsg(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSend();
              }}
              disabled={blocked}
              placeholder={blocked ? t.chatLimitReached.slice(0, 30) + '...' : t.chatPlaceholder}
              className="flex-1 bg-slate-900 border border-purple-500/20 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-purple-500 focus:outline-none disabled:opacity-40"
            />
            <button
              onClick={handleSend}
              disabled={blocked || isTyping || !userMsg.trim()}
              className="w-8 h-8 shrink-0 bg-gradient-to-tr from-purple-500 to-emerald-400 rounded-lg flex items-center justify-center disabled:opacity-40 transition hover:scale-105"
            >
              <Send size={14} className="text-slate-950" />
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setIsOpen((v) => !v)}
        title={t.chatBubbleLabel}
        className="fixed bottom-4 right-4 sm:right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-tr from-purple-500 to-emerald-400 shadow-[0_0_20px_rgba(153,69,255,0.4)] flex items-center justify-center hover:scale-105 transition"
      >
        {isOpen ? <X size={22} className="text-slate-950" /> : <MessageCircle size={22} className="text-slate-950" />}
      </button>
    </>
  );
}
