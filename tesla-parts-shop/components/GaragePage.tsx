import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Car,
  Search,
  CheckCircle2,
  AlertCircle,
  Trash2,
  ShieldCheck,
  ChevronRight,
  ArrowRight,
  Layers,
  Sparkles,
  Copy,
  Check,
  RotateCcw,
  Plus
} from 'lucide-react';
import { api } from '../services/api';
import { SavedCar, PlateLookupResult, VinDecodeResult } from '../types';
import { slugify } from '../utils/slugify';

export const GaragePage: React.FC = () => {
  const navigate = useNavigate();

  // Active car & all saved cars
  const [activeCar, setActiveCar] = useState<SavedCar | null>(null);
  const [allCars, setAllCars] = useState<SavedCar[]>([]);
  const [copiedVin, setCopiedVin] = useState(false);

  // Tab for adding car: 'plate' | 'vin' | 'manual'
  const [addMode, setAddMode] = useState<'plate' | 'vin' | 'manual'>('plate');

  // Plate search state
  const [plateInput, setPlateInput] = useState('');
  const [plateLoading, setPlateLoading] = useState(false);
  const [plateError, setPlateError] = useState<string | null>(null);
  const [plateResult, setPlateResult] = useState<PlateLookupResult | null>(null);

  // VIN search state
  const [vinInput, setVinInput] = useState('');
  const [vinLoading, setVinLoading] = useState(false);
  const [vinError, setVinError] = useState<string | null>(null);
  const [vinResult, setVinResult] = useState<VinDecodeResult | null>(null);

  // Manual selection state
  const [modelsData, setModelsData] = useState<any[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>('model_3');
  const [selectedGenId, setSelectedGenId] = useState<string>('highland');
  const [selectedYear, setSelectedYear] = useState<number>(2024);
  const [selectedTrim, setSelectedTrim] = useState<string>('Long Range AWD');

  // Feedback notification
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    loadGarageState();
    loadModels();
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const loadGarageState = () => {
    try {
      const activeStr = localStorage.getItem('tesla_garage_active_car');
      if (activeStr) {
        const parsed = JSON.parse(activeStr);
        setActiveCar(parsed);
      } else {
        setActiveCar(null);
      }

      const allStr = localStorage.getItem('tesla_garage_all_cars');
      if (allStr) {
        setAllCars(JSON.parse(allStr));
      } else if (activeStr) {
        setAllCars([JSON.parse(activeStr)]);
      }
    } catch (e) {
      console.error('Failed to parse garage state', e);
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
      console.error('Failed to load models list', e);
    }
  };

  const saveCarToGarage = (car: SavedCar) => {
    try {
      // 1. Set as active car
      localStorage.setItem('tesla_garage_active_car', JSON.stringify(car));
      setActiveCar(car);

      // 2. Add to all saved cars list (avoid duplicates by id or vin)
      const existingStr = localStorage.getItem('tesla_garage_all_cars');
      let currentList: SavedCar[] = existingStr ? JSON.parse(existingStr) : [];
      currentList = currentList.filter(
        (c) => c.id !== car.id && (!car.vin || c.vin !== car.vin)
      );
      currentList.unshift(car);
      localStorage.setItem('tesla_garage_all_cars', JSON.stringify(currentList));
      setAllCars(currentList);

      // Trigger global event for header and catalog
      window.dispatchEvent(new Event('garage-car-changed'));
      showToast(`Автомобіль ${car.model} успішно додано до вашого Гаража!`);
    } catch (e) {
      console.error('Failed to save car to garage', e);
    }
  };

  const handleSelectActiveCar = (car: SavedCar) => {
    localStorage.setItem('tesla_garage_active_car', JSON.stringify(car));
    setActiveCar(car);
    window.dispatchEvent(new Event('garage-car-changed'));
    showToast(`Активне авто перемкнено на ${car.model}`);
  };

  const handleRemoveCar = (carId: string) => {
    try {
      const updated = allCars.filter((c) => c.id !== carId);
      localStorage.setItem('tesla_garage_all_cars', JSON.stringify(updated));
      setAllCars(updated);

      if (activeCar?.id === carId) {
        if (updated.length > 0) {
          localStorage.setItem('tesla_garage_active_car', JSON.stringify(updated[0]));
          setActiveCar(updated[0]);
        } else {
          localStorage.removeItem('tesla_garage_active_car');
          setActiveCar(null);
        }
        window.dispatchEvent(new Event('garage-car-changed'));
      }
      showToast('Автомобіль видалено з гаража');
    } catch (e) {
      console.error('Failed to remove car', e);
    }
  };

  // 1. Handle Plate Search
  const handlePlateSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = plateInput.trim();
    if (clean.length < 3) {
      setPlateError('Введіть коректний номер авто (наприклад, КА 0001 АА)');
      return;
    }

    try {
      setPlateLoading(true);
      setPlateError(null);
      setPlateResult(null);
      const res = await api.lookupByPlate(clean);
      setPlateResult(res);
    } catch (err: any) {
      setPlateError(err.message || 'Не вдалося знайти авто за номером');
      setPlateResult(null);
    } finally {
      setPlateLoading(false);
    }
  };

  const handleSaveFromPlate = () => {
    if (!plateResult) return;
    const specs = plateResult.tesla_specs;
    const car: SavedCar = {
      id: `plate_${plateResult.plate.replace(/\s+/g, '')}_${plateResult.vin}`,
      plate: plateResult.plate,
      vin: plateResult.vin,
      model: specs ? specs.model : plateResult.model || 'Tesla',
      generation: specs ? specs.generation : 'Стандартна',
      year: specs ? specs.year : plateResult.year || 2021,
      drive: specs ? specs.drive : '',
      plant: specs ? specs.plant : '',
      description: specs
        ? specs.description
        : `Tesla ${plateResult.model} (${plateResult.year}) [${plateResult.plate}]`,
      savedAt: new Date().toISOString()
    };
    saveCarToGarage(car);
    setPlateResult(null);
    setPlateInput('');
  };

  // 2. Handle VIN Search
  const handleVinSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = vinInput.trim().toUpperCase();
    if (clean.length !== 17) {
      setVinError('VIN-код повинен містити рівно 17 символів');
      return;
    }

    try {
      setVinLoading(true);
      setVinError(null);
      setVinResult(null);
      const res = await api.decodeVin(clean);
      setVinResult(res);
    } catch (err: any) {
      setVinError(err.message || 'Не вдалося розпізнати VIN-номер Tesla');
      setVinResult(null);
    } finally {
      setVinLoading(false);
    }
  };

  const handleSaveFromVin = () => {
    if (!vinResult) return;
    const car: SavedCar = {
      id: `vin_${vinResult.vin}`,
      vin: vinResult.vin,
      model: vinResult.model,
      generation: vinResult.generation,
      year: vinResult.year,
      drive: vinResult.drive,
      plant: vinResult.plant,
      body_type: vinResult.body_type,
      description: vinResult.description,
      savedAt: new Date().toISOString()
    };
    saveCarToGarage(car);
    setVinResult(null);
    setVinInput('');
  };

  // 3. Handle Manual Save
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
      description: `Tesla ${modelName} ${genName.split(' (')[0]} ${selectedYear} ${selectedTrim}`,
      savedAt: new Date().toISOString()
    };
    saveCarToGarage(car);
  };

  const copyVinToClipboard = (vin: string) => {
    navigator.clipboard.writeText(vin);
    setCopiedVin(true);
    setTimeout(() => setCopiedVin(false), 2000);
    showToast('VIN-код скопійовано в буфер обміну');
  };

  const activeModelObj = modelsData.find((m) => m.id === selectedModelId);
  const activeGenObj = activeModelObj?.generations?.find((g: any) => g.id === selectedGenId);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 md:py-10 font-manrope">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-gray-700 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <CheckCircle2 size={18} className="text-emerald-400 flex-shrink-0" />
          <span className="text-sm font-semibold">{toastMsg}</span>
        </div>
      )}

      {/* Hero Header */}
      <div className="mb-8 md:mb-12 text-center max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-50 text-tesla-red border border-red-200/80 text-xs font-montserrat font-bold uppercase tracking-wider mb-3">
          <Car size={14} />
          <span>Персональний сервіс</span>
        </div>
        <h1 className="text-3xl md:text-5xl font-black font-montserrat text-gray-950 tracking-tight mb-3">
          Мій Гараж Tesla
        </h1>
        <p className="text-gray-600 text-sm md:text-base leading-relaxed">
          Додайте ваш автомобіль за <strong className="text-gray-900">номером машини</strong>, VIN-кодом або оберіть модель вручну. Каталог та схеми запчастин автоматично підлаштуються під точну комплектацію вашої Tesla.
        </p>
      </div>

      {/* ACTIVE CAR SECTION */}
      {activeCar ? (
        <div className="mb-12 bg-gradient-to-br from-gray-950 via-gray-900 to-black text-white rounded-3xl p-6 md:p-8 shadow-2xl border border-gray-800 relative overflow-hidden">
          {/* Subtle background glow */}
          <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6 md:gap-8">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-montserrat font-bold uppercase tracking-wider">
                  <CheckCircle2 size={13} />
                  <span>Активне авто для підбору</span>
                </span>

                {/* Ukrainian License Plate Badge */}
                {activeCar.plate && (
                  <div className="inline-flex items-center rounded-lg border border-gray-300 bg-white shadow-xs overflow-hidden h-7">
                    <div className="bg-[#0057B7] text-white px-2 h-full flex flex-col justify-center items-center text-[9px] font-black leading-tight border-r border-[#0057B7]">
                      <span className="text-[#FFDD00] text-[8px] leading-none">UA</span>
                    </div>
                    <div className="px-2.5 font-mono font-black text-xs tracking-wider text-gray-950 uppercase">
                      {activeCar.plate}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <h2 className="text-2xl md:text-4xl font-black font-montserrat tracking-tight text-white mb-1">
                  Tesla {activeCar.model}
                </h2>
                <div className="text-gray-400 text-sm md:text-base font-medium">
                  {activeCar.generation} &bull; {activeCar.year} рік
                  {activeCar.drive ? ` &bull; ${activeCar.drive}` : ''}
                </div>
              </div>

              {/* VIN & Factory info */}
              {activeCar.vin && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <div className="inline-flex items-center gap-2 bg-gray-800/80 border border-gray-700/80 rounded-xl px-3 py-1.5 text-xs font-mono text-gray-200">
                    <span className="text-gray-400 uppercase font-sans text-[10px] font-bold">VIN:</span>
                    <span className="tracking-widest font-bold">{activeCar.vin}</span>
                    <button
                      type="button"
                      onClick={() => copyVinToClipboard(activeCar.vin!)}
                      className="p-1 hover:text-white transition-colors cursor-pointer"
                      title="Скопіювати VIN"
                    >
                      {copiedVin ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                    </button>
                  </div>
                  {activeCar.plant && (
                    <span className="text-xs text-gray-400 bg-gray-800/50 border border-gray-700/50 rounded-xl px-3 py-1.5 font-medium">
                      Завод: {activeCar.plant}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 flex-shrink-0">
              <Link
                to={`/category/${slugify(activeCar.model)}`}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-tesla-red hover:bg-red-700 text-white font-montserrat font-bold text-sm transition-all duration-200 shadow-lg shadow-red-900/30 active:scale-95"
              >
                <span>Підібрати деталі</span>
                <ArrowRight size={16} />
              </Link>
              <Link
                to={`/schemes?model=${encodeURIComponent(activeCar.model)}`}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-montserrat font-bold text-sm transition-all duration-200 border border-gray-700 active:scale-95"
              >
                <Layers size={16} className="text-red-400" />
                <span>Схеми вузлів {activeCar.model}</span>
              </Link>
              <button
                type="button"
                onClick={() => handleRemoveCar(activeCar.id)}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs text-gray-400 hover:text-red-400 transition-colors cursor-pointer"
              >
                <Trash2 size={13} />
                <span>Видалити авто з гаража</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-12 bg-white rounded-3xl p-8 md:p-10 border border-gray-200 text-center shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-red-50 text-tesla-red flex items-center justify-center mx-auto mb-4 border border-red-100">
            <Car size={32} />
          </div>
          <h2 className="text-xl md:text-2xl font-black font-montserrat text-gray-950 mb-2">
            У вашому Гаражі ще немає автомобіля
          </h2>
          <p className="text-gray-500 text-sm max-w-md mx-auto mb-6">
            Додайте вашу Tesla за номером авто або VIN-кодом нижче, щоб автоматично бачити тільки сумісні деталі та схеми.
          </p>
        </div>
      )}

      {/* ADD / CHANGE CAR SECTION */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-gray-200/90 shadow-sm mb-12">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gray-100 mb-6">
          <div>
            <h3 className="text-xl md:text-2xl font-black font-montserrat text-gray-950">
              {activeCar ? 'Додати ще одне авто або змінити' : 'Додати автомобіль у Гараж'}
            </h3>
            <p className="text-gray-500 text-xs md:text-sm mt-0.5">
              Оберіть найзручніший для вас спосіб підбору:
            </p>
          </div>

          {/* Mode Tabs */}
          <div className="inline-flex p-1 bg-gray-100 rounded-2xl border border-gray-200/60 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setAddMode('plate')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-montserrat font-bold transition-all cursor-pointer ${
                addMode === 'plate'
                  ? 'bg-white text-gray-950 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span>За номером авто</span>
              <span className="bg-emerald-100 text-emerald-700 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                Швидко
              </span>
            </button>
            <button
              type="button"
              onClick={() => setAddMode('vin')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-montserrat font-bold transition-all cursor-pointer ${
                addMode === 'vin'
                  ? 'bg-white text-gray-950 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span>За VIN-кодом</span>
            </button>
            <button
              type="button"
              onClick={() => setAddMode('manual')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-montserrat font-bold transition-all cursor-pointer ${
                addMode === 'manual'
                  ? 'bg-white text-gray-950 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span>Обрати модель</span>
            </button>
          </div>
        </div>

        {/* TAB 1: PLATE SEARCH */}
        {addMode === 'plate' && (
          <div className="max-w-xl mx-auto py-2">
            <div className="text-center mb-6">
              <p className="text-sm text-gray-600">
                Введіть державний номерний знак авто в українському форматі. Миттєво підтягнемо офіційний VIN та точні характеристики вашої Tesla.
              </p>
            </div>

            <form onSubmit={handlePlateSearch} className="space-y-4">
              {/* Ukrainian License Plate Input Box */}
              <div className="relative flex items-stretch border-2 border-gray-900 rounded-2xl overflow-hidden shadow-md focus-within:ring-4 focus-within:ring-red-500/20 transition-all bg-white">
                {/* Left Blue UA Strip */}
                <div className="bg-[#0057B7] text-white px-3 sm:px-4 flex flex-col justify-center items-center flex-shrink-0 select-none border-r border-[#004799]">
                  <div className="w-4 h-3 bg-[#0057B7] relative flex flex-col justify-between overflow-hidden rounded-xs border border-white/20 mb-0.5">
                    <div className="h-1.5 bg-[#0057B7]" />
                    <div className="h-1.5 bg-[#FFDD00]" />
                  </div>
                  <span className="font-mono font-black text-xs sm:text-sm tracking-wider text-white">UA</span>
                </div>

                {/* Input */}
                <input
                  type="text"
                  value={plateInput}
                  onChange={(e) => {
                    setPlateInput(e.target.value.toUpperCase());
                    setPlateError(null);
                  }}
                  placeholder="КА 0001 АА"
                  maxLength={12}
                  className="w-full py-3.5 px-4 font-mono font-black text-xl sm:text-2xl tracking-widest text-gray-950 placeholder:text-gray-300 outline-none uppercase bg-white"
                  autoFocus
                />

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={plateLoading || !plateInput.trim()}
                  className="px-5 sm:px-7 bg-tesla-red hover:bg-red-700 disabled:bg-gray-300 text-white font-montserrat font-bold text-sm sm:text-base flex items-center justify-center gap-2 transition-colors cursor-pointer flex-shrink-0"
                >
                  {plateLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Search size={18} />
                      <span className="hidden sm:inline">Знайти</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between text-xs text-gray-400 px-1">
                <span>Приклади: КА1234АА, АА7777ВВ, ВС1234ХХ</span>
                <span>Безкоштовно &bull; За 0.3 сек</span>
              </div>
            </form>

            {/* Error Message */}
            {plateError && (
              <div className="mt-5 p-4 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-3 text-red-700 text-sm animate-in fade-in duration-200">
                <AlertCircle size={18} className="text-tesla-red flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold font-montserrat">Не вдалося розпізнати авто</div>
                  <div className="text-xs text-red-600 mt-0.5">{plateError}</div>
                </div>
              </div>
            )}

            {/* Result Card */}
            {plateResult && (
              <div className="mt-6 p-6 rounded-2xl bg-gray-50 border border-gray-200 animate-in zoom-in-95 duration-200">
                {plateResult.is_tesla ? (
                  <div>
                    <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-200">
                      <div className="flex items-center gap-2 text-emerald-600 font-montserrat font-bold text-sm">
                        <CheckCircle2 size={18} />
                        <span>Знайдено автомобіль Tesla!</span>
                      </div>
                      <div className="font-mono font-bold text-xs bg-white px-2.5 py-1 rounded-lg border border-gray-200 text-gray-800">
                        {plateResult.plate}
                      </div>
                    </div>

                    <div className="space-y-1.5 mb-5">
                      <h4 className="text-xl font-black font-montserrat text-gray-950">
                        Tesla {plateResult.tesla_specs ? plateResult.tesla_specs.model : plateResult.model}
                      </h4>
                      <div className="text-sm text-gray-600">
                        Покоління: <strong>{plateResult.tesla_specs?.generation || 'Стандартне'}</strong> &bull; Рік: <strong>{plateResult.year}</strong>
                      </div>
                      {plateResult.tesla_specs?.drive && (
                        <div className="text-xs text-gray-500">
                          Привід: {plateResult.tesla_specs.drive}
                        </div>
                      )}
                      <div className="text-xs font-mono text-gray-400 pt-1">
                        VIN: {plateResult.vin}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleSaveFromPlate}
                      className="w-full py-3 px-4 bg-tesla-red hover:bg-red-700 text-white rounded-xl font-montserrat font-bold text-sm transition-all shadow-md active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Plus size={16} />
                      <span>Додати в Мій Гараж та підібрати запчастини</span>
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-2">
                    <AlertCircle size={32} className="text-amber-500 mx-auto mb-2" />
                    <h4 className="font-montserrat font-bold text-gray-900 text-base mb-1">
                      Знайдено авто іншої марки
                    </h4>
                    <p className="text-xs text-gray-600 max-w-sm mx-auto mb-4">
                      {plateResult.message || `Знайдено ${plateResult.mark} ${plateResult.model} (${plateResult.year}), проте наш магазин спеціалізується виключно на автомобілях Tesla.`}
                    </p>
                    <button
                      type="button"
                      onClick={() => setAddMode('manual')}
                      className="px-4 py-2 bg-gray-900 text-white text-xs font-montserrat font-bold rounded-xl hover:bg-black transition-colors"
                    >
                      Обрати модель Tesla вручну
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: VIN SEARCH */}
        {addMode === 'vin' && (
          <div className="max-w-xl mx-auto py-2">
            <div className="text-center mb-6">
              <p className="text-sm text-gray-600">
                Введіть 17-значний VIN-номер кузова вашої Tesla (вказаний у техпаспорті або в меню монітора авто).
              </p>
            </div>

            <form onSubmit={handleVinSearch} className="space-y-4">
              <div className="relative flex items-stretch border-2 border-gray-900 rounded-2xl overflow-hidden shadow-md focus-within:ring-4 focus-within:ring-red-500/20 transition-all bg-white">
                <input
                  type="text"
                  value={vinInput}
                  onChange={(e) => {
                    setVinInput(e.target.value.toUpperCase());
                    setVinError(null);
                  }}
                  placeholder="5YJ3E1EB..."
                  maxLength={17}
                  className="w-full py-3.5 px-4 font-mono font-bold text-base sm:text-lg tracking-widest text-gray-950 placeholder:text-gray-300 outline-none uppercase bg-white"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={vinLoading || vinInput.trim().length !== 17}
                  className="px-5 sm:px-7 bg-tesla-red hover:bg-red-700 disabled:bg-gray-300 text-white font-montserrat font-bold text-sm sm:text-base flex items-center justify-center gap-2 transition-colors cursor-pointer flex-shrink-0"
                >
                  {vinLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Search size={18} />
                      <span className="hidden sm:inline">Розпізнати</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between text-xs text-gray-400 px-1">
                <span>Символів: {vinInput.length} / 17</span>
                <span>Підтримуються Model 3, Y, S, X, Cybertruck</span>
              </div>
            </form>

            {vinError && (
              <div className="mt-5 p-4 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-3 text-red-700 text-sm animate-in fade-in duration-200">
                <AlertCircle size={18} className="text-tesla-red flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold font-montserrat">Помилка валідації VIN</div>
                  <div className="text-xs text-red-600 mt-0.5">{vinError}</div>
                </div>
              </div>
            )}

            {vinResult && (
              <div className="mt-6 p-6 rounded-2xl bg-gray-50 border border-gray-200 animate-in zoom-in-95 duration-200">
                <div className="flex items-center gap-2 text-emerald-600 font-montserrat font-bold text-sm mb-3 pb-3 border-b border-gray-200">
                  <CheckCircle2 size={18} />
                  <span>VIN успішно розшифровано!</span>
                </div>

                <div className="space-y-1.5 mb-5">
                  <h4 className="text-xl font-black font-montserrat text-gray-950">
                    Tesla {vinResult.model}
                  </h4>
                  <div className="text-sm text-gray-600">
                    Покоління: <strong>{vinResult.generation}</strong> &bull; Рік: <strong>{vinResult.year}</strong>
                  </div>
                  <div className="text-xs text-gray-500">
                    Привід: {vinResult.drive} &bull; Завод: {vinResult.plant}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSaveFromVin}
                  className="w-full py-3 px-4 bg-tesla-red hover:bg-red-700 text-white rounded-xl font-montserrat font-bold text-sm transition-all shadow-md active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Plus size={16} />
                  <span>Зберегти в Мій Гараж</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: MANUAL SELECTION */}
        {addMode === 'manual' && (
          <div className="max-w-2xl mx-auto py-2 space-y-5">
            {/* Step 1: Model Selection */}
            <div>
              <label className="block text-xs font-bold font-montserrat uppercase tracking-wider text-gray-500 mb-2">
                1. Оберіть модель Tesla
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {modelsData.map((m) => {
                  const isSelected = selectedModelId === m.id;
                  return (
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
                      className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                        isSelected
                          ? 'border-red-600 bg-red-50/60 text-tesla-red shadow-xs ring-1 ring-red-500'
                          : 'border-gray-200 bg-white text-gray-800 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-montserrat font-black text-sm">{m.name}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Generation */}
            {activeModelObj && activeModelObj.generations?.length > 0 && (
              <div>
                <label className="block text-xs font-bold font-montserrat uppercase tracking-wider text-gray-500 mb-2">
                  2. Покоління / Ревізія
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {activeModelObj.generations.map((g: any) => {
                    const isSelected = selectedGenId === g.id;
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => {
                          setSelectedGenId(g.id);
                          if (g.years?.length > 0) setSelectedYear(g.years[0]);
                          if (g.trims?.length > 0) setSelectedTrim(g.trims[0]);
                        }}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'border-red-600 bg-red-50/50 text-tesla-red ring-1 ring-red-500'
                            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        <div className="font-montserrat font-bold text-xs">{g.name}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 3: Year & Trim */}
            {activeGenObj && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold font-montserrat uppercase tracking-wider text-gray-500 mb-1.5">
                    3. Рік випуску
                  </label>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-red-500/20"
                  >
                    {activeGenObj.years.map((y: number) => (
                      <option key={y} value={y}>
                        {y} рік
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold font-montserrat uppercase tracking-wider text-gray-500 mb-1.5">
                    4. Модифікація / Привід
                  </label>
                  <select
                    value={selectedTrim}
                    onChange={(e) => setSelectedTrim(e.target.value)}
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-red-500/20"
                  >
                    {activeGenObj.trims.map((t: string) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleSaveManual}
              className="w-full py-3.5 px-4 bg-tesla-red hover:bg-red-700 text-white rounded-xl font-montserrat font-bold text-sm transition-all shadow-md active:scale-98 flex items-center justify-center gap-2 cursor-pointer mt-4"
            >
              <Plus size={16} />
              <span>Зберегти {activeModelObj?.name || 'Tesla'} в Гараж</span>
            </button>
          </div>
        )}
      </div>

      {/* SAVED CARS FLEET LIST */}
      {allCars.length > 1 && (
        <div className="mb-12">
          <h3 className="text-xl font-black font-montserrat text-gray-950 mb-4">
            Збережені автомобілі у вашому парку ({allCars.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {allCars.map((c) => {
              const isActive = activeCar?.id === c.id;
              return (
                <div
                  key={c.id}
                  className={`p-5 rounded-2xl border transition-all ${
                    isActive
                      ? 'border-red-600 bg-red-50/20 shadow-sm ring-1 ring-red-500'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-montserrat font-black text-lg text-gray-950">
                      Tesla {c.model}
                    </div>
                    {c.plate && (
                      <span className="font-mono font-bold text-xs bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-md text-gray-800 uppercase">
                        {c.plate}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mb-4">
                    {c.generation} &bull; {c.year} &bull; {c.drive || 'Standard'}
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    {isActive ? (
                      <span className="text-xs font-montserrat font-bold text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 size={14} />
                        <span>Активне</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSelectActiveCar(c)}
                        className="text-xs font-montserrat font-bold text-tesla-red hover:underline cursor-pointer"
                      >
                        Зробити активним
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleRemoveCar(c.id)}
                      className="text-gray-400 hover:text-red-600 p-1 transition-colors cursor-pointer"
                      title="Видалити"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* WHY USE GARAGE? (BENEFITS) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-gray-200/80">
        <div className="p-6 rounded-2xl bg-gray-50 border border-gray-100">
          <div className="w-10 h-10 rounded-xl bg-red-100 text-tesla-red flex items-center justify-center mb-3">
            <ShieldCheck size={20} />
          </div>
          <h4 className="font-montserrat font-bold text-base text-gray-900 mb-1">
            100% сумісність запчастин
          </h4>
          <p className="text-xs text-gray-500 leading-relaxed">
            Повна гарантія того, що замовлена деталь підійде під ваш рік, ревізію та тип приводу без переробок.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-gray-50 border border-gray-100">
          <div className="w-10 h-10 rounded-xl bg-red-100 text-tesla-red flex items-center justify-center mb-3">
            <Layers size={20} />
          </div>
          <h4 className="font-montserrat font-bold text-base text-gray-900 mb-1">
            Прямий перехід до схем EPC
          </h4>
          <p className="text-xs text-gray-500 leading-relaxed">
            Інтерактивні вибух-схеми вузлів відкриваються одразу з фільтром на вашу модель та покоління.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-gray-50 border border-gray-100">
          <div className="w-10 h-10 rounded-xl bg-red-100 text-tesla-red flex items-center justify-center mb-3">
            <Sparkles size={20} />
          </div>
          <h4 className="font-montserrat font-bold text-base text-gray-900 mb-1">
            Збереження в 1 клік
          </h4>
          <p className="text-xs text-gray-500 leading-relaxed">
            Авто зберігається у пам'яті браузера та вашому кабінеті — вам не потрібно щоразу повторно вводити дані.
          </p>
        </div>
      </div>
    </div>
  );
};
export default GaragePage;
