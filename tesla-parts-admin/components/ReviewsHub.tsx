import React, { useState } from 'react';
import { ReviewManager } from './ReviewManager';
import { ProductReviewModeration } from './ProductReviewModeration';

type Tab = 'products' | 'photos';

/**
 * Два різні види відгуків в одному розділі: відгуки покупців на конкретні
 * товари (їх треба перевіряти й публікувати) і галерея фото-відгуків.
 * За замовчуванням відкривається черга модерації, бо саме туди приходять
 * нові відгуки.
 */
export const ReviewsHub: React.FC = () => {
  const [tab, setTab] = useState<Tab>('products');
  const [pending, setPending] = useState(0);

  const tabClass = (active: boolean) =>
    `px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
      active
        ? 'bg-gray-900 text-white'
        : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
    }`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab('products')}
          className={tabClass(tab === 'products')}
        >
          Відгуки на товари{pending > 0 ? ` (${pending})` : ''}
        </button>
        <button
          type="button"
          onClick={() => setTab('photos')}
          className={tabClass(tab === 'photos')}
        >
          Фото-відгуки
        </button>
      </div>

      {tab === 'products' ? (
        <ProductReviewModeration
          onCountsChange={(counts) => setPending(counts.pending)}
        />
      ) : (
        <ReviewManager />
      )}
    </div>
  );
};
