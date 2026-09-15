import React from 'react';
import { Helmet } from 'react-helmet-async';

interface SeoHeadProps {
  title?: string | null;
  description?: string | null;
  image?: string;
  fallbackTitle?: string;
  fallbackDescription?: string;

  // Нові пропси для Schema.org
  type?: 'website' | 'product'; // Тип сторінки
  price?: number; // Ціна (для товарів)
  currency?: string; // Валюта (за замовчуванням UAH)
  availability?: boolean; // Чи є в наявності
  deliveryInfo?: string | null; // Інформація про доставку
  canonicalUrl?: string; // Канонічний URL сторінки
}

const DEFAULT_TITLE = 'Tesla Parts Center';
const DEFAULT_DESCRIPTION =
  'Tesla Parts Center пропонує запчастини та аксесуари для вашого електромобіля.';
const URL = 'https://teslapartscenter.com.ua';

const SeoHead: React.FC<SeoHeadProps> = ({
  title,
  description,
  image,
  fallbackTitle,
  fallbackDescription,
  type = 'website', // За замовчуванням звичайна сторінка
  price,
  currency = 'UAH',
  availability = true,
  deliveryInfo,
  canonicalUrl,
}) => {
  const safeTitle = title?.trim() || fallbackTitle?.trim() || DEFAULT_TITLE;
  let safeDescription =
    description?.trim() || fallbackDescription?.trim() || DEFAULT_DESCRIPTION;

  if (type === 'product' && deliveryInfo) {
    // Append delivery info summary if available
    const deliverySummary = deliveryInfo
      .split('\n')
      .filter((l) => l.trim().length > 0)
      .slice(0, 3)
      .join('. ');
    const truncatedDelivery =
      deliverySummary.length > 150
        ? deliverySummary.slice(0, 147) + '...'
        : deliverySummary;
    if (!safeDescription.includes(truncatedDelivery.slice(0, 20))) {
      // Avoid duplication
      safeDescription = `${safeDescription} ${truncatedDelivery}`;
    }
  }

  const currentUrl =
    canonicalUrl ||
    (typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}`
      : URL);

  const nextYear = new Date();
  nextYear.setFullYear(nextYear.getFullYear() + 1);
  const priceValidUntil = nextYear.toISOString().split('T')[0];

  // Логіка створення JSON-LD (Schema.org)
  let structuredData = null;

  if (type === 'product') {
    structuredData = {
      '@context': 'https://schema.org/',
      '@type': 'Product',
      name: safeTitle,
      image: image ? [image] : [],
      description: safeDescription,
      brand: {
        '@type': 'Brand',
        name: 'Tesla', // Можна змінити на динамічний бренд, якщо є різні
      },
      offers: {
        '@type': 'Offer',
        url: currentUrl,
        priceCurrency: currency,
        priceValidUntil: priceValidUntil,

        price: price, // Google вимагає цифру
        availability: availability
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
        itemCondition: 'https://schema.org/UsedCondition', // Можна змінювати на NewCondition
      },
    };
  }

  return (
    <Helmet>
      {/* Основні теги */}
      <title>{safeTitle}</title>
      <meta name="description" content={safeDescription} />
      <link rel="canonical" href={currentUrl} />

      {/* Open Graph (Facebook, Viber, Telegram) */}
      <meta property="og:title" content={safeTitle} />
      <meta property="og:description" content={safeDescription} />
      <meta
        property="og:type"
        content={type === 'product' ? 'product' : 'website'}
      />
      {image && <meta property="og:image" content={image} />}
      <meta property="og:url" content={currentUrl} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={safeTitle} />
      <meta name="twitter:description" content={safeDescription} />
      {image && <meta name="twitter:image" content={image} />}

      {/* Вставка JSON-LD для Google Rich Results */}
      {structuredData && (
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      )}
    </Helmet>
  );
};

export default SeoHead;
