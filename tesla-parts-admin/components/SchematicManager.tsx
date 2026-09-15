import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Trash2,
  Edit2,
  Save,
  ArrowLeft,
  Upload,
  Layers,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Search,
  ExternalLink,
  DollarSign
} from 'lucide-react';
import { api } from '../services/api';
import { Schematic, SchematicSummary, SchematicHotspot, HotspotVariant, Product } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

const TESLA_MODELS = [
  'Model 3',
  'Model Y',
  'Model S',
  'Model X',
  'Cybertruck'
];

const GENERATIONS_BY_MODEL: Record<string, string[]> = {
  'Model 3': ['Highland (2024-...)', 'Classic (2017-2023)'],
  'Model Y': ['Classic (2020-2024)', 'Juniper (2025-...)'],
  'Model S': ['Plaid / Refresh (2021-...)', 'Facelift (2016-2020)', 'Classic (2012-2016)'],
  'Model X': ['Plaid / Refresh (2021-...)', 'Classic (2015-2020)'],
  'Cybertruck': ['1st Gen (2023-...)']
};

export const SchematicManager: React.FC = () => {
  const [schematics, setSchematics] = useState<SchematicSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filter state for list
  const [filterModel, setFilterModel] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Editing state
  const [editingSchematic, setEditingSchematic] = useState<Schematic | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Selected hotspot for editing
  const [selectedHotspotIdx, setSelectedHotspotIdx] = useState<number | null>(null);

  // Catalog products for linking
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [catalogSearch, setCatalogSearch] = useState<string>('');

  // Image canvas ref
  const imageContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadSchematics();
    loadCatalogProducts();
  }, [filterModel, searchQuery]);

  const loadSchematics = async () => {
    try {
      setLoading(true);
      const data = await api.getSchematics({
        model: filterModel || undefined,
        q: searchQuery || undefined
      });
      setSchematics(data);
    } catch (err: any) {
      setError(err.message || 'Помилка завантаження схем');
    } finally {
      setLoading(false);
    }
  };

  const loadCatalogProducts = async () => {
    try {
      const res = await api.getProducts({ page_size: 100 });
      setCatalogProducts(res.products || []);
    } catch (err) {
      console.error('Failed to load products for link:', err);
    }
  };

  const handleCreateNew = () => {
    setIsNew(true);
    setEditingSchematic({
      id: 0,
      title: '',
      model: 'Model 3',
      generation: 'Highland (2024-...)',
      section: 'НАРУЖНЫЕ КРЕПЛЕНИЯ',
      subsystem: 'Защита днища и диффузор',
      image_url: '',
      sort_order: 1,
      hotspots: []
    });
    setSelectedHotspotIdx(null);
  };

  const handleEdit = async (id: number) => {
    try {
      setLoading(true);
      const data = await api.getSchematic(id);
      setEditingSchematic(data);
      setIsNew(false);
      setSelectedHotspotIdx(data.hotspots.length > 0 ? 0 : null);
    } catch (err: any) {
      setError(err.message || 'Помилка завантаження схеми');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Ви впевнені, що хочете видалити цю схему та всі її точки?')) return;
    try {
      await api.deleteSchematic(id);
      setSuccessMsg('Схему видалено');
      loadSchematics();
    } catch (err: any) {
      setError(err.message || 'Помилка видалення');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingSchematic) return;

    try {
      setUploadingImage(true);
      const res = await api.uploadSchematicImage(file);
      setEditingSchematic({
        ...editingSchematic,
        image_url: res.image_url
      });
      setSuccessMsg('Зображення завантажено');
    } catch (err: any) {
      setError(err.message || 'Помилка завантаження зображення');
    } finally {
      setUploadingImage(false);
    }
  };

  // Canvas click to add a new pin
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!imageContainerRef.current || !editingSchematic) return;

    const rect = imageContainerRef.current.getBoundingClientRect();
    const xPx = e.clientX - rect.left;
    const yPx = e.clientY - rect.top;

    const xPercent = Math.round((xPx / rect.width) * 1000) / 10;
    const yPercent = Math.round((yPx / rect.height) * 1000) / 10;

    // Check if clicked near an existing pin
    const clickedExistingIdx = editingSchematic.hotspots.findIndex(h => {
      const pinX = (h.x / 100) * rect.width;
      const pinY = (h.y / 100) * rect.height;
      const dist = Math.hypot(pinX - xPx, pinY - yPx);
      return dist <= 18;
    });

    if (clickedExistingIdx >= 0) {
      setSelectedHotspotIdx(clickedExistingIdx);
      return;
    }

    // Next pin number
    const maxNum = editingSchematic.hotspots.reduce((acc, h) => Math.max(acc, h.number), 0);
    const newNumber = maxNum + 1;

    const newHotspot: SchematicHotspot = {
      number: newNumber,
      x: xPercent,
      y: yPercent,
      name: `Деталь #${newNumber}`,
      part_number: '',
      sort_order: newNumber,
      variants: [
        {
          name: 'Оригинал новый',
          type: 'original',
          condition: 'new',
          priceUAH: 1000,
          priceUSD: 25,
          inStock: true
        }
      ]
    };

    const updated = [...editingSchematic.hotspots, newHotspot];
    setEditingSchematic({
      ...editingSchematic,
      hotspots: updated
    });
    setSelectedHotspotIdx(updated.length - 1);
  };

  const handleUpdateHotspot = (index: number, field: keyof SchematicHotspot, value: any) => {
    if (!editingSchematic) return;
    const updated = [...editingSchematic.hotspots];
    updated[index] = {
      ...updated[index],
      [field]: value
    };
    setEditingSchematic({
      ...editingSchematic,
      hotspots: updated
    });
  };

  const handleDeleteHotspot = (index: number) => {
    if (!editingSchematic) return;
    const updated = editingSchematic.hotspots.filter((_, i) => i !== index);
    setEditingSchematic({
      ...editingSchematic,
      hotspots: updated
    });
    setSelectedHotspotIdx(updated.length > 0 ? Math.max(0, index - 1) : null);
  };

  const handleAddVariant = (hotspotIdx: number) => {
    if (!editingSchematic) return;
    const hotspot = editingSchematic.hotspots[hotspotIdx];
    const currentVariants = hotspot.variants || [];
    const newVar: HotspotVariant = {
      name: 'Аналог новый',
      type: 'analog',
      condition: 'new',
      priceUAH: 800,
      priceUSD: 20,
      inStock: true
    };
    handleUpdateHotspot(hotspotIdx, 'variants', [...currentVariants, newVar]);
  };

  const handleUpdateVariant = (
    hotspotIdx: number,
    varIdx: number,
    field: keyof HotspotVariant,
    value: any
  ) => {
    if (!editingSchematic) return;
    const hotspot = editingSchematic.hotspots[hotspotIdx];
    const updatedVariants = [...(hotspot.variants || [])];
    updatedVariants[varIdx] = {
      ...updatedVariants[varIdx],
      [field]: value
    };
    handleUpdateHotspot(hotspotIdx, 'variants', updatedVariants);
  };

  const handleDeleteVariant = (hotspotIdx: number, varIdx: number) => {
    if (!editingSchematic) return;
    const hotspot = editingSchematic.hotspots[hotspotIdx];
    const updatedVariants = (hotspot.variants || []).filter((_, i) => i !== varIdx);
    handleUpdateHotspot(hotspotIdx, 'variants', updatedVariants);
  };

  const handleSave = async () => {
    if (!editingSchematic) return;
    if (!editingSchematic.title.trim()) {
      setError('Введіть назву вузла / схеми');
      return;
    }
    if (!editingSchematic.image_url) {
      setError('Завантажте зображення схеми');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      // Prepare payload with formatted variants_json
      const hotspotsPayload = editingSchematic.hotspots.map((h, i) => ({
        number: h.number || i + 1,
        x: h.x,
        y: h.y,
        part_number: h.part_number || '',
        name: h.name || `Деталь #${h.number}`,
        product_id: h.product_id || null,
        variants_json: JSON.stringify(h.variants || []),
        sort_order: h.sort_order ?? i + 1
      }));

      const payload = {
        title: editingSchematic.title,
        model: editingSchematic.model,
        generation: editingSchematic.generation,
        section: editingSchematic.section,
        subsystem: editingSchematic.subsystem,
        image_url: editingSchematic.image_url,
        sort_order: editingSchematic.sort_order || 1,
        hotspots: hotspotsPayload
      };

      if (isNew) {
        await api.createSchematic(payload);
        setSuccessMsg('Схему успішно створено');
      } else {
        await api.updateSchematic(editingSchematic.id, payload);
        setSuccessMsg('Схему оновлено');
      }

      setEditingSchematic(null);
      loadSchematics();
    } catch (err: any) {
      setError(err.message || 'Помилка збереження схеми');
    } finally {
      setSaving(false);
    }
  };

  const getFullImageUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  // RENDER: LIST VIEW
  if (!editingSchematic) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black font-montserrat text-gray-900 uppercase tracking-wide flex items-center gap-2">
              <Layers className="text-red-600" size={28} />
              Схеми запчастин (EPC)
            </h1>
            <p className="text-gray-500 font-manrope text-sm mt-1">
              Керування інтерактивними схемами вузлів Tesla з розстановкою точок деталей
            </p>
          </div>
          <button
            onClick={handleCreateNew}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-montserrat font-bold text-sm transition-colors shadow-sm"
          >
            <Plus size={18} />
            Додати схему
          </button>
        </div>

        {/* Notifications */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700 text-sm font-manrope">
            <AlertCircle size={20} className="shrink-0 text-red-600" />
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-xs underline">Закрити</button>
          </div>
        )}
        {successMsg && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3 text-green-700 text-sm font-manrope">
            <CheckCircle2 size={20} className="shrink-0 text-green-600" />
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg(null)} className="ml-auto text-xs underline">Закрити</button>
          </div>
        )}

        {/* Filter bar */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Пошук за назвою вузла або розділу..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-manrope focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <div className="w-full md:w-56">
            <select
              value={filterModel}
              onChange={(e) => setFilterModel(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-manrope focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="">Всі моделі Tesla</option>
              {TESLA_MODELS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Grid of Schematics */}
        {loading ? (
          <div className="py-20 text-center text-gray-400 font-manrope">
            Завантаження схем...
          </div>
        ) : schematics.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-2xl border border-dashed border-gray-300">
            <Layers size={48} className="mx-auto text-gray-300 mb-3" />
            <h3 className="font-montserrat font-bold text-gray-700 text-lg">Схем не знайдено</h3>
            <p className="text-gray-400 font-manrope text-sm mt-1 max-w-md mx-auto">
              Створіть першу інтерактивну схему із точками та прив’язкою до деталей
            </p>
            <button
              onClick={handleCreateNew}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-montserrat font-bold"
            >
              <Plus size={16} /> Додати першу схему
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {schematics.map((s) => (
              <div
                key={s.id}
                className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col"
              >
                <div className="relative h-48 bg-gray-50 border-b border-gray-100 flex items-center justify-center p-4">
                  {s.image_url ? (
                    <img
                      src={getFullImageUrl(s.image_url)}
                      alt={s.title}
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <Layers size={36} className="text-gray-300" />
                  )}
                  <div className="absolute top-3 right-3 bg-red-600 text-white text-xs font-bold px-2.5 py-1 rounded-full font-montserrat flex items-center gap-1 shadow-sm">
                    <MapPin size={12} />
                    {s.hotspots_count} точок
                  </div>
                </div>

                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-800 text-xs font-montserrat font-bold">
                      {s.model}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-xs font-manrope font-medium">
                      {s.generation}
                    </span>
                  </div>

                  <h3 className="font-montserrat font-bold text-gray-900 text-lg line-clamp-1 mb-1">
                    {s.title}
                  </h3>

                  <p className="text-xs text-gray-500 font-manrope mb-4">
                    {s.section} • {s.subsystem}
                  </p>

                  <div className="mt-auto pt-4 border-t border-gray-100 flex items-center justify-between">
                    <button
                      onClick={() => handleEdit(s.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold font-montserrat text-gray-700 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Edit2 size={14} /> Редагувати точки
                    </button>
                    <button
                      onClick={() => handleDelete(s.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                      title="Видалити"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // RENDER: EDIT / PINNING CANVAS VIEW
  const selectedHotspot = selectedHotspotIdx !== null ? editingSchematic.hotspots[selectedHotspotIdx] : null;

  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setEditingSchematic(null)}
            className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-black font-montserrat text-gray-900">
              {isNew ? 'Нова інтерактивна схема' : `Редагування: ${editingSchematic.title || 'Схема'}`}
            </h1>
            <p className="text-xs text-gray-500 font-manrope">
              Клікніть на зображення, щоб поставити точку деталі (hotspot)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setEditingSchematic(null)}
            className="px-4 py-2 border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-xl text-sm font-montserrat font-bold transition-colors"
          >
            Скасувати
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl text-sm font-montserrat font-bold transition-colors shadow-sm"
          >
            <Save size={16} />
            {saving ? 'Збереження...' : 'Зберегти схему'}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-manrope">
          {error}
        </div>
      )}

      {/* Metadata Form */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="md:col-span-2">
          <label className="block text-xs font-bold font-montserrat text-gray-700 uppercase mb-1">
            Назва схеми / вузла *
          </label>
          <input
            type="text"
            value={editingSchematic.title}
            onChange={(e) => setEditingSchematic({ ...editingSchematic, title: e.target.value })}
            placeholder="напр. Передняя защита днища"
            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-manrope focus:ring-2 focus:ring-red-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-bold font-montserrat text-gray-700 uppercase mb-1">
            Модель Tesla
          </label>
          <select
            value={editingSchematic.model}
            onChange={(e) => {
              const newModel = e.target.value;
              const gens = GENERATIONS_BY_MODEL[newModel] || [];
              setEditingSchematic({
                ...editingSchematic,
                model: newModel,
                generation: gens[0] || 'Highland (2024-...)'
              });
            }}
            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-manrope focus:ring-2 focus:ring-red-500 focus:outline-none"
          >
            {TESLA_MODELS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold font-montserrat text-gray-700 uppercase mb-1">
            Покоління
          </label>
          <select
            value={editingSchematic.generation}
            onChange={(e) => setEditingSchematic({ ...editingSchematic, generation: e.target.value })}
            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-manrope focus:ring-2 focus:ring-red-500 focus:outline-none"
          >
            {(GENERATIONS_BY_MODEL[editingSchematic.model] || []).map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold font-montserrat text-gray-700 uppercase mb-1">
            Сортування
          </label>
          <input
            type="number"
            value={editingSchematic.sort_order}
            onChange={(e) => setEditingSchematic({ ...editingSchematic, sort_order: parseInt(e.target.value) || 0 })}
            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-manrope focus:ring-2 focus:ring-red-500 focus:outline-none"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-bold font-montserrat text-gray-700 uppercase mb-1">
            Розділ (Section)
          </label>
          <input
            type="text"
            value={editingSchematic.section}
            onChange={(e) => setEditingSchematic({ ...editingSchematic, section: e.target.value })}
            placeholder="напр. НАРУЖНЫЕ КРЕПЛЕНИЯ"
            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-manrope focus:ring-2 focus:ring-red-500 focus:outline-none"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-bold font-montserrat text-gray-700 uppercase mb-1">
            Підсистема (Subsystem)
          </label>
          <input
            type="text"
            value={editingSchematic.subsystem}
            onChange={(e) => setEditingSchematic({ ...editingSchematic, subsystem: e.target.value })}
            placeholder="напр. Защита днища и диффузор"
            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-manrope focus:ring-2 focus:ring-red-500 focus:outline-none"
          />
        </div>

        <div className="md:col-span-1">
          <label className="block text-xs font-bold font-montserrat text-gray-700 uppercase mb-1">
            Зображення схеми
          </label>
          <label className="flex items-center justify-center gap-2 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-bold font-montserrat cursor-pointer transition-colors border border-red-200">
            <Upload size={14} />
            {uploadingImage ? 'Завантаження...' : 'Завантажити фото'}
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Main Canvas & Hotspots Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Interactive diagram canvas */}
        <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold font-montserrat uppercase text-gray-600 flex items-center gap-1.5">
              <MapPin size={16} className="text-red-600" />
              Полотно схеми (клікніть щоб додати точку)
            </span>
            <span className="text-xs text-gray-400 font-manrope">
              Всього точок: {editingSchematic.hotspots.length}
            </span>
          </div>

          <div
            ref={imageContainerRef}
            onClick={handleCanvasClick}
            className="relative w-full border border-gray-200 rounded-xl overflow-hidden bg-gray-50 select-none cursor-crosshair min-h-[380px] flex items-center justify-center"
          >
            {editingSchematic.image_url ? (
              <img
                src={getFullImageUrl(editingSchematic.image_url)}
                alt="Схема"
                className="w-full h-auto block object-contain pointer-events-none"
              />
            ) : (
              <div className="text-center p-10 text-gray-400 font-manrope">
                <Upload size={40} className="mx-auto mb-2 text-gray-300" />
                <p className="text-sm font-medium">Завантажте зображення схеми вгорі</p>
              </div>
            )}

            {/* Hotspot Pins */}
            {editingSchematic.image_url && editingSchematic.hotspots.map((h, idx) => {
              const isSelected = selectedHotspotIdx === idx;
              return (
                <div
                  key={idx}
                  style={{
                    left: `${h.x}%`,
                    top: `${h.y}%`,
                    transform: 'translate(-50%, -50%)'
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedHotspotIdx(idx);
                  }}
                  className={`absolute w-7 h-7 rounded-full flex items-center justify-center font-montserrat font-black text-xs transition-all shadow-md cursor-pointer ${
                    isSelected
                      ? 'bg-red-600 text-white ring-4 ring-red-300 ring-offset-1 scale-125 z-20'
                      : 'bg-red-600 text-white hover:scale-110 z-10'
                  }`}
                  title={`${h.number}: ${h.name}`}
                >
                  {h.number}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Hotspots editor & details */}
        <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <h3 className="font-montserrat font-bold text-gray-900 text-base">
              {selectedHotspot ? `Редагування точки #${selectedHotspot.number}` : 'Список деталей вузла'}
            </h3>
            {selectedHotspot && (
              <button
                onClick={() => handleDeleteHotspot(selectedHotspotIdx!)}
                className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1 font-montserrat font-bold"
              >
                <Trash2 size={14} /> Видалити точку
              </button>
            )}
          </div>

          {selectedHotspot && selectedHotspotIdx !== null ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold font-montserrat text-gray-700 mb-1">
                    Номер на схемі
                  </label>
                  <input
                    type="number"
                    value={selectedHotspot.number}
                    onChange={(e) => handleUpdateHotspot(selectedHotspotIdx, 'number', parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-manrope"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold font-montserrat text-gray-700 mb-1">
                    Парт-номер (Tesla)
                  </label>
                  <input
                    type="text"
                    value={selectedHotspot.part_number || ''}
                    onChange={(e) => handleUpdateHotspot(selectedHotspotIdx, 'part_number', e.target.value)}
                    placeholder="напр. 1499151-00-C"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-manrope font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold font-montserrat text-gray-700 mb-1">
                  Назва деталі
                </label>
                <input
                  type="text"
                  value={selectedHotspot.name}
                  onChange={(e) => handleUpdateHotspot(selectedHotspotIdx, 'name', e.target.value)}
                  placeholder="напр. Защита переднего подрамника"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-manrope"
                />
              </div>

              {/* Link to catalog product */}
              <div>
                <label className="block text-xs font-bold font-montserrat text-gray-700 mb-1">
                  Прив'язати до товару з каталогу
                </label>
                <select
                  value={selectedHotspot.product_id || ''}
                  onChange={(e) => handleUpdateHotspot(selectedHotspotIdx, 'product_id', e.target.value || null)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-manrope"
                >
                  <option value="">-- Без прямої прив'язки (використовувати варіанти нижче) --</option>
                  {catalogProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.detail_number ? `[${p.detail_number}] ` : ''}{p.name} ({p.priceUAH} ₴)
                    </option>
                  ))}
                </select>
              </div>

              {/* Coordinates info */}
              <div className="bg-gray-50 p-2.5 rounded-lg text-xs font-manrope text-gray-500 flex items-center justify-between">
                <span>Координати на фото:</span>
                <span className="font-mono font-bold text-gray-800">
                  X: {selectedHotspot.x}% • Y: {selectedHotspot.y}%
                </span>
              </div>

              {/* Variants Section */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold font-montserrat text-gray-700 uppercase">
                    Варіанти наявності та цін
                  </span>
                  <button
                    onClick={() => handleAddVariant(selectedHotspotIdx)}
                    className="text-xs text-red-600 hover:text-red-700 font-montserrat font-bold flex items-center gap-1"
                  >
                    <Plus size={14} /> Додати варіант
                  </button>
                </div>

                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                  {(selectedHotspot.variants || []).map((v, varIdx) => (
                    <div key={varIdx} className="bg-gray-50 p-3 rounded-xl border border-gray-200 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <input
                          type="text"
                          value={v.name}
                          onChange={(e) => handleUpdateVariant(selectedHotspotIdx, varIdx, 'name', e.target.value)}
                          placeholder="напр. Оригинал б/у"
                          className="font-montserrat font-bold bg-white px-2 py-1 border border-gray-200 rounded text-gray-800 text-xs w-2/3"
                        />
                        <button
                          onClick={() => handleDeleteVariant(selectedHotspotIdx, varIdx)}
                          className="text-gray-400 hover:text-red-600"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <span className="text-gray-400 block mb-0.5">Тип</span>
                          <select
                            value={v.type || 'original'}
                            onChange={(e) => handleUpdateVariant(selectedHotspotIdx, varIdx, 'type', e.target.value)}
                            className="w-full bg-white p-1 border border-gray-200 rounded"
                          >
                            <option value="original">Оригінал</option>
                            <option value="analog">Аналог</option>
                          </select>
                        </div>
                        <div>
                          <span className="text-gray-400 block mb-0.5">Стан</span>
                          <select
                            value={v.condition || 'new'}
                            onChange={(e) => handleUpdateVariant(selectedHotspotIdx, varIdx, 'condition', e.target.value)}
                            className="w-full bg-white p-1 border border-gray-200 rounded"
                          >
                            <option value="new">Новий</option>
                            <option value="used">Б/В</option>
                          </select>
                        </div>
                        <div>
                          <span className="text-gray-400 block mb-0.5">Ціна (₴)</span>
                          <input
                            type="number"
                            value={v.priceUAH}
                            onChange={(e) => handleUpdateVariant(selectedHotspotIdx, varIdx, 'priceUAH', parseFloat(e.target.value) || 0)}
                            className="w-full bg-white p-1 border border-gray-200 rounded font-bold"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-gray-500 font-manrope">
                Оберіть точку на зображенні або зі списку нижче:
              </p>
              <div className="space-y-2 max-h-[420px] overflow-y-auto">
                {editingSchematic.hotspots.map((h, idx) => (
                  <div
                    key={idx}
                    onClick={() => setSelectedHotspotIdx(idx)}
                    className="p-3 bg-gray-50 hover:bg-red-50 rounded-xl border border-gray-200 cursor-pointer transition-colors flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-red-600 text-white font-montserrat font-bold text-xs flex items-center justify-center">
                        {h.number}
                      </span>
                      <div>
                        <div className="font-montserrat font-bold text-gray-900 text-xs">
                          {h.name}
                        </div>
                        <div className="text-[11px] font-mono text-gray-400">
                          {h.part_number || 'Не вказано парт-номер'}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs text-gray-500 font-manrope">
                      {h.variants?.length || 0} вар.
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
