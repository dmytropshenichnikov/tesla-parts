import { Product, OrderData, Category, StaticSeoRecord, Page } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('customerToken');
  const headers = {
    ...options.headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const response = await fetch(url, { ...options, headers });

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

    const res = await fetch(`${API_URL}/products/?${params.toString()}`);
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
    const res = await fetch(`${API_URL}/products/${id}`);
    if (!res.ok) throw new Error('Failed to fetch product');
    return res.json();
  },

  getLabels: async (): Promise<string[]> => {
    const res = await fetch(`${API_URL}/products/labels`);
    if (!res.ok) throw new Error('Failed to fetch labels');
    return res.json();
  },

  getCategories: async (): Promise<Category[]> => {
    const res = await fetch(`${API_URL}/categories/`);
    if (!res.ok) throw new Error('Failed to fetch categories');
    return res.json();
  },

  getCategory: async (id: number): Promise<Category> => {
    const res = await fetch(`${API_URL}/categories/${id}`);
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

    const res = await fetchWithAuth(`${API_URL}/orders/`, {
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
      const res = await fetch(`${API_URL}/pages/${slug}`);
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  },

  getPagesBySlugs: async (slugs: string[]): Promise<Page[]> => {
    const res = await fetch(`${API_URL}/pages/by-slugs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slugs }),
    });
    if (!res.ok) throw new Error('Failed to fetch pages');
    return res.json();
  },

  getSetting: async (key: string): Promise<string | null> => {
    try {
      const res = await fetch(`${API_URL}/settings/${key}`);
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
    const res = await fetch(`${API_URL}/settings/social-links`);
    if (!res.ok) throw new Error('Failed to fetch social links');
    return res.json();
  },

  getStaticSeo: async (): Promise<StaticSeoRecord[]> => {
    const res = await fetch(`${API_URL}/seo/static`);
    if (!res.ok) throw new Error('Failed to fetch static SEO data');
    return res.json();
  },

  getReviews: async (): Promise<any[]> => {
    const res = await fetch(`${API_URL}/reviews/`);
    if (!res.ok) throw new Error('Failed to fetch reviews');
    return res.json();
  },

  // --- Customer Authentication ---
  registerCustomer: async (email: string) => {
    const res = await fetch(`${API_URL}/customers/register`, {
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
    const res = await fetch(`${API_URL}/customers/verify`, {
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
    const res = await fetch(`${API_URL}/customers/login`, {
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
    const res = await fetchWithAuth(`${API_URL}/customers/logout`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Logout failed');
    return res.json();
  },

  forgotPassword: async (email: string) => {
    const res = await fetch(`${API_URL}/customers/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) throw new Error('Failed to send reset link');
    return res.json();
  },

  resetPassword: async (data: any) => {
    const res = await fetch(`${API_URL}/customers/reset-password`, {
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
    const res = await fetchWithAuth(`${API_URL}/customers/me`);
    if (!res.ok) throw new Error('Failed to fetch profile');
    return res.json();
  },

  getMyOrders: async () => {
    const res = await fetchWithAuth(`${API_URL}/customers/me/orders`);
    if (!res.ok) throw new Error('Failed to fetch orders');
    return res.json();
  },

  updateProfile: async (data: any) => {
    const res = await fetchWithAuth(`${API_URL}/customers/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update profile');
    return res.json();
  },

  validatePromoCode: async (code: string) => {
    const res = await fetchWithAuth(`${API_URL}/promocodes/validate`, {
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
      await fetch(`${API_URL}/analytics/search-log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, results_count: resultsCount }),
      });
    } catch (e) {
      // Silently catch logging errors so user experience is uninterrupted
      console.warn('Failed to log search query', e);
    }
  },
};
