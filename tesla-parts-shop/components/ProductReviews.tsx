import React, { useEffect, useCallback } from 'react';
import { Star, X } from 'lucide-react';
import { ProductReview } from '../types';

interface ProductReviewsProps {
  reviews: ProductReview[];
}

/**
 * Оцінка у зірках. Порожні зірки потрібні, щоб рядок не «стрибав» між
 * відгуками з різною оцінкою.
 */
const Stars: React.FC<{ rating: number; size?: number }> = ({
  rating,
  size = 13,
}) => (
  <span className="flex items-center gap-0.5" aria-hidden="true">
    {[0, 1, 2, 3, 4].map((index) => (
      <Star
        key={index}
        size={size}
        className={
          index < Math.round(rating)
            ? 'fill-amber-400 text-amber-400'
            : 'fill-gray-200 text-gray-200'
        }
      />
    ))}
  </span>
);

const formatDate = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('uk-UA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

/**
 * Відгуки на конкретну деталь: один компактний відгук під карткою купівлі
 * і модальне вікно з усіма. Показується лише коли відгуки є — порожній блок
 * не займає місця.
 */
const ProductReviews: React.FC<ProductReviewsProps> = ({ reviews }) => {
  const [isOpen, setIsOpen] = React.useState(false);

  const close = useCallback(() => setIsOpen(false), []);

  // Модалка: Escape закриває, сторінка під нею не скролиться.
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, close]);

  if (reviews.length === 0) return null;

  const latest = reviews[0];
  const count = reviews.length;
  const average =
    reviews.reduce((sum, review) => sum + review.rating, 0) / count;
  const averageText = average.toFixed(1).replace('.', ',');

  return (
    <>
      <div className="mt-4 rounded-xl border border-gray-100 bg-white overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-3.5 pt-3">
          <span className="text-xs font-semibold text-gray-900">
            Відгуки на цю деталь
          </span>
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="text-[11px] font-semibold text-tesla-red hover:underline cursor-pointer shrink-0"
          >
            Усі відгуки ({count})
          </button>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="w-full text-left px-3.5 pt-1.5 pb-3 cursor-pointer group"
        >
          <span className="flex items-center gap-1.5 flex-wrap">
            <Stars rating={latest.rating} />
            <span className="text-[11px] font-semibold text-gray-900">
              {latest.author}
            </span>
            {latest.created_at && (
              <span className="text-[11px] text-gray-400">
                · {formatDate(latest.created_at)}
              </span>
            )}
          </span>
          <span className="block mt-1.5 text-[13px] leading-relaxed text-gray-700 line-clamp-2 group-hover:text-gray-900 transition-colors">
            {latest.text}
          </span>
        </button>
      </div>

      {isOpen && (
        <div
          className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-6 animate-fade-in"
          onClick={close}
          role="presentation"
        >
          <div
            className="w-full sm:max-w-lg max-h-[85vh] bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-reviews-title"
          >
            <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-gray-100">
              <div>
                <h2
                  id="product-reviews-title"
                  className="text-base font-bold text-gray-900"
                >
                  Відгуки на цю деталь
                </h2>
                <div className="mt-1 flex items-center gap-1.5">
                  <Stars rating={average} size={14} />
                  <span className="text-xs font-semibold text-gray-900">
                    {averageText}
                  </span>
                  <span className="text-xs text-gray-500">
                    · {count}{' '}
                    {count === 1
                      ? 'відгук'
                      : count < 5
                        ? 'відгуки'
                        : 'відгуків'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={close}
                className="p-1.5 -mr-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
                aria-label="Закрити відгуки"
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto divide-y divide-gray-100">
              {reviews.map((review) => (
                <div key={review.id} className="px-5 py-4">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Stars rating={review.rating} />
                    <span className="text-xs font-semibold text-gray-900">
                      {review.author}
                    </span>
                    {review.created_at && (
                      <span className="text-[11px] text-gray-400">
                        · {formatDate(review.created_at)}
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-gray-700 whitespace-pre-line">
                    {review.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ProductReviews;
