import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../api/supabaseClient';
import L from 'leaflet';

// Фикс дефолтных иконок Leaflet
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
const musicianIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

// Список административных районов Минска для чекбоксов
const MINSK_DISTRICTS = [
  'Центральный', 'Советский', 'Первомайский', 'Партизанский', 
  'Ленинский', 'Октябрьском', 'Московский', 'Фрунзенский', 'Заводской'
];

// Другие популярные локации / регионы
const OTHER_REGIONS = ['Минский район', 'Областные города', 'Другие регионы Беларуси'];

// Компонент обработки кликов по карте для установки маркера
function MapClickHandler({ onLocationSelect }) {
  useMapEvents({
    click(e) {
      onLocationSelect([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}

export default function MusicianDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  // Стейт анкеты музыканта
  const [formData, setFormData] = useState({
    full_name: '',
    genre: '',
    format: '',
    has_equipment: false,
    is_npd: false,
    media_links: ['', ''], // Две заготовки под ссылки
    phone_hidden: '',
    telegram_hidden: '',
    target_locations: [] // Выбранные районы выезда
  });

  // Стейт координат (По умолчанию центр Минска)
  const [markerPosition, setMarkerPosition] = useState([53.9006, 27.5590]);

  useEffect(() => {
    async function loadMusicianProfile() {
      try {
        setLoading(true);
        
        const { data, error } = await supabase
          .from('musicians')
          .select('*')
          .eq('id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') throw error;

        if (data) {
          setFormData({
            full_name: data.full_name || '',
            genre: data.genre || '',
            format: data.format || '',
            has_equipment: data.has_equipment || false,
            is_npd: data.is_npd || false,
            media_links: data.media_links?.length ? [...data.media_links, ''] : ['', ''],
            phone_hidden: data.phone_hidden || '',
            telegram_hidden: data.telegram_hidden || '',
            target_locations: data.target_locations || []
          });

          if (data.latitude && data.longitude) {
            setMarkerPosition([data.latitude, data.longitude]);
          }
        }
      } catch (err) {
        console.error('Ошибка загрузки профиля:', err.message);
        setMessage({ text: 'Не удалось загрузить данные профиля.', type: 'error' });
      } finally {
        setLoading(false);
      }
    }

    if (user) loadMusicianProfile();
  }, [user]);

  // Обработка изменения текстовых полей и свитчей
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Обработка ссылок на видео
  const handleLinkChange = (index, value) => {
    const updatedLinks = [...formData.media_links];
    updatedLinks[index] = value;
    setFormData(prev => ({ ...prev, media_links: updatedLinks }));
  };

  // Обработка выбора районов (чекбоксы)
  const handleDistrictToggle = (district) => {
    setFormData(prev => {
      const current = prev.target_locations;
      const updated = current.includes(district)
        ? current.filter(d => d !== district)
        : [...current, district];
      return { ...prev, target_locations: updated };
    });
  };

  // Сохранение изменений в Supabase
  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ text: '', type: '' });

    // Фильтруем пустые медиа-ссылки перед отправкой
    const cleanMediaLinks = formData.media_links.filter(link => link.trim() !== '');

    try {
      const { error } = await supabase
        .from('musicians')
        .update({
          full_name: formData.full_name,
          genre: formData.genre,
          format: formData.format,
          has_equipment: formData.has_equipment,
          is_npd: formData.is_npd,
          media_links: cleanMediaLinks,
          phone_hidden: formData.phone_hidden,
          telegram_hidden: formData.telegram_hidden,
          target_locations: formData.target_locations,
          latitude: markerPosition[0],
          longitude: markerPosition[1]
        })
        .eq('id', user.id);

      if (error) throw error;
      setMessage({ text: '🚀 Профиль успешно обновлен! Заведения видят вас на карте.', type: 'success' });
    } catch (err) {
      console.error(err);
      setMessage({ text: `Ошибка сохранения: ${err.message}`, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 text-indigo-400">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500 mr-3"></div>
        <span>Инициализация личного кабинета...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans p-4 sm:p-6 pb-12">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Заголовок */}
        <div>
          <h1 className="text-2xl font-black tracking-tight text-indigo-400">🎸 Кабинет Музыканта</h1>
          <p className="text-slate-400 text-xs">Управляйте анкетой, картой выездов и промо-материалами</p>
        </div>

        {/* Уведомления */}
        {message.text && (
          <div className={`p-4 rounded-xl text-sm font-medium border ${
            message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'
          }`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* ЛЕВАЯ КОЛОНКА: Настройки анкеты */}
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-5 sm:p-6 space-y-5">
            <h2 className="text-lg font-bold tracking-tight border-b border-slate-700/50 pb-2">1. Основная информация</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Псевдоним / Имя бэнда</label>
                <input type="text" name="full_name" required value={formData.full_name} onChange={handleChange}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Основной жанр</label>
                <input type="text" name="genre" placeholder="Джаз, Рок, Поп, Кавер-бэнд" value={formData.genre} onChange={handleChange}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Формат состава</label>
                <input type="text" name="format" placeholder="Соло-акустика, Дуэт, Трио, Full Band" value={formData.format} onChange={handleChange}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none" />
              </div>
              <div className="flex items-center gap-6 pt-5">
                <label className="flex items-center gap-2 text-xs font-bold uppercase text-slate-400 cursor-pointer select-none">
                  <input type="checkbox" name="has_equipment" checked={formData.has_equipment} onChange={handleChange} className="h-4 w-4 rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-0" />
                  🎙️ Свой аппарат
                </label>
                <label className="flex items-center gap-2 text-xs font-bold uppercase text-slate-400 cursor-pointer select-none">
                  <input type="checkbox" name="is_npd" checked={formData.is_npd} onChange={handleChange} className="h-4 w-4 rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-0" />
                  💼 Налог НПД (Чек)
                </label>
              </div>
            </div>

            <h2 className="text-lg font-bold tracking-tight border-b border-slate-700/50 pb-2 pt-2">2. Контакты (Скрыты за подпиской)</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Прямой телефон</label>
                <input type="text" name="phone_hidden" placeholder="+375 (XX) XXX-XX-XX" value={formData.phone_hidden} onChange={handleChange}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Юзернейм Telegram</label>
                <input type="text" name="telegram_hidden" placeholder="@username" value={formData.telegram_hidden} onChange={handleChange}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none" />
              </div>
            </div>

            <h2 className="text-lg font-bold tracking-tight border-b border-slate-700/50 pb-2 pt-2">3. Ссылки на промо-видео (Открытые)</h2>
            <div className="space-y-2">
              {formData.media_links.map((link, idx) => (
                <div key={idx}>
                  <label className="block text-[10px] text-slate-400 mb-0.5">Ссылка на YouTube / Instagram / Диск #{idx + 1}</label>
                  <input type="url" placeholder="https://..." value={link} onChange={(e) => handleLinkChange(idx, e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:border-indigo-500 outline-none" />
                </div>
              ))}
            </div>
          </div>

          {/* ПРАВАЯ КОЛОНКА: География и Карта */}
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-5 sm:p-6 flex flex-col justify-between space-y-5">
            <div>
              <h2 className="text-lg font-bold tracking-tight border-b border-slate-700/50 pb-2">4. География и карта выездов</h2>
              <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                📍 <strong>Укажите базовую точку:</strong> Кликните по карте в месте, где вы базируетесь (дом/студия). Арт-директора увидят этот маркер.<br/>
                ✅ <strong>Районы выезда:</strong> Отметьте чекбоксами зоны, куда вы готовы приехать на выступление. Если заведение находится за пределами выбранных зон, вы скроетесь из их поиска.
              </p>

              {/* Чекбоксы районов */}
              <div className="mt-4 space-y-2">
                <span className="block text-xs font-bold uppercase text-slate-500">Минск (Районы):</span>
                <div className="grid grid-cols-3 gap-2">
                  {MINSK_DISTRICTS.map(district => (
                    <label key={district} className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer select-none">
                      <input type="checkbox" checked={formData.target_locations.includes(district)} onChange={() => handleDistrictToggle(district)} className="h-3.5 w-3.5 rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-0" />
                      {district}
                    </label>
                  ))}
                </div>

                <span className="block text-xs font-bold uppercase text-slate-500 pt-2">Регионы:</span>
                <div className="flex flex-wrap gap-4">
                  {OTHER_REGIONS.map(region => (
                    <label key={region} className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer select-none">
                      <input type="checkbox" checked={formData.target_locations.includes(region)} onChange={() => handleDistrictToggle(region)} className="h-3.5 w-3.5 rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-0" />
                      {region}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Контейнер интерактивной карты Leaflet */}
            <div className="h-60 w-full rounded-xl overflow-hidden border border-slate-700 relative z-0 mt-2">
              <MapContainer center={markerPosition} zoom={12} className="h-full w-full">
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Marker position={markerPosition} icon={musicianIcon} />
                <MapClickHandler onLocationSelect={setMarkerPosition} />
              </MapContainer>
            </div>

            {/* Финальная кнопка сохранения изменений */}
            <div className="pt-4 border-t border-slate-700/40 shrink-0">
              <button type="submit" disabled={saving}
                className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold tracking-wide shadow-lg shadow-indigo-600/20 active:scale-[0.99] transition"
              >
                {saving ? 'Синхронизация с облаком...' : 'Сохранить профиль и карту'}
              </button>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
}