  const handleSendChat = async () => {
    if (!userMsg.trim()) return;

    const userMessage = { sender: 'user', text: userMsg };
    setChatMessages(prev => [...prev, userMessage]);
    const currentMsg = userMsg;
    setUserMsg('');
    setIsTyping(true);

    try {
      const res = await fetch('/api/deepseek-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: currentMsg })
      });

      const data = await res.json();

      if (data.reply) {
        const botMessage = { sender: 'bot', text: data.reply };
        setChatMessages(prev => [...prev, botMessage]);
      } else {
        const errorMsg = { sender: 'bot', text: 'Извини, произошла ошибка. Попробуй ещё раз.' };
        setChatMessages(prev => [...prev, errorMsg]);
      }
    } catch (err) {
      console.error('Chat error:', err);
      const errorMsg = { sender: 'bot', text: 'Не удалось связаться с ИИ. Проверь подключение.' };
      setChatMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };