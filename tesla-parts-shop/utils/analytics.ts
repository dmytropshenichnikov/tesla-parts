import { CartItem, OrderData, Product } from '../types';

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

const SENT_ORDERS_KEY = 'tp-sent-orders';
const INTERNAL_TRAFFIC_KEY = 'tp-kit-internal';
const CURRENCY = 'UAH';
const VIEW_REPEAT_MS = 1000;

// Price of a single item in UAH, using the same rate the buyer saw on the page.
// Takes Product, so CartItem (which extends it) fits here as well.
const itemPriceUAH = (item: Product, rate: number): number => {
  const priceUSD =
    item.priceUSD && item.priceUSD > 0
      ? item.priceUSD
      : item.priceUAH && item.priceUAH > 0 && rate > 0
        ? item.priceUAH / rate
        : 0;
  return Math.round(priceUSD * rate * 100) / 100;
};

const itemsValueUAH = (items: Product[], rate: number): number => {
  const value = items.reduce((sum, item) => {
    const quantity =
      'quantity' in item ? Number((item as CartItem).quantity) || 1 : 1;
    return sum + itemPriceUAH(item, rate) * quantity;
  }, 0);
  return Math.round(value * 100) / 100;
};

// One item in GA4 format. item_id must stay equal to g:id in the Merchant
// Center feed, otherwise Google Ads cannot match the product in dynamic ads.
const gaItem = (product: Product, rate: number, quantity: number) => ({
  item_id: product.id,
  item_name: product.name,
  item_category: product.category?.split(',')[0].trim(),
  price: itemPriceUAH(product, rate),
  quantity,
});

// Checkout and purchase events include position index, as GA4 recommends.
const gaItems = (items: CartItem[], rate: number) =>
  items.map((item, index) => ({ ...gaItem(item, rate, item.quantity), index }));

/**
 * Manager browser flag. Открытие сайта с ?kit_internal=1 один раз помечает
 * браузер магазина как внутренний; ?kit_internal=0 снимает пометку.
 */
export const initInternalTrafficFlag = (): void => {
  try {
    const url = new URL(window.location.href);
    const flag = url.searchParams.get('kit_internal');
    if (flag !== '1' && flag !== '0') return;
    if (flag === '1') {
      localStorage.setItem(INTERNAL_TRAFFIC_KEY, '1');
    } else {
      localStorage.removeItem(INTERNAL_TRAFFIC_KEY);
    }
    url.searchParams.delete('kit_internal');
    window.history.replaceState({}, '', url.toString());
  } catch {
    // Analytics must not affect the page.
  }
};

export const isInternalTraffic = (): boolean => {
  try {
    return localStorage.getItem(INTERNAL_TRAFFIC_KEY) === '1';
  } catch {
    return false;
  }
};

const eventContext = (extra?: Record<string, unknown>): Record<string, unknown> => ({
  ...(isInternalTraffic() ? { traffic_type: 'internal' } : {}),
  ...(extra || {}),
});

const pushEvent = (
  event: string,
  ecommerce: Record<string, unknown>,
  extra?: Record<string, unknown>
): void => {
  window.dataLayer = window.dataLayer || [];
  // Clear the previous ecommerce object, as recommended by Google.
  window.dataLayer.push({ ecommerce: null });
  window.dataLayer.push({ event, ...eventContext(extra), ecommerce });
};

// Guards against a duplicate purchase/manager_order event if the order is
// submitted twice or the success page is reopened in another tab.
const wasOrderEventSent = (transactionId: string): boolean => {
  try {
    const stored = localStorage.getItem(SENT_ORDERS_KEY);
    const sent: string[] = stored ? JSON.parse(stored) : [];
    return sent.includes(transactionId);
  } catch {
    return false;
  }
};

const markOrderEventSent = (transactionId: string): void => {
  try {
    const stored = localStorage.getItem(SENT_ORDERS_KEY);
    const sent: string[] = stored ? JSON.parse(stored) : [];
    localStorage.setItem(
      SENT_ORDERS_KEY,
      JSON.stringify([...sent.slice(-49), transactionId])
    );
  } catch {
    // If storage is unavailable, the order still goes through.
  }
};

/**
 * An order marked "SB" in the manager comment is not a website purchase:
 * Google Ads must not attribute it to ads or search.
 */
export const isSbOrder = (note?: string | null): boolean =>
  /^SB\b/i.test((note || '').trim());

// Swallows a view_item repeated within a second: that is an instant re-mount
// of the product page, not a second visit. A later revisit is a real view
// and is reported again, as GA4 expects.
let lastView = { id: '', at: 0 };
const isInstantRepeat = (id: string): boolean => {
  const now = Date.now();
  if (lastView.id === id && now - lastView.at < VIEW_REPEAT_MS) return true;
  lastView = { id, at: now };
  return false;
};

/**
 * Product page view. Feeds the "viewed but did not buy" remarketing audience.
 *
 * There is no error boundary in this app, so a throw inside an effect would
 * blank the whole page — hence the try/catch around everything.
 */
export const trackViewItem = (product: Product, rate: number): void => {
  try {
    if (!product?.id || isInstantRepeat(product.id)) return;
    pushEvent('view_item', {
      currency: CURRENCY,
      value: itemPriceUAH(product, rate),
      items: [gaItem(product, rate, 1)],
    });
  } catch {
    // Analytics must not affect the page.
  }
};

/**
 * Add to cart. Feeds the "added but did not order" remarketing audience.
 *
 * Must be called from the click handler and never from inside a setState
 * updater: React is allowed to run an updater callback more than once.
 * The site always adds one unit per click, hence quantity 1.
 */
export const trackAddToCart = (product: Product, rate: number): void => {
  try {
    if (!product?.id) return;
    pushEvent('add_to_cart', {
      currency: CURRENCY,
      value: itemPriceUAH(product, rate),
      items: [gaItem(product, rate, 1)],
    });
  } catch {
    // Analytics must not affect the cart.
  }
};

/**
 * Checkout started: /checkout opened and the cart is not empty.
 * Call once per checkout visit (the caller guards repeats).
 */
export const trackBeginCheckout = (
  items: CartItem[],
  rate: number,
  value?: number
): void => {
  try {
    if (!items?.length) return;
    pushEvent('begin_checkout', {
      currency: CURRENCY,
      value: value ?? itemsValueUAH(items, rate),
      items: gaItems(items, rate),
    });
  } catch {
    // Analytics must not affect checkout.
  }
};

/**
 * Delivery chosen. shipping_tier lets GA4 split Nova Poshta branches,
 * parcel lockers and courier delivery in the checkout funnel.
 */
export const trackAddShippingInfo = (
  items: CartItem[],
  rate: number,
  shippingTier: string,
  value?: number
): void => {
  try {
    if (!items?.length || !shippingTier) return;
    pushEvent('add_shipping_info', {
      currency: CURRENCY,
      value: value ?? itemsValueUAH(items, rate),
      shipping_tier: shippingTier,
      items: gaItems(items, rate),
    });
  } catch {
    // Analytics must not affect checkout.
  }
};

/**
 * Payment method chosen. payment_type separates cash on delivery from IBAN.
 */
export const trackAddPaymentInfo = (
  items: CartItem[],
  rate: number,
  paymentType: string,
  value?: number
): void => {
  try {
    if (!items?.length || !paymentType) return;
    pushEvent('add_payment_info', {
      currency: CURRENCY,
      value: value ?? itemsValueUAH(items, rate),
      payment_type: paymentType,
      items: gaItems(items, rate),
    });
  } catch {
    // Analytics must not affect checkout.
  }
};

/**
 * Pushes a GA4 purchase event to the dataLayer for GTM.
 *
 * Orders with an "SB" note are manager orders: they are sent as
 * `manager_order` so they stay visible in Analytics but Google Ads does not
 * count them as purchases brought by ads or search.
 *
 * Customer name, phone, note and delivery address are intentionally omitted:
 * sending personal data to Google Analytics is against its terms of service.
 *
 * Any failure here is swallowed — analytics must never break checkout.
 */
export const trackPurchase = (
  created: { id?: number | string } | null | undefined,
  order: OrderData,
  rate: number
): void => {
  try {
    const transactionId = created?.id != null ? String(created.id) : '';
    if (!transactionId || wasOrderEventSent(transactionId)) return;

    const value = Math.round(order.totalUSD * rate * 100) / 100;
    const items = order.items.map((item, index) => ({
      item_id: item.id,
      item_name: item.name,
      item_category: item.category?.split(',')[0].trim(),
      price: itemPriceUAH(item, rate),
      quantity: item.quantity,
      index,
    }));

    if (isSbOrder(order.note)) {
      pushEvent(
        'manager_order',
        {
          transaction_id: transactionId,
          currency: CURRENCY,
          value,
          items,
        },
        { order_source: 'SB' }
      );
    } else {
      pushEvent('purchase', {
        transaction_id: transactionId,
        value,
        currency: CURRENCY,
        coupon: order.promocode,
        payment_type: order.paymentMethod,
        items,
      });
    }

    markOrderEventSent(transactionId);
  } catch {
    // Analytics must not affect the order flow.
  }
};
