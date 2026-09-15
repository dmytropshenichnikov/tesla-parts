import React, { useState, useEffect } from 'react';
import {
  X,
  Car,
  CheckCircle2,
  AlertCircle,
  Search,
  Trash2,
  ShieldCheck,
  ChevronRight,
  ArrowRight
} from 'lucide-react';
import { api } from '../services/api';
import { VinDecodeResult, SavedCar } from '../types';

interface GarageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCarSaved?: (car: SavedCar | null) => void;
}

export const GarageModal: React.FC<GarageModalProps> = ({
  isOpen,
  onClose,
  onCarSaved
}) => {
  const [activeTab, setActiveTab] = useState<'vin' | 'model'>('vin');
  const [vinInput, setVinInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decodedCar, setDecodedCar] = useState<VinDecodeResult | null>(null);

  // Manual selection state
  const [modelsData, setModelsData] = useState<any[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>('model_3');
  const [selectedGenId, setSelectedGenId] = useState<string>('highland');
  const [selectedYear, setSelectedYear] = useState<number>(2024);
  const [selectedTrim, setSelectedTrim] = useState<string>('Long Range AWD');

  // Currently active car in garage
  const [currentCar, setCurrentCar] = useState<SavedCar | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadSavedCar();
      loadModels();
      setError(null);
      setDecodedCar(null);
    }
  }, [isOpen]);

  const loadSavedCar = () => {
    try {
      const saved = localStorage.getItem('tesla_garage_active_car');
      if (saved) {
        setCurrentCar(JSON.parse(saved));
      } else {
        setCurrentCar(null);
      }
    } catch (e) {
      console.error('Failed to parse saved car:', e);
    }
  };

  const loadModels = async () => {
    try {
      const data = await api.getVinModels();
      setModelsData(data);
      if (data.length > 0) {
        const m = data[0];
        setSelectedModelId(m.id);
        if (m.generations?.length > 0) {
          const g = m.generations[0];
          setSelectedGenId(g.id);
          if (g.years?.length > 0) setSelectedYear(g.years[0]);
          if (g.trims?.length > 0) setSelectedTrim(g.trims[0]);
        }
      }
    } catch (e) {
      console.error('Failed to fetch models:', e);
    }
  };

  const handleDecodeVin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = vinInput.trim().toUpperCase();
    if (clean.length !== 17) {
      setError('VIN-код повинен містити рівно 17 символів');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await api.decodeVin(clean);
      setDecodedCar(res);
    } catch (err: any) {
      setError(err.message || 'Не вдалося розпізнати VIN. Перевірте введені дані.');
      setDecodedCar(null);
    } finally {
      setLoading(false);
    }
  };

  const saveCarToGarage = (car: SavedCar) => {
    try {
      localStorage.setItem('tesla_garage_active_car', JSON.stringify(car));
      window.dispatchEvent(new Event('garage-car-changed'));
      setCurrentCar(car);
      if (onCarSaved) onCarSaved(car);
      onClose();
    } catch (e) {
      console.error('Failed to save car to garage:', e);
    }
  };

  const handleSaveDecoded = () => {
    if (!decodedCar) return;
    const car: SavedCar = {
      id: `vin_${decodedCar.vin}`,
      vin: decodedCar.vin,
      model: decodedCar.model,
      generation: decodedCar.generation,
      year: decodedCar.year,
      drive: decodedCar.drive,
      description: decodedCar.description
    };
    saveCarToGarage(car);
  };

  const handleSaveManual = () => {
    const modelObj = modelsData.find((m) => m.id === selectedModelId);
    const genObj = modelObj?.generations?.find((g: any) => g.id === selectedGenId);

    const modelName = modelObj ? modelObj.name : 'Model 3';
    const genName = genObj ? genObj.name : 'Highland (2024-...)';

    const car: SavedCar = {
      id: `manual_${selectedModelId}_${selectedGenId}_${selectedYear}`,
      model: modelName,
      generation: genName,
      year: selectedYear,
      drive: selectedTrim,
      description: `Tesla ${modelName} ${genName.split(' (')[0]} ${selectedYear} ${selectedTrim}`
    };
    saveCarToGarage(car);
  };

  const handleRemoveCar = () => {
    localStorage.removeItem('tesla_garage_active_car');
    window.dispatchEvent(new Event('garage-car-changed'));
    setCurrentCar(null);
    if (onCarSaved) onCarSaved(null);
  };

  if (!isOpen) return null;

  const currentModelObj = modelsData.find((m) => m.id === selectedModelId);
  const currentGenObj = currentModelObj?.generations?.find((g: any) => g.id === selectedGenId);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-red-50 text-tesla-red flex items-center justify-center font-bold">
              <Car size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black font-montserrat text-gray-900 tracking-tight">
                Мій гараж
              </h2>
              <p className="text-xs text-gray-500 font-manrope">
                Додайте авто для точного підбору запчастин
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
            aria-label="Закрити"
          >
            <X size={20} />
          </button>
        </div>

        {/* Current Car Banner (if exists) */}
        {currentCar && (
          <div className="mx-6 mt-4 p-4 bg-gray-50 rounded-2xl border border-gray-200/80 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-tesla-red font-bold shrink-0">
                <ShieldCheck size={22} />
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-green-600 font-montserrat flex items-center gap-1">
                  <CheckCircle2 size={12} /> Активне авто в гаражі
                </div>
                <div className="font-montserrat font-bold text-gray-900 text-sm">
                  Tesla {currentCar.model} • {currentCar.year}
                </div>
                <div className="text-xs text-gray-500 font-manrope">
                  {currentCar.generation} {currentCar.drive ? `• ${currentCar.drive}` : ''}
                </div>
              </div>
            </div>

            <button
              onClick={handleRemoveCar}
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
              title="Видалити авто з гаража"
            >
              <Trash2 size={18} />
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="p-6 pt-5">
          <div className="grid grid-cols-2 p-1 bg-gray-100 rounded-2xl mb-6">
            <button
              type="button"
              onClick={() => {
                setActiveTab('vin');
                setError(null);
              }}
              className={`py-2.5 text-sm font-montserrat font-bold rounded-xl transition-all cursor-pointer ${
                activeTab === 'vin'
                  ? 'bg-gray-900 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              За VIN-кодом
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('model');
                setError(null);
              }}
              className={`py-2.5 text-sm font-montserrat font-bold rounded-xl transition-all cursor-pointer ${
                activeTab === 'model'
                  ? 'bg-gray-900 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Обрати вручну
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-2.5 text-red-700 text-xs font-manrope">
              <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {/* TAB 1: VIN */}
          {activeTab === 'vin' && (
            <form onSubmit={handleDecodeVin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold font-montserrat text-gray-700 uppercase mb-2">
                  VIN-код автомобіля (17 символів)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    maxLength={17}
                    value={vinInput}
                    onChange={(e) => {
                      setVinInput(e.target.value.toUpperCase());
                      setError(null);
                    }}
                    placeholder="напр. 5YJ3E1EB8NF..."
                    className="w-full pl-4 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-mono tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-tesla-red focus:bg-white transition-all shadow-inner"
                  />
                  <Search
                    size={18}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                  />
                </div>
                <p className="mt-2 text-xs text-gray-400 font-manrope">
                  Вкажіть 17 символів VIN з техпаспорта або застосунку Tesla. Ми миттєво розшифруємо комплектацію.
                </p>
              </div>

              {!decodedCar ? (
                <button
                  type="submit"
                  disabled={loading || vinInput.trim().length !== 17}
                  className="w-full py-3.5 bg-tesla-red hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl font-montserrat font-bold text-sm transition-all shadow-md active:scale-98 cursor-pointer flex items-center justify-center gap-2"
                >
                  {loading ? 'Визначаємо авто...' : 'Визначити авто'}
                  {!loading && <ArrowRight size={16} />}
                </button>
              ) : (
                <div className="p-4 bg-green-50/70 border border-green-200 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2 text-green-700 font-montserrat font-bold text-sm">
                    <CheckCircle2 size={18} />
                    <span>Авто успішно розпізнано!</span>
                  </div>

                  <div className="space-y-1 text-xs font-manrope text-gray-700">
                    <div className="font-montserrat font-black text-gray-900 text-base">
                      {decodedCar.description}
                    </div>
                    <div className="text-gray-500">
                      Завод: {decodedCar.plant} • Рік: {decodedCar.year}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveDecoded}
                    className="w-full mt-2 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-montserrat font-bold text-sm transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <CheckCircle2 size={16} />
                    Зберегти авто в гараж
                  </button>
                </div>
              )}
            </form>
          )}

          {/* TAB 2: MANUAL SELECTION */}
          {activeTab === 'model' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold font-montserrat text-gray-700 uppercase mb-1.5">
                  1. Модель Tesla
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {modelsData.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setSelectedModelId(m.id);
                        if (m.generations?.length > 0) {
                          const g = m.generations[0];
                          setSelectedGenId(g.id);
                          if (g.years?.length > 0) setSelectedYear(g.years[0]);
                          if (g.trims?.length > 0) setSelectedTrim(g.trims[0]);
                        }
                      }}
                      className={`py-2 px-1 text-center rounded-xl text-xs font-montserrat font-bold border transition-all cursor-pointer ${
                        selectedModelId === m.id
                          ? 'border-tesla-red bg-red-50 text-tesla-red ring-2 ring-tesla-red/20'
                          : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
              </div>

              {currentModelObj && (
                <div>
                  <label className="block text-xs font-bold font-montserrat text-gray-700 uppercase mb-1.5">
                    2. Покоління
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {(currentModelObj.generations || []).map((g: any) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => {
                          setSelectedGenId(g.id);
                          if (g.years?.length > 0) setSelectedYear(g.years[0]);
                          if (g.trims?.length > 0) setSelectedTrim(g.trims[0]);
                        }}
                        className={`py-2 px-3 rounded-xl text-xs font-montserrat font-semibold border transition-all cursor-pointer ${
                          selectedGenId === g.id
                            ? 'border-tesla-red bg-red-50 text-tesla-red font-bold'
                            : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        {g.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {currentGenObj && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold font-montserrat text-gray-700 uppercase mb-1.5">
                      3. Рік випуску
                    </label>
                    <select
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                      className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-manrope font-semibold focus:ring-2 focus:ring-tesla-red focus:outline-none"
                    >
                      {(currentGenObj.years || []).map((yr: number) => (
                        <option key={yr} value={yr}>
                          {yr} рік
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold font-montserrat text-gray-700 uppercase mb-1.5">
                      4. Комплектація
                    </label>
                    <select
                      value={selectedTrim}
                      onChange={(e) => setSelectedTrim(e.target.value)}
                      className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-manrope font-semibold focus:ring-2 focus:ring-tesla-red focus:outline-none"
                    >
                      {(currentGenObj.trims || []).map((tr: string) => (
                        <option key={tr} value={tr}>
                          {tr}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={handleSaveManual}
                className="w-full mt-4 py-3.5 bg-tesla-red hover:bg-red-700 text-white rounded-2xl font-montserrat font-bold text-sm transition-all shadow-md active:scale-98 cursor-pointer flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={16} />
                Зберегти в мій гараж
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
