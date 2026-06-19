export async function POST(request) {
  try {
    const { message } = await request.json();

    if (!message) {
      return Response.json({ error: 'Message is required' }, { status: 400 });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return Response.json({ error: 'DeepSeek API key not configured' }, { status: 500 });
    }

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: 'Ты ИИ-Инспектор TNT House. Отвечай коротко, по делу, в стиле крипто-энтузиаста. Анализируй токены, контракты и давай полезные советы по $MRDT и Solana мемкоинам. Отвечай на русском языке.'
          },
          {
            role: 'user',
            content: message
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('DeepSeek API error:', errorText);
      return Response.json({ error: 'DeepSeek API error' }, { status: 500 });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || 'Извини, не смог ответить.';

    return Response.json({ reply });

  } catch (error) {
    console.error('DeepSeek chat error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
