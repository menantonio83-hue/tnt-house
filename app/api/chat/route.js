// app/api/chat/route.js
// Server-side route — GROQ_API_KEY stays hidden in .env
//
// v1.1 (2026-08-27): Groq deprecated llama-3.1-8b-instant (shutdown
// Aug 16, 2026 — console.groq.com/docs/deprecations). Every request
// had been failing with a 500 "model does not exist" error since then.
// Migrated to openai/gpt-oss-20b, Groq's own recommended replacement.
// Same fix applied to app/api/risk-api-chat/route.ts. Also wired up
// alertAdmin() on the error path so a repeat of this class of failure
// pings the admin Telegram chat instead of going unnoticed for days.

import { alertAdmin } from '../../../lib/telegram-alert';

export const runtime = 'edge';

const SYSTEM_PROMPT = `Ты — ИИ-Инспектор TNT House, платформы безопасного листинга токенов Solana.

ЖЁСТКОЕ ОГРАНИЧЕНИЕ ТЕМЫ:
- Ты отвечаешь ТОЛЬКО на вопросы про TNT House, $MRDT, аудит токенов, безопасность Solana-токенов и функции этого сайта
- Если вопрос НЕ по теме (личные проблемы, посторонние темы, general chit-chat, вопросы не про крипту/сайт) — вежливо откажи ОДНИМ коротким предложением и предложи спросить про TNT House или $MRDT. Не отвечай на сам посторонний вопрос вообще
- Пример отказа: "Я отвечаю только на вопросы про TNT House и $MRDT — спроси меня про аудит токена или как тут всё работает 🛡️"

Правила для вопросов по теме:
- Отвечай КОРОТКО — максимум 3 предложения
- Всегда на русском языке
- Если пользователь вставил CA-адрес Solana — дай краткий поверхностный вывод по общим признакам (длина адреса, формат). Не придумывай данные которых у тебя нет
- В конце КАЖДОГО ответа по теме добавляй новую строку: "💎 Полный аудит + листинг в таблицу → от $10"
- Не давай развёрнутых технических деталей — это платная функция
- Ты знаешь: $MRDT (MaradonaToken) — утилити-токен TNT House на Solana, CA: 8Q22r9qUm4AzFzTpZgaPYMxqq4z5WxE9FVa7X9dsvmBg
- TNT House: платформа AI-аудита токенов, тарифы: Базовый $10, Быстрый $40, VIP $120`;

export async function POST(request) {
  try {
    var body = await request.json();
    var messages = body.messages || [];

    var groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + process.env.GROQ_API_KEY,
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-20b', // free, fast — Groq's recommended replacement for the deprecated llama-3.1-8b-instant
        max_tokens: 600, // was 200 — too low for a reasoning model, see reasoning_effort note below
        temperature: 0.7,
        // gpt-oss-20b spends tokens on internal reasoning before the
        // actual answer (defaults to reasoning_effort "medium"); with a
        // small max_tokens budget that could eat the whole budget and
        // leave message.content empty. 'low' minimizes that for this
        // short Q&A use case — same fix as app/api/risk-api-chat/route.ts.
        reasoning_effort: 'low',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...messages,
        ],
      }),
    });

    if (!groqRes.ok) {
      var errText = await groqRes.text();
      await alertAdmin('groq-chat-main-site', groqRes.status + ' — ' + errText);
      return new Response(JSON.stringify({ error: 'Groq error: ' + errText }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    var data = await groqRes.json();
    var reply = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content
      ? data.choices[0].message.content
      : 'Не смог получить ответ. Попробуй ещё раз.';

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
