import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../api/supabaseClient';
import L from 'leaflet';

// Фикс для дефолтных иконок Leaflet в React, чтобы они не пропадали
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Кастомная иконка для самого Кафе (чтобы отличалась от музыкантов)
const cafeIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

// Компонент для динамического центрирования карты на координаты кафе
function RecenterMap({ coords }) {
  const map = useMap();
  useEffect(() => {
    if (coords) {
      map.setView(coords, 13);
    }
  }, [coords, map]);
  return null;
}

export default function CafeDashboard() {
  const { user } = useAuth();
  const [cafeProfile, setCafeProfile] = useState(null);
  const [filteredMusicians, setFilteredMusicians] = useState([]);
  const [selectedArtist, setSelectedArtist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Координаты по умолчанию (Центр Минска), если у кафе еще нет координат
  const [mapCenter, setMapCenter] = useState([53.9006, 27.5590]);

  useEffect(() => {
    async function loadMapData() {
      try {
        setLoading(true);

        // 1. Получаем данные заведения (включая его район/город и координаты)
        const { data: cafeData, error: cafeError } = await supabase
          .from('cafes')
          .select('*')
          .eq('id', user.id)
          .single();

        if (cafeError) throw cafeError;
        setCafeProfile(cafeData);

        // Если у кафе сохранены координаты в базе, центрируем карту на них
        if (cafeData.latitude && cafeData.longitude) {
          setMapCenter([cafeData.latitude, cafeData.longitude]);
        }

        // 2. Получаем музыкантов, которые готовы ехать в локацию этого кафе
        // Фильтруем на уровне сервера: музыкант указал этот же город/район в готовности
        const { data: artistsData, error: artistsError } = await supabase
          .from('musicians')
          .select('*')
          .contains('target_locations', [cafeData.district || cafeData.city || 'Минск']);

        if (artistsError) throw artistsError;
        setFilteredMusicians(artistsData || []);

      } catch (err) {
        console.error('Ошибка загрузки карты:', err.message);
        setError('Не удалось загрузить интерактивную карту.');
      } finally {
        setLoading(false);
      }
    }

    if (user) {
      loadMapData();
    }
  }, [user]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 text-indigo-400">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500 mr-3"></div>
        <span>Синхронизация карты локаций...</span>
      </div>
    );
  }

  const isPremiumActive = cafeProfile?.is_premium;

  return (
    <div className="h-screen w-screen bg-slate-900 text-white flex flex-col overflow-hidden font-sans">
      
      {/* Шапка управления */}
      <header className="bg-slate-900/90 border-b border-slate-800 p-4 flex flex-col sm:flex-row justify-between items-center gap-2 z-10 shrink-0">
        <div>
          <h1 className="text-lg font-black tracking-tight text-indigo-400">☕ {cafeProfile?.title}</h1>
          <p className="text-slate-400 text-xs">
            Район: <span className="text-slate-200 font-semibold">{cafeProfile?.district || 'Не указан'}</span> &bull; Показываем готовых к выезду артистов
          </p>
        </div>

        {/* Статус премиум-подписки */}
        <div className="flex items-center gap-2">
          {isPremiumActive ? (
            <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              База разблокирована
            </span>
          ) : (
            <button 
              onClick={() => alert('Для активации доступа к прямым контактам переведите 50 BYN...')}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-xl transition shadow-lg shadow-indigo-600/20"
            >
              Открыть контакты (50 BYN)
            </button>
          )}
        </div>
      </header>

      {/* Контейнер Карты (Занимает все доступное пространство) */}
      <div className="flex-1 relative z-0">
        <MapContainer center={mapCenter} zoom={13} className="h-full w-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {/* Динамическая подстройка центра */}
          <RecenterMap coords={mapCenter} />

          {/* Метка самого Кафе (Красная) */}
          {cafeProfile?.latitude && cafeProfile?.longitude && (
            <Marker position={[cafeProfile.latitude, cafeProfile.longitude]} icon={cafeIcon}>
              <Popup>
                <div className="text-slate-900 font-bold text-xs">Ваше заведение:<br/>{cafeProfile.title}</div>
              </Popup>
            </Marker>
          )}

          {/* Метки доступных Музыкантов (Синие) */}
          {filteredMusicians.map((artist) => {
            // Если музыкант не указал точные координаты, не ломаем карту, а временно пропускаем
            if (!artist.latitude || !artist.longitude) return null;

            return (
              <Marker 
                key={artist.id} 
                position={[artist.latitude, artist.longitude]}
                eventHandlers={{
                  click: () => setSelectedArtist(artist),
                }}
              >
                <Popup>
                  <div className="text-slate-900 p-0.5">
                    <div className="font-bold text-sm leading-tight">{artist.full_name}</div>
                    <div className="text-[11px] text-indigo-600 font-medium mt-0.5">{artist.genre}</div>
                    <div className="text-[10px] text-slate-500 mt-1">Кликните на маркер, чтобы открыть анкету ниже</div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

        {/* ВСПЛЫВАЮЩАЯ ШТОРКА (Action Sheet) С АНКЕТОЙ АРТИСТА */}
        {selectedArtist && (
          <div className="absolute bottom-0 left-0 right-0 bg-slate-850 bg-slate-800 border-t border-slate-700/60 rounded-t-3xl p-5 z-[1000] shadow-2xl max-h-[45vh] overflow-y-auto transition-transform duration-300">
            <div className="flex justify-between items-start mb-3">
              <div>
                <span className="text-[10px] bg-indigo-500/10 text-indigo-400 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  {selectedArtist.format || 'Кавер-исполнитель'}
                </span>
                <h3 className="text-xl font-black tracking-tight mt-1">{selectedArtist.full_name}</h3>
                <p className="text-xs text-slate-400">🎭 Жанр: <span className="text-indigo-300 font-medium">{selectedArtist.genre}</span></p>
              </div>
              <button 
                onClick={() => setSelectedArtist(null)}
                className="bg-slate-700 hover:bg-slate-600 text-slate-300 h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition"
              >
                ✕
              </button>
            </div>

            {/* Параметры */}
            <div className="grid grid-cols-2 gap-3 bg-slate-900/40 p-3 rounded-xl text-xs text-slate-400 mb-4">
              <div>🎸 Аппаратура: <span className="text-slate-200 font-medium">{selectedArtist.has_equipment ? 'Своя' : 'Нужен прокат'}</span></div>
              <div>💼 Налоги (НПД РБ): <span className="text-slate-200 font-medium">{selectedArtist.is_npd ? 'Выставит чек' : 'Физнайм'}</span></div>
            </div>

            {/* Бесплатные медиа-ссылки */}
            {selectedArtist.media_links && selectedArtist.media_links.length > 0 && (
              <div className="space-y-1.5 mb-4">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Демо-видео (Бесплатно):</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedArtist.media_links.map((link, idx) => (
                    <a 
                      key={idx} href={link} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-cyan-400 hover:underline bg-cyan-950/20 border border-cyan-500/20 px-2.5 py-1 rounded-lg"
                    >
                      ▶️ Посмотреть демо {idx + 1}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Контакты под пейволлом */}
            <div className="pt-2 border-t border-slate-700/50">
              {isPremiumActive ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <a href={`tel:${selectedArtist.phone_hidden}`} className="flex items-center justify-center gap-2 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-xl text-xs font-bold transition">
                    📞 Позвонить ({selectedArtist.phone_hidden || 'Нет номера'})
                  </a>
                  <a href={`https://t.me/${selectedArtist.telegram_hidden?.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 py-2.5 bg-sky-600 hover:bg-sky-500 rounded-xl text-xs font-bold transition">
                    ✈️ Написать в Telegram ({selectedArtist.telegram_hidden})
                  </a>
                </div>
              ) : (
                <div className="bg-slate-900/60 rounded-xl p-3 text-center border border-dashed border-slate-700">
                  <p className="text-xs text-amber-400 font-medium mb-1">🔒 Прямые контакты заблокированы</p>
                  <span className="text-[10px] text-slate-500 block">
                    Оплатите B2B-подписку (50 BYN), чтобы бронировать Олега напрямую без посредников.
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}