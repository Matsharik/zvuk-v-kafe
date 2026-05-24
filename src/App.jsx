import React from 'react';
import { useAuth } from './context/AuthContext';

// Импортируем все наши экраны (Views)
import AuthView from './views/AuthView';
import RoleSelection from './views/RoleSelection';
import CafeRegistration from './views/CafeRegistration';
import CafeDashboard from './views/CafeDashboard';
import MusicianDashboard from './views/MusicianDashboard';

export default function App() {
  const { user, profile, cafeDetails, loading } = useAuth();

  // 1. Пока Supabase проверяет токены в LocalStorage, показываем экран загрузки
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 text-indigo-400">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500 mr-3"></div>
        <span className="font-sans text-sm font-medium">Синхронизация сессии...</span>
      </div>
    );
  }

  // 2. Если пользователь НЕ залогинен — жестко отправляем его на авторизацию Telegram
  if (!user) {
    return <AuthView />;
  }

  // 3. Если юзер залогинен, но записи в `profiles` еще нет — отправляем выбирать роль
  if (!profile) {
    return <RoleSelection />;
  }

  // 4. ЕСЛИ ЮЗЕР — КАФЕ (Разбираем твою задачу)
  if (profile.role === 'cafe') {
    // ПРОВЕРКА: Если адрес или координаты еще не заполнены — принудительно открываем регистрацию
    const isNewCafe = !cafeDetails?.address || !cafeDetails?.latitude || !cafeDetails?.longitude;
    
    if (isNewCafe) {
      return <CafeRegistration />;
    }

    // Если всё заполнено — пускаем в основной дешборд с картой
    return <CafeDashboard />;
  }

  // 5. ЕСЛИ ЮЗЕР — МУЗЫКАНТ
  if (profile.role === 'musician') {
    return <MusicianDashboard />;
  }

  // Заглушка на случай непредвиденных ролей
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 text-white">
      <p>Ошибка: Неизвестная роль аккаунта.</p>
    </div>
  );
}