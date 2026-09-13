import React, { useState, useEffect } from 'react';
import { ApiService } from '../services/api';
import { Search, AlertTriangle, TrendingUp, Clock, RefreshCw, Trash2, Plus, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

interface SearchReport {
  total_searches: number;
  zero_results_count: number;
  zero_results: { query: string; count: number; last_searched: string }[];
  popular: { query: string; count: number; results_count: number; last_searched: string }[];
  recent: { id: number; query: string; results_count: number; created_at: string }[];
}

export const SearchAnalytics: React.FC = () => {
  const [report, setReport] = useState<SearchReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'recent' | 'zero' | 'popular'>('recent');

  const loadReport = async () => {
    setLoading(true);
    try {
      const data = await ApiService.getSearchQueriesReport(100);
      setReport(data);
    } catch (e) {
      console.error('Failed to load search analytics', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, []);

  const handleClearHistory = async () => {
    if (!window.confirm('Ви впевнені, що хочете очистити історію пошукових запитів?')) {
      return;
    }
    try {
      await ApiService.clearSearchQueries();
      loadReport();
    } catch (e) {
      alert('Не вдалося очистити історію');
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('uk-UA', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-gray-200 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Search className="text-red-600" size={24} />
            Пошукова аналітика
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Відстежуйте, що шукають клієнти, та знаходьте товари, на які є попит, але їх немає на складі.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadReport}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
            title="Оновити дані"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Оновити
          </button>
          <button
            onClick={handleClearHistory}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition"
            title="Очистити історію пошуків"
          >
            <Trash2 size={16} />
            Очистити
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
            <Search size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Усього пошуків</p>
            <p className="text-2xl font-bold text-gray-900 mt-0.5">
              {loading ? '...' : report?.total_searches ?? 0}
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-rose-200 bg-rose-50/20 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold text-rose-700 uppercase tracking-wider">Не знайдено товарів (0)</p>
            <p className="text-2xl font-bold text-rose-700 mt-0.5">
              {loading ? '...' : report?.zero_results_count ?? 0}
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Унікальних запитів</p>
            <p className="text-2xl font-bold text-gray-900 mt-0.5">
              {loading ? '...' : report?.popular?.length ?? 0}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="flex border-b border-gray-200 px-6 pt-4 gap-6 bg-gray-50/50">
          <button
            onClick={() => setActiveTab('recent')}
            className={`pb-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition cursor-pointer ${
              activeTab === 'recent'
                ? 'border-red-600 text-red-600'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <Clock size={16} className={activeTab === 'recent' ? 'text-red-600' : 'text-gray-400'} />
            Стрічка пошуків ({report?.recent?.length ?? 0})
          </button>

          <button
            onClick={() => setActiveTab('zero')}
            className={`pb-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition cursor-pointer ${
              activeTab === 'zero'
                ? 'border-red-600 text-red-600'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <AlertTriangle size={16} className={activeTab === 'zero' ? 'text-red-600' : 'text-gray-400'} />
            Не знайдено товарів ({report?.zero_results?.length ?? 0})
          </button>

          <button
            onClick={() => setActiveTab('popular')}
            className={`pb-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition cursor-pointer ${
              activeTab === 'popular'
                ? 'border-red-600 text-red-600'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <TrendingUp size={16} className={activeTab === 'popular' ? 'text-red-600' : 'text-gray-400'} />
            Популярні запити ({report?.popular?.length ?? 0})
          </button>
        </div>

        {/* Tab 1: Zero Results */}
        {activeTab === 'zero' && (
          <div className="p-6">
            <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 flex items-start gap-2">
              <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <span>
                Тут зібрані запити, за якими клієнти шукали деталі, але не отримали жодного результату. Це пряма підказка, які товари слід додати або які ключові слова/синоніми прописати в товарах.
              </span>
            </div>

            {!report?.zero_results?.length ? (
              <div className="text-center py-12 text-gray-400">
                Пошукових запитів із нульовим результатом поки немає.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase bg-gray-50">
                      <th className="py-3 px-4">Пошуковий запит</th>
                      <th className="py-3 px-4 text-center">Кількість пошуків</th>
                      <th className="py-3 px-4">Останній пошук</th>
                      <th className="py-3 px-4 text-right">Дія</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {report.zero_results.map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/80 transition">
                        <td className="py-3 px-4 font-semibold text-gray-900">
                          «{item.query}»
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700">
                            {item.count}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-500 text-xs">
                          {formatDate(item.last_searched)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Link
                            to={`/products/new?name=${encodeURIComponent(item.query)}`}
                            className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded-md transition"
                            title="Створити деталь з такою назвою"
                          >
                            <Plus size={14} />
                            Створити товар
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Popular Queries */}
        {activeTab === 'popular' && (
          <div className="p-6">
            {!report?.popular?.length ? (
              <div className="text-center py-12 text-gray-400">
                Немає даних пошукових запитів.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase bg-gray-50">
                      <th className="py-3 px-4">Пошуковий запит</th>
                      <th className="py-3 px-4 text-center">Кількість пошуків</th>
                      <th className="py-3 px-4 text-center">Знайдено товарів</th>
                      <th className="py-3 px-4">Останній пошук</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {report.popular.map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/80 transition">
                        <td className="py-3 px-4 font-semibold text-gray-900">
                          «{item.query}»
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-800">
                            {item.count}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {item.results_count > 0 ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                              {item.results_count} поз.
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700">
                              0 (не знайдено)
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-gray-500 text-xs">
                          {formatDate(item.last_searched)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Recent Searches */}
        {activeTab === 'recent' && (
          <div className="p-6">
            {!report?.recent?.length ? (
              <div className="text-center py-12 text-gray-400">
                Стрічка пошуків поки порожня.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase bg-gray-50">
                      <th className="py-3 px-4">Час запиту</th>
                      <th className="py-3 px-4">Пошуковий запит</th>
                      <th className="py-3 px-4 text-center">Результат</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {report.recent.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50/80 transition">
                        <td className="py-3 px-4 text-gray-500 text-xs">
                          {formatDate(item.created_at)}
                        </td>
                        <td className="py-3 px-4 font-semibold text-gray-900">
                          «{item.query}»
                        </td>
                        <td className="py-3 px-4 text-center">
                          {item.results_count > 0 ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                              ✓ Знайдено {item.results_count}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700">
                              ✕ 0 знайдено
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
