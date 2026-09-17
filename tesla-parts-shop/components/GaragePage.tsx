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
  BookmarkCheck,
  Copy,
  Check,
  RotateCcw,
  Plus
} from 'lucide-react';
import { api } from '../services/api';
import { SavedCar, PlateLookupResult, VinDecodeResult } from '../types';
import { slugify } from '../utils/slugify';
import { useAuth } from '../context/AppContext';

// Helper for precise Tesla model & submodel matching
export const getCarTargetInfo = (car: SavedCar) => {
  const model = car.model || '';
  const gen = car.generation || '';
  const year = car.year || 0;

  const isHighland =
    model.toLowerCase().includes('highland') ||
    gen.toLowerCase().includes('highland') ||
    (model === 'Model 3' && year >= 2024);

  const isJuniper =
    model.toLowerCase().includes('juniper') ||
    gen.toLowerCase().includes('juniper') ||
    (model === 'Model Y' && year >= 2025);

  if (isHighland) {
    return {
      displayName: 'Model 3 Highland',
      fullTitle: 'Tesla Model 3 Highland',
      categorySlug: 'model-3-highland',
      schematicModel: 'Model 3 Highland',
      schematicGen: 'Highland (2024-...)',
      schemesUrl: '/schemes?model=Model%203%20Highland&generation=Highland%20(2024-...)',
    };
  }

  if (isJuniper) {
    return {
      displayName: 'Model Y Juniper',
      fullTitle: 'Tesla Model Y Juniper',
      categorySlug: 'model-y-juniper',
      schematicModel: 'Model Y Juniper',
      schematicGen: 'Juniper (2025-...)',
      schemesUrl: '/schemes?model=Model%20Y%20Juniper&generation=Juniper%20(2025-...)',
    };
  }

  const slug = slugify(model);
  const genParam = gen && !gen.includes('Стандартн') ? `&generation=${encodeURIComponent(gen)}` : '';
  return {
    displayName: model,
    fullTitle: `Tesla ${model}`,
    categorySlug: slug,
    schematicModel: model,
    schematicGen: gen,
    schemesUrl: `/schemes?model=${encodeURIComponent(model)}${genParam}`,
  };
};

