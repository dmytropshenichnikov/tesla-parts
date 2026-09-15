import React, { useState, useEffect } from 'react';
import { PaymentMethod, CartItem, Currency, OrderData } from '../types';
import { api } from '../services/api';
import { Truck, Building, Wallet } from 'lucide-react';
import NovaPostWidget from '../components/NovaPostWidget'; // Ensure this path is correct
import { DEFAULT_EXCHANGE_RATE_UAH_PER_USD } from '../constants';
import { formatCurrency } from '../utils/currency';
import { trackPurchase } from '../utils/analytics';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AppContext';

interface CheckoutProps {
  cartItems: CartItem[];
  currency: Currency;
  uahPerUsd: number;
  onSuccess: () => void;
  totalUSD: number;
}

const Checkout: React.FC<CheckoutProps> = ({
  cartItems,
  currency,
  uahPerUsd,
  onSuccess,
  totalUSD,
}) => {
  const { isCustomerLoggedIn, customerProfile } = useAuth();

  // --- Form State ---
  const [firstName, setFirstName] = useState(customerProfile?.first_name || '');
  const [lastName, setLastName] = useState(customerProfile?.last_name || '');
  const [phone, setPhone] = useState(customerProfile?.phone || '');
  const [note, setNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    PaymentMethod.IBAN
  );
  const [phoneError, setPhoneError] = useState<string | null>(null);

  // --- Promocode State ---
  const [promoCode, setPromoCode] = useState('');
  const [discountType, setDiscountType] = useState<string | null>(
    customerProfile?.discount_type || null
  );
  const [discountValue, setDiscountValue] = useState<number | null>(
    customerProfile?.discount_value || null
  );
  const [promoMessage, setPromoMessage] = useState<{
    text: string;
    type: 'success' | 'error';
  } | null>(null);
  const [loadingPromo, setLoadingPromo] = useState(false);
  const [appliedPromoCode, setAppliedPromoCode] = useState<string | null>(null);

  useEffect(() => {
    if (customerProfile) {
      if (!firstName) setFirstName(customerProfile.first_name || '');
      if (!lastName) setLastName(customerProfile.last_name || '');
      if (!phone) setPhone(customerProfile.phone || '');
      if (!discountType && customerProfile.discount_type)
        setDiscountType(customerProfile.discount_type);
      if (!discountValue && customerProfile.discount_value)
        setDiscountValue(customerProfile.discount_value);

      if (customerProfile.default_address) {
        setDeliveryData(
          (prev) =>
            prev || {
              city: '',
              branch: customerProfile.default_address,
              address: '',
              ref: '',
            }
        );
      }
    }
  }, [customerProfile]);

  // --- Delivery State (Simplified) ---
  // We no longer need arrays for cities/warehouses. We just store the final result.
  const [deliveryData, setDeliveryData] = useState<{
    city: string;
    branch: string;
    ref: string;
    address: string;
  } | null>(null);

  const [processing, setProcessing] = useState(false);

  // Scrolls the view to the upper side of the screen
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // --- Handlers ---

  const handleNovaPostSelect = (data: {
    ref: string;
    description: string;
    city: string;
    address: string;
  }) => {
    setDeliveryData({
      city: data.city,
      branch: data.description, // e.g., "Department No 1"
      address: data.address, // e.g., "Kyiv, Khreshchatyk str..."
      ref: data.ref, // UUID for backend
    });
  };

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validatePhone(phone)) {
      alert('Будь ласка, введіть коректний номер телефону');
      return;
    }

    if (!deliveryData) {
      alert('Будь ласка, оберіть відділення доставки на мапі');
      return;
    }

    setProcessing(true);

    const order: OrderData = {
      items: cartItems,
      totalUSD: Number(finalUsdAmount.toFixed(2)),
      customer: { firstName, lastName, phone },
      delivery: {
        city: deliveryData.city,
        branch: `${deliveryData.branch} (${deliveryData.address})`, // Save full info
      },
      paymentMethod,
      createdAt: new Date().toISOString(),
      note: note.trim() || undefined,
      promocode: appliedPromoCode || undefined,
      // Optional: You can add deliveryRef to your OrderData type if you want to store the UUID
      // deliveryRef: deliveryData.ref
    };

    try {
      const created = await api.createOrder(order);
      trackPurchase(created, order, effectiveRate);
      onSuccess();
    } catch (err) {
      console.error('Order failed', err);
      alert('Виникла помилка при оформленні. Спробуйте ще раз.');
    } finally {
      setProcessing(false);
    }
  };

  const effectiveRate =
    uahPerUsd > 0 ? uahPerUsd : DEFAULT_EXCHANGE_RATE_UAH_PER_USD;
  const formatAmount = (amount: number) => {
    return formatCurrency(amount, currency);
  };

  const applyPromo = async () => {
    if (!promoCode.trim()) return;
    setLoadingPromo(true);
    setPromoMessage(null);
    try {
      const res = await api.validatePromoCode(promoCode.trim());
      setDiscountType(res.discount_type);
      setDiscountValue(res.discount_value);
      setAppliedPromoCode(promoCode.trim());
      setPromoMessage({
        text: res.message || 'Промокод застосовано!',
        type: 'success',
      });
    } catch (err: any) {
      setPromoMessage({
        text: err.message || 'Недійсний промокод',
        type: 'error',
      });
      setAppliedPromoCode(null);
    } finally {
      setLoadingPromo(false);
    }
  };

  const cancelPromo = () => {
    setPromoCode('');
    setAppliedPromoCode(null);
    setPromoMessage(null);
    setDiscountType(customerProfile?.discount_type || null);
    setDiscountValue(customerProfile?.discount_value || null);
  };

  const getItemBaseAmount = (item: CartItem) => {
    const priceUSD =
      item.priceUSD && item.priceUSD > 0
        ? item.priceUSD
        : item.priceUAH && item.priceUAH > 0 && effectiveRate > 0
          ? item.priceUAH / effectiveRate
          : 0;
    return currency === Currency.USD ? priceUSD : priceUSD * effectiveRate;
  };

  const getItemDiscountedAmount = (item: CartItem) => {
    const base = getItemBaseAmount(item);
    if (!discountType || !discountValue) return base;
    if (discountType === 'percent') {
      return Math.round(base * (1 - discountValue / 100));
    }
    const ratio = baseDisplayAmount > 0 ? (finalDisplayAmount / baseDisplayAmount) : 1;
    return Math.round(base * ratio);
  };

  const formatItemPrice = (item: CartItem) => {
    return formatAmount(getItemBaseAmount(item));
  };
  const totalUAH = totalUSD * effectiveRate;
  const baseDisplayAmount = currency === Currency.UAH ? totalUAH : totalUSD;
  const baseUsdAmount = totalUSD;

  let finalDisplayAmount = baseDisplayAmount;
  let finalUsdAmount = baseUsdAmount;
  let discountDisplayValue = 0;

  if (discountType && discountValue) {
    if (discountType === 'percent') {
      finalDisplayAmount = baseDisplayAmount * (1 - discountValue / 100);
      discountDisplayValue = baseDisplayAmount * (discountValue / 100);
      finalUsdAmount = baseUsdAmount * (1 - discountValue / 100);
    } else if (discountType === 'usd') {
      const discountInCurrent =
        currency === Currency.UAH
          ? discountValue * effectiveRate
          : discountValue;
      finalDisplayAmount = Math.max(0, baseDisplayAmount - discountInCurrent);
      discountDisplayValue = discountInCurrent;
      finalUsdAmount = Math.max(0, baseUsdAmount - discountValue);
    } else if (discountType === 'uah') {
      const discountInCurrent =
        currency === Currency.USD
          ? discountValue / effectiveRate
          : discountValue;
      finalDisplayAmount = Math.max(0, baseDisplayAmount - discountInCurrent);
      discountDisplayValue = discountInCurrent;
      finalUsdAmount = Math.max(
        0,
        baseUsdAmount - discountValue / effectiveRate
      );
    }
  }

  if (cartItems.length === 0) {
    return <div className="p-8 text-center text-gray-500">Кошик порожній</div>;
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8 text-tesla-dark">
        Оформлення замовлення
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Column: Form */}
        <div className="md:col-span-2 space-y-8">
          <form
            id="checkout-form"
            onSubmit={handleSubmit}
            className="space-y-8"
          >
            {/* 1. Contact Info */}
            <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-600">
                  1
                </div>
                Контактні дані
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ім'я
                  </label>
                  <input
                    required
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full border rounded-md p-2 focus:ring-2 focus:ring-tesla-red outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Прізвище
                  </label>
                  <input
                    required
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full border rounded-md p-2 focus:ring-2 focus:ring-tesla-red outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Телефон
                  </label>
                  <input
                    required
                    type="tel"
                    placeholder="0XX XX XX XX"
                    value={phone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    className={`w-full border rounded-md p-2 focus:ring-2 focus:ring-tesla-red outline-none ${phoneError ? 'border-red-500' : ''}`}
                  />
                  {phoneError && (
                    <p className="text-sm text-red-600 mt-1">{phoneError}</p>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Коментар до замовлення
                  </label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    placeholder="Наприклад: прохання зателефонувати після 18:00, додаткові деталі доставки..."
                    className="w-full border rounded-md p-2 focus:ring-2 focus:ring-tesla-red outline-none resize-none"
                  ></textarea>
                </div>
              </div>
            </section>

            {/* 2. Delivery (Using NovaPostWidget) */}
            <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-600">
                  2
                </div>
                Доставка{' '}
                <span className="text-red-500 font-bold ml-2 text-sm flex items-center gap-1">
                  <Truck size={14} /> Nova Post
                </span>
              </h2>

              <div className="space-y-4">
                {/* The Map Widget */}
                <NovaPostWidget onSelect={handleNovaPostSelect} />

                {/* Validation / Selection Message */}
                {deliveryData ? (
                  <div className="p-3 bg-green-50 border border-green-200 rounded text-sm text-green-800 flex flex-col">
                    <span className="font-bold">✓ Вибрано:</span>
                    <span>{deliveryData.city}</span>
                    <span>{deliveryData.branch}</span>
                    <span className="text-xs text-gray-500 mt-1">
                      {deliveryData.address}
                    </span>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 italic pl-1">
                    * Оберіть відділення або поштомат на карті вище
                  </div>
                )}
              </div>
            </section>

            {/* 3. Payment */}
            <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-600">
                  3
                </div>
                Оплата
              </h2>
              <div className="space-y-3">
                <label
                  className={`flex items-center p-4 border rounded-lg cursor-pointer transition ${paymentMethod === PaymentMethod.IBAN ? 'border-tesla-red bg-red-50' : 'hover:bg-gray-50'}`}
                >
                  <input
                    type="radio"
                    name="payment"
                    value={PaymentMethod.IBAN}
                    checked={paymentMethod === PaymentMethod.IBAN}
                    onChange={() => setPaymentMethod(PaymentMethod.IBAN)}
                    className="text-tesla-red focus:ring-tesla-red"
                  />
                  <div className="ml-3 flex items-center gap-3">
                    <Building className="text-gray-600" />
                    <div>
                      <div className="font-medium text-gray-900">
                        Оплата на рахунок ФОП
                      </div>
                    </div>
                  </div>
                </label>

                <label
                  className={`flex items-center p-4 border rounded-lg cursor-pointer transition ${paymentMethod === PaymentMethod.COD ? 'border-tesla-red bg-red-50' : 'hover:bg-gray-50'}`}
                >
                  <input
                    type="radio"
                    name="payment"
                    value={PaymentMethod.COD}
                    checked={paymentMethod === PaymentMethod.COD}
                    onChange={() => setPaymentMethod(PaymentMethod.COD)}
                    className="text-tesla-red focus:ring-tesla-red"
                  />
                  <div className="ml-3 flex items-center gap-3">
                    <Wallet className="text-gray-600" />
                    <div>
                      <div className="font-medium text-gray-900">
                        Накладений платіж
                      </div>
                    </div>
                  </div>
                </label>
              </div>
            </section>
          </form>
        </div>

        {/* Right Column: Order Summary */}
        <div className="md:col-span-1">
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 sticky top-24">
            <h3 className="text-lg font-bold mb-4 text-gray-900">
              Ваше замовлення
            </h3>
            <div className="space-y-4 max-h-60 overflow-y-auto mb-4 pr-2 custom-scrollbar">
              {cartItems.map((item) => (
                <div key={item.id} className="flex gap-3 text-sm">
                  <div className="w-12 h-12 bg-gray-100 rounded flex-shrink-0">
                    <img
                      src={item.image}
                      className="w-full h-full object-cover rounded"
                      alt={item.name}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium line-clamp-2 text-gray-900">{item.name}</div>
                    {discountType && discountValue ? (
                      <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                        <span className="text-gray-500 text-xs">{item.quantity} ×</span>
                        <span className="font-bold text-gray-900 text-xs sm:text-sm">
                          {formatAmount(getItemDiscountedAmount(item))}
                        </span>
                        <span className="text-xs text-gray-400 line-through">
                          {formatAmount(getItemBaseAmount(item))}
                        </span>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-1 py-0.5 rounded">
                          {discountType === 'percent'
                            ? `-${discountValue}%`
                            : `-${formatAmount(getItemBaseAmount(item) - getItemDiscountedAmount(item))}`}
                        </span>
                      </div>
                    ) : (
                      <div className="text-gray-500 text-xs sm:text-sm mt-0.5">
                        {item.quantity} × {formatItemPrice(item)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t pt-4 space-y-2 mb-6">
              <div className="flex justify-between text-gray-600">
                <span>Сума товарів</span>
                <span>{formatAmount(baseDisplayAmount)}</span>
              </div>
              {discountType && discountValue && (
                <div className="flex justify-between text-green-600 font-medium">
                  <span>Знижка</span>
                  <span>-{formatAmount(discountDisplayValue)}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-600">
                <div className="flex flex-col">
                  <span>Доставка</span>
                  <span className="text-xs">(за тарифами перевізника)</span>
                </div>
              </div>
              <div className="flex justify-between text-xl font-bold text-gray-900 pt-2 border-t mt-2">
                <span>Разом</span>
                <span>{formatAmount(finalDisplayAmount)}</span>
              </div>
            </div>

            {/* Promocode UI */}
            <div className="mb-6 border-t pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Промокод
              </label>
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  placeholder="Введіть код..."
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-tesla-red"
                  disabled={loadingPromo}
                />
                <button
                  type="button"
                  onClick={applyPromo}
                  disabled={loadingPromo || !promoCode}
                  className="w-full px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 transition disabled:opacity-50 text-sm"
                >
                  {loadingPromo ? '...' : 'Застосувати'}
                </button>
              </div>
              {promoMessage && (
                <div
                  className={`mt-2 text-sm flex justify-between items-center ${promoMessage.type === 'success' ? 'text-green-600' : 'text-red-500'}`}
                >
                  <span>{promoMessage.text}</span>
                  {promoMessage.type === 'success' && (
                    <button
                      type="button"
                      onClick={cancelPromo}
                      className="text-xs underline text-gray-500 hover:text-gray-700"
                    >
                      Скасувати
                    </button>
                  )}
                </div>
              )}
              {!promoMessage && discountType && !promoCode && (
                <div className="mt-2 text-sm text-green-600">
                  Активна персональна знижка
                </div>
              )}
            </div>

            <button
              form="checkout-form"
              disabled={processing}
              type="submit"
              className="w-full bg-tesla-red text-white py-3 rounded-md font-bold hover:bg-red-700 transition disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center"
            >
              {processing ? (
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                'Підтвердити замовлення'
              )}
            </button>
            <p className="text-xs text-gray-400 mt-4 text-center">
              Натискаючи кнопку, ви погоджуєтесь з умовами{' '}
              <Link
                to={'/info/terms-of-service'}
                className="text-tesla-red hover:underline"
              >
                публічної оферти
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
