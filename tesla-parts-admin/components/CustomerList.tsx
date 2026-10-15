import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiService } from '../services/api';
import { Edit2, Save, X } from 'lucide-react';

export const CustomerList: React.FC = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editType, setEditType] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const data = await ApiService.getCustomers();
      const sorted = [...data].sort((a: any, b: any) => (b.id || 0) - (a.id || 0));
      setCustomers(sorted);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (customer: any) => {
    setEditingId(customer.id);
    setEditType(customer.discount_type || '');
    setEditValue(
      customer.discount_value !== null ? String(customer.discount_value) : ''
    );
  };

  const handleSave = async (id: number) => {
    try {
      const val = editValue ? parseFloat(editValue) : null;
      await ApiService.updateCustomerDiscount(id, editType || null, val);
      setEditingId(null);
      fetchCustomers();
    } catch (e) {
      alert('Помилка збереження');
    }
  };

  if (loading) return <div>Завантаження...</div>;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-6 border-b border-gray-100 flex justify-between items-center">
        <h2 className="text-xl font-bold">Клієнти</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase">
            <tr>
              <th className="px-6 py-4">Email</th>
              <th className="px-6 py-4">Ім'я / Прізвище</th>
              <th className="px-6 py-4">Телефон</th>
              <th className="px-6 py-4">Зареєстрований</th>
              <th className="px-6 py-4">Знижка</th>
              <th className="px-6 py-4 text-right">Дії</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm">
            {customers.map((c) => (
              <tr
                key={c.id}
                className="hover:bg-gray-50 cursor-pointer"
                onClick={() => navigate(`/customers/${c.id}`)}
              >
                <td className="px-6 py-4">{c.email}</td>
                <td className="px-6 py-4">
                  {c.first_name} {c.last_name}
                </td>
                <td className="px-6 py-4">{c.phone}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {c.created_at ? new Date(c.created_at).toLocaleDateString('uk-UA') : '—'}
                  {c.created_at &&
                    Date.now() - new Date(c.created_at).getTime() < 7 * 24 * 3600 * 1000 && (
                      <span className="ml-2 inline-block px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-bold">
                        НОВИЙ
                      </span>
                    )}
                </td>
                <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                  {editingId === c.id ? (
                    <div className="flex gap-2">
                      <select
                        value={editType || ''}
                        onChange={(e) => setEditType(e.target.value)}
                        className="border rounded p-1 text-sm"
                      >
                        <option value="">Немає</option>
                        <option value="percent">%</option>
                        <option value="usd">USD</option>
                        <option value="uah">UAH</option>
                      </select>
                      {editType && (
                        <input
                          type="number"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="border rounded p-1 w-20 text-sm"
                          placeholder="Значення"
                        />
                      )}
                    </div>
                  ) : c.discount_type ? (
                    `${c.discount_value} ${c.discount_type === 'percent' ? '%' : c.discount_type.toUpperCase()}`
                  ) : (
                    '—'
                  )}
                </td>
                <td
                  className="px-6 py-4 text-right"
                  onClick={(e) => e.stopPropagation()}
                >
                  {editingId === c.id ? (
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleSave(c.id)}
                        className="text-green-600 hover:text-green-900"
                      >
                        <Save size={18} />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleEdit(c)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      <Edit2 size={18} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
