import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../api/supabaseClient';

export default function RoleSelection() {
  const { user, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSelectRole = async (selectedRole) => {
    if (!user) {
      setError('Пользователь не авторизован.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Извлекаем имя из метаданных, которые мы сохранили при регистрации
      const fullName = user.user_metadata?.first_name || 'Пользователь';
      const username = user.user_metadata?.username || null;

      // Записываем роль в таблицу profiles
      const { error: insertError } = await supabase
        .from('profiles')
        .insert([
          {
            id: user.id, // Связываем UUID из auth.users
            role: selectedRole,
            full_name: fullName,
            username: username,
            created_at: new Date().toISOString()
          }
        ]);

      if (insertError) {
        throw insertError;
      }

      // Если это владелец заведения, создаем для него пустую карточку в cafes
      if (selectedRole === 'cafe') {
        const { error: cafeError } = await supabase
          .from('cafes')
          .insert([
            {
              id: user.id, // Использовать тот же ID для связи один-к-одному — лучшая практика
              title: `Кафе (${fullName})`,
              is_premium: false
            }
          ]);
        
        if (cafeError) throw cafeError;
      }

      // Если это музыкант, создаем для него пустую заготовку в musicians
      if (selectedRole === 'musician') {
        const { error: musicianError } = await supabase
          .from('musicians')
          .insert([
            {
              id: user.id,
              full_name: fullName,
              is_npd: false,
              has_equipment: false
            }
          ]);

        if (musicianError) throw musicianError;
      }

      // Оповещаем AuthContext, что профиль создан, чтобы он перерендерил App.jsx
      refreshProfile();

    } catch (err) {
      console.error('Ошибка при выборе роли:', err.message);
      setError(`Не удалось сохранить выбор: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-900 p-6 text-white font-sans">
      <div className="w-full max-w-lg space-y-8 rounded-2xl bg-slate-800 p-8 shadow-2xl border border-slate-700/50 text-center">
        
        {/* Шапка */}
        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-widest text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full">
            Шаг 2 из 2
          </span>
          <h1 className="text-3xl font-black tracking-tight">Кто вы?</h1>
          <p className="text-slate-400 text-sm max-w-sm mx-auto">
            Выберите ваш тип аккаунта. Изменить этот выбор в будущем будет невозможно.
          </p>
        </div>

        {/* Вывод ошибок */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl p-4 text-sm text-left font-medium">
            {error}
          </div>
        )}

        {/* Блоки выбора ролей */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
          
          {/* Кнопка: Музыкант */}
          <button
            disabled={loading}
            onClick={() => handleSelectRole('musician')}
            className="flex flex-col items-center justify-between p-6 rounded-2xl border-2 border-slate-700 bg-slate-800/50 text-left hover:border-indigo-500 hover:bg-indigo-950/20 active:scale-[0.98] transition-all duration-200 group disabled:opacity-50 disabled:pointer-events-none"
          >
            <div className="space-y-3 w-full text-center sm:text-left">
              <div className="text-4xl mx-auto sm:mx-0 bg-indigo-500/10 w-14 h-14 rounded-xl flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-200 text-indigo-400">
                🎸
              </div>
              <h3 className="text-xl font-bold text-white group-hover:text-indigo-400 transition-colors">
                Я Музыкант
              </h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Хочу находить крутые легальные площадки для выступлений, террасы, бары и забирать лучшие слоты в Минске и регионах.
              </p>
            </div>
            <div className="mt-6 text-xs font-semibold text-indigo-400 group-hover:translate-x-1 transition-transform inline-flex items-center gap-1 w-full justify-center sm:justify-start">
              Создать профиль артиста &rarr;
            </div>
          </button>

          {/* Кнопка: Заведение */}
          <button
            disabled={loading}
            onClick={() => handleSelectRole('cafe')}
            className="flex flex-col items-center justify-between p-6 rounded-2xl border-2 border-slate-700 bg-slate-800/50 text-left hover:border-emerald-500 hover:bg-emerald-950/20 active:scale-[0.98] transition-all duration-200 group disabled:opacity-50 disabled:pointer-events-none"
          >
            <div className="space-y-3 w-full text-center sm:text-left">
              <div className="text-4xl mx-auto sm:mx-0 bg-emerald-500/10 w-14 h-14 rounded-xl flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors duration-200 text-emerald-400">
                ☕
              </div>
              <h3 className="text-xl font-bold text-white group-hover:text-emerald-400 transition-colors">
                Я Заведение
              </h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Ищу живую музыку на веранду, в ресторан или ТРЦ. Хочу бронировать проверенных артистов за пару кликов без бюрократии.
              </p>
            </div>
            <div className="mt-6 text-xs font-semibold text-emerald-400 group-hover:translate-x-1 transition-transform inline-flex items-center gap-1 w-full justify-center sm:justify-start">
              Открыть доступ к базе &rarr;
            </div>
          </button>

        </div>

        {/* Лоадер поверх интерфейса при записи */}
        {loading && (
          <div className="flex items-center justify-center gap-2 text-sm text-slate-400 pt-2 animate-pulse">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            Конфигурируем рабочее пространство...
          </div>
        )}

      </div>
    </div>
  );
}