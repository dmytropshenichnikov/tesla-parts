import React, { useCallback, useEffect, useState } from 'react';
import {
  Check,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  Pencil,
  Star,
  Trash2,
} from 'lucide-react';
import { ApiService } from '../services/api';
import { ProductReviewQueueItem } from '../types';

type Filter = 'pending' | 'published' | 'all';

interface Props {
  onCountsChange?: (counts: { pending: number; published: number }) => void;
}

const SITE_URL = 'https://teslapartscenter.com.ua';

const formatDateTime = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const toDateTimeLocal = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const Stars: React.FC<{ rating: number }> = ({ rating }) => (
  <span className="flex items-center gap-0.5" aria-label={`Оцінка ${rating} з 5`}>
    {[0, 1, 2, 3, 4].map((index) => (
      <Star
        key={index}
        size={14}
        className={
          index < rating
            ? 'fill-amber-400 text-amber-400'
            : 'fill-gray-200 text-gray-200'
        }
      />
    ))}
  </span>
);

/**
 * Черга відгуків на товари: сюди приходять відгуки покупців, тут їх
 * публікують, ховають, редагують (разом із датою) або видаляють.
 */
export const ProductReviewModeration: React.FC<Props> = ({
  onCountsChange,
}) => {
  const [filter, setFilter] = useState<Filter>('pending');
  const [items, setItems] = useState<ProductReviewQueueItem[]>([]);
  const [counts, setCounts] = useState({ pending: 0, published: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState({
    author: '',
    rating: 5,
    text: '',
    createdAt: '',
  });

  const load = useCallback(
    async (status: Filter) => {
      try {
        setLoading(true);
        setError(null);
        const data = await ApiService.getProductReviewQueue(status);
        setItems(data.items);
        setCounts(data.counts);
        onCountsChange?.(data.counts);
      } catch (e) {
        console.error('Failed to load review queue', e);
        setError('Не вдалося завантажити відгуки');
      } finally {
        setLoading(false);
      }
    },
    [onCountsChange]
  );

  useEffect(() => {
    load(filter);
  }, [filter, load]);

  const handleToggle = async (review: ProductReviewQueueItem) => {
    setBusyId(review.id);
    try {
      await ApiService.updateProductReview(review.id, {
        is_published: !review.is_published,
      });
      await load(filter);
    } catch (e) {
      console.error('Failed to change status', e);
      setError('Не вдалося змінити статус відгуку');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Видалити цей відгук назавжди?')) return;
    setBusyId(id);
    try {
      await ApiService.deleteProductReview(id);
      await load(filter);
    } catch (e) {
      console.error('Failed to delete review', e);
      setError('Не вдалося видалити відгук');
    } finally {
      setBusyId(null);
    }
  };

  const startEdit = (review: ProductReviewQueueItem) => {
    setEditingId(review.id);
    setEditDraft({
      author: review.author,
      rating: review.rating,
      text: review.text,
      createdAt: toDateTimeLocal(review.created_at),
    });
  };

  const saveEdit = async (id: number) => {
    if (!editDraft.author.trim() || !editDraft.text.trim()) {
      setError('Заповніть імʼя та текст відгуку');
      return;
    }
    setBusyId(id);
    try {
      await ApiService.updateProductReview(id, {
        author: editDraft.author.trim(),
        rating: editDraft.rating,
        text: editDraft.text.trim(),
        ...(editDraft.createdAt
          ? { created_at: `${editDraft.createdAt}:00` }
          : {}),
      });
      setEditingId(null);
      await load(filter);
    } catch (e) {
      console.error('Failed to save review', e);
      setError('Не вдалося зберегти зміни');
    } finally {
      setBusyId(null);
    }
  };

  const tabClass = (active: boolean) =>
    `px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
      active
        ? 'bg-gray-900 text-white'
        : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
    }`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Відгуки на товари</h2>
          <p className="text-gray-500">
            Нові відгуки покупців чекають рішення: опублікувати чи приховати
          </p>
        </div>
        <button
          type="button"
          onClick={() => load(filter)}
          className="text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          Оновити
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFilter('pending')}
          className={tabClass(filter === 'pending')}
        >
          На перевірці ({counts.pending})
        </button>
        <button
          type="button"
          onClick={() => setFilter('published')}
          className={tabClass(filter === 'published')}
        >
          На сайті ({counts.published})
        </button>
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={tabClass(filter === 'all')}
        >
          Усі
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-100">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-8 h-8 animate-spin text-red-600" />
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <Check className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">
            {filter === 'pending'
              ? 'Нових відгуків немає'
              : filter === 'published'
                ? 'На сайті ще немає відгуків'
                : 'Відгуків поки немає'}
          </h3>
          <p className="text-gray-500">
            Коли покупець залишить відгук у картці товару, він зʼявиться тут
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((review) => (
            <div
              key={review.id}
              className="bg-white rounded-xl border border-gray-200 p-4"
            >
              {editingId === review.id ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input
                      type="text"
                      value={editDraft.author}
                      onChange={(e) =>
                        setEditDraft({ ...editDraft, author: e.target.value })
                      }
                      className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                      placeholder="Імʼя"
                    />
                    <select
                      value={editDraft.rating}
                      onChange={(e) =>
                        setEditDraft({
                          ...editDraft,
                          rating: Number(e.target.value),
                        })
                      }
                      className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                      {[5, 4, 3, 2, 1].map((value) => (
                        <option key={value} value={value}>
                          {value} з 5
                        </option>
                      ))}
                    </select>
                    <input
                      type="datetime-local"
                      value={editDraft.createdAt}
                      onChange={(e) =>
                        setEditDraft({
                          ...editDraft,
                          createdAt: e.target.value,
                        })
                      }
                      className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                  <textarea
                    rows={3}
                    value={editDraft.text}
                    onChange={(e) =>
                      setEditDraft({ ...editDraft, text: e.target.value })
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => saveEdit(review.id)}
                      disabled={busyId === review.id}
                      className="inline-flex items-center gap-1.5 bg-gray-900 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
                    >
                      <Check size={15} />
                      Зберегти
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="px-3 py-1.5 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-100"
                    >
                      Скасувати
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Stars rating={review.rating} />
                      <span className="text-sm font-semibold text-gray-900">
                        {review.author}
                      </span>
                      <span className="text-xs text-gray-400">
                        {formatDateTime(review.created_at)}
                      </span>
                      {review.is_published ? (
                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                          На сайті
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                          На перевірці
                        </span>
                      )}
                    </div>

                    <a
                      href={
                        review.product_slug
                          ? `${SITE_URL}/product/${review.product_slug}`
                          : SITE_URL
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-tesla-red"
                    >
                      {review.product_name}
                      <ExternalLink size={12} />
                    </a>

                    <p className="mt-2 text-sm text-gray-700 whitespace-pre-line">
                      {review.text}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggle(review)}
                      disabled={busyId === review.id}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 ${
                        review.is_published
                          ? 'border border-gray-200 text-gray-700 hover:bg-gray-50'
                          : 'bg-emerald-600 text-white hover:bg-emerald-700'
                      }`}
                    >
                      {review.is_published ? (
                        <>
                          <EyeOff size={15} />
                          Приховати
                        </>
                      ) : (
                        <>
                          <Eye size={15} />
                          Опублікувати
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => startEdit(review)}
                      className="p-2 text-gray-400 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Редагувати"
                      aria-label="Редагувати відгук"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(review.id)}
                      disabled={busyId === review.id}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                      title="Видалити"
                      aria-label="Видалити відгук"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-500">
        Відгук покупця не видно на сайті, поки ви не натиснете «Опублікувати».
      </p>
    </div>
  );
};
