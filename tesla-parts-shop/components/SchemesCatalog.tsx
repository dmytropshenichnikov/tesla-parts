import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Layers,
  Search,
  MapPin,
  ChevronRight,
  Car,
  CheckCircle2,
  ShieldCheck,
  ArrowRight,
  Filter,
  Check
} from 'lucide-react';
import { api } from '../services/api';
import { SchematicSummary, SavedCar, SchematicModelOption } from '../types';
import { GarageModal } from './GarageModal';

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

const ALL_MODELS = '__all__';
const ALL_GENERATIONS = 'Всі покоління';

/**
 * Моделі та покоління більше не дублюються хардкодом — вони приходять
 * з категорій каталогу (`/schematics/model-options`), тож фільтр схем
 * завжди збігається з категоріями магазину.
 */
const resolveOption = (
  options: SchematicModelOption[],
  model?: string | null,
  generation?: string | null
): SchematicModelOption | null => {
  if (!model || options.length === 0) return null;
  const lowModel = model.toLowerCase();
  const direct = options.find((o) => o.category.toLowerCase() === lowModel);
  if (direct) return direct;
  const byModel = options.filter((o) => o.model.toLowerCase() === lowModel);
  if (byModel.length === 0) return null;
  if (generation) {
    const lowGen = generation.toLowerCase();
    const variant = byModel.find(
      (o) => o.category !== o.model && lowGen.includes(o.category.replace(o.model, '').trim().toLowerCase())
    );
    if (variant) return variant;
    const matched = byModel.find((o) => o.generations.some((g) => g.toLowerCase() === lowGen));
    if (matched) return matched;
  }
  return byModel.find((o) => o.category === o.model) || byModel[0];
};

