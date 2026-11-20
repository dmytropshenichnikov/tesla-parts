import React, { useCallback, useEffect, useState } from 'react';
import { Star, X } from 'lucide-react';
import { ProductReview } from '../types';
import { api } from '../services/api';

interface ProductReviewsProps {
  productId: string;
  reviews: ProductReview[];
}

type ModalView = 'list' | 'form' | 'thanks';

/**
 * Оцінка у зірках. Порожні зірки потрібні, щоб рядок не стрибав між
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

const pluralReviews = (count: number): string => {
  if (count === 1) return 'відгук';
  if (count > 1 && count < 5) return 'відгуки';
  return 'відгуків';
};

/**
 * Відгуки на конкретну деталь: компактний блок під карткою купівлі,
 * вікно з усіма відгуками і форма, щоб покупець міг залишити свій.
 * Відгук покупця публікується після перевірки адміном.
 */
const ProductReviews: React.FC<ProductReviewsProps> = ({
  productId,
  reviews,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<ModalView>('list');
  const [author, setAuthor] = useState('');
  const [rating, setRating] = useState(5);
  const [text, setText] = useState('');
  const [website, setWebsite] = useState(''); // пастка для ботів
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = useCallback(() => {
    setIsOpen(false);
    setView('list');
    setError(null);
  }, []);

  const openList = () => {
    setView('list');
    setIsOpen(true);
  };

  const openForm = () => {
    setView('form');
    setError(null);
    setIsOpen(true);
  };

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

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleanAuthor = author.trim();
    const cleanText = text.trim();
    if (cleanAuthor.length < 2) {
      setError('Вкажіть імʼя');
      return;
    }
    if (cleanText.length < 10) {
      setError('Напишіть хоча б кілька слів про деталь');
      return;
    }
    setSending(true);
    setError(null);
    const result = await api.createProductReview({
      product_id: productId,
      author: cleanAuthor,
      rating,
      text: cleanText,
      website,
    });
    setSending(false);
    if (!result.ok) {
      setError(result.error || 'Не вдалося надіслати відгук. Спробуйте ще раз.');
      return;
    }
    setAuthor('');
    setText('');
    setRating(5);
    setView('thanks');
  };

  const count = reviews.length;
  const latest = reviews[0];
  const average =
    count > 0
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / count
      : 0;
  const averageText = average.toFixed(1).replace('.', ',');

  return (
    <>
      <div className="mt-4 rounded-xl border border-gray-100 bg-white overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-3.5 pt-3">
          <span className="text-xs font-semibold text-gray-900">
            Відгуки на цю деталь
          </span>
          {count > 0 && (
            <button
              type="button"
              onClick={openList}
              className="text-[11px] font-semibold text-tesla-red hover:underline cursor-pointer shrink-0"
            >
              Усі відгуки ({count})
            </button>
          )}
        </div>

        {latest ? (
          <button
            type="button"
            onClick={openList}
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
        ) : (
          <div className="px-3.5 pt-1.5 pb-3">
            <p className="text-[13px] text-gray-500">
              Відгуків ще немає. Розкажіть, як деталь стала.
            </p>
            <button
              type="button"
              onClick={openForm}
              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-900 text-white text-[11px] font-semibold hover:bg-gray-800 transition-colors cursor-pointer"
            >
              Залишити відгук
            </button>
          </div>
        )}
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
                  {view === 'form' ? 'Залишити відгук' : 'Відгуки на цю деталь'}
                </h2>
                {view === 'list' && count > 0 && (
                  <div className="mt-1 flex items-center gap-1.5">
                    <Stars rating={average} size={14} />
                    <span className="text-xs font-semibold text-gray-900">
                      {averageText}
                    </span>
                    <span className="text-xs text-gray-500">
                      · {count} {pluralReviews(count)}
                    </span>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={close}
                className="p-1.5 -mr-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
                aria-label="Закрити"
              >
                <X size={18} />
              </button>
            </div>

            {view === 'list' && (
              <>
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
                  {count === 0 && (
                    <p className="px-5 py-6 text-sm text-gray-500">
                      Відгуків ще немає. Розкажіть, як деталь стала.
                    </p>
                  )}
                </div>
                <div className="px-5 py-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={openForm}
                    className="w-full py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition-colors cursor-pointer"
                  >
                    Залишити відгук
                  </button>
                </div>
              </>
            )}

            {view === 'form' && (
              <form onSubmit={handleSubmit} className="overflow-y-auto px-5 py-4 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Оцінка
                  </label>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setRating(value)}
                        aria-label={`Оцінка ${value} з 5`}
                        aria-pressed={rating === value}
                        className="p-0.5 cursor-pointer"
                      >
                        <Star
                          size={24}
                          className={
                            value <= rating
                              ? 'fill-amber-400 text-amber-400'
                              : 'fill-gray-200 text-gray-200'
                          }
                        />
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="review-author"
                    className="block text-xs font-medium text-gray-700 mb-1"
                  >
                    Ваше імʼя
                  </label>
                  <input
                    id="review-author"
                    type="text"
                    value={author}
                    onChange={(event) => setAuthor(event.target.value)}
                    maxLength={80}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tesla-red"
                    placeholder="Наприклад: Ігор"
                  />
                </div>
                <div>
                  <label
                    htmlFor="review-text"
                    className="block text-xs font-medium text-gray-700 mb-1"
                  >
                    Текст відгуку
                  </label>
                  <textarea
                    id="review-text"
                    rows={4}
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    maxLength={1500}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tesla-red resize-none"
                    placeholder="Що сподобалось, чи підійшло, як працює"
                  />
                </div>
                {/* Пастка для ботів: прихована від людей. */}
                <input
                  type="text"
                  value={website}
                  onChange={(event) => setWebsite(event.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  className="hidden"
                />
                {error && <p className="text-xs text-red-600">{error}</p>}
                <button
                  type="submit"
                  disabled={sending}
                  className="w-full py-2.5 rounded-xl bg-tesla-red text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-60 cursor-pointer"
                >
                  {sending ? 'Надсилаємо...' : 'Надіслати відгук'}
                </button>
                <p className="text-[11px] text-gray-400 text-center">
                  Відгук зʼявиться на сайті після перевірки.
                </p>
              </form>
            )}

            {view === 'thanks' && (
              <div className="px-5 py-8 text-center">
                <p className="text-sm font-semibold text-gray-900">
                  Дякуємо за відгук!
                </p>
                <p className="mt-1 text-sm text-gray-600">
                  Він зʼявиться на сайті після перевірки.
                </p>
                <button
                  type="button"
                  onClick={close}
                  className="mt-4 px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition-colors cursor-pointer"
                >
                  Добре
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default ProductReviews;
