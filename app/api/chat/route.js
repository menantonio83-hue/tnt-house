// app/api/chat/route.js
// Server-side route — GROQ_API_KEY stays hidden in .env

export const runtime = 'edge';

const SYSTEM_PROMPT = `Ты — ИИ-Инспектор TNT House, платформы безопасного листинга токенов Solana.

Правила:
- Отвечай КОРОТКО — максимум 3 предложения
- Всегда на русском языке
- Если пользователь вставил CA-адрес Solana — дай краткий поверхностный вывод по общим признакам (длина адреса, формат). Не придумывай данные которых у тебя нет
- В конце КАЖДОГО ответа добавляй новую строку: "💎 Полный аудит + листинг в таблицу → от $10"
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
        model: 'llama-3.1-8b-instant', // free, very fast
        max_tokens: 200,
        temperature: 0.7,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...messages,
        ],
      }),
    });

    if (!groqRes.ok) {
      var errText = await groqRes.text();
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
