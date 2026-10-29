import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';
import { Category } from '../types';
import { Link } from 'react-router-dom';
import { slugify } from '../utils/slugify';
import { catalogModelForCar, useActiveCar } from '../utils/garageMatch';
import { HOME_H1 } from '../utils/seoTemplates';
import { mediaUrl, sizedMediaUrl } from '../utils/media';

interface HeroProps {}

/**
 * Категорії, які вже вбудував сервер у prerender-HTML (`window.__HOME_CATEGORIES__`).
 * Перший рендер React має збігатися з серверною розміткою плиток — інакше плитки
 * зникнуть біжучим запитом і сторінка дасть layout shift (CLS).
 */
const readServerCategories = (): Category[] => {
  if (typeof window === 'undefined') return [];
  const raw = (window as unknown as { __HOME_CATEGORIES__?: unknown }).__HOME_CATEGORIES__;
  return Array.isArray(raw) ? (raw as Category[]) : [];
};

const Hero: React.FC<HeroProps> = () => {
  const [categories, setCategories] = useState<Category[]>(readServerCategories);
  const activeCar = useActiveCar();
  const myModel = catalogModelForCar(activeCar);

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

  // Каталог підлаштовується під гараж: модель з гаража стає першою, щоб її
  // не доводилось щоразу шукати серед семи плиток.
  const orderedCategories = useMemo(() => {
    if (!myModel) return categories;
    const wanted = myModel.toLowerCase();
    const mine = categories.filter((c) => c.name.trim().toLowerCase() === wanted);
    if (mine.length === 0) return categories;
    const rest = categories.filter((c) => c.name.trim().toLowerCase() !== wanted);
    return [...mine, ...rest];
  }, [categories, myModel]);

  return (
    <div className="mb-12">
      <h1 className="text-3xl md:text-4xl font-bold text-center mb-2 text-tesla-dark">
        {HOME_H1}
      </h1>
      <p className="text-center text-lg text-gray-500 mb-8 font-manrope">Оберіть модель вашого Tesla</p>
      {myModel && (
        <p className="text-center text-sm text-gray-500 -mt-4 mb-6 font-manrope">
          Ваше авто — <span className="font-semibold text-tesla-dark">{myModel}</span>. Воно вже перше в списку,
          а в товарах позначено те, що підходить саме вам.
        </p>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {orderedCategories.map((category, index) => {
          const isMine = Boolean(myModel) && category.name.trim().toLowerCase() === myModel.toLowerCase();
          // Плитка завширшки ~400 px (3 колонки) або ~390 px (мобільний), тож
          // 900-піксельний оригінал — зайві ~50 КБ на кожну картку.
          const heroOriginal = mediaUrl(category.image);
          const heroImage = heroOriginal;
          const heroSrcSet = /\/static\//.test(heroOriginal)
            ? `${sizedMediaUrl(heroOriginal, 480)} 480w, ${heroOriginal} 900w`
            : undefined;
          return (
            <Link
              key={category.id}
              to={`/category/${slugify(category.name)}`}
              className={`group relative h-64 md:h-96 rounded-2xl overflow-hidden cursor-pointer shadow-md hover:shadow-xl transition-shadow duration-300 ease-out active:scale-[0.98] ${
                isMine ? 'ring-2 ring-tesla-red ring-offset-2' : ''
              }`}
              style={{
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/10 group-hover:via-black/25 transition-all duration-300 z-10" />
              <img
                src={heroImage || 'https://via.placeholder.com/800'}
                srcSet={heroSrcSet}
                sizes="(min-width: 1024px) 33vw, 100vw"
                alt={category.name}
                width={800}
                height={500}
                fetchPriority={index < 2 ? 'high' : undefined}
                loading={index < 2 ? 'eager' : 'lazy'}
                decoding="async"
                className="absolute inset-0 w-full h-full object-cover transform transition-transform duration-500 ease-out"
              />
              {isMine && (
                <span className="absolute top-3 left-3 z-20 inline-flex items-center gap-1.5 bg-tesla-red text-white text-[11px] font-bold font-montserrat uppercase tracking-wide px-2.5 py-1 rounded-full shadow-md">
                  <CheckCircle2 size={13} />
                  Ваше авто
                </span>
              )}
              <div className="absolute bottom-0 left-0 p-6 z-20 text-white w-full">
                <h2 className="text-xl md:text-2xl font-bold mb-1 group-hover:translate-x-0.5 transition-transform duration-200">
                  {category.name}
                </h2>
                <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-200 group-hover:text-white transition-colors">
                  <span>Переглянути каталог</span>
                  <ArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-1.5" />
                </div>
              </div>
            </Link>
          );
        })}
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
