import { Product, OrderData, Category, StaticSeoRecord, Page, SchematicSummary, Schematic, SchematicModelOption, SchematicSectionGroup, SchematicUsage, SubcategorySchemeSummary, VinDecodeResult, PlateLookupResult } from '../types';

/**
 * Абсолютна адреса бекенду (api.teslapartscenter.com.ua).
 * Використовується лише як фолбек і для локальної розробки.
 */
const DIRECT_API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

const IS_LOCAL_DEV =
  typeof window !== 'undefined' &&
  ['localhost', '127.0.0.1', '0.0.0.0'].includes(window.location.hostname);

/**
 * У продакшні звертаємось до API через ВЛАСНИЙ домен (`/api/...`), а не напряму
 * до `api.*`. Крос-доменні fetch-запити блокуються на частині мобільних
 * пристроїв і мереж (iOS Safari у такому разі віддає `TypeError: Load failed`),
 * хоча звичайні картинки з того ж домену завантажуються. nginx-шлюз проксіює
 * `/api/` у бекенд, тож запит стає first-party: без CORS і без зайвого DNS.
 */
const API_URL = IS_LOCAL_DEV ? DIRECT_API_URL : '/api';

/** Повний URL ендпоінта (для сторонніх клієнтів, напр. <img> або посилань). */
export const apiUrl = (path: string) => `${API_URL}${path}`;

/**
 * fetch до API з автоматичним фолбеком: якщо власний домен не відповів на
 * мережевому рівні — повторюємо той самий шлях напряму через api-піддомен.
 * Саме такі обриви Safari показує як «Load failed».
 */
const apiFetch = async (path: string, init?: RequestInit): Promise<Response> => {
  const primary = `${API_URL}${path}`;
  const fallback = `${DIRECT_API_URL}${path}`;

  try {
    return await fetch(primary, init);
  } catch (err) {
    if (primary === fallback) throw err;
    return await fetch(fallback, init);
  }
};

const fetchWithAuth = async (path: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('customerToken');
  const headers = {
    ...options.headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const response = await apiFetch(path, { ...options, headers });

  if (response.status === 401) {
    window.dispatchEvent(new Event('customer-logged-out'));
  }

  return response;
};

export interface ProductFilter {
  category?: string;
  subId?: number;
  limit?: number;
  offset?: number;
  search?: string;
  is_popular?: boolean;
}

export const api = {
  getProducts: async (filters: ProductFilter = {}): Promise<Product[]> => {
    const params = new URLSearchParams();
    if (filters.category) params.append('category_slug', filters.category);
    if (filters.subId)
      params.append('subcategory_id', filters.subId.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());
    if (filters.offset) params.append('offset', filters.offset.toString());
    if (filters.search) params.append('search', filters.search);
    if (filters.is_popular !== undefined)
      params.append('is_popular', filters.is_popular.toString());

    const res = await apiFetch(`/products/?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch products');
    return res.json();
  },

  getProduct: async (id: string): Promise<Product> => {
    // Since we don't have a dedicated single product endpoint yet (except admin one),
    // we can filter from all products or add a new endpoint.
    // Actually, we should add a new endpoint in backend or use the existing list and filter client side if list is small.
    // But for correctness, let's assume we might want a dedicated endpoint.
    // Wait, backend router has `read_products` (list) and `delete_product`. It DOES NOT have `read_product` (single).
    // I should add `read_product` to backend first?
    // Or just use the list for now since we load all products in App.tsx anyway.
    // Let's use the list for now to avoid backend restart if possible, BUT user asked for "open product page", usually implies fetching details.
    // However, `App.tsx` already loads ALL products. So I can just find it in the state.
    // But if I refresh on product page, I need to fetch it.
    // Let's add a simple `read_product` endpoint to backend `routers/products.py` first.
    // Actually, I'll add it to backend now.
    const res = await apiFetch(`/products/${id}`);
    if (!res.ok) throw new Error('Failed to fetch product');
    return res.json();
  },

  getLabels: async (): Promise<string[]> => {
    const res = await apiFetch(`/products/labels`);
    if (!res.ok) throw new Error('Failed to fetch labels');
    return res.json();
  },

  getCategories: async (): Promise<Category[]> => {
    const res = await apiFetch(`/categories/`);
    if (!res.ok) throw new Error('Failed to fetch categories');
    return res.json();
  },

  getCategory: async (id: number): Promise<Category> => {
    const res = await apiFetch(`/categories/${id}`);
    if (!res.ok) throw new Error('Failed to fetch category details');
    return res.json();
  },

  createOrder: async (orderData: OrderData) => {
    // Transform frontend OrderData to backend schema if needed
    // Backend expects: items, totalUSD, customer, delivery, paymentMethod
    // Frontend OrderData matches this structure mostly.

    const payload = {
      items: orderData.items,
      totalUSD: orderData.totalUSD,
      customer: orderData.customer,
      delivery: orderData.delivery,
      paymentMethod: orderData.paymentMethod,
      note: orderData.note,
      promocode: orderData.promocode,
    };

    const res = await fetchWithAuth(`/orders/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error('Failed to create order');
    return res.json();
  },

  getPage: async (
    slug: string
  ): Promise<{
    id: number;
    slug: string;
    title: string;
    content: string;
    is_published: boolean;
    location: string;
  } | null> => {
    try {
      const res = await apiFetch(`/pages/${slug}`);
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  },

  getPagesBySlugs: async (slugs: string[]): Promise<Page[]> => {
    const res = await apiFetch(`/pages/by-slugs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slugs }),
    });
    if (!res.ok) throw new Error('Failed to fetch pages');
    return res.json();
  },

  getSetting: async (key: string): Promise<string | null> => {
    try {
      const res = await apiFetch(`/settings/${key}`);
      if (!res.ok) return null;
      const data = await res.json();
      return data.value;
    } catch {
      return null;
    }
  },

  getSocialLinks: async (): Promise<{
    instagram: string;
    telegram: string;
  }> => {
    const res = await apiFetch(`/settings/social-links`);
    if (!res.ok) throw new Error('Failed to fetch social links');
    return res.json();
  },

  getStaticSeo: async (): Promise<StaticSeoRecord[]> => {
    const res = await apiFetch(`/seo/static`);
    if (!res.ok) throw new Error('Failed to fetch static SEO data');
    return res.json();
  },

  getReviews: async (): Promise<any[]> => {
    const res = await apiFetch(`/reviews/`);
    if (!res.ok) throw new Error('Failed to fetch reviews');
    return res.json();
  },

  // --- Customer Authentication ---
  registerCustomer: async (email: string) => {
    const res = await apiFetch(`/customers/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Registration failed');
    }
    return res.json();
  },

  verifyCustomer: async (data: any) => {
    const res = await apiFetch(`/customers/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Verification failed');
    }
    return res.json();
  },

  loginCustomer: async (data: any) => {
    const res = await apiFetch(`/customers/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Login failed');
    }
    return res.json();
  },

  logoutCustomer: async () => {
    const res = await fetchWithAuth(`/customers/logout`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Logout failed');
    return res.json();
  },

  forgotPassword: async (email: string) => {
    const res = await apiFetch(`/customers/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) throw new Error('Failed to send reset link');
    return res.json();
  },

  resetPassword: async (data: any) => {
    const res = await apiFetch(`/customers/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to reset password');
    }
    return res.json();
  },

  getMe: async () => {
    const res = await fetchWithAuth(`/customers/me`);
    if (!res.ok) throw new Error('Failed to fetch profile');
    return res.json();
  },

  getMyOrders: async () => {
    const res = await fetchWithAuth(`/customers/me/orders`);
    if (!res.ok) throw new Error('Failed to fetch orders');
    return res.json();
  },

  updateProfile: async (data: any) => {
    const res = await fetchWithAuth(`/customers/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update profile');
    return res.json();
  },

  validatePromoCode: async (code: string) => {
    const res = await fetchWithAuth(`/promocodes/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Invalid promocode');
    }
    return res.json();
  },

  logSearchQuery: async (query: string, resultsCount: number = 0) => {
    try {
      const q = query.trim();
      if (q.length < 2) return;
      await apiFetch(`/analytics/search-log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, results_count: resultsCount }),
      });
    } catch (e) {
      // Silently catch logging errors so user experience is uninterrupted
      console.warn('Failed to log search query', e);
    }
  },

  // --- Schematics API ---
  getSchematics: async (params?: {
    model?: string;
    generation?: string;
    section?: string;
    subsystem?: string;
    q?: string;
  }): Promise<SchematicSummary[]> => {
    const searchParams = new URLSearchParams();
    if (params?.model) searchParams.append('model', params.model);
    if (params?.generation) searchParams.append('generation', params.generation);
    if (params?.section) searchParams.append('section', params.section);
    if (params?.subsystem) searchParams.append('subsystem', params.subsystem);
    if (params?.q) searchParams.append('q', params.q);
    const queryString = searchParams.toString();
    const res = await apiFetch(`/schematics${queryString ? `?${queryString}` : ''}`);
    if (!res.ok) throw new Error('Failed to fetch schematics');
    return res.json();
  },

  /** Моделі/покоління для фільтрів схем — з категорій каталогу. */
  getSchematicModelOptions: async (): Promise<SchematicModelOption[]> => {
    try {
      const res = await apiFetch(`/schematics/model-options`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.options || [];
    } catch (e) {
      console.warn('Failed to load schematic model options', e);
      return [];
    }
  },

  /**
   * Дерево «розділ → підсистеми» для схем обраної моделі.
   * Дає той самий шлях до схеми, що й у каталозі: авто → розділ → підсистема.
   */
  getSchematicSections: async (
    params?: { model?: string; generation?: string }
  ): Promise<SchematicSectionGroup[]> => {
    const searchParams = new URLSearchParams();
    if (params?.model) searchParams.append('model', params.model);
    if (params?.generation) searchParams.append('generation', params.generation);
    const queryString = searchParams.toString();
    try {
      const res = await apiFetch(`/schematics/sections${queryString ? `?${queryString}` : ''}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.sections || [];
    } catch (e) {
      console.warn('Failed to load schematic sections', e);
      return [];
    }
  },

  /**
   * Схеми, що відповідають підкатегорії каталогу — щоб у каталозі поруч із
   * товарами підкатегорії була кнопка «Схема цього вузла».
   */
  getSchematicsForSubcategory: async (
    subcategoryId: number
  ): Promise<SubcategorySchemeSummary[]> => {
    if (!subcategoryId) return [];
    try {
      const res = await apiFetch(`/schematics/for-subcategory/${subcategoryId}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.schematics || [];
    } catch (e) {
      console.warn('Failed to load schematics for subcategory', e);
      return [];
    }
  },

  /**
   * Підкатегорія каталогу, що відповідає підсистемі схеми — щоб на кроці
   * «підсистема» показати деталі саме цього вузла.
   */
  getSubcategoryForSubsystem: async (params: {
    model?: string;
    subsystem?: string;
  }): Promise<{ subcategory_id: number | null; subcategory_name?: string }> => {
    if (!params.subsystem) return { subcategory_id: null };
    const searchParams = new URLSearchParams();
    if (params.model) searchParams.append('model', params.model);
    searchParams.append('subsystem', params.subsystem);
    try {
      const res = await apiFetch(`/schematics/subsystem-info?${searchParams.toString()}`);
      if (!res.ok) return { subcategory_id: null };
      return await res.json();
    } catch (e) {
      console.warn('Failed to resolve subsystem subcategory', e);
      return { subcategory_id: null };
    }
  },

  /**
   * Схеми, у яких стоїть ця деталь — зворотний звʼязок «товар → схема».
   * Екосистема працює в обидва боки: зі схеми можна прийти в товар, з товару — на схему.
   */
  getSchematicsByProduct: async (productId: string): Promise<SchematicUsage[]> => {
    if (!productId) return [];
    try {
      const res = await apiFetch(`/schematics/by-product/${encodeURIComponent(productId)}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.schematics || [];
    } catch (e) {
      console.warn('Failed to load schematics for product', e);
      return [];
    }
  },

  getSchematic: async (id: number): Promise<Schematic> => {
    const res = await apiFetch(`/schematics/${id}`);
    if (!res.ok) throw new Error('Failed to fetch schematic');
    return res.json();
  },

  getSchematicFilters: async (): Promise<{
    models: string[];
    generations: string[];
    sections: string[];
    subsystems: string[];
  }> => {
    const res = await apiFetch(`/schematics/meta/filters`);
    if (!res.ok) throw new Error('Failed to fetch schematic filters');
    return res.json();
  },

  decodeVin: async (vin: string): Promise<VinDecodeResult> => {
    const res = await apiFetch(`/vin/decode?vin=${encodeURIComponent(vin.trim().toUpperCase())}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Недійсний VIN-номер Tesla');
    }
    return res.json();
  },

  lookupByPlate: async (plate: string): Promise<PlateLookupResult> => {
    const res = await apiFetch(`/vin/lookup-by-plate?plate=${encodeURIComponent(plate.trim())}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Не вдалося знайти автомобіль за цим номером');
    }
    return res.json();
  },

  getVinModels: async (): Promise<any[]> => {
    const res = await apiFetch(`/vin/models`);
    if (!res.ok) throw new Error('Failed to fetch car models');
    return res.json();
  },
};

