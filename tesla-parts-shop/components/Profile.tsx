import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AppContext';
import { api } from '../services/api';
import NovaPostWidget from './NovaPostWidget';

export const Profile: React.FC = () => {
  const {
    isCustomerLoggedIn,
    customerProfile,
    updateProfileState,
    logoutCustomer,
  } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get('tab') || 'info';

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [orders, setOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const formatPhoneNumber = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 10);
    const parts = [
      digits.slice(0, 3),
      digits.slice(3, 6),
      digits.slice(6, 8),
      digits.slice(8, 10),
    ].filter(Boolean);
    return parts.join(' ');
  };

  const validatePhone = (value: string) => {
    const pattern = /^0\d{2}\s\d{3}\s\d{2}\s\d{2}$/;
    const digits = value.replace(/\D/g, '');
    if (digits.length !== 10) {
      setPhoneError('Номер має містити 10 цифр у форматі 0XX XXX XX XX');
      return false;
    }
    if (!pattern.test(value)) {
      setPhoneError('Номер має бути у форматі 0XX XXX XX XX');
      return false;
    }
    setPhoneError(null);
    return true;
  };

  const handlePhoneChange = (value: string) => {
    const formatted = formatPhoneNumber(value);
    setPhone(formatted);
    if (!formatted) {
      setPhoneError(null);
      return;
    }

    const digits = formatted.replace(/\D/g, '');
    if (digits.length < 10) {
      setPhoneError(null);
      return;
    }

    validatePhone(formatted);
  };

  useEffect(() => {
    if (!isCustomerLoggedIn) {
      navigate('/login');
    }
  }, [isCustomerLoggedIn, navigate]);

  useEffect(() => {
    if (customerProfile) {
      setFirstName(customerProfile.first_name || '');
      setLastName(customerProfile.last_name || '');
      setPhone(customerProfile.phone || '');
      setAddress(customerProfile.default_address || '');
    }
  }, [customerProfile]);

  useEffect(() => {
    if (isCustomerLoggedIn && currentTab === 'orders') {
      const fetchOrders = async () => {
        setLoadingOrders(true);
        try {
          const data = await api.getMyOrders();
          setOrders(data);
        } catch (e) {
          console.error('Failed to fetch orders', e);
        } finally {
          setLoadingOrders(false);
        }
      };
      fetchOrders();
    }
  }, [isCustomerLoggedIn, currentTab]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePhone(phone)) {
      setMessage('Помилка: перевірте правильність номеру телефону');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const updated = await api.updateProfile({
        first_name: firstName,
        last_name: lastName,
        phone,
        default_address: address,
      });
      updateProfileState(updated);
      setMessage('Профіль успішно оновлено');
    } catch (err: any) {
      setMessage(err.message || 'Помилка оновлення');
    } finally {
      setLoading(false);
    }
  };

  if (!isCustomerLoggedIn || !customerProfile) return null;

  return (
    <div className="max-w-4xl mx-auto mt-8 flex flex-col md:flex-row gap-8">
      {/* Sidebar */}
      <div className="w-full md:w-1/4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="font-bold text-lg mb-4 break-all">{customerProfile.email}</div>
          <nav className="flex flex-col gap-2">
            <button
              onClick={() => setSearchParams({ tab: 'info' })}
              className={`text-left px-4 py-2 rounded-md ${currentTab === 'info' ? 'bg-gray-100 font-semibold' : 'hover:bg-gray-50'}`}
            >
              Особисті дані
            </button>
            <button
              onClick={() => setSearchParams({ tab: 'orders' })}
              className={`text-left px-4 py-2 rounded-md ${currentTab === 'orders' ? 'bg-gray-100 font-semibold' : 'hover:bg-gray-50'}`}
            >
              Історія замовлень
            </button>
            <button
              onClick={() => {
                logoutCustomer();
                navigate('/');
              }}
              className="text-left px-4 py-2 rounded-md text-red-500 hover:bg-red-50 mt-4"
            >
              Вийти
            </button>
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="w-full md:w-3/4 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        {currentTab === 'info' && (
          <div>
            <h2 className="text-2xl font-bold mb-6">Особисті дані</h2>
            {message && (
              <div
                className={`mb-4 text-sm p-3 rounded-md ${message.includes('Помилка') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}
              >
                {message}
              </div>
            )}
            <form onSubmit={handleUpdate} className="space-y-4 max-w-lg">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ім'я
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-4 py-2 border rounded-md focus:ring-1 focus:ring-tesla-red focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Прізвище
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-4 py-2 border rounded-md focus:ring-1 focus:ring-tesla-red focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Телефон
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  placeholder="0XX XXX XX XX"
                  className={`w-full px-4 py-2 border rounded-md focus:ring-1 focus:ring-tesla-red focus:outline-none ${phoneError ? 'border-red-500' : ''}`}
                  required
                />
                {phoneError && (
                  <div className="text-red-500 text-xs mt-1">{phoneError}</div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Адреса доставки
                </label>
                {address && (
                  <div className="mb-2 p-3 bg-gray-50 border rounded-md text-sm text-gray-700 font-medium">
                    {address}
                  </div>
                )}
                <NovaPostWidget
                  onSelect={(data) => {
                    const cityPart = data.city.toLowerCase().startsWith('м.') || data.city.toLowerCase().startsWith('село') || data.city.toLowerCase().startsWith('с.')
                      ? data.city
                      : `м. ${data.city}`;
                    const formatted = data.description
                      ? `${cityPart}, ${data.description} (${data.address})`
                      : `${cityPart}, ${data.address}`;
                    setAddress(formatted);
                  }}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="bg-tesla-red text-white px-6 py-2 rounded-md hover:bg-red-700 transition disabled:opacity-50"
              >
                {loading ? 'Збереження...' : 'Зберегти зміни'}
              </button>
            </form>
          </div>
        )}

        {currentTab === 'orders' && (
          <div>
            <h2 className="text-2xl font-bold mb-6">Історія замовлень</h2>
            {loadingOrders ? (
              <div className="flex justify-center py-8">
                <div className="w-8 h-8 border-4 border-tesla-red border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : orders.length > 0 ? (
              <div className="space-y-4">
                {orders.map((order: any) => (
                  <div
                    key={order.id}
                    onClick={() => setSelectedOrder(order)}
                    className="border p-4 rounded-md cursor-pointer hover:bg-gray-50 hover:shadow-md transition"
                  >
                    <div className="flex justify-between font-bold mb-2">
                      <span>Замовлення #{order.id}</span>
                      <span>${order.totalUSD}</span>
                    </div>
                    <div className="text-sm text-gray-600">
                      <p>
                        <strong>Доставка:</strong> {order.delivery_city},{' '}
                        {order.delivery_branch}
                      </p>
                      <p>
                        <strong>Дата:</strong>{' '}
                        {new Date(order.created_at).toLocaleDateString()}
                      </p>
                      <p className="text-tesla-red mt-2 font-medium">
                        Переглянути деталі &rarr;
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">У вас ще немає замовлень.</p>
            )}
          </div>
        )}
      </div>

      {/* Order Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-2xl w-full max-h-[90vh] flex flex-col">
            <div className="p-6 border-b flex justify-between items-center">
              <h3 className="text-xl font-bold">
                Деталі замовлення #{selectedOrder.id}
              </h3>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-gray-500 hover:text-black w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition"
              >
                ✕
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              <div className="mb-6 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Дата</p>
                  <p className="font-semibold">
                    {new Date(selectedOrder.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Доставка</p>
                  <p className="font-semibold">
                    {selectedOrder.delivery_city},{' '}
                    {selectedOrder.delivery_branch}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Сума</p>
                  <p className="font-semibold">${selectedOrder.totalUSD}</p>
                </div>
              </div>
              <h4 className="font-bold mb-4">
                Товари ({selectedOrder.items?.length})
              </h4>
              <div className="space-y-4">
                {selectedOrder.items?.map((item: any) => (
                  <div
                    key={item.id}
                    className="flex gap-4 border-b pb-4 last:border-b-0"
                  >
                    <div className="w-20 h-20 bg-gray-100 rounded-md overflow-hidden flex-shrink-0">
                      {item.product_image ? (
                        <img
                          src={item.product_image}
                          alt={item.product_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-400 text-xs">
                          Немає фото
                        </div>
                      )}
                    </div>
                    <div className="flex-1 flex flex-col justify-between">
                      <div>
                        <h5 className="font-medium text-sm line-clamp-2">
                          <Link
                            to={`/product/${item.product_id}`}
                            className="hover:text-tesla-red transition"
                          >
                            {item.product_name}
                          </Link>
                        </h5>
                        {item.product_detail_number && (
                          <p className="text-xs text-gray-500 mt-1">
                            Деталь: {item.product_detail_number}
                          </p>
                        )}
                      </div>
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-sm text-gray-600">
                          К-ть: {item.quantity}
                        </span>
                        <span className="font-bold">
                          ${item.price_at_purchase}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