export const SchemesCatalog: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [schematics, setSchematics] = useState<SchematicSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [modelOptions, setModelOptions] = useState<SchematicModelOption[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [selectedGen, setSelectedGen] = useState<string>(ALL_GENERATIONS);
  const [searchInput, setSearchInput] = useState<string>('');
  const [activeSearch, setActiveSearch] = useState<string>('');
  const [vinBanner, setVinBanner] = useState<string | null>(null);

  // Garage state
  const [isGarageOpen, setIsGarageOpen] = useState(false);
  const [activeCar, setActiveCar] = useState<SavedCar | null>(null);

  // Категорії каталогу — джерело моделей і поколінь для фільтрів
  useEffect(() => {
    api.getSchematicModelOptions().then((options) => {
      setModelOptions(options);
      if (options.length === 0) return;
      const hasUrlFilter = Boolean(searchParams.get('model') || searchParams.get('generation') || searchParams.get('vin'));
      if (!hasUrlFilter) {
        // Дефолт: категорія, під якою вже є схеми (щоб не відкривати порожній список)
        const fallback =
          options.find((o) => o.schematics_count > 0) || options[0];
        setSelectedModel((current) => current || fallback.category);
      }
    });
  }, []);

  useEffect(() => {
    if (modelOptions.length === 0) return;

    const vinParam = searchParams.get('vin');
    const modelParam = searchParams.get('model');
    const genParam = searchParams.get('generation');

    if (modelParam || genParam) {
      const option = resolveOption(modelOptions, modelParam || genParam, genParam);
      if (option) {
        setSelectedModel(option.category);
        setSelectedGen(
          genParam && option.generations.some((g) => g.toLowerCase() === genParam.toLowerCase())
            ? genParam
            : ALL_GENERATIONS
        );
      }
    }

    if (vinParam && vinParam.length === 17) {
      api.decodeVin(vinParam).then(res => {
        if (res.is_valid && res.model) {
          const option = resolveOption(modelOptions, res.model, res.generation);
          if (option) {
            setSelectedModel(option.category);
            setSelectedGen(ALL_GENERATIONS);
          }
          const newCar: SavedCar = {
            id: `car_${Date.now()}`,
            vin: res.vin,
            model: res.model,
            year: res.year,
            drive: res.drive,
            plant: res.plant,
            generation: res.generation || 'Стандартне',
            description: res.description || `Tesla ${res.model} ${res.year || ''}`
          };
          localStorage.setItem('tesla_garage_active_car', JSON.stringify(newCar));
          setActiveCar(newCar);
          window.dispatchEvent(new CustomEvent('garage-car-changed'));
          setVinBanner(`Розпізнано за VIN: Tesla ${res.model} ${res.year || ''} (${res.generation || ''})`);
        }
      }).catch(console.error);
    }
  }, [searchParams, modelOptions]);

  useEffect(() => {
    loadActiveCar();
    const handleGarageUpdate = () => loadActiveCar();
    window.addEventListener('garage-car-changed', handleGarageUpdate);
    return () => window.removeEventListener('garage-car-changed', handleGarageUpdate);
  }, [modelOptions]);

  useEffect(() => {
    if (!selectedModel) return;
    loadSchematics();
  }, [selectedModel, selectedGen, activeSearch]);

  const loadActiveCar = () => {
    try {
      const saved = localStorage.getItem('tesla_garage_active_car');
      if (saved) {
        const parsed: SavedCar = JSON.parse(saved);
        setActiveCar(parsed);
        // Автоматично підставляємо авто з гаража, якщо модель не задана в URL
        if (!searchParams.get('model') && !searchParams.get('generation') && modelOptions.length > 0) {
          const option = resolveOption(modelOptions, parsed.model, parsed.generation);
          if (option) {
            setSelectedModel(option.category);
            setSelectedGen(ALL_GENERATIONS);
          }
        }
      } else {
        setActiveCar(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadSchematics = async () => {
    try {
      setLoading(true);
      setError(null);

      const option = selectedModel === ALL_MODELS
        ? null
        : modelOptions.find((o) => o.category === selectedModel);

      // Бекенд сам розуміє складені назви категорій («Model 3 Highland» →
      // Model 3 + покоління Highland), тому передаємо саме категорію.
      const apiModel = option
        ? option.category
        : (selectedModel === ALL_MODELS ? undefined : selectedModel || undefined);

      const apiGen = selectedGen === ALL_GENERATIONS ? undefined : selectedGen;

      const data = await api.getSchematics({
        model: apiModel,
        generation: apiGen,
        q: activeSearch || undefined
      });
      setSchematics(data);
    } catch (err: any) {
      setError(err.message || 'Помилка завантаження схем');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = searchInput.trim();
    // If it's a 17-character VIN, let's open garage modal with it or decode it!
    if (val.length === 17) {
      setIsGarageOpen(true);
      return;
    }
    setActiveSearch(val);
  };

  const getFullImageUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  const activeModelObj = modelOptions.find((o) => o.category === selectedModel) || null;

  // Покоління показуємо лише тоді, коли категорія справді має кілька варіантів.
  const availableGenerations =
    activeModelObj && !activeModelObj.is_accessory && activeModelObj.generations.length > 1
      ? [ALL_GENERATIONS, ...activeModelObj.generations]
      : [];

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-xs text-gray-500 font-manrope mb-6">
        <Link to="/" className="hover:text-tesla-red transition-colors">
          Головна
        </Link>
        <ChevronRight size={14} className="text-gray-400" />
        <span className="text-gray-900 font-semibold">Схеми запчастин Tesla</span>
      </nav>

      {/* Hero / Title Section */}
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-black font-montserrat text-tesla-dark tracking-tight">
          Схеми запчастин Tesla
        </h1>
        <p className="text-sm sm:text-base text-gray-500 font-manrope mt-2 max-w-2xl">
          Інтерактивні складальні схеми вузлів (EPC) та сумісні оригінальні деталі й якісні аналоги для вашої комплектації.
        </p>
      </div>

      {vinBanner && (
        <div className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 size={20} className="text-emerald-600 flex-shrink-0" />
            <span className="font-montserrat font-bold text-sm">{vinBanner}</span>
          </div>
          <button
            onClick={() => setVinBanner(null)}
            className="text-xs font-bold text-emerald-700 hover:text-emerald-950 underline cursor-pointer"
          >
            Закрити
          </button>
        </div>
      )}

      {/* Search & Garage Banner */}
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm mb-8 space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="VIN або парт-номер деталі (напр. 1499151-00-C)..."
                className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-manrope focus:outline-none focus:ring-2 focus:ring-tesla-red focus:bg-white transition-all shadow-inner"
              />
              <Search
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
            </div>
            <button
              type="submit"
              className="px-6 py-3.5 bg-tesla-red hover:bg-red-700 text-white rounded-2xl font-montserrat font-bold text-sm transition-all shadow-md active:scale-95 cursor-pointer whitespace-nowrap"
            >
              Знайти
            </button>
          </form>

          {/* Garage trigger button */}
          <button
            onClick={() => setIsGarageOpen(true)}
            className="flex items-center justify-center gap-2.5 px-5 py-3.5 bg-gray-900 hover:bg-black text-white rounded-2xl font-montserrat font-bold text-sm transition-all shadow-sm active:scale-95 cursor-pointer whitespace-nowrap"
          >
            <Car size={18} className="text-tesla-red" />
            {activeCar ? `Гараж: ${activeCar.model}` : 'Додати авто в гараж'}
          </button>
        </div>

        {/* Active car notification */}
        {activeCar && (
          <div className="pt-3 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-manrope text-gray-600">
            <div className="flex items-center gap-2 text-emerald-700 font-semibold">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span>
                Активне авто: <strong>Tesla {activeCar.model} ({activeCar.year})</strong> — {activeCar.generation}
              </span>
            </div>
            <button
              onClick={() => setIsGarageOpen(true)}
              className="text-xs text-tesla-red hover:underline font-bold font-montserrat text-left sm:text-right"
            >
              Змінити авто
            </button>
          </div>
        )}
      </div>

      {/* Step 1: Model Selection Tabs */}
      <div className="mb-6">
        <div className="text-xs font-bold uppercase tracking-wider text-gray-400 font-montserrat mb-3">
          1. Оберіть модель Tesla
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
          {[
            { category: ALL_MODELS, label: 'Всі моделі' },
            ...modelOptions.map((o) => ({ category: o.category, label: o.category }))
          ].map((m) => {
            const isSelected = selectedModel === m.category;
            return (
              <button
                key={m.category}
                onClick={() => {
                  setSelectedModel(m.category);
                  setSelectedGen(ALL_GENERATIONS);
                }}
                className={`py-3 px-4 rounded-2xl font-montserrat font-bold text-xs sm:text-sm text-center transition-all cursor-pointer border ${
                  isSelected
                    ? 'border-tesla-red bg-red-50 text-tesla-red shadow-xs ring-2 ring-tesla-red/20'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Step 2: Generation Selector Pills (if model selected) */}
      {availableGenerations.length > 0 && (
        <div className="mb-8">
          <div className="text-xs font-bold uppercase tracking-wider text-gray-400 font-montserrat mb-3">
            2. Оберіть покоління
          </div>
          <div className="flex flex-wrap gap-2">
            {availableGenerations.map((gen) => {
              const isSelected = selectedGen === gen;
              return (
                <button
                  key={gen}
                  onClick={() => setSelectedGen(gen)}
                  className={`py-2 px-4 rounded-full text-xs font-montserrat font-semibold transition-all cursor-pointer border ${
                    isSelected
                      ? 'border-tesla-red bg-tesla-red text-white shadow-xs'
                      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {gen}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Schematics Results Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold font-montserrat text-gray-900 flex items-center gap-2">
            <Layers size={18} className="text-tesla-red" />
            Вузли та схеми
            <span className="text-xs font-normal text-gray-400 font-manrope">
              ({schematics.length})
            </span>
          </h2>
        </div>

        {loading ? (
          <div className="py-20 text-center text-gray-400 font-manrope">
            Завантаження схем...
          </div>
        ) : schematics.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-3xl border border-dashed border-gray-300 p-8">
            <Layers size={48} className="mx-auto text-gray-300 mb-3" />
            <h3 className="font-montserrat font-bold text-gray-700 text-lg">Схем не знайдено</h3>
            <p className="text-gray-400 font-manrope text-sm mt-1 max-w-md mx-auto">
              Спробуйте змінити фільтр моделі чи покоління або скиньте рядок пошуку.
            </p>
            <button
              onClick={() => {
                setSelectedModel('all');
                setSelectedGen('Всі покоління');
                setActiveSearch('');
                setSearchInput('');
              }}
              className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-tesla-red text-white rounded-xl text-xs font-montserrat font-bold cursor-pointer"
            >
              Скинути фільтри
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {schematics.map((s) => (
              <Link
                key={s.id}
                to={`/schemes/${s.id}`}
                className="group bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-xs hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col cursor-pointer"
              >
                {/* Diagram Thumbnail */}
                <div className="relative h-52 bg-[#fbfbfb] p-6 flex items-center justify-center border-b border-gray-50 overflow-hidden">
                  {s.image_url ? (
                    <img
                      src={getFullImageUrl(s.image_url)}
                      alt={s.title}
                      className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <Layers size={40} className="text-gray-300" />
                  )}
                  <div className="absolute top-4 right-4 bg-tesla-red text-white text-[11px] font-bold px-2.5 py-1 rounded-full font-montserrat flex items-center gap-1 shadow-sm">
                    <MapPin size={12} />
                    {s.hotspots_count} точок
                  </div>
                </div>

                {/* Details */}
                <div className="p-6 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-800 text-[11px] font-montserrat font-bold">
                        {s.model}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-red-50 text-tesla-red text-[11px] font-manrope font-semibold">
                        {s.generation}
                      </span>
                    </div>

                    <h3 className="font-montserrat font-bold text-gray-900 text-lg group-hover:text-tesla-red transition-colors mb-1.5 line-clamp-1">
                      {s.title}
                    </h3>

                    <p className="text-xs text-gray-500 font-manrope line-clamp-1">
                      {s.section} • {s.subsystem}
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between text-xs font-montserrat font-bold text-tesla-red group-hover:translate-x-0.5 transition-transform">
                    <span>Переглянути схему</span>
                    <ArrowRight size={16} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Garage Modal */}
      <GarageModal
        isOpen={isGarageOpen}
        onClose={() => setIsGarageOpen(false)}
        onCarSaved={(car) => {
          setActiveCar(car);
          if (car?.model) setSelectedModel(car.model);
        }}
      />
    </div>
  );
};
