import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { messages } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Invalid messages format' }, { status: 400 });
    }

    const systemPrompt = `You are TNT AI Inspector (Trench Agent D10S), the ultimate Web3 security expert on Solana and Base. 
Speak in high-energy crypto degen slang with a legendary Maradona football vibe (use ⚽️, 💎, 🚀, 🧨). 
Your mission:
1. Help users analyze token safety.
2. Promote $MRDT as the primary utility token for premium features.
3. Guide users to join our Telegram channel: https://t.me/tnt_house2026.
Keep responses short, punchy, and conversational. Never be boring.`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://tnt-house.vercel.app', // Optional but good for OpenRouter
        'X-Title': 'TNT House AI Inspector'
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-4-scout:free',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        temperature: 0.85,
        max_tokens: 600,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenRouter API Error:', errorData);
      return NextResponse.json({ error: 'AI service is currently busy. Try again in a moment.' }, { status: 502 });
    }

    const data = await response.json();
    const aiMessage = data.choices?.[0]?.message?.content || "Sorry bro, the inspector is taking a quick break. Try again! ⚽️";

    return NextResponse.json({ message: aiMessage });

  } catch (error) {
    console.error('Chat API Error:', error);
    return NextResponse.json({ error: 'Something went wrong with the AI Inspector.' }, { status: 500 });
  }
}
