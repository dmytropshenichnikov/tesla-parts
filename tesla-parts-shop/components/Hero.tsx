import React, { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
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
      <h1 className="text-3xl md:text-4xl font-bold text-center mb-8 text-tesla-dark">
        Оберіть модель вашого Tesla
      </h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {categories.map((category, idx) => (
          <Link
            key={category.id}
            to={`/category/${slugify(category.name)}`}
            className="group relative h-64 md:h-96 rounded-2xl overflow-hidden cursor-pointer shadow-md hover:shadow-xl transition-all duration-300 ease-out hover:-translate-y-1 active:scale-[0.98] animate-cascade-item"
            style={{
              WebkitTapHighlightColor: 'transparent',
              animationDelay: `${idx * 80}ms`,
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
