import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import SeoHead from './SeoHead';
import { Review } from '../types';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

export const ReviewsPage: React.FC = () => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(
    null
  );

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const data = await api.getReviews();
        setReviews(data);
      } catch (err) {
        console.error('Failed to fetch reviews:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchReviews();
  }, []);

  const openImage = (index: number) => {
    setSelectedImageIndex(index);
    document.body.style.overflow = 'hidden';
  };

  const closeImage = () => {
    setSelectedImageIndex(null);
    document.body.style.overflow = 'auto';
  };

  const showNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedImageIndex !== null) {
      setSelectedImageIndex((selectedImageIndex + 1) % reviews.length);
    }
  };

  const showPrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedImageIndex !== null) {
      setSelectedImageIndex(
        (selectedImageIndex - 1 + reviews.length) % reviews.length
      );
    }
  };

  return (
    <div className="bg-white">
      <SeoHead
        title="Відгуки клієнтів | Tesla Parts Center"
        description="Що про нас кажуть клієнти. Переглядайте скріншоти відгуків про запчастини Tesla від нашого магазину."
      />

      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Відгуки</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Ми цінуємо довіру наших клієнтів. Тут ви можете переглянути реальні
            відгуки з месенджерів про нашу роботу та запчастини.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
          </div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-20 bg-gray-50 rounded-2xl">
            <p className="text-gray-500 text-lg">
              Відгуків поки немає, але вони скоро з'являться!
            </p>
          </div>
        ) : (
          <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-6 space-y-6">
            {reviews.map((review, index) => (
              <div
                key={review.id}
                className="break-inside-avoid bg-gray-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => openImage(index)}
              >
                <img
                  src={review.image_url}
                  alt="Відгук клієнта"
                  className="w-full h-auto block hover:scale-[1.02] transition-transform duration-300"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox Modal */}
      {selectedImageIndex !== null && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 md:p-8 animate-fade-in"
          onClick={closeImage}
        >
          <button
            className="absolute top-4 right-4 text-white hover:text-tesla-red transition-colors p-2 z-[110]"
            onClick={closeImage}
          >
            <X size={32} />
          </button>

          {reviews.length > 1 && (
            <>
              <button
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:text-tesla-red transition-colors p-2 z-[110] bg-black/20 rounded-full"
                onClick={showPrev}
              >
                <ChevronLeft size={48} />
              </button>
              <button
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:text-tesla-red transition-colors p-2 z-[110] bg-black/20 rounded-full"
                onClick={showNext}
              >
                <ChevronRight size={48} />
              </button>
            </>
          )}

          <div className="max-w-full max-h-full flex items-center justify-center">
            <img
              src={reviews[selectedImageIndex].image_url}
              alt="Відгук клієнта"
              className="max-w-full max-h-[90vh] object-contain shadow-2xl animate-scale-in"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm bg-black/50 px-4 py-2 rounded-full">
            {selectedImageIndex + 1} / {reviews.length}
          </div>
        </div>
      )}
    </div>
  );
};