export const GaragePage: React.FC = () => {
  const navigate = useNavigate();
  const { customerProfile } = useAuth();

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
    // Підтягуємо гараж з акаунта (якщо людина залогінена) і одразу переносимо
    // в нього авто, які вже лежали в цьому браузері.
    void syncGarageWithServer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Після входу гараж підтягуємо з акаунта (а локальні авто переносимо в нього),
  // після виходу — повертаємось до того, що лежить у браузері.
  useEffect(() => {
    if (customerProfile) void syncGarageWithServer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerProfile]);

  useEffect(() => {
    const onLogout = () => loadGarageState();
    window.addEventListener('customer-logged-out', onLogout);
    return () => window.removeEventListener('customer-logged-out', onLogout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  /**
   * Гараж на сервері. Якщо людина залогінена — авто їде за акаунтом, тож на
   * іншому пристрої гараж не порожній. Локальний гараж при цьому лишається:
   * він і кеш, і режим для незалогінених. Коли в акаунті ще нічого немає, а в
   * браузері авто вже збережені — переносимо їх в акаунт (import).
   */
  const syncGarageWithServer = async () => {
    if (!localStorage.getItem('customerToken')) return;
    try {
      // Локальні авто ЗАВЖДИ відправляємо на сервер — ендпоінт ідемпотентний,
      // тож дублі не створюються, а авто, додане до входу (як гість), не
      // губиться. Раніше імпорт спрацьовував лише для порожнього акаунта, і
      // таке авто зникало при вході.
      let localCars: SavedCar[] = [];
      let activeVin: string | undefined;
      try {
        localCars = JSON.parse(localStorage.getItem('tesla_garage_all_cars') || '[]');
        activeVin = JSON.parse(localStorage.getItem('tesla_garage_active_car') || 'null')?.vin;
      } catch {
        localCars = [];
      }

      const serverCars =
        localCars.length > 0 ? await api.importGarage(localCars, activeVin) : await api.getGarageCars();

      if (serverCars.length === 0) return;
      const active = serverCars.find((c) => c.isActive) || serverCars[0];
      localStorage.setItem('tesla_garage_all_cars', JSON.stringify(serverCars));
      localStorage.setItem('tesla_garage_active_car', JSON.stringify(active));
      setAllCars(serverCars);
      setActiveCar(active);
      window.dispatchEvent(new Event('garage-car-changed'));
    } catch (e) {
      console.error('Не вдалося синхронізувати гараж із акаунтом', e);
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

      // 3. Якщо людина залогінена — дублюємо в акаунт, щоб авто було й на
      //    іншому пристрої. Помилка мережі не ламає локальний гараж.
      if (localStorage.getItem('customerToken')) {
        api
          .addGarageCar(car)
          .then(() => syncGarageWithServer())
          .catch((e) => console.error('Не вдалося зберегти авто в акаунті', e));
      }
    } catch (e) {
      console.error('Failed to save car to garage', e);
    }
  };

  const handleSelectActiveCar = (car: SavedCar) => {
    localStorage.setItem('tesla_garage_active_car', JSON.stringify(car));
    setActiveCar(car);
    window.dispatchEvent(new Event('garage-car-changed'));
    showToast(`Активне авто перемкнено на ${car.model}`);
    if (car.serverId && localStorage.getItem('customerToken')) {
      api.setActiveGarageCar(car.serverId).catch((e) => console.error('Не вдалося перемкнути авто в акаунті', e));
    }
  };

  const handleRemoveCar = (carId: string) => {
    try {
      const removing = allCars.find((c) => c.id === carId);
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

      if (removing?.serverId && localStorage.getItem('customerToken')) {
        api
          .deleteGarageCar(removing.serverId)
          .then(() => syncGarageWithServer())
          .catch((e) => console.error('Не вдалося видалити авто з акаунта', e));
      }
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
      const msg =
        err?.message === 'Load failed' || err?.message === 'Failed to fetch'
          ? 'Не вдалося звʼязатися із сервером. Перевірте зʼєднання або скористайтесь ручним вибором моделі.'
          : (err?.message || 'Не вдалося знайти авто за номером');
      // Пошук за номером залежить від зовнішнього сервісу: якщо він не знає номер
      // або лежить, одразу ведемо людину на VIN — він розшифровується на нашому
      // боці, тож працює завжди. Повідомлення лишаємо видимим у вкладці VIN.
      setPlateError(msg);
      setVinError(msg);
      setAddMode('vin');
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
    <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6 md:py-10 font-manrope">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white px-4 py-2.5 sm:px-5 sm:py-3 rounded-xl shadow-2xl flex items-center gap-2.5 sm:gap-3 border border-gray-700 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0" />
          <span className="text-xs sm:text-sm font-semibold">{toastMsg}</span>
        </div>
      )}

      {/* Hero Header */}
      <div className="mb-4 sm:mb-6 md:mb-10 text-center max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 text-tesla-red border border-red-200/80 text-[10px] sm:text-xs font-montserrat font-bold uppercase tracking-wider mb-2">
          <Car size={13} />
          <span>Персональний сервіс</span>
        </div>
        <h1 className="text-2xl sm:text-3xl md:text-5xl font-black font-montserrat text-gray-950 tracking-tight mb-1.5 sm:mb-2">
          Мій Гараж Tesla
        </h1>
        <p className="text-gray-600 text-xs sm:text-sm md:text-base leading-relaxed">
          Додайте ваш автомобіль за <strong className="text-gray-900">номером машини</strong>, VIN-кодом або оберіть модель вручну. Каталог та схеми запчастин автоматично підлаштуються під точну комплектацію вашої Tesla.
        </p>
      </div>
      {/* ACTIVE CAR SECTION */}
      {activeCar ? (() => {
        const targetInfo = getCarTargetInfo(activeCar);
        return (
          <div className="mb-5 sm:mb-8 md:mb-10 bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 shadow-lg shadow-slate-100/80 border border-gray-200/90 relative overflow-hidden transition-all">
            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-6 md:gap-8">
              <div className="space-y-2.5 sm:space-y-3.5">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-[10px] sm:text-xs font-montserrat font-bold uppercase tracking-wider">
                    <CheckCircle2 size={12} className="text-emerald-600" />
                    <span>Активне авто для підбору</span>
                  </span>

                  {/* Ukrainian License Plate Badge */}
                  {activeCar.plate && (
                    <div className="inline-flex items-center rounded-lg border-2 border-gray-900 bg-white shadow-xs overflow-hidden h-6 sm:h-7">
                      <div className="bg-[#0057B7] text-white px-1.5 sm:px-2 h-full flex flex-col justify-center items-center text-[8px] sm:text-[9px] font-black leading-tight border-r border-[#0057B7]">
                        <span className="text-[#FFDD00] text-[7px] sm:text-[8px] leading-none">UA</span>
                      </div>
                      <div className="px-2 sm:px-2.5 font-mono font-black text-[11px] sm:text-xs tracking-wider text-gray-950 uppercase">
                        {activeCar.plate}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <h2 className="text-xl sm:text-2xl md:text-3xl font-black font-montserrat tracking-tight text-gray-950 mb-0.5 sm:mb-1">
                    {targetInfo.fullTitle}
                  </h2>
                  <div className="text-gray-500 text-xs sm:text-sm md:text-base font-medium font-manrope">
                    {activeCar.generation} • {activeCar.year} рік
                    {activeCar.drive ? ` • ${activeCar.drive}` : ''}
                  </div>
                </div>

                {/* VIN & Factory info */}
                {activeCar.vin && (
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pt-0.5 sm:pt-1">
                    <div className="inline-flex items-center gap-1.5 sm:gap-2 bg-gray-50 border border-gray-200 rounded-lg sm:rounded-xl px-2.5 py-1 sm:py-1.5 text-[11px] sm:text-xs font-mono text-gray-800">
                      <span className="text-gray-400 uppercase font-sans text-[9px] sm:text-[10px] font-bold">VIN:</span>
                      <span className="tracking-wider sm:tracking-widest font-bold">{activeCar.vin}</span>
                      <button
                        type="button"
                        onClick={() => copyVinToClipboard(activeCar.vin!)}
                        className="p-0.5 hover:text-gray-950 text-gray-400 transition-colors cursor-pointer"
                        title="Скопіювати VIN"
                      >
                        {copiedVin ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                      </button>
                    </div>
                    {activeCar.plant && (
                      <span className="text-[11px] sm:text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg sm:rounded-xl px-2.5 py-1 sm:py-1.5 font-medium font-manrope">
                        Завод: {activeCar.plant}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2 sm:gap-2.5 flex-shrink-0 w-full sm:w-auto">
                <Link
                  to={`/category/${targetInfo.categorySlug}`}
                  className="inline-flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl bg-tesla-red hover:bg-red-700 text-white font-montserrat font-bold text-xs sm:text-sm transition-all duration-200 shadow-md shadow-red-600/20 active:scale-98 cursor-pointer"
                >
                  <span>Підібрати деталі {targetInfo.displayName}</span>
                  <ArrowRight size={15} />
                </Link>
                <Link
                  to={targetInfo.schemesUrl}
                  className="inline-flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl bg-gray-900 hover:bg-black text-white font-montserrat font-bold text-xs sm:text-sm transition-all duration-200 shadow-xs active:scale-98 cursor-pointer"
                >
                  <Layers size={15} className="text-red-400" />
                  <span>Схеми вузлів {targetInfo.displayName}</span>
                </Link>
                <button
                  type="button"
                  onClick={() => handleRemoveCar(activeCar.id)}
                  className="inline-flex items-center justify-center gap-1.5 px-2 py-1 text-[11px] text-gray-400 hover:text-red-600 transition-colors cursor-pointer sm:col-span-2 lg:col-span-1"
                >
                  <Trash2 size={12} />
                  <span>Видалити авто з гаража</span>
                </button>
              </div>
            </div>
          </div>
        );
      })() : (
        <div className="mb-5 sm:mb-8 md:mb-10 bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-8 md:p-10 border border-gray-200 text-center shadow-xs">
          <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-red-50 text-tesla-red flex items-center justify-center mx-auto mb-3 sm:mb-4 border border-red-100">
            <Car size={24} className="sm:w-8 sm:h-8" />
          </div>
          <h2 className="text-lg sm:text-xl md:text-2xl font-black font-montserrat text-gray-950 mb-1.5 sm:mb-2">
            У вашому Гаражі ще немає автомобіля
          </h2>
          <p className="text-gray-500 text-xs sm:text-sm max-w-md mx-auto mb-4 sm:mb-6">
            Додайте вашу Tesla за номером авто або VIN-кодом нижче, щоб автоматично бачити тільки сумісні деталі та схеми.
          </p>
        </div>
      )}

      {/* ADD / CHANGE CAR SECTION */}
      <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 border border-gray-200/90 shadow-xs mb-8 md:mb-12">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-3.5 sm:pb-6 border-b border-gray-100 mb-4 sm:mb-6">
          <div>
            <h3 className="text-base sm:text-xl md:text-2xl font-black font-montserrat text-gray-950">
              {activeCar ? 'Додати ще одне авто або змінити' : 'Додати автомобіль у Гараж'}
            </h3>
            <p className="text-gray-500 text-[11px] sm:text-xs md:text-sm mt-0.5">
              Оберіть найзручніший для вас спосіб підбору:
            </p>
          </div>

          {/* Mode Tabs - Compact single-line segmented control on mobile */}
          <div className="grid grid-cols-3 sm:flex p-1 bg-gray-100 rounded-xl sm:rounded-2xl border border-gray-200/60 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setAddMode('plate')}
              className={`flex items-center justify-center gap-1 py-1.5 sm:py-2 px-1.5 sm:px-3.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-montserrat font-bold transition-all cursor-pointer ${
                addMode === 'plate'
                  ? 'bg-white text-gray-950 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span className="sm:hidden">Номер авто</span>
              <span className="hidden sm:inline">За номером авто</span>
              <span className="hidden md:inline-block bg-emerald-100 text-emerald-700 text-[9px] px-1.5 py-0.2 rounded-full font-bold">
                Швидко
              </span>
            </button>
            <button
              type="button"
              onClick={() => setAddMode('vin')}
              className={`flex items-center justify-center py-1.5 sm:py-2 px-1.5 sm:px-3.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-montserrat font-bold transition-all cursor-pointer ${
                addMode === 'vin'
                  ? 'bg-white text-gray-950 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span className="sm:hidden">VIN-код</span>
              <span className="hidden sm:inline">За VIN-кодом</span>
            </button>
            <button
              type="button"
              onClick={() => setAddMode('manual')}
              className={`flex items-center justify-center py-1.5 sm:py-2 px-1.5 sm:px-3.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-montserrat font-bold transition-all cursor-pointer ${
                addMode === 'manual'
                  ? 'bg-white text-gray-950 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span className="sm:hidden">Модель</span>
              <span className="hidden sm:inline">Обрати модель</span>
            </button>
          </div>
        </div>

        {/* TAB 1: PLATE SEARCH */}
        {addMode === 'plate' && (
          <div className="max-w-xl mx-auto py-1 sm:py-2">
            <div className="text-center mb-3.5 sm:mb-6">
              <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                Введіть державний номерний знак авто в українському форматі. Миттєво підтягнемо офіційний VIN та точні характеристики вашої Tesla.
              </p>
            </div>

            <form onSubmit={handlePlateSearch} className="space-y-3 sm:space-y-4">
              {/* Ukrainian License Plate Input Box */}
              <div className="relative flex items-stretch border-2 border-gray-900 rounded-xl sm:rounded-2xl overflow-hidden shadow-sm focus-within:ring-4 focus-within:ring-red-500/20 transition-all bg-white">
                {/* Left Blue UA Strip */}
                <div className="bg-[#0057B7] text-white px-2.5 sm:px-4 flex flex-col justify-center items-center flex-shrink-0 select-none border-r border-[#004799]">
                  <div className="w-3.5 sm:w-4 h-2.5 sm:h-3 bg-[#0057B7] relative flex flex-col justify-between overflow-hidden rounded-xs border border-white/20 mb-0.5">
                    <div className="h-1 sm:h-1.5 bg-[#0057B7]" />
                    <div className="h-1 sm:h-1.5 bg-[#FFDD00]" />
                  </div>
                  <span className="font-mono font-black text-[10px] sm:text-sm tracking-wider text-white">UA</span>
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
                  className="w-full py-2 sm:py-3.5 px-3 sm:px-4 font-mono font-black text-lg sm:text-2xl tracking-widest text-gray-950 placeholder:text-gray-300 outline-none uppercase bg-white"
                  autoFocus
                />

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={plateLoading || !plateInput.trim()}
                  className="px-4 sm:px-7 bg-tesla-red hover:bg-red-700 disabled:bg-gray-300 text-white font-montserrat font-bold text-xs sm:text-base flex items-center justify-center gap-1.5 sm:gap-2 transition-colors cursor-pointer flex-shrink-0"
                >
                  {plateLoading ? (
                    <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Search size={16} />
                      <span className="hidden sm:inline">Знайти</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between text-[10px] sm:text-xs text-gray-400 px-1">
                <span>Приклади: КА1234АА, АА7777ВВ</span>
                <span>Безкоштовно • 0.3 сек</span>
              </div>
            </form>

            {/* Error Message */}
            {plateError && (
              <div className="mt-3.5 sm:mt-5 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-red-50 border border-red-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 sm:gap-3 text-red-700 text-xs sm:text-sm animate-in fade-in duration-200">
                <div className="flex items-start gap-2.5 sm:gap-3">
                  <AlertCircle size={16} className="text-tesla-red flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold font-montserrat">
                      {plateError.includes('не є Tesla') ? 'Автомобіль не є Tesla' : 'Не вдалося розпізнати авто'}
                    </div>
                    <div className="text-[11px] sm:text-xs text-red-600 mt-0.5">{plateError}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAddMode('manual')}
                  className="px-3 py-1.5 bg-gray-900 hover:bg-black text-white rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-montserrat font-bold transition-colors cursor-pointer shrink-0 self-end sm:self-center"
                >
                  Обрати Tesla вручну
                </button>
              </div>
            )}

            {/* Result Card (Only for verified Tesla) */}
            {plateResult && plateResult.is_tesla && (
              <div className="mt-4 sm:mt-6 p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-gray-50 border border-gray-200 animate-in zoom-in-95 duration-200">
                <div>
                  <div className="flex items-center justify-between mb-2.5 sm:mb-3 pb-2.5 sm:pb-3 border-b border-gray-200">
                    <div className="flex items-center gap-1.5 sm:gap-2 text-emerald-600 font-montserrat font-bold text-xs sm:text-sm">
                      <CheckCircle2 size={16} />
                      <span>Знайдено автомобіль Tesla!</span>
                    </div>
                    <div className="font-mono font-bold text-[11px] sm:text-xs bg-white px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg border border-gray-200 text-gray-800">
                      {plateResult.plate}
                    </div>
                  </div>

                  <div className="space-y-1 sm:space-y-1.5 mb-4 sm:mb-5">
                    <h4 className="text-lg sm:text-xl font-black font-montserrat text-gray-950">
                      Tesla {plateResult.tesla_specs ? plateResult.tesla_specs.model : plateResult.model}
                    </h4>
                    <div className="text-xs sm:text-sm text-gray-600">
                      Покоління: <strong>{plateResult.tesla_specs?.generation || 'Стандартне'}</strong> • Рік: <strong>{plateResult.year}</strong>
                    </div>
                    {plateResult.tesla_specs?.drive && (
                      <div className="text-[11px] sm:text-xs text-gray-500">
                        Привід: {plateResult.tesla_specs.drive}
                      </div>
                    )}
                    <div className="text-[11px] sm:text-xs font-mono text-gray-400 pt-0.5">
                      VIN: {plateResult.vin}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveFromPlate}
                    className="w-full py-2.5 sm:py-3 px-3 sm:px-4 bg-tesla-red hover:bg-red-700 text-white rounded-xl font-montserrat font-bold text-xs sm:text-sm transition-all shadow-md active:scale-98 flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer"
                  >
                    <Plus size={15} />
                    <span>Додати в Мій Гараж та підібрати запчастини</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: VIN SEARCH */}
        {addMode === 'vin' && (
          <div className="max-w-xl mx-auto py-1 sm:py-2">
            <div className="text-center mb-3.5 sm:mb-6">
              <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                Введіть 17-значний VIN-номер кузова вашої Tesla (вказаний у техпаспорті або в меню монітора авто).
              </p>
            </div>

            <form onSubmit={handleVinSearch} className="space-y-3 sm:space-y-4">
              <div className="relative flex items-stretch border-2 border-gray-900 rounded-xl sm:rounded-2xl overflow-hidden shadow-sm focus-within:ring-4 focus-within:ring-red-500/20 transition-all bg-white">
                <input
                  type="text"
                  value={vinInput}
                  onChange={(e) => {
                    setVinInput(e.target.value.toUpperCase());
                    setVinError(null);
                  }}
                  placeholder="5YJ3E1EB..."
                  maxLength={17}
                  className="w-full py-2 sm:py-3.5 px-3 sm:px-4 font-mono font-bold text-xs sm:text-base tracking-widest text-gray-950 placeholder:text-gray-300 outline-none uppercase bg-white"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={vinLoading || vinInput.trim().length !== 17}
                  className="px-4 sm:px-7 bg-tesla-red hover:bg-red-700 disabled:bg-gray-300 text-white font-montserrat font-bold text-xs sm:text-base flex items-center justify-center gap-1.5 sm:gap-2 transition-colors cursor-pointer flex-shrink-0"
                >
                  {vinLoading ? (
                    <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Search size={16} />
                      <span className="hidden sm:inline">Розпізнати</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between text-[10px] sm:text-xs text-gray-400 px-1">
                <span>Символів: {vinInput.length} / 17</span>
                <span>Підтримуються Model 3, Y, S, X, Cybertruck</span>
              </div>
            </form>

            {vinError && (
              <div className="mt-3.5 sm:mt-5 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-red-50 border border-red-200 flex items-start gap-2.5 sm:gap-3 text-red-700 text-xs sm:text-sm animate-in fade-in duration-200">
                <AlertCircle size={16} className="text-tesla-red flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold font-montserrat">Авто не підібралось автоматично</div>
                  <div className="text-[11px] sm:text-xs text-red-600 mt-0.5">{vinError}</div>
                </div>
              </div>
            )}

            {vinResult && (
              <div className="mt-4 sm:mt-6 p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-gray-50 border border-gray-200 animate-in zoom-in-95 duration-200">
                <div className="flex items-center gap-1.5 sm:gap-2 text-emerald-600 font-montserrat font-bold text-xs sm:text-sm mb-2.5 sm:mb-3 pb-2.5 sm:pb-3 border-b border-gray-200">
                  <CheckCircle2 size={16} />
                  <span>VIN успішно розшифровано!</span>
                </div>

                <div className="space-y-1 sm:space-y-1.5 mb-4 sm:mb-5">
                  <h4 className="text-lg sm:text-xl font-black font-montserrat text-gray-950">
                    Tesla {vinResult.model}
                  </h4>
                  <div className="text-xs sm:text-sm text-gray-600">
                    Покоління: <strong>{vinResult.generation}</strong> • Рік: <strong>{vinResult.year}</strong>
                  </div>
                  <div className="text-[11px] sm:text-xs text-gray-500">
                    Привід: {vinResult.drive} • Завод: {vinResult.plant}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSaveFromVin}
                  className="w-full py-2.5 sm:py-3 px-3 sm:px-4 bg-tesla-red hover:bg-red-700 text-white rounded-xl font-montserrat font-bold text-xs sm:text-sm transition-all shadow-md active:scale-98 flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer"
                >
                  <Plus size={15} />
                  <span>Зберегти в Мій Гараж</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: MANUAL SELECTION */}
        {addMode === 'manual' && (
          <div className="max-w-2xl mx-auto py-1 sm:py-2 space-y-3.5 sm:space-y-5">
            {/* Step 1: Model Selection */}
            <div>
              <label className="block text-[11px] sm:text-xs font-bold font-montserrat uppercase tracking-wider text-gray-500 mb-1.5 sm:mb-2">
                1. Оберіть модель Tesla
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
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
                      className={`p-2 sm:p-3 rounded-xl sm:rounded-2xl border text-center transition-all cursor-pointer ${
                        isSelected
                          ? 'border-red-600 bg-red-50/60 text-tesla-red shadow-xs ring-1 ring-red-500'
                          : 'border-gray-200 bg-white text-gray-800 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-montserrat font-black text-xs sm:text-sm">{m.name}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Generation */}
            {activeModelObj && activeModelObj.generations?.length > 0 && (
              <div>
                <label className="block text-[11px] sm:text-xs font-bold font-montserrat uppercase tracking-wider text-gray-500 mb-1.5 sm:mb-2">
                  2. Покоління / Ревізія
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2">
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
                        className={`p-2 sm:p-3 rounded-lg sm:rounded-xl border text-left transition-all cursor-pointer ${
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-[11px] sm:text-xs font-bold font-montserrat uppercase tracking-wider text-gray-500 mb-1 sm:mb-1.5">
                    3. Рік випуску
                  </label>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="w-full p-2 sm:p-2.5 bg-gray-50 border border-gray-200 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-red-500/20"
                  >
                    {activeGenObj.years.map((y: number) => (
                      <option key={y} value={y}>
                        {y} рік
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] sm:text-xs font-bold font-montserrat uppercase tracking-wider text-gray-500 mb-1 sm:mb-1.5">
                    4. Модифікація / Привід
                  </label>
                  <select
                    value={selectedTrim}
                    onChange={(e) => setSelectedTrim(e.target.value)}
                    className="w-full p-2 sm:p-2.5 bg-gray-50 border border-gray-200 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-red-500/20"
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
              className="w-full py-2.5 sm:py-3.5 px-3 sm:px-4 bg-tesla-red hover:bg-red-700 text-white rounded-xl font-montserrat font-bold text-xs sm:text-sm transition-all shadow-md active:scale-98 flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer mt-3 sm:mt-4"
            >
              <Plus size={15} />
              <span>Зберегти {activeModelObj?.name || 'Tesla'} в Гараж</span>
            </button>
          </div>
        )}
      </div>

      {/* SAVED CARS FLEET LIST */}
      {allCars.length > 1 && (
        <div className="mb-8 sm:mb-12">
          <h3 className="text-base sm:text-xl font-black font-montserrat text-gray-950 mb-3 sm:mb-4">
            Збережені автомобілі у вашому парку ({allCars.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {allCars.map((c) => {
              const isActive = activeCar?.id === c.id;
              return (
                <div
                  key={c.id}
                  className={`p-3.5 sm:p-5 rounded-xl sm:rounded-2xl border transition-all ${
                    isActive
                      ? 'border-red-600 bg-red-50/20 shadow-xs ring-1 ring-red-500'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                    <div className="font-montserrat font-black text-base sm:text-lg text-gray-950">
                      Tesla {c.model}
                    </div>
                    {c.plate && (
                      <span className="font-mono font-bold text-[11px] sm:text-xs bg-gray-100 border border-gray-200 px-1.5 sm:px-2 py-0.5 rounded-md text-gray-800 uppercase">
                        {c.plate}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] sm:text-xs text-gray-500 mb-3 sm:mb-4">
                    {c.generation} • {c.year} • {c.drive || 'Standard'}
                  </div>

                  <div className="flex items-center justify-between pt-2.5 sm:pt-3 border-t border-gray-100">
                    {isActive ? (
                      <span className="text-[11px] sm:text-xs font-montserrat font-bold text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 size={13} />
                        <span>Активне</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSelectActiveCar(c)}
                        className="text-[11px] sm:text-xs font-montserrat font-bold text-tesla-red hover:underline cursor-pointer"
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
                      <Trash2 size={14} />
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
            Інтерактивні схеми вузлів (EPC) відкриваються одразу з фільтром на вашу модель та покоління.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-gray-50 border border-gray-100">
          <div className="w-10 h-10 rounded-xl bg-red-100 text-tesla-red flex items-center justify-center mb-3">
            <BookmarkCheck size={20} />
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
