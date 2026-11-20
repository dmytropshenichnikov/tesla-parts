import React, { useEffect, useState } from 'react';
import { Star, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';

const AVTOPRO_URL = 'https://avto.pro/seller/tesla-parts-center/';

// Резервні цифри — реальний стан профілю на 20.11.2026. Показуються одразу,
// поки не прийшла відповідь бекенду, і лишаються, якщо АвтоПро недоступний:
// порожнього місця в картці бути не повинно.
const FALLBACK = { rating: 5, reviews: 114 };

const formatRating = (value: number): string =>
  value.toFixed(1).replace('.', ',');

/**
 * Компактний рядок довіри між кнопкою купівлі та схемою: оцінка магазину
 * на АвтоПро (справжні відгуки покупців) і перехід до фото-відгуків сайту.
 * Стоїть в один рядок, щоб не роздувати блок замовлення.
 */
const ReviewStrip: React.FC = () => {
  const [summary, setSummary] = useState(FALLBACK);

  useEffect(() => {
    let alive = true;
    api
      .getAvtoproSummary()
      .then((data) => {
        if (!alive || !data) return;
        const rating = Number(data.rating);
        const reviews = Number(data.reviews);
        if (Number.isFinite(rating) && rating > 0 && Number.isFinite(reviews)) {
          setSummary({ rating, reviews });
        }
      })
      .catch(() => {
        // Лишаємо резервні цифри.
      });
    return () => {
      alive = false;
    };
  }, []);

  const ratingText = formatRating(summary.rating);

  return (
    <div className="flex items-center justify-between gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-2 rounded-xl border border-gray-100 bg-gray-50/70">
      <a
        href={AVTOPRO_URL}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="flex items-center gap-1 sm:gap-1.5 min-w-0 group"
        aria-label={`Оцінка ${ratingText} з 5 на АвтоПро, ${summary.reviews} відгуків`}
        title="Профіль магазину на АвтоПро"
      >
        <span
          className="flex items-center gap-px sm:gap-0.5 text-amber-400 shrink-0"
          aria-hidden="true"
        >
          {[0, 1, 2, 3, 4].map((index) => (
            <Star key={index} size={12} className="fill-amber-400" />
          ))}
        </span>
        <span className="text-xs font-bold text-gray-900">{ratingText}</span>
        <span className="text-[10px] sm:text-[11px] text-gray-500 whitespace-nowrap group-hover:text-gray-700 transition-colors">
          · {summary.reviews} відгуків на АвтоПро
        </span>
      </a>
      <Link
        to="/reviews"
        className="flex items-center gap-0.5 text-[10px] sm:text-[11px] font-semibold text-tesla-red hover:underline shrink-0"
      >
        Усі відгуки
        <ChevronRight size={12} />
      </Link>
    </div>
  );
};

export default ReviewStrip;
