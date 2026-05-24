import React, { useEffect, useState } from 'react';
import { supabase } from '../api/supabaseClient';

export default function AuthView() {
  const [error, setError] = useState(null);
  const [isTelegram, setIsTelegram] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Проверяем, запущено ли приложение внутри реального Telegram WebApp
    const tg = window.Telegram?.WebApp;
    
    if (tg && tg.initData && Object.keys(tg.initDataUnsafe).length > 0) {
      setIsTelegram(true);
      tg.expand(); // Раскрываем приложение на весь экран смартфона
      
      handleTelegramAuth();
    }
  }, []);

  // БЕЗОПАСНАЯ АВТОРИЗАЦИЯ: Отправка сырых данных на бэкенд (Edge Function)
  const handleTelegramAuth = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const initData = window.Telegram?.WebApp?.initData;

      if (!initData) {
        throw new Error('Telegram initData пуст. Откройте приложение внутри мессенджера.');
      }

      // Вызываем бэкенд-функцию проверки подписи в Supabase
      const { data, error: functionError } = await supabase.functions.invoke('telegram-auth', {
        body: { initData: initData }
      });

      if (functionError || !data?.session) {
        throw new Error(data?.error || functionError?.message || 'Ошибка верификации данных.');
      }

      // Принудительно устанавливаем валидную сессию в клиент Supabase
      const { error: setSessionError } = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token
      });

      if (setSessionError) throw setSessionError;

    } catch (err) {
      console.error('Критическая ошибка авторизации:', err.message);
      setError(`Ошибка входа: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // РЕЖИМ РАЗРАБОТЧИКА: Быстрый локальный вход с компьютера (в обход проверки Telegram)
  const handleDevLogin = async (type) => {
    setLoading(true);
    setError(null);
    
    // Генерируем фиксированные тестовые ID для локальной разработки
    const testId = type === 'musician' ? 'dev_musician_2026' : 'dev_cafe_2026';
    const fakeEmail = `test_${testId}@zvukvkafe.local`;
    const fakePassword = `secure_dev_password_${testId}`;

    try {
      // Пытаемся войти под существующим тестовым юзером
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: fakeEmail,
        password: fakePassword,
      });

      // Если такого тестового юзера в твоем локальном Supabase еще нет — создаем его
      if (signInError && signInError.message.includes('Invalid login credentials')) {
        const { error: signUpError } = await supabase.auth.signUp({
          email: fakeEmail,
          password: fakePassword,
          options: {
            data: {
              first_name: type === 'musician' ? '🎭 Тест Артист' : '☕ Тест Кафе',
              username: `dev_${type}`
            }
          }
        });

        if (signUpError) throw signUpError;
        
        // Повторный вход после автоматической регистрации
        await supabase.auth.signInWithPassword({ email: fakeEmail, password: fakePassword });
      } else if (signInError) {
        throw signInError;
      }

    } catch (err) {
      console.error('Ошибка режима разработки:', err.message);
      setError(`Ошибка Dev-входа: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-900 p-6 text-white font-sans">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-slate-800 p-8 shadow-2xl border border-slate-700/50 text-center">
        
        {/* Логотип и Описание */}
        <div className="space-y-2">
          <h1 className="text-4xl font-black tracking-tight bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
            Звук в Кафе 🎸
          </h1>
          <p className="text-slate-400 text-sm max-w-xs mx-auto">
            B2B-синхронизация уличных артистов и городских локаций в Беларуси
          </p>
        </div>

        {/* Индикатор загрузки / Ожидания ответа бэкенда */}
        {loading && (
          <div className="py-6 space-y-3">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500 mx-auto"></div>
            <p className="text-indigo-400 text-sm animate-pulse">Защищенная авторизация...</p>
          </div>
        )}

        {/* Рендеринг интерфейса в зависимости от среды запуска */}
        {!loading && (
          <div className="py-2">
            {isTelegram ? (
              <div className="bg-indigo-950/40 border border-indigo-500/20 text-indigo-300 rounded-xl p-4 text-sm">
                Проверяем цифровую подпись вашего аккаунта Telegram...
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl p-4 text-xs text-left leading-relaxed">
                  ⚠️ <strong>Режим отладки:</strong> Приложение запущено вне Telegram. Используйте тестовые профили для программирования логики на компьютере.
                </div>
                
                <button 
                  onClick={() => handleDevLogin('musician')}
                  className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl font-semibold shadow-lg shadow-indigo-600/20 transition-all duration-200 transform active:scale-[0.98]"
                >
                  Войти как Тестовый Музыкант
                </button>
                
                <button 
                  onClick={() => handleDevLogin('cafe')}
                  className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl font-semibold shadow-lg shadow-emerald-600/20 transition-all duration-200 transform active:scale-[0.98]"
                >
                  Войти как Тестовое Кафе
                </button>
              </div>
            )}
          </div>
        )}

        {/* Вывод ошибок */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl p-4 text-sm text-left font-medium">
            {error}
          </div>
        )}

      </div>
    </div>
  );
}