import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../api/supabaseClient';
import L from 'leaflet';

// Красная иконка для заведения
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
const cafeIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

const MINSK_DISTRICTS = [
  'Центральный', 'Советский', 'Первомайский', 'Партизанский', 
  'Ленинский', 'Октябрьский', 'Московский', 'Фрунзенский', 'Заводской'
];

function MapClickHandler({ setPosition }) {
  useMapEvents({
    click(e) {
      setPosition([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}

export default function CafeRegistration() {
  const { user, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    address: '',
    district: 'Центральный'
  });
  
  // По умолчанию ставим маркер на Октябрьскую площадь
  const [position, setPosition] = useState([53.9025, 27.5615]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.address) {
      alert('Пожалуйста, заполните название и точный адрес.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('cafes')
        .update({
          title: formData.title,
          address: formData.address,
          district: formData.district,
          latitude: position[0],
          longitude: position[1]
        })
        .eq('id', user.id);

      if (error) throw error;

      // Перезагружаем профиль, чтобы App.jsx увидел изменения и открыл Dashboard
      refreshProfile();
    } catch (err) {
      alert(`Ошибка сохранения: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-8 bg-slate-800 p-8 rounded-3xl border border-slate-700 shadow-2xl">
        
        {/* Левая часть: Форма */}
        <div className="space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-black tracking-tight text-indigo-400">Регистрация точки</h1>
            <p className="text-slate-400 text-sm">Укажите данные вашего заведения, чтобы музыканты могли вас найти.</p>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Название заведения</label>
              <input 
                type="text" 
                placeholder="Напр: Кафе 'Пауза'"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none transition"
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Район (для фильтрации артистов)</label>
              <select 
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none transition appearance-none"
                value={formData.district}
                onChange={(e) => setFormData({...formData, district: e.target.value})}
              >
                {MINSK_DISTRICTS.map(d => <option key={d} value={d}>{d} район</option>)}
                <option value="Другой">Другой город</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Точный адрес</label>
              <input 
                type="text" 
                placeholder="Минск, ул. Октябрьская, 16"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none transition"
                value={formData.address}
                onChange={(e) => setFormData({...formData, address: e.target.value})}
              />
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-2xl font-bold text-lg shadow-lg shadow-indigo-600/20 transition transform active:scale-95"
            >
              {loading ? 'Создаем локацию...' : 'Завершить регистрацию'}
            </button>
          </form>
        </div>

        {/* Правая часть: Карта */}
        <div className="flex flex-col space-y-4">
          <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700">
            <h3 className="text-sm font-bold text-slate-200 mb-1 flex items-center gap-2">
              📍 Укажите точное место на карте
            </h3>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Кликните по зданию, где находится ваш вход. Это поможет музыкантам не запутаться, а системе — точнее считать логистику.
            </p>
          </div>

          <div className="flex-1 min-h-[300px] rounded-2xl overflow-hidden border border-slate-700 z-0">
            <MapContainer center={position} zoom={15} className="h-full w-full">
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <Marker position={position} icon={cafeIcon} />
              <MapClickHandler setPosition={setPosition} />
            </MapContainer>
          </div>
          
          <div className="text-center text-[10px] text-slate-600">
            Координаты: {position[0].toFixed(5)}, {position[1].toFixed(5)}
          </div>
        </div>

      </div>
    </div>
  );
}