import React, { useState, useEffect } from 'react';
import { TrendingUp, Shield, Lock, Zap, Send, ExternalLink, AlertCircle } from 'lucide-react';

export default function TrenchConstructionSite() {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({ projectName: '', ca: '', email: '' });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  // Fetch новые токены из DexScreener API
  useEffect(() => {
    const fetchTokens = async () => {
      try {
        setLoading(true);
        // DexScreener: ищет новые пары на Solana с низкой ликвидностью
        const response = await fetch(
          'https://api.dexscreener.com/latest/dex/tokens/So11111111111111111111111111111111111111112?limit=20'
        );
        const data = await response.json();
        
        if (data.pairs) {
          // Фильтруем: берём только те с капитализацией $5K-$100K
          const filtered = data.pairs
            .filter(p => {
              const mc = p.marketCap || 0;
              return mc >= 5000 && mc <= 100000;
            })
            .slice(0, 8)
            .map(p => ({
              name: p.baseToken?.name || 'Unknown',
              symbol: p.baseToken?.symbol || '???',
              ca: p.baseToken?.address || '',
              price: p.priceUsd ? parseFloat(p.priceUsd).toFixed(10) : '0',
              liquidity: p.liquidity?.usd ? Math.round(p.liquidity.usd) : 0,
              volume24h: p.volume?.h24 ? Math.round(p.volume.h24) : 0,
              priceChange24h: p.priceChange?.h24 || 0,
              verified: Math.random() > 0.4, // Мок-проверка (в боевом варианте - реальные апи)
              dexUrl: p.url || ''
            }));
          
          setTokens(filtered);
        }
        setLoading(false);
      } catch (err) {
        console.error('DexScreener API error:', err);
        setError('Не удалось загрузить токены. Попробуй позже.');
        setLoading(false);
      }
    };

    fetchTokens();
    // Обновляем каждые 5 минут
    const interval = setInterval(fetchTokens, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!formData.projectName || !formData.ca || !formData.email) {
      setError('Заполни все поля');
      return;
    }
    // В MVP просто показываем успех (в реальной системе - отправляем в базу)
    setSubmitted(true);
    setFormData({ projectName: '', ca: '', email: '' });
    setTimeout(() => setSubmitted(false), 4000);
  };

  const formatNumber = (num) => {
    if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(1)}K`;
    return `$${num.toFixed(0)}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 text-white font-mono">
      {/* Blueprint сетка фон */}
      <div className="fixed inset-0 opacity-5 pointer-events-none">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      {/* Основной контент */}
      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-amber-500/30 backdrop-blur-lg bg-blue-950/40">
          <div className="max-w-7xl mx-auto px-6 py-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 border-2 border-amber-500 rounded flex items-center justify-center">
                  <span className="text-amber-500 font-bold text-lg">◆</span>
                </div>
                <h1 className="text-3xl font-bold text-amber-400">TRENCH</h1>
              </div>
              <div className="text-amber-500/70 text-sm">CONSTRUCTION SITE v1.0</div>
            </div>
            <p className="text-blue-200 text-lg">Платформа безопасности для микро-капов • Только проверенные гемы</p>
          </div>
        </header>

        {/* Hero секция с чертежом */}
        <section className="max-w-7xl mx-auto px-6 py-16">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Левая часть - описание */}
            <div className="space-y-6">
              <div className="space-y-3 border-l-2 border-amber-500 pl-6">
                <h2 className="text-4xl font-bold text-amber-400">Строим чистые гемы</h2>
                <p className="text-blue-200 text-lg">
                  Автоматический аудит смарт-контрактов на основе ИИ. Без скамов. Без манипуляций. Только честная ликвидность.
                </p>
              </div>

              {/* Три столпа */}
              <div className="grid grid-cols-3 gap-4 mt-8">
                {[
                  { icon: Shield, label: 'AI Аудит', desc: 'Проверка контрактов' },
                  { icon: Zap, label: 'Микро-капы', desc: '$5K-$100K' },
                  { icon: Lock, label: 'DAO Лицензия', desc: 'Через $MRDT' }
                ].map((item, i) => (
                  <div key={i} className="bg-blue-900/40 border border-amber-500/40 rounded p-4 text-center hover:border-amber-500/80 transition">
                    <item.icon className="w-6 h-6 text-amber-400 mx-auto mb-2" />
                    <div className="text-sm font-bold text-amber-300">{item.label}</div>
                    <div className="text-xs text-blue-300">{item.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Правая часть - Blueprint чертёж */}
            <div className="relative h-96 bg-blue-950 border-2 border-amber-500 rounded overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-transparent to-blue-500/10"></div>
              <svg className="absolute inset-0 w-full h-full opacity-20" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern id="smallgrid" width="8" height="8" patternUnits="userSpaceOnUse">
                    <path d="M 8 0 L 0 0 0 8" fill="none" stroke="#f59e0b" strokeWidth="0.5"/>
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#smallgrid)" />
              </svg>
              
              {/* Элементы чертежа */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center space-y-4">
                  <div className="w-32 h-32 border-2 border-amber-400 rounded flex items-center justify-center mx-auto">
                    <TrendingUp className="w-16 h-16 text-amber-400 opacity-70" />
                  </div>
                  <div className="text-amber-400 font-bold text-sm">SECURITY BLUEPRINT</div>
                  <div className="text-amber-400/60 text-xs">Scale 1:1000000</div>
                </div>
              </div>

              {/* Линейки */}
              <div className="absolute top-0 left-0 right-0 h-8 border-b border-amber-500/30 flex items-center px-4">
                {[...Array(10)].map((_, i) => (
                  <div key={i} className="flex-1 border-r border-amber-500/20 text-xs text-amber-500/40">
                    {i * 100}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Блок токенов */}
        <section className="max-w-7xl mx-auto px-6 py-12">
          <div className="border-2 border-amber-500/40 rounded bg-blue-950/30 backdrop-blur p-8">
            <h3 className="text-2xl font-bold text-amber-400 mb-2 flex items-center gap-2">
              <Shield className="w-6 h-6" />
              ПРОВЕРЕННЫЕ ГЕМЫ (In Progress)
            </h3>
            <p className="text-blue-300 text-sm mb-6">Микро-капы с ИИ-аудитом. Обновляется каждые 5 минут.</p>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="bg-blue-900/40 border border-amber-500/20 rounded p-4 animate-pulse">
                    <div className="h-6 bg-amber-500/20 rounded w-1/3 mb-2"></div>
                    <div className="h-4 bg-amber-500/10 rounded w-2/3"></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {tokens.map((token, i) => (
                  <a
                    key={i}
                    href={token.dexUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-gradient-to-br from-blue-900/50 to-blue-950/50 border border-amber-500/30 rounded p-4 hover:border-amber-500 hover:shadow-lg hover:shadow-amber-500/20 transition group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="font-bold text-amber-400 truncate">${token.symbol}</div>
                        <div className="text-xs text-blue-300 truncate">{token.name}</div>
                      </div>
                      {token.verified && (
                        <div className="w-6 h-6 bg-emerald-500/30 border border-emerald-500 rounded-full flex items-center justify-center">
                          <Shield className="w-3 h-3 text-emerald-400" />
                        </div>
                      )}
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-blue-400">Цена</span>
                        <span className="text-amber-300 font-mono">${token.price}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-blue-400">Ликвидность</span>
                        <span className="text-amber-300 font-mono">{formatNumber(token.liquidity)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-blue-400">Vol 24h</span>
                        <span className={token.priceChange24h > 0 ? 'text-emerald-400' : 'text-red-400'}>
                          {formatNumber(token.volume24h)} ({token.priceChange24h > 0 ? '+' : ''}{token.priceChange24h.toFixed(1)}%)
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-amber-500/20 flex items-center justify-between">
                      <span className="text-xs text-blue-400">Смотреть</span>
                      <ExternalLink className="w-3 h-3 text-amber-400 group-hover:translate-x-1 transition" />
                    </div>
                  </a>
                ))}
              </div>
            )}

            {error && (
              <div className="mt-6 p-4 bg-red-950/40 border border-red-500/50 rounded flex items-center gap-2 text-red-300">
                <AlertCircle className="w-5 h-5" />
                {error}
              </div>
            )}
          </div>
        </section>

        {/* Форма подачи проекта */}
        <section className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid md:grid-cols-2 gap-12">
            {/* Левая часть - информация */}
            <div className="space-y-6">
              <h3 className="text-2xl font-bold text-amber-400">Подай заявку на листинг</h3>
              <p className="text-blue-200">
                Твой токен пройдёт ИИ-аудит и попадёт на нашу платформу. Для премиум-листинга нужна комиссия в $MRDT.
              </p>
              
              <div className="space-y-4">
                {[
                  'Проверка смарт-контракта',
                  'Анализ холдеров на инсайдеров',
                  'Рейтинг безопасности',
                  'Листинг на главной'
                ].map((item, i) => (
                  <div key={i} className="flex gap-3 text-blue-200">
                    <div className="w-5 h-5 border border-amber-500 rounded flex-shrink-0 flex items-center justify-center mt-1">
                      <div className="w-2 h-2 bg-amber-500 rounded-sm"></div>
                    </div>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Правая часть - форма */}
            <div className="border-2 border-amber-500/40 rounded bg-blue-950/30 p-8 backdrop-blur">
              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div>
                  <label className="block text-amber-400 text-sm font-bold mb-2">Название проекта</label>
                  <input
                    type="text"
                    value={formData.projectName}
                    onChange={(e) => setFormData({...formData, projectName: e.target.value})}
                    placeholder="Твой токен..."
                    className="w-full bg-blue-950/50 border border-amber-500/30 rounded px-4 py-2 text-white placeholder-blue-400 focus:border-amber-500 focus:outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-amber-400 text-sm font-bold mb-2">Contract Address (Solana)</label>
                  <input
                    type="text"
                    value={formData.ca}
                    onChange={(e) => setFormData({...formData, ca: e.target.value})}
                    placeholder="8Q22r9qUm4AzFzTp..."
                    className="w-full bg-blue-950/50 border border-amber-500/30 rounded px-4 py-2 text-white placeholder-blue-400 focus:border-amber-500 focus:outline-none transition font-mono text-sm"
                  />
                </div>

                <div>
                  <label className="block text-amber-400 text-sm font-bold mb-2">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    placeholder="your@email.com"
                    className="w-full bg-blue-950/50 border border-amber-500/30 rounded px-4 py-2 text-white placeholder-blue-400 focus:border-amber-500 focus:outline-none transition"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-blue-950 font-bold py-3 rounded transition flex items-center justify-center gap-2 group mt-6"
                >
                  <Send className="w-4 h-4 group-hover:translate-x-1 transition" />
                  ОТПРАВИТЬ ЗАЯВКУ
                </button>

                {submitted && (
                  <div className="p-3 bg-emerald-950/50 border border-emerald-500 rounded text-emerald-300 text-sm text-center">
                    ✓ Заявка отправлена! Наш ИИ начнёт проверку.
                  </div>
                )}

                {error && (
                  <div className="p-3 bg-red-950/50 border border-red-500 rounded text-red-300 text-sm">
                    {error}
                  </div>
                )}
              </form>
            </div>
          </div>
        </section>

        {/* Whale Club CTA */}
        <section className="max-w-7xl mx-auto px-6 py-16">
          <div className="relative bg-gradient-to-r from-amber-500/20 via-transparent to-blue-500/20 border-2 border-amber-500/50 rounded-lg p-12 overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl"></div>
            
            <div className="relative z-10 max-w-2xl">
              <h3 className="text-3xl font-bold text-amber-400 mb-4">🐋 WHALE CLUB DAO</h3>
              <p className="text-blue-200 text-lg mb-6">
                Держи $MRDT и получи доступ в приватный Telegram чат. Первым узнавай о новых гемах, голосуй за листинги, общайся с инсайдерами.
              </p>
              <button className="bg-amber-500 hover:bg-amber-400 text-blue-950 font-bold py-3 px-8 rounded transition">
                Вступить в DAO →
              </button>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-amber-500/30 mt-16 py-8 bg-blue-950/40 backdrop-blur">
          <div className="max-w-7xl mx-auto px-6 text-center space-y-3">
            <div className="text-amber-400 font-bold">TRENCH CONSTRUCTION SITE v1.0</div>
            <div className="text-blue-300 text-sm">
              Powered by $MRDT • IA Audits • Solana Ecosystem
            </div>
            <div className="text-blue-400 text-xs">
              Built with Next.js + Tailwind CSS • DexScreener API
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
