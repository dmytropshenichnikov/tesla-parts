import React, { useState, useEffect } from 'react';
import { ApiService } from '../services/api';
import {
  Plus,
  Trash2,
  Loader2,
  Image as ImageIcon,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface Review {
  id: number;
  image_url: string;
  sort_order: number;
  created_at: string;
}

export const ReviewManager: React.FC = () => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(
    null
  );

  useEffect(() => {
    fetchReviews();
  }, []);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const data = await ApiService.getReviews();
      setReviews(data);
    } catch (err) {
      setError('Не вдалося завантажити відгуки');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        // Use 0 to place new reviews at the beginning (newest first)
        await ApiService.createReview(files[i], 0);
      }
      await fetchReviews();
    } catch (err) {
      setError('Не вдалося завантажити фото');
      console.error(err);
    } finally {
      setUploading(false);
      // Reset input
      event.target.value = '';
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Ви впевнені, що хочете видалити цей відгук?')) return;

    try {
      await ApiService.deleteReview(id);
      setReviews(reviews.filter((r) => r.id !== id));
    } catch (err) {
      setError('Не вдалося видалити відгук');
      console.error(err);
    }
  };

  const moveReview = async (dragIndex: number, hoverIndex: number) => {
    const newReviews = [...reviews];
    const draggedReview = newReviews[dragIndex];
    newReviews.splice(dragIndex, 1);
    newReviews.splice(hoverIndex, 0, draggedReview);

    setReviews(newReviews);
    try {
      await ApiService.reorderReviews(newReviews.map((r) => r.id));
    } catch (err) {
      console.error('Failed to reorder', err);
    }
  };

  const openLightbox = (index: number) => {
    setSelectedImageIndex(index);
    document.body.style.overflow = 'hidden';
  };

  const closeLightbox = () => {
    setSelectedImageIndex(null);
    document.body.style.overflow = 'auto';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-red-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Фото-відгуки</h2>
          <p className="text-gray-500">
            Керування скріншотами відгуків клієнтів
          </p>
        </div>

        <label className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors cursor-pointer">
          {uploading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Plus className="w-5 h-5" />
          )}
          <span>Додати відгуки</span>
          <input
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
            disabled={uploading}
          />
        </label>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-100">
          {error}
        </div>
      )}

      {reviews.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">
            Відгуків поки немає
          </h3>
          <p className="text-gray-500">Завантажте перші скріншоти відгуків</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {reviews.map((review, index) => (
            <div
              key={review.id}
              className="group relative bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
            >
              <div
                className="aspect-[3/4] overflow-hidden bg-gray-100 cursor-zoom-in"
                onClick={() => openLightbox(index)}
              >
                <img
                  src={review.image_url}
                  alt={`Відгук ${review.id}`}
                  className="w-full h-full object-cover hover:scale-105 transition-transform"
                />
              </div>

              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                {/* Delete button in center */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(review.id);
                  }}
                  className="p-3 bg-white text-red-600 rounded-full hover:bg-red-50 transition-colors shadow-lg pointer-events-auto"
                  title="Видалити"
                >
                  <Trash2 className="w-6 h-6" />
                </button>

                {/* Reordering buttons - Left/Right only */}
                {index > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      moveReview(index, index - 1);
                    }}
                    className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 bg-white/90 text-gray-800 rounded-full hover:bg-white shadow-sm pointer-events-auto transition-all hover:scale-110"
                    title="Перемістити ліворуч"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                )}

                {index < reviews.length - 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      moveReview(index, index + 1);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-white/90 text-gray-800 rounded-full hover:bg-white shadow-sm pointer-events-auto transition-all hover:scale-110"
                    title="Перемістити праворуч"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                )}
              </div>

              <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                #{index + 1}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox Modal */}
      {selectedImageIndex !== null && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 md:p-8"
          onClick={closeLightbox}
        >
          <button
            className="absolute top-4 right-4 text-white hover:text-red-500 transition-colors p-2 z-[110]"
            onClick={closeLightbox}
          >
            <X size={32} />
          </button>

          {reviews.length > 1 && (
            <>
              <button
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:text-red-500 transition-colors p-2 z-[110] bg-black/20 rounded-full"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedImageIndex(
                    (selectedImageIndex - 1 + reviews.length) % reviews.length
                  );
                }}
              >
                <ChevronLeft size={48} />
              </button>
              <button
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:text-red-500 transition-colors p-2 z-[110] bg-black/20 rounded-full"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedImageIndex(
                    (selectedImageIndex + 1) % reviews.length
                  );
                }}
              >
                <ChevronRight size={48} />
              </button>
            </>
          )}

          <div className="max-w-full max-h-full flex items-center justify-center">
            <img
              src={reviews[selectedImageIndex].image_url}
              alt="Відгук"
              className="max-w-full max-h-[90vh] object-contain shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
};
