// Version 1.3 — app/api/chat/route.js
//
// v1.3 (2026-09-11): server-side rate limit and input guard. This route
// had neither. The only cap on it was a counter in React state, so
// anyone could POST here in a loop and every request was a paid DeepSeek
// call on our account. Now 30 messages / 10 minutes per IP+User-Agent,
// enforced in Redis — the same numbers the widget already showed the
// visitor — and the incoming history is rebuilt from scratch rather than
// forwarded as received. See lib/chat-limit.ts for why it fails closed.
//
// v1.2 (2026-08-27): switched from Groq (openai/gpt-oss-20b) to
// DeepSeek (deepseek-v4-flash) per product-owner decision — existing
// funded DeepSeek account was going unused. Verified deepseek-v4-flash
// is the current model ID first: the legacy 'deepseek-chat' alias
// (used by the old, unused app/api/deepseek-chat/route.js in this
// repo) was retired by DeepSeek on 2026-07-24 with no fallback — would
// have repeated the exact same silent-breakage pattern as the Groq
// deprecation below if migrated to blindly. Same alertAdmin() wiring,
// updated service-name string. V4-Flash defaults to non-thinking mode,
// sidestepping the reasoning-token/empty-content issue gpt-oss-20b had.
//
// v1.1 (2026-08-27): Groq deprecated llama-3.1-8b-instant (shutdown
// Aug 16, 2026 — console.groq.com/docs/deprecations). Every request
// had been failing with a 500 "model does not exist" error since then.
// Migrated to openai/gpt-oss-20b, Groq's own recommended replacement.
// Same fix applied to app/api/risk-api-chat/route.ts. Also wired up
// alertAdmin() on the error path so a repeat of this class of failure
// pings the admin Telegram chat instead of going unnoticed for days.

import { alertAdmin } from '../../../lib/telegram-alert';
import { checkDeepSeekBalanceIfDue } from '../../../lib/deepseek-balance';
import {
  consumeChatQuota,
  extractClientIp,
  sanitizeMessages,
} from '../../../lib/chat-limit';

export const runtime = 'edge';

const SYSTEM_PROMPT = `Ты — ИИ-Инспектор TNT House, платформы безопасного листинга токенов Solana.

ЯЗЫК: Отвечай на том языке, на котором задан вопрос — это касается ВСЕГО ответа целиком, включая отказ не по теме и рекламную приписку в конце (ниже даны только как пример на русском, переводи их смысл на язык вопроса).

ЖЁСТКОЕ ОГРАНИЧЕНИЕ ТЕМЫ:
- Ты отвечаешь ТОЛЬКО на вопросы про TNT House, $MRDT, аудит токенов, безопасность Solana-токенов и функции этого сайта
- Если вопрос НЕ по теме (личные проблемы, посторонние темы, general chit-chat, вопросы не про крипту/сайт) — вежливо откажи ОДНИМ коротким предложением на языке вопроса и предложи спросить про TNT House или $MRDT. Не отвечай на сам посторонний вопрос вообще
- Пример отказа (на русском — переведи смысл на язык вопроса): "Я отвечаю только на вопросы про TNT House и $MRDT — спроси меня про аудит токена или как тут всё работает 🛡️"

Правила для вопросов по теме:
- Отвечай КОРОТКО — максимум 3 предложения
- Если пользователь вставил CA-адрес Solana — дай краткий поверхностный вывод по общим признакам (длина адреса, формат). Не придумывай данные которых у тебя нет
- В конце КАЖДОГО ответа по теме добавляй новую строку с рекламной припиской на языке вопроса, по смыслу как: "💎 Полный аудит + листинг в таблицу → от $10" (эмодзи 💎 оставляй всегда, сумму $10 не переводи)
- Не давай развёрнутых технических деталей — это платная функция
- Ты знаешь: $MRDT (MaradonaToken) — утилити-токен TNT House на Solana, CA: 8Q22r9qUm4AzFzTpZgaPYMxqq4z5WxE9FVa7X9dsvmBg
- TNT House: платформа AI-аудита токенов, тарифы: Базовый $10, Быстрый $40, VIP $120`;

export async function POST(request) {
  try {
    // Quota first — before parsing a body or spending anything upstream.
    var ip = extractClientIp(request.headers);
    var userAgent = request.headers.get('user-agent') || 'unknown';
    var quota = await consumeChatQuota('site', ip, userAgent);

    if (!quota.allowed) {
      var quotaMessage =
        quota.reason === 'unavailable'
          ? 'Chat is temporarily unavailable. Please try again shortly.'
          : 'Too many messages. Please wait a few minutes before continuing.';
      return new Response(
        JSON.stringify({ error: quotaMessage, retry_after_seconds: quota.retryAfterSeconds }),
        {
          status: quota.reason === 'unavailable' ? 503 : 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(quota.retryAfterSeconds),
          },
        },
      );
    }

    var body = await request.json();
    var sanitized = sanitizeMessages(body.messages || []);
    if (!sanitized.ok) {
      return new Response(JSON.stringify({ error: sanitized.error }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    var messages = sanitized.messages;

    var dsRes = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + process.env.DEEPSEEK_API_KEY,
      },
      body: JSON.stringify({
        model: 'deepseek-v4-flash', // legacy alias 'deepseek-chat' retired by DeepSeek on 2026-07-24 (no fallback)
        max_tokens: 600,
        temperature: 0.7,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...messages,
        ],
      }),
    });

    if (!dsRes.ok) {
      var errText = await dsRes.text();
      await alertAdmin('deepseek-chat-main-site', dsRes.status + ' — ' + errText);
      return new Response(JSON.stringify({ error: 'DeepSeek error: ' + errText }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    var data = await dsRes.json();
    var reply = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content
      ? data.choices[0].message.content
      : 'Не смог получить ответ. Попробуй ещё раз.';

    if (reply === 'Не смог получить ответ. Попробуй ещё раз.') {
      await alertAdmin('deepseek-chat-main-site-empty-content', JSON.stringify(data).slice(0, 500));
    }

    checkDeepSeekBalanceIfDue(); // fire-and-forget, cooldown-throttled — see lib/deepseek-balance.ts

    return new Response(JSON.stringify({ reply: reply }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
