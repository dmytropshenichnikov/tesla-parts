import React, { useState, useEffect, useMemo } from 'react';
import { ApiService } from '../services/api';
import { Plus, Trash2, CheckCircle, XCircle } from 'lucide-react';

export const PromoCodeList: React.FC = () => {
  const [promocodes, setPromocodes] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    discount_type: 'percent',
    discount_value: '',
    scope: 'everyone',
  });
  const [selectedCustomers, setSelectedCustomers] = useState<number[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchPromoCodes();
    fetchCustomers();
  }, []);

  const fetchPromoCodes = async () => {
    try {
      const data = await ApiService.getPromoCodes();
      setPromocodes(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const data = await ApiService.getCustomers();
      setCustomers(data);
    } catch (e) {
      console.error(e);
    }
  };

  const filteredCustomers = useMemo(() => {
    if (!searchTerm) return customers;
    const lower = searchTerm.toLowerCase();
    return customers.filter(
      (c) =>
        (c.email && c.email.toLowerCase().includes(lower)) ||
        (c.first_name && c.first_name.toLowerCase().includes(lower)) ||
        (c.last_name && c.last_name.toLowerCase().includes(lower)) ||
        (c.phone && c.phone.includes(lower))
    );
  }, [customers, searchTerm]);

  const handleSelectAllFiltered = () => {
    const newIds = filteredCustomers.map((c) => c.id);
    const combined = Array.from(new Set([...selectedCustomers, ...newIds]));
    setSelectedCustomers(combined);
  };

  const toggleCustomer = (id: number) => {
    if (selectedCustomers.includes(id)) {
      setSelectedCustomers(selectedCustomers.filter((cId) => cId !== id));
    } else {
      setSelectedCustomers([...selectedCustomers, id]);
    }
  };

  const openAddForm = () => {
    setFormData({
      code: '',
      discount_type: 'percent',
      discount_value: '',
      scope: 'everyone',
    });
    setSelectedCustomers([]);
    setEditingId(null);
    setIsAdding(true);
  };

  const openEditForm = (promo: any) => {
    setFormData({
      code: promo.code,
      discount_type: promo.discount_type,
      discount_value: promo.discount_value.toString(),
      scope: promo.scope,
    });
    setSelectedCustomers(promo.customer_ids || []);
    setEditingId(promo.id);
    setIsAdding(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        code: formData.code.toUpperCase().trim(),
        discount_type: formData.discount_type,
        discount_value: parseFloat(formData.discount_value),
        scope: formData.scope,
        customer_ids: formData.scope === 'selected' ? selectedCustomers : [],
        is_active: true,
      };

      if (editingId) {
        await ApiService.updatePromoCode(editingId, payload);
      } else {
        await ApiService.createPromoCode(payload);
      }
      setIsAdding(false);
      fetchPromoCodes();
    } catch (e: any) {
      alert(e.message || 'Помилка збереження');
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('Видалити промокод?')) {
      try {
        await ApiService.deletePromoCode(id);
        fetchPromoCodes();
      } catch (e) {
        alert('Помилка видалення');
      }
    }
  };

  const toggleStatus = async (promo: any) => {
    try {
      const payload = {
        code: promo.code,
        discount_type: promo.discount_type,
        discount_value: promo.discount_value,
        scope: promo.scope,
        customer_ids: promo.customer_ids,
        is_active: !promo.is_active,
      };
      await ApiService.updatePromoCode(promo.id, payload);
      fetchPromoCodes();
    } catch (e) {
      alert('Помилка оновлення');
    }
  };

  if (loading) return <div>Завантаження...</div>;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-6 border-b border-gray-100 flex justify-between items-center">
        <h2 className="text-xl font-bold">Промокоди</h2>
        <button
          onClick={isAdding ? () => setIsAdding(false) : openAddForm}
          className="bg-black text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-800"
        >
          {isAdding ? (
            'Скасувати'
          ) : (
            <>
              <Plus size={18} /> Додати промокод
            </>
          )}
        </button>
      </div>

      {isAdding && (
        <div className="p-6 border-b border-gray-100 bg-gray-50">
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Код</label>
                <input
                  required
                  type="text"
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({ ...formData, code: e.target.value })
                  }
                  className="w-full border rounded p-2"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Тип знижки
                </label>
                <select
                  required
                  value={formData.discount_type}
                  onChange={(e) =>
                    setFormData({ ...formData, discount_type: e.target.value })
                  }
                  className="w-full border rounded p-2"
                >
                  <option value="percent">Відсоток</option>
                  <option value="usd">USD</option>
                  <option value="uah">UAH</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Значення
                </label>
                <input
                  required
                  type="number"
                  step="0.01"
                  value={formData.discount_value}
                  onChange={(e) =>
                    setFormData({ ...formData, discount_value: e.target.value })
                  }
                  className="w-full border rounded p-2"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Доступність (scope)
                </label>
                <select
                  required
                  value={formData.scope}
                  onChange={(e) =>
                    setFormData({ ...formData, scope: e.target.value })
                  }
                  className="w-full border rounded p-2"
                >
                  <option value="everyone">Для всіх</option>
                  <option value="selected">Для обраних клієнтів</option>
                </select>
              </div>
            </div>

            {formData.scope === 'selected' && (
              <div className="mt-4 p-4 border rounded bg-white">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold">Оберіть клієнтів</h3>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Пошук клієнтів..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="border rounded px-2 py-1 text-sm"
                    />
                    <button
                      type="button"
                      onClick={handleSelectAllFiltered}
                      className="bg-gray-200 px-3 py-1 rounded text-sm hover:bg-gray-300"
                    >
                      Вибрати всіх відфільтрованих
                    </button>
                  </div>
                </div>
                <div className="max-h-60 overflow-y-auto border rounded divide-y">
                  {filteredCustomers.map((c) => (
                    <label
                      key={c.id}
                      className="flex items-center gap-3 p-2 hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedCustomers.includes(c.id)}
                        onChange={() => toggleCustomer(c.id)}
                      />
                      <span className="text-sm">
                        {c.first_name} {c.last_name} ({c.email}) {c.phone}
                      </span>
                    </label>
                  ))}
                  {filteredCustomers.length === 0 && (
                    <div className="p-4 text-center text-gray-500 text-sm">
                      Нікого не знайдено
                    </div>
                  )}
                </div>
                <div className="mt-2 text-sm text-gray-600">
                  Обрано клієнтів: {selectedCustomers.length}
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
              >
                {editingId ? 'Зберегти зміни' : 'Створити'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase">
            <tr>
              <th className="px-6 py-4">Код</th>
              <th className="px-6 py-4">Знижка</th>
              <th className="px-6 py-4">Доступність</th>
              <th className="px-6 py-4">Статус</th>
              <th className="px-6 py-4 text-right">Дії</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm">
            {promocodes.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-bold">{p.code}</td>
                <td className="px-6 py-4">
                  {p.discount_value}{' '}
                  {p.discount_type === 'percent'
                    ? '%'
                    : p.discount_type.toUpperCase()}
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`px-2 py-1 rounded text-xs ${p.scope === 'everyone' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}
                  >
                    {p.scope === 'everyone'
                      ? 'Для всіх'
                      : `Обрані (${p.customer_ids?.length || 0})`}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => toggleStatus(p)}
                    title={
                      p.is_active
                        ? 'Промокод працює. Натисніть, щоб вимкнути'
                        : 'Промокод вимкнено — клієнти бачать «Промокод вимкнено». Натисніть, щоб увімкнути'
                    }
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                      p.is_active
                        ? 'bg-green-100 text-green-800 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {p.is_active ? <CheckCircle size={14} /> : <XCircle size={14} />}
                    {p.is_active ? 'Увімкнено' : 'Вимкнено'}
                  </button>
                </td>
                <td className="px-6 py-4 text-right flex justify-end gap-2">
                  <button
                    onClick={() => openEditForm(p)}
                    className="text-blue-500 hover:text-blue-700 text-xs"
                  >
                    Редагувати
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
