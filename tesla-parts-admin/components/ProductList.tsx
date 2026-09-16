import React, { useState, useEffect } from 'react';
import { ApiService } from '../services/api';
import { Product } from '../types';
import {
  Search,
  Plus,
  Filter,
  Trash2,
  Pencil,
  ArrowUpDown,
  Star,
  Copy,
} from 'lucide-react';

import { Link } from 'react-router-dom';

const extractCategories = (value?: string) => {
  if (!value) return [];
  return value
    .split(',')
    .map((cat) => cat.trim())
    .filter(Boolean);
};

export const ProductList: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('Всі');
  const [sortBy, setSortBy] = useState<string>('default');
  const [loading, setLoading] = useState(true);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const data = await ApiService.getProducts();
      setProducts(data);
      setFilteredProducts(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let result = [...products];
    if (categoryFilter !== 'Всі') {
      result = result.filter((p) =>
        extractCategories(p.category).includes(categoryFilter)
      );
    }
    if (searchTerm) {
      const lower = searchTerm.toLowerCase().trim();
      // Порядок слів не важливий: усі слова мають бути присутні в будь-якому
      // місці. «захист переднього бампера» знайде «Захист нижній переднього...»
      const tokens = lower.split(/\s+/).filter(Boolean);
      const cleanSearch = lower.replace(/[^a-z0-9]/g, '');

      result = result.filter((p) => {
        const haystack = [
          p.name,
          p.description,
          p.search_keywords,
          p.detail_number,
          p.cross_number,
          p.id,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        if (tokens.length > 0 && tokens.every((token) => haystack.includes(token))) {
          return true;
        }
        if (!cleanSearch) return false;
        const codes = [p.detail_number, p.cross_number, p.id]
          .filter(Boolean)
          .map((value) => String(value).toLowerCase().replace(/[^a-z0-9]/g, ''));
        return codes.some((value) => value.includes(cleanSearch));
      });
    }

    // Sorting
    result.sort((a, b) => {
      switch (sortBy) {
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        case 'price-asc':
          return (a.priceUSD || 0) - (b.priceUSD || 0);
        case 'price-desc':
          return (b.priceUSD || 0) - (a.priceUSD || 0);
        case 'cross-asc':
          return (a.cross_number || '').localeCompare(b.cross_number || '');
        case 'cross-desc':
          return (b.cross_number || '').localeCompare(a.cross_number || '');
        case 'date-newest':
          return (
            new Date(b.created_at || 0).getTime() -
            new Date(a.created_at || 0).getTime()
          );
        case 'date-oldest':
          return (
            new Date(a.created_at || 0).getTime() -
            new Date(b.created_at || 0).getTime()
          );
        default:
          // Backend default or preserved order
          return 0;
      }
    });

    setFilteredProducts(result);
  }, [searchTerm, categoryFilter, sortBy, products]);

  const handleDelete = async (id: string) => {
    if (confirm('Ви впевнені, що хочете видалити цей товар?')) {
      await ApiService.deleteProduct(id);
      setSelectedProducts((prev) => prev.filter((pid) => pid !== id));
      fetchProducts();
    }
  };

  const handleTogglePopular = async (id: string) => {
    try {
      await ApiService.togglePopular(id);
      fetchProducts();
    } catch (e) {
      console.error(e);
      alert('Не вдалося змінити статус');
    }
  };

  const handleCopyProduct = async (id: string) => {
    if (confirm('Ви впевнені, що хочете скопіювати цей товар?')) {
      try {
        await ApiService.copyProduct(id);
        fetchProducts();
      } catch (error) {
        alert('Не вдалося скопіювати товар');
      }
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedProducts((prev) =>
      prev.includes(id) ? prev.filter((pid) => pid !== id) : [...prev, id]
    );
  };

  useEffect(() => {
    setSelectedProducts((prev) =>
      prev.filter((pid) => products.some((product) => product.id === pid))
    );
  }, [products]);

  const allVisibleIds = filteredProducts.map((p) => p.id);
  const isAllSelected =
    allVisibleIds.length > 0 &&
    allVisibleIds.every((id) => selectedProducts.includes(id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedProducts((prev) =>
        prev.filter((id) => !allVisibleIds.includes(id))
      );
    } else {
      setSelectedProducts((prev) =>
        Array.from(new Set([...prev, ...allVisibleIds]))
      );
    }
  };

  const handleBulkDelete = async () => {
    if (selectedProducts.length === 0) return;
    if (!confirm(`Видалити ${selectedProducts.length} товар(и)?`)) return;
    try {
      await ApiService.bulkDeleteProducts(selectedProducts);
      setSelectedProducts([]);
      fetchProducts();
    } catch (error) {
      alert('Не вдалося видалити вибрані товари');
    }
  };

  if (loading) return <div className="p-8 text-center">Завантаження...</div>;

  const categories = [
    'Всі',
    ...Array.from(
      new Set(products.flatMap((p) => extractCategories(p.category)))
    ),
  ];

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="relative w-full md:w-80 lg:w-96">
          <Search
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
            size={20}
          />
          <input
            type="text"
            placeholder="Пошук..."
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-start md:justify-end">
          <button
            onClick={handleBulkDelete}
            disabled={selectedProducts.length === 0}
            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors border flex-1 sm:flex-none ${
              selectedProducts.length === 0
                ? 'text-gray-300 border-gray-200 cursor-not-allowed'
                : 'text-red-600 border-red-200 hover:bg-red-50'
            }`}
          >
            <Trash2 size={16} />
            <span className="whitespace-nowrap">Видалити вибрані</span>
            {selectedProducts.length > 0 && (
              <span className="text-xs font-semibold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                {selectedProducts.length}
              </span>
            )}
          </button>

          <div className="relative flex-1 sm:flex-none">
            <select
              className="w-full appearance-none pl-10 pr-8 py-2 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <Filter
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
              size={16}
            />
          </div>

          <div className="relative flex-1 sm:flex-none">
            <select
              className="w-full appearance-none pl-10 pr-8 py-2 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="default">За замовчуванням</option>
              <option value="name-asc">Назва (А-Я)</option>
              <option value="name-desc">Назва (Я-А)</option>
              <option value="price-asc">Ціна (дешевше)</option>
              <option value="price-desc">Ціна (дорожче)</option>
              <option value="cross-asc">Cross-номер (A-Z)</option>
              <option value="cross-desc">Cross-номер (Z-A)</option>
              <option value="date-newest">Спочатку нові</option>
              <option value="date-oldest">Спочатку старі</option>
            </select>
            <ArrowUpDown
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
              size={16}
            />
          </div>

          <Link
            to="/products/new"
            className="flex items-center justify-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors flex-1 sm:flex-none"
          >
            <Plus size={20} />
            <span className="whitespace-nowrap">Додати Товар</span>
          </Link>
        </div>
      </div>

      <div className="px-2">
        <span className="text-sm text-gray-500">
          Всього товарів:{' '}
          <span className="font-medium text-gray-900">{products.length}</span>
          {filteredProducts.length !== products.length && (
            <>
              {' '}
              • Знайдено:{' '}
              <span className="font-medium text-gray-900">
                {filteredProducts.length}
              </span>
            </>
          )}
        </span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-4 w-10">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 text-red-600 border-gray-300 rounded"
                  />
                </th>
                <th className="px-6 py-4">Товар</th>
                <th className="px-6 py-4">Категорія</th>
                <th className="px-6 py-4">Наявність</th>
                <th className="px-6 py-4">Ціна</th>
                <th className="px-6 py-4 text-right">Дії</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredProducts.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4">
                    <input
                      type="checkbox"
                      checked={selectedProducts.includes(product.id)}
                      onChange={() => toggleSelect(product.id)}
                      className="w-4 h-4 text-red-600 border-gray-300 rounded"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded bg-gray-100 overflow-hidden">
                        <img
                          src={product.image}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">
                          {product.name}
                        </div>
                        <div className="text-xs text-gray-400 truncate max-w-[200px]">
                          {product.description}
                        </div>
                        {product.cross_number && (
                          <div className="text-xs text-gray-500 mt-1">
                            Cross: {product.cross_number}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">
                      {product.category}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`${product.inStock ? 'text-green-600' : 'text-red-600 font-bold'}`}
                    >
                      {product.inStock ? 'В наявності' : 'Немає'}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-medium">
                    {product.priceUSD} $
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleTogglePopular(product.id)}
                        className={`p-1.5 rounded transition-colors ${
                          product.is_popular
                            ? 'text-yellow-500 bg-yellow-50 hover:bg-yellow-100'
                            : 'text-gray-400 hover:bg-gray-50'
                        }`}
                        title={
                          product.is_popular
                            ? 'Прибрати з популярних'
                            : 'Додати в популярні'
                        }
                      >
                        <Star
                          size={16}
                          fill={product.is_popular ? 'currentColor' : 'none'}
                        />
                      </button>
                      <button
                        onClick={() => handleCopyProduct(product.id)}
                        className="p-1.5 text-green-500 hover:bg-green-50 rounded"
                        title="Копіювати"
                      >
                        <Copy size={16} />
                      </button>
                      <Link
                        to={`/products/edit/${product.id}`}
                        className="p-1.5 text-blue-500 hover:bg-blue-50 rounded"
                      >
                        <Pencil size={16} />
                      </Link>
                      <button
                        onClick={() => handleDelete(product.id)}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredProducts.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            Товарів не знайдено.
          </div>
        )}
      </div>
    </div>
  );
};
