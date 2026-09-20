import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Car,
  CheckCircle2,
  AlertCircle,
  Search,
  Trash2,
  ChevronRight,
  ArrowRight
} from 'lucide-react';
import { api } from '../services/api';
import { VinDecodeResult, SavedCar, PlateLookupResult } from '../types';
import { Link } from 'react-router-dom';
import { getCarTargetInfo } from './GaragePage';
import { TeslaCarIcon } from './TeslaCarIcon';

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
  const [activeTab, setActiveTab] = useState<'plate' | 'vin' | 'model'>('plate');
  const [vinInput, setVinInput] = useState('');
  const [plateInput, setPlateInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decodedCar, setDecodedCar] = useState<VinDecodeResult | null>(null);
  const [plateResult, setPlateResult] = useState<PlateLookupResult | null>(null);

  // Manual selection state
  const [modelsData, setModelsData] = useState<any[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>('model_3');
  const [selectedGenId, setSelectedGenId] = useState<string>('highland');
  const [selectedYear, setSelectedYear] = useState<number>(2024);
  const [selectedTrim, setSelectedTrim] = useState<string>('Long Range AWD');

  // Currently active car in garage
  const [currentCar, setCurrentCar] = useState<SavedCar | null>(null);
  // Увесь автопарк — щоб видалення одного авто залишало інше і тут, і на сторінці
  const [fleet, setFleet] = useState<SavedCar[]>([]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      loadSavedCar();
      loadFleet();
      loadModels();
      setError(null);
      setDecodedCar(null);
      setPlateResult(null);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
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

  const loadFleet = () => {
    try {
      const allStr = localStorage.getItem('tesla_garage_all_cars');
      setFleet(allStr ? JSON.parse(allStr) : []);
    } catch (e) {
      console.error('Failed to parse garage fleet:', e);
      setFleet([]);
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

  const handlePlateSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = plateInput.trim();
    if (clean.length < 3) {
      setError('Введіть номерний знак авто (наприклад, КА 0001 АА)');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setPlateResult(null);
      const res = await api.lookupByPlate(clean);
      setPlateResult(res);
      if (!res.is_tesla) {
        setError(res.message || 'Знайдено авто іншої марки. Оберіть модель Tesla вручну.');
      }
    } catch (err: any) {
      const msg =
        err?.message === 'Load failed' || err?.message === 'Failed to fetch'
          ? 'Не вдалося звʼязатися із сервером. Перевірте зʼєднання або скористайтесь вибором вручну.'
          : (err?.message || 'Не вдалося знайти авто за номером');
      // Номер не знайшли або сервіс лежить — перемикаємо на VIN: він розшифровується
      // на нашому боці, тож працює навіть коли зовнішній сервіс відповідає помилкою.
      setError(msg);
      setActiveTab('vin');
      setPlateResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveFromPlate = () => {
    if (!plateResult || !plateResult.is_tesla) return;
    const specs = plateResult.tesla_specs;
    const car: SavedCar = {
      id: `plate_${plateResult.plate.replace(/\s+/g, '')}_${plateResult.vin}`,
      plate: plateResult.plate,
      vin: plateResult.vin,
      model: specs ? specs.model : plateResult.model || 'Tesla',
      generation: specs ? specs.generation : 'Стандартна',
      year: specs ? specs.year : plateResult.year || 2021,
      drive: specs ? specs.drive : '',
      description: specs
        ? specs.description
        : `Tesla ${plateResult.model} (${plateResult.year}) [${plateResult.plate}]`
    };
    saveCarToGarage(car);
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

      // Also append to all cars list
      const existingStr = localStorage.getItem('tesla_garage_all_cars');
      let currentList: SavedCar[] = existingStr ? JSON.parse(existingStr) : [];
      currentList = currentList.filter(
        (c) => c.id !== car.id && (!car.vin || c.vin !== car.vin)
      );
      currentList.unshift(car);
      localStorage.setItem('tesla_garage_all_cars', JSON.stringify(currentList));

      window.dispatchEvent(new Event('garage-car-changed'));
      setCurrentCar(car);
      if (onCarSaved) onCarSaved(car);
      onClose();

      // Залогіненим — одразу пишемо авто й в акаунт, щоб воно було доступне на
      // іншому пристрої. Якщо мережа підвела, локальний гараж усе одно працює.
      if (localStorage.getItem('customerToken')) {
        api.addGarageCar(car).catch((e) => console.error('Не вдалося зберегти авто в акаунті', e));
      }
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

  /** Видалити ОДНЕ конкретне авто: воно зникає зі списку, а перше з решти
   *  стає активним. Раніше тут стирався лише активний ключ — і здавалось,
   *  що зникли одразу всі авто. */
  const removeCarFromFleet = (carId: string) => {
    try {
      const allStr = localStorage.getItem('tesla_garage_all_cars');
      const list: SavedCar[] = allStr ? JSON.parse(allStr) : [];
      const target = list.find((c) => c.id === carId) || null;
      const updated = list.filter((c) => c.id !== carId);
      localStorage.setItem('tesla_garage_all_cars', JSON.stringify(updated));

      const nextActive =
        currentCar?.id === carId ? (updated[0] || null) : (currentCar || updated[0] || null);
      if (nextActive) {
        localStorage.setItem('tesla_garage_active_car', JSON.stringify(nextActive));
      } else {
        localStorage.removeItem('tesla_garage_active_car');
      }
      setFleet(updated);
      setCurrentCar(nextActive);
      if (onCarSaved) onCarSaved(nextActive);
      window.dispatchEvent(new Event('garage-car-changed'));

      // Залогіненим — видаляємо й на сервері саме це авто
      if (target?.serverId && localStorage.getItem('customerToken')) {
        api
          .deleteGarageCar(target.serverId)
          .catch((e) => console.error('Не вдалося видалити авто в акаунті', e));
      }
    } catch (e) {
      console.error('Failed to remove car from garage:', e);
    }
  };

  const handleRemoveCar = () => {
    if (currentCar) removeCarFromFleet(currentCar.id);
  };

  /** Зробити авто активним і тут, і на сторінці */
  const selectCarAsActive = (car: SavedCar) => {
    try {
      localStorage.setItem('tesla_garage_active_car', JSON.stringify(car));
      setCurrentCar(car);
      if (onCarSaved) onCarSaved(car);
      window.dispatchEvent(new Event('garage-car-changed'));
    } catch (e) {
      console.error('Failed to set active car:', e);
    }
  };

  if (!isOpen) return null;

  const currentModelObj = modelsData.find((m) => m.id === selectedModelId);
  const currentGenObj = currentModelObj?.generations?.find((g: any) => g.id === selectedGenId);

  const modalContent = (
    <div className="fixed inset-0 z-[100] h-[100dvh] w-screen overflow-y-auto overscroll-contain flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-200 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-50 text-tesla-red flex items-center justify-center font-bold">
              <Car size={17} />
            </div>
            <div>
              <h2 className="text-lg font-black font-montserrat text-gray-900 tracking-tight">
                Мій гараж
              </h2>
              <p className="text-[11px] text-gray-500 font-manrope">
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
        {currentCar && (() => {
          const target = getCarTargetInfo(currentCar);
          return (
            <div className="mx-5 mt-3 p-3 bg-gray-50 rounded-2xl border border-gray-200/80">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-tesla-red shrink-0 overflow-hidden">
                  <TeslaCarIcon model={currentCar.model} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-green-600 font-montserrat flex items-center gap-1">
                    <CheckCircle2 size={11} /> Активне авто в гаражі
                  </div>
                  <div className="font-montserrat font-bold text-gray-900 text-sm leading-tight">
                    {target.fullTitle}
                  </div>
                  <div className="text-[11px] text-gray-500 font-manrope truncate">
                    {currentCar.year} • {currentCar.generation}
                    {currentCar.drive ? ` • ${currentCar.drive}` : ''}
                  </div>
                </div>

                <button
                  onClick={handleRemoveCar}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer shrink-0"
                  title="Видалити авто з гаража"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="flex gap-2 mt-3">
                <Link
                  to={`/category/${target.categorySlug}`}
                  onClick={onClose}
                  className="flex-1 py-1.5 px-3 bg-tesla-red hover:bg-red-700 text-white rounded-lg text-[11px] font-montserrat font-bold text-center flex items-center justify-center gap-1 transition-colors whitespace-nowrap"
                >
                  <span>Деталі</span>
                  <ArrowRight size={12} />
                </Link>
                <Link
                  to={target.schemesUrl}
                  onClick={onClose}
                  className="flex-1 py-1.5 px-3 bg-gray-900 hover:bg-black text-white rounded-lg text-[11px] font-montserrat font-bold text-center flex items-center justify-center gap-1 transition-colors whitespace-nowrap"
                >
                  <span>Схеми</span>
                </Link>
              </div>
            </div>
          );
        })()}
        {/* Інші авто в гаражі: видно решту парку, можна перемкнути або видалити.
            Без цього після видалення активного авто модалка виглядала порожньою,
            хоча авто лишились. */}
        {fleet.filter((c) => c.id !== currentCar?.id).length > 0 && (
          <div className="mx-5 mt-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 font-montserrat mb-1.5">
              Інші авто в гаражі
            </div>
            <div className="space-y-2">
              {fleet
                .filter((c) => c.id !== currentCar?.id)
                .map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-2.5 p-2.5 bg-white rounded-2xl border border-gray-200/80"
                  >
                    <div className="w-9 h-9 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center text-tesla-red shrink-0 overflow-hidden">
                      <TeslaCarIcon model={c.model} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-montserrat font-bold text-gray-900 text-[13px] leading-tight truncate">
                        Tesla {c.model}
                      </div>
                      <div className="text-[11px] text-gray-500 font-manrope truncate">
                        {c.year}
                        {c.generation ? ` • ${c.generation}` : ''}
                        {c.plate ? ` • ${c.plate}` : ''}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => selectCarAsActive(c)}
                      className="text-[11px] font-montserrat font-bold text-tesla-red hover:underline cursor-pointer shrink-0"
                    >
                      Зробити активним
                    </button>
                    <button
                      type="button"
                      onClick={() => removeCarFromFleet(c.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer shrink-0"
                      title="Видалити авто з гаража"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="p-5 pt-4">
          <div className="grid grid-cols-3 p-0.5 bg-gray-100 rounded-xl mb-4">
            <button
              type="button"
              onClick={() => {
                setActiveTab('plate');
                setError(null);
              }}
              className={`py-1.5 text-[11px] font-montserrat font-bold rounded-lg transition-all cursor-pointer ${
                activeTab === 'plate'
                  ? 'bg-gray-900 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              За номером
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('vin');
                setError(null);
              }}
              className={`py-1.5 text-[11px] font-montserrat font-bold rounded-lg transition-all cursor-pointer ${
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
              className={`py-1.5 text-[11px] font-montserrat font-bold rounded-lg transition-all cursor-pointer ${
                activeTab === 'model'
                  ? 'bg-gray-900 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Вручну
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-2.5 text-red-700 text-xs font-manrope">
              <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {/* TAB 0: PLATE */}
          {activeTab === 'plate' && (
            <form onSubmit={handlePlateSearch} className="space-y-4">
              <div>
                <label className="block text-xs font-bold font-montserrat text-gray-700 uppercase mb-2">
                  Номерний знак авто (Україна)
                </label>
                <div className="relative flex items-stretch border-2 border-gray-900 rounded-2xl overflow-hidden shadow-sm focus-within:ring-2 focus-within:ring-tesla-red bg-white">
                  <div className="bg-[#0057B7] text-white px-3 flex flex-col justify-center items-center flex-shrink-0 select-none">
                    <span className="font-mono font-black text-xs text-white">UA</span>
                  </div>
                  <input
                    type="text"
                    value={plateInput}
                    onChange={(e) => {
                      setPlateInput(e.target.value.toUpperCase());
                      setError(null);
                    }}
                    placeholder="КА 0001 АА"
                    maxLength={12}
                    className="w-full py-2 px-3 font-mono font-black text-base tracking-wider text-gray-950 placeholder:text-gray-300 outline-none uppercase bg-white"
                  />
                  <button
                    type="submit"
                    disabled={loading || !plateInput.trim()}
                    className="px-4 bg-tesla-red hover:bg-red-700 disabled:opacity-50 text-white font-montserrat font-bold text-xs transition-colors cursor-pointer flex-shrink-0 flex items-center gap-1"
                  >
                    {loading ? 'Пошук...' : 'Знайти'}
                  </button>
                </div>
                <p className="mt-2 text-xs text-gray-400 font-manrope">
                  Введіть держномер. Ми автоматично отримаємо VIN та точну комплектацію Tesla.
                </p>
              </div>

              {plateResult && plateResult.is_tesla && (
                <div className="p-4 bg-green-50/70 border border-green-200 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2 text-green-700 font-montserrat font-bold text-sm">
                    <CheckCircle2 size={18} />
                    <span>Автомобіль Tesla знайдено!</span>
                  </div>
                  <div className="space-y-1 text-xs font-manrope text-gray-700">
                    <div className="font-montserrat font-black text-gray-900 text-base">
                      Tesla {plateResult.tesla_specs ? plateResult.tesla_specs.model : plateResult.model}
                    </div>
                    <div className="text-gray-500">
                      {plateResult.tesla_specs?.generation} • {plateResult.year} рік • {plateResult.plate}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveFromPlate}
                    className="w-full mt-2 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-montserrat font-bold text-sm transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <CheckCircle2 size={16} />
                    Зберегти авто в гараж
                  </button>
                </div>
              )}
            </form>
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
                <span>Зберегти в мій гараж</span>
              </button>
            </div>
          )}

          {/* Link to full Garage Page */}
          <div className="pt-4 mt-6 border-t border-gray-100 flex items-center justify-between text-xs">
            <span className="text-gray-400 font-manrope">Повний гараж із автопарком:</span>
            <Link
              to="/garage"
              onClick={onClose}
              className="font-montserrat font-bold text-tesla-red hover:text-red-700 flex items-center gap-1 transition-colors group"
            >
              <span>Відкрити сторінку Гаража</span>
              <ArrowRight size={13} className="transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
