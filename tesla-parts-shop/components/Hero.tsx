import React, { useEffect, useState } from 'react';
import { ArrowRight, Layers, Car } from 'lucide-react';
import { api } from '../services/api';
import { Category } from '../types';
import { Link } from 'react-router-dom';
import { slugify } from '../utils/slugify';

interface HeroProps {}

const Hero: React.FC<HeroProps> = () => {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const data = await api.getCategories();
        setCategories(data);
      } catch (e) {
        console.error('Failed to fetch categories', e);
      }
    };
    fetchCategories();
  }, []);

  return (
    <div className="mb-12">
      {/* Interactive EPC & VIN Search Hero Card */}
      <div className="bg-gradient-to-r from-gray-950 via-gray-900 to-gray-950 rounded-3xl p-5 sm:p-7 text-white border border-gray-800 shadow-xl mb-10 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-full bg-radial from-red-600/10 via-transparent to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4 sm:gap-5">
            <div className="w-14 h-14 rounded-2xl bg-tesla-red/15 border border-tesla-red/30 flex items-center justify-center flex-shrink-0 text-tesla-red shadow-inner">
              <Layers size={30} />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[11px] font-bold uppercase tracking-wider mb-1.5 border border-red-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                Новий функціонал
              </div>
              <h2 className="text-xl sm:text-2xl font-bold font-montserrat text-white tracking-tight">
                Інтерактивні схеми запчастин та підбір за VIN
              </h2>
              <p className="text-xs sm:text-sm text-gray-300 font-manrope mt-1 max-w-xl">
                Обирайте деталі прямо на вибух-схемах вузлів (EPC) вашої моделі або введіть 17-значний VIN-код для автоматичного визначення комплектації.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 w-full md:w-auto flex-shrink-0">
            <Link
              to="/schemes"
              className="flex-1 md:flex-initial text-center bg-tesla-red hover:bg-red-700 text-white text-xs sm:text-sm font-bold font-montserrat px-5 py-3 rounded-xl transition-all shadow-md hover:shadow-tesla-red/20 active:scale-95 whitespace-nowrap flex items-center justify-center gap-2"
            >
              <Layers size={16} />
              <span>Переглянути схеми</span>
            </Link>
            <button
              type="button"
              onClick={() => {
                window.dispatchEvent(new CustomEvent('open-garage-modal'));
              }}
              className="flex-1 md:flex-initial text-center bg-gray-800/90 hover:bg-gray-800 text-white text-xs sm:text-sm font-bold font-montserrat px-5 py-3 rounded-xl border border-gray-700 hover:border-gray-600 transition-all active:scale-95 whitespace-nowrap flex items-center justify-center gap-2 cursor-pointer"
            >
              <Car size={16} className="text-tesla-red" />
              <span>Підібрати за VIN</span>
            </button>
          </div>
        </div>
      </div>

      <h1 className="text-3xl md:text-4xl font-bold text-center mb-8 text-tesla-dark">
        Оберіть модель вашого Tesla
      </h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {categories.map((category, idx) => (
          <Link
            key={category.id}
            to={`/category/${slugify(category.name)}`}
            className="group relative h-64 md:h-96 rounded-2xl overflow-hidden cursor-pointer shadow-md hover:shadow-xl transition-all duration-300 ease-out hover:-translate-y-1 active:scale-[0.98]"
            style={{
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/10 group-hover:via-black/25 transition-all duration-300 z-10" />
            <img
              src={category.image || 'https://via.placeholder.com/800'}
              alt={category.name}
              className="absolute inset-0 w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500 ease-out"
            />
            <div className="absolute bottom-0 left-0 p-6 z-20 text-white w-full">
              <h3 className="text-xl md:text-2xl font-bold mb-1 group-hover:translate-x-0.5 transition-transform duration-200">
                {category.name}
              </h3>
              <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-200 group-hover:text-white transition-colors">
                <span>Переглянути каталог</span>
                <ArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-1.5" />
              </div>
            </div>
          </Link>
        ))}
      </div>
      {categories.length === 0 && (
        <div className="text-center text-gray-500 py-12">
          Завантаження категорій...
        </div>
      )}
    </div>
  );
};

export default Hero;
