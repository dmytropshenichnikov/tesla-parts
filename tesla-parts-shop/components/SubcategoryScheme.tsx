import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layers, ArrowRight, MapPin } from 'lucide-react';
import { api } from '../services/api';
import { SubcategorySchemeSummary } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

/** «1 точка / 2 точки / 5 точок» */
const pluralPoints = (n: number) => {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} точка`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} точки`;
  return `${n} точок`;
};

/**
 * Блок «Схема цього вузла» на сторінці підкатегорії каталогу.
 *
 * Якщо для підкатегорії («ЗАХИСТИ ПЕРЕДНІ») є схема — показуємо її поруч із
 * товарами, щоб клієнт міг піти і в деталі, і на схему вузла.
 */
export const SubcategoryScheme: React.FC<{ subcategoryId?: number | null }> = ({
  subcategoryId,
}) => {
  const [schemes, setSchemes] = useState<SubcategorySchemeSummary[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!subcategoryId) {
      setSchemes([]);
      setLoaded(true);
      return;
    }
    api
      .getSchematicsForSubcategory(subcategoryId)
      .then((list) => {
        if (!cancelled) setSchemes(list);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [subcategoryId]);

  if (!loaded || schemes.length === 0) return null;

  const imageUrl = (url: string) =>
    !url ? '' : url.startsWith('http') ? url : `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`;

  // Одна схема — показуємо звичайну широку картку.
  // Кілька схем (напр. на сторінці розділу «ЗОВНІШНЄ ОЗДОБЛЕННЯ») — компактний
  // рядок, що гортається: раніше сім карток займали пів екрана.
  if (schemes.length > 1) {
    const first = schemes[0];
    const allLink = `/schemes?model=${encodeURIComponent(first.model)}&generation=${encodeURIComponent(
      first.generation || ''
    )}&section=${encodeURIComponent(first.section || '')}&all=1`;

    return (
      <div className="mb-6">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-montserrat font-bold text-tesla-red uppercase tracking-wider">
            <Layers size={12} />
            Схеми цього вузла ({schemes.length})
          </span>
          <Link
            to={allLink}
            className="inline-flex items-center gap-1 text-xs font-montserrat font-bold text-tesla-red hover:underline"
          >
            Усі схеми розділу
            <ArrowRight size={13} />
          </Link>
        </div>

        <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1">
          {schemes.map((scheme) => (
            <Link
              key={scheme.id}
              to={`/schemes/${scheme.id}`}
              className="group flex items-center gap-2.5 p-2.5 rounded-xl border border-tesla-red/25 bg-white hover:border-tesla-red hover:shadow-md transition-all shrink-0 w-[230px]"
            >
              <div className="w-12 h-12 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                {scheme.image_url ? (
                  <img
                    src={imageUrl(scheme.image_url)}
                    alt={scheme.title}
                    className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <Layers size={20} className="text-gray-300" />
                )}
              </div>
              <div className="min-w-0">
                <div className="font-montserrat font-bold text-xs text-gray-900 truncate">
                  {scheme.title}
                </div>
                <div className="text-[10px] text-gray-400 font-manrope mt-0.5 truncate">
                  {pluralPoints(scheme.hotspots_count)}
                  {scheme.subsystem && scheme.subsystem !== scheme.title
                    ? ` • ${scheme.subsystem}`
                    : ''}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6 space-y-3">
      {schemes.map((scheme) => (
        <Link
          key={scheme.id}
          to={`/schemes/${scheme.id}`}
          className="group flex flex-col sm:flex-row items-center gap-4 p-4 rounded-2xl border-2 border-tesla-red/25 bg-white hover:border-tesla-red hover:shadow-lg transition-all duration-200"
        >
          <div className="w-full sm:w-28 h-24 sm:h-20 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden shrink-0">
            {scheme.image_url ? (
              <img
                src={imageUrl(scheme.image_url)}
                alt={scheme.title}
                className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-300"
              />
            ) : (
              <Layers size={28} className="text-gray-300" />
            )}
          </div>

          <div className="min-w-0 flex-1 text-center sm:text-left">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-montserrat font-bold text-tesla-red uppercase tracking-wider mb-1">
              <Layers size={12} />
              Схема цього вузла
            </div>
            <div className="font-montserrat font-bold text-gray-900 leading-snug">
              {scheme.title}
            </div>
            <div className="text-xs text-gray-500 font-manrope mt-0.5">
              {scheme.model} {scheme.generation} • {scheme.section}
              {scheme.subsystem ? ` • ${scheme.subsystem}` : ''}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-tesla-red bg-red-50 border border-red-100 px-2.5 py-1 rounded-full font-montserrat">
              <MapPin size={11} />
              {pluralPoints(scheme.hotspots_count)}
            </span>
            <span className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-tesla-red group-hover:bg-red-700 text-white rounded-xl text-xs font-montserrat font-bold transition-colors whitespace-nowrap">
              Переглянути на схемі
              <ArrowRight size={13} />
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
};

export default SubcategoryScheme;
