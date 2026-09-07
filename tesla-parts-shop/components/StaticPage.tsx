import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import SeoHead from './SeoHead';
import { StaticSeoRecord } from '../types';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

interface StaticPageProps {
  slug: string;
  seo?: StaticSeoRecord | null;
}

// Map of slugs to Ukrainian titles for fallback
const PAGE_TITLES: { [key: string]: string } = {
  about: 'Про нас',
  delivery: 'Доставка та оплата',
  returns: 'Повернення',
  faq: 'Часті питання',
  contacts: 'Контакти',
};

const StaticPage: React.FC<StaticPageProps> = ({ slug, seo }) => {
  const [page, setPage] = useState<{ title: string; content: string } | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPage = async () => {
      setLoading(true);
      try {
        const data = await api.getPage(slug);
        if (data && data.is_published) {
          setPage({ title: data.title, content: data.content });
        } else {
          // Fallback if page not found or not published
          setPage(null);
        }
      } catch (e) {
        console.error('Failed to load page', e);
        setPage(null);
      } finally {
        setLoading(false);
      }
    };
    loadPage();
  }, [slug]);

  if (loading) {
    return (
      <div className="py-12 max-w-2xl mx-auto">
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-tesla-red border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  const fallbackTitle = `${page?.title || PAGE_TITLES[slug] || 'Tesla Parts Center'} | Tesla Parts Center`;
  const rawContent = page?.content ? page.content.replace(/<[^>]+>/g, ' ') : '';
  const trimmedContent = rawContent.trim();
  const fallbackDescription =
    trimmedContent.length === 0
      ? 'Tesla Parts Center — інтернет-магазин запчастин для Tesla.'
      : trimmedContent.length > 160
        ? `${trimmedContent.slice(0, 157).trimEnd()}...`
        : trimmedContent;

  return (
    <div className="py-12 max-w-2xl mx-auto">
      <SeoHead
        title={seo?.meta_title}
        description={seo?.meta_description}
        fallbackTitle={fallbackTitle}
        fallbackDescription={fallbackDescription}
      />
      <h1 className="text-3xl font-bold mb-6">
        {page?.title || PAGE_TITLES[slug] || slug}
      </h1>

      {page ? (
        <div
          className="text-gray-600 leading-relaxed prose prose-lg max-w-none"
          dangerouslySetInnerHTML={{
            __html: page.content.replace(/\n/g, '<br />'),
          }}
        />
      ) : (
        <p className="text-gray-600 leading-relaxed">
          Ця сторінка знаходиться в розробці.
        </p>
      )}

      <Link
        to="/"
        className="mt-8 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 hover:text-tesla-dark text-sm font-medium shadow-xs transition-all duration-200 hover:-translate-x-0.5 active:scale-95 group"
      >
        <ArrowLeft size={16} className="transition-transform duration-200 group-hover:-translate-x-1 text-gray-400 group-hover:text-tesla-dark" />
        <span>Повернутись на головну</span>
      </Link>
    </div>
  );
};

export default StaticPage;
