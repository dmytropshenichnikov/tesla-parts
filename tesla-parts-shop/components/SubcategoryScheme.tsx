import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layers, ArrowRight, MapPin } from 'lucide-react';
import { api } from '../services/api';
import { SubcategorySchemeSummary } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

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

  return (
    <div className="mb-6 space-y-3">
      {schemes.map((scheme) => (
        <Link
          key={scheme.id}
          to={`/schemes/${scheme.id}`}
          className="group flex flex-col sm:flex-row items-center gap-4 p-4 rounded-2xl border border-gray-200 bg-white hover:border-tesla-red hover:shadow-md transition-all duration-200"
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
              {scheme.hotspots_count} точок
            </span>
            <span className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gray-900 group-hover:bg-tesla-red text-white rounded-xl text-xs font-montserrat font-bold transition-colors whitespace-nowrap">
              Відкрити
              <ArrowRight size={13} />
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
};

export default SubcategoryScheme;
