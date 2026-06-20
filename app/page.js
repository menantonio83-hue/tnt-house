'use client';

import React, { useState, useEffect } from 'react';

export default function TntHouse() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(false);
  }, []);

  if (loading) return <div className="min-h-screen bg-black text-white flex items-center justify-center text-xl">Загрузка...</div>;

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <h1 className="text-3xl font-bold text-purple-400">TNT HOUSE</h1>
      <p className="text-gray-400 mt-2">Безопасная площадка для новых токенов Solana</p>
      <div className="mt-8 p-6 bg-gray-900 rounded-lg border border-purple-500/30">
        <h2 className="text-xl font-bold mb-4">🔍 Заказать ИИ-инспекцию</h2>
        <div className="space-y-4">
          <input type="text" placeholder="Название проекта" className="w-full p-3 bg-gray-800 border border-gray-700 rounded-xl text-white" />
          <input type="text" placeholder="Contract Address (Solana)" className="w-full p-3 bg-gray-800 border border-gray-700 rounded-xl text-white" />
          <input type="email" placeholder="Email для связи" className="w-full p-3 bg-gray-800 border border-gray-700 rounded-xl text-white" />
          <button className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-3 px-6 rounded-xl font-semibold hover:opacity-90 transition">
            Далее →
          </button>
        </div>
      </div>
    </div>
  );
}