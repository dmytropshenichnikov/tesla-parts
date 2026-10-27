import React from 'react';

/**
 * Кістяки (skeleton) замість крутилки: сторінка одразу показує свій каркас,
 * тому контент не «підстрибує» з порожнього місця і відсутні layout-стрибки.
 * Усі блоки мають таку саму геометрію, як у справжнього контенту
 * (картки товарів — квадратне фото 1:1, сітка — ті самі колонки), тож після
 * завантаження нічого не зміщується.
 */

interface SkeletonProps {
  className?: string;
}

const Block: React.FC<SkeletonProps> = ({ className = '' }) => (
  <div className={`bg-gray-200/80 rounded-lg ${className}`} />
);

/** Сітка карток товарів (головна, категорія, пошук). */
export const GridSkeleton: React.FC<{ count?: number; title?: boolean }> = ({
  count = 8,
  title = true,
}) => (
  <div className="py-8 animate-pulse" aria-hidden="true">
    {title && <Block className="h-7 w-56 mb-6" />}
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 sm:gap-6">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="bg-white rounded-2xl shadow-xs border border-gray-100 flex flex-col overflow-hidden"
        >
          <div className="relative w-full aspect-square bg-gray-200/80" />
          <div className="p-3 sm:p-4 flex flex-col gap-2">
            <Block className="h-3 w-3/4" />
            <Block className="h-3 w-1/2" />
            <Block className="h-5 w-2/5 mt-1" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

/** Каркас сторінки: заголовок + сітка. Використовується для ленивих маршрутів. */
export const PageSkeleton: React.FC = () => (
  <div className="py-8 animate-pulse" aria-hidden="true">
    <Block className="h-3 w-40 mb-5" />
    <Block className="h-8 w-72 max-w-full mb-6" />
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 sm:gap-6">
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          key={index}
          className="bg-white rounded-2xl shadow-xs border border-gray-100 overflow-hidden"
        >
          <div className="w-full aspect-square bg-gray-200/80" />
          <div className="p-3 sm:p-4 flex flex-col gap-2">
            <Block className="h-3 w-3/4" />
            <Block className="h-3 w-1/2" />
            <Block className="h-5 w-2/5 mt-1" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

/** Карточка товару: фото 1:1, назва, ціна, кнопка. */
export const ProductSkeleton: React.FC = () => (
  <div className="animate-pulse" aria-hidden="true">
    <Block className="h-7 w-64 max-w-full mb-4" />
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
      <div className="aspect-square bg-gray-200/80 rounded-2xl" />
      <div className="flex flex-col gap-4">
        <Block className="h-4 w-40" />
        <Block className="h-9 w-56" />
        <Block className="h-6 w-32" />
        <Block className="h-12 w-full rounded-xl" />
        <div className="flex flex-col gap-3 mt-2">
          <Block className="h-5 w-full" />
          <Block className="h-5 w-5/6" />
          <Block className="h-5 w-2/3" />
        </div>
      </div>
    </div>
  </div>
);
