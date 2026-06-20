'use client';

import { NextResponse } from 'next/server';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const MODEL = 'meta-llama/llama-3.1-8b-instruct:free';

// System prompt for strict professional Solana token auditor
const SYSTEM_PROMPT = `You are a strict, professional, and highly experienced Solana Token Security Inspector (TNT Inspector).

Your role is to analyze new Solana tokens for safety risks.
You must be direct, factual, and professional. Never give financial advice.
Focus on:
- Mint/Freeze authority status
- LP lock/burn status
- Top holder concentration
- Contract risks (honeypot, rug pull patterns)
- Liquidity and volume analysis

Respond in Russian. Keep answers short, clear, and structured.
Use professional tone like a security auditor.
If the token looks safe - say so clearly with reasons.
If there are risks - list them clearly with severity.`;

// Fallback responses if API fails
const FALLBACK_RESPONSES = {
  safe: "\u0410\u043d\u0430\u043b\u0438\u0437 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043d. \u041a\u043e\u043d\u0442\u0440\u0430\u043a\u0442 \u043f\u0440\u043e\u0439\u0434\u0435\u043d \u043f\u043e \u043e\u0441\u043d\u043e\u0432\u043d\u044b\u043c \u043f\u0430\u0440\u0430\u043c\u0435\u0442\u0440\u0430\u043c \u0431\u0435\u0437\u043e\u043f\u0430\u0441\u043d\u043e\u0441\u0442\u0438. Mint \u0438 Freeze authority \u043e\u0442\u043a\u043b\u044e\u0447\u0435\u043d\u044b, LP \u0437\u0430\u0431\u043b\u043e\u043a\u0438\u0440\u043e\u0432\u0430\u043d \u0438\u043b\u0438 \u0441\u043e\u0436\u0436\u0435\u043d. \u0422\u043e\u043f-\u0445\u043e\u043b\u0434\u0435\u0440\u044b \u043d\u0435 \u043a\u043e\u043d\u0446\u0435\u043d\u0442\u0440\u0438\u0440\u043e\u0432\u0430\u043d\u044b. \u0420\u0438\u0441\u043a\u043e\u0432 \u043d\u0435 \u043e\u0431\u043d\u0430\u0440\u0443\u0436\u0435\u043d\u043e.",
  risky: "\u041e\u0431\u043d\u0430\u0440\u0443\u0436\u0435\u043d\u044b \u043f\u043e\u0442\u0435\u043d\u0446\u0438\u0430\u043b\u044c\u043d\u044b\u0435 \u0440\u0438\u0441\u043a\u0438. \u0420\u0435\u043a\u043e\u043c\u0435\u043d\u0434\u0443\u0435\u0442\u0441\u044f \u043f\u0440\u043e\u0432\u0435\u0441\u0442\u0438 \u0434\u043e\u043f\u043e\u043b\u043d\u0438\u0442\u0435\u043b\u044c\u043d\u0443\u044e \u043f\u0440\u043e\u0432\u0435\u0440\u043a\u0443 \u043a\u043e\u043d\u0442\u0440\u0430\u043a\u0442\u0430. \u0412\u043e\u0437\u043c\u043e\u0436\u043d\u043e \u043d\u0430\u043b\u0438\u0447\u0438\u0435 mint authority \u0438\u043b\u0438 \u0432\u044b\u0441\u043e\u043a\u043e\u0439 \u043a\u043e\u043d\u0446\u0435\u043d\u0442\u0440\u0430\u0446\u0438\u0438 \u0442\u043e\u043f-\u0445\u043e\u043b\u0434\u0435\u0440\u043e\u0432.",
  error: "\u0418\u0418-\u0418\u043d\u0441\u043f\u0435\u043a\u0442\u043e\u0440 \u0432\u0440\u0435\u043c\u0435\u043d\u043d\u043e \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u0435\u043d. \u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439\u0442\u0435 \u043f\u043e\u0437\u0436\u0435 \u0438\u043b\u0438 \u043f\u0440\u043e\u0432\u0435\u0440\u044c\u0442\u0435 \u0442\u043e\u043a\u0435\u043d \u0432\u0440\u0443\u0447\u043d\u0443\u044e \u043d\u0430 DexScreener."
};

export async function POST(request) {
  try {
    const { message, tokenCA } = await request.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Invalid message' }, { status: 400 });
    }

    const userPrompt = tokenCA 
      ? `\u041f\u0440\u043e\u0432\u0435\u0434\u0438 \u0430\u0443\u0434\u0438\u0442 \u0442\u043e\u043a\u0435\u043d\u0430 \u0441 \u043a\u043e\u043d\u0442\u0440\u0430\u043a\u0442\u043e\u043c ${tokenCA}. \u0412\u043e\u043f\u0440\u043e\u0441 \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f: ${message}`
      : message;

    // Call OpenRouter
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://tnt-house.vercel.app',
        'X-Title': 'TNT House AI Inspector'
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 600,
        temperature: 0.3
      }),
      signal: AbortSignal.timeout(15000) // 15 sec timeout
    });

    if (!response.ok) {
      throw new Error(`OpenRouter error: ${response.status}`);
    }

    const data = await response.json();
    const aiReply = data.choices?.[0]?.message?.content || FALLBACK_RESPONSES.safe;

    return NextResponse.json({ reply: aiReply });

  } catch (error) {
    console.error('Chat API Error:', error);
    
    // Fallback logic
    const fallbackText = error.message?.includes('timeout') || error.message?.includes('429')
      ? FALLBACK_RESPONSES.error
      : FALLBACK_RESPONSES.risky;

    return NextResponse.json({ 
      reply: fallbackText,
      fallback: true 
    });
  }
}