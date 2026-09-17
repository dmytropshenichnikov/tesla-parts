import { Product, Order, Category, Subcategory, Schematic, SchematicSummary, SchematicModelOption, SchematicSectionOption } from '../types';
import { trimImageFile } from '../utils/trimImageFile';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

const getHeaders = (isMultipart: boolean = false) => {
  const token = localStorage.getItem('accessToken');
  const headers: HeadersInit = {};

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Set Content-Type only if it's not a multipart request
  if (!isMultipart) {
    headers['Content-Type'] = 'application/json';
  }

  return headers;
};

// Define a temporary function to be replaced by the actual AuthContext logout
// This prevents a circular dependency with AuthContext importing ApiService, and ApiService needing AuthContext for logout.
// The real logout will be passed as a setter by AuthContext later.
let onUnauthorized: () => void = () => {
  console.warn('onUnauthorized callback not set in ApiService');
};

export const setUnauthorizedCallback = (callback: () => void) => {
  onUnauthorized = callback;
};

// Helper to check token expiration (very basic, actual JWT parsing would be better)
const isTokenExpired = (token: string | null): boolean => {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 < Date.now() + 2 * 60 * 1000; // Оновлюємо за 2 хв до кінця
  } catch (e) {
    return true; // Malformed token
  }
};

/**
 * Одночасні запити не мають смикати оновлення токена по черзі — тримаємо одну
 * спільну операцію й перевикористовуємо її результат.
 */
let refreshInFlight: Promise<string> | null = null;

const applyTokens = (accessToken: string, refreshToken?: string) => {
  localStorage.setItem('accessToken', accessToken);
  if (refreshToken) {
    localStorage.setItem('refreshToken', refreshToken);
  }
  // Повідомляємо AuthContext, щоб стан у React не розходився з localStorage
  window.dispatchEvent(
    new CustomEvent('admin-tokens-refreshed', {
      detail: { accessToken, refreshToken },
    })
  );
};

/** Тихо оновлює access-токен. Кидає помилку лише якщо оновлення неможливе. */
const refreshAccessTokenInternal = async (): Promise<string> => {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) {
    throw new Error('Немає refresh-токена');
  }

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      // Дві спроби: короткий збій мережі не має виглядати як «сесія закінчилась»
      let lastError: unknown;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const currentToken = localStorage.getItem('refreshToken') || refreshToken;
          const res = await ApiService.refreshToken(currentToken);
          applyTokens(res.access_token, res.refresh_token);
          return res.access_token;
        } catch (err) {
          lastError = err;
          if (attempt === 0) {
            await new Promise((resolve) => setTimeout(resolve, 600));
          }
        }
      }
      throw lastError;
    })().finally(() => {
      refreshInFlight = null;
    });
  }

  return refreshInFlight;
};

// Generic authenticated fetch wrapper with refresh token logic
// async function _authenticatedFetch(url: string, options: RequestInit = {}, isMultipart: boolean = false): Promise<Response> {
//   const accessToken = localStorage.getItem('accessToken');
//   const refreshToken = localStorage.getItem('refreshToken');

//   // If token is expired or about to expire, try to refresh
//   if (isTokenExpired(accessToken) && refreshToken) {
//     try {
//       const refreshResponse = await ApiService.refreshToken(refreshToken);
//       localStorage.setItem('accessToken', refreshResponse.access_token);
//       localStorage.setItem('refreshToken', refreshResponse.refresh_token);
//     } catch (refreshError) {
//       console.error("Token refresh failed:", refreshError);
//       onUnauthorized(); // Refresh failed, log out
//       throw new Error("Unauthorized: Token refresh failed.");
//     }
//   }

//   // After potential refresh, get new headers
//   let headers = getHeaders(isMultipart);
//   options.headers = { ...headers, ...options.headers };

//   let response = await fetch(url, options);

//   // If unauthorized after retry or if initial 401 on auth endpoints, and not on auth endpoint itself
//   if (response.status === 401 && !url.includes('/auth/')) {
//     onUnauthorized();
//     throw new Error("Unauthorized: Invalid credentials or session expired.");
//   }

//   return response;
// }

/**
 * Готує опції запиту з актуальними заголовками.
 * Викликається заново для повторної спроби після оновлення токена.
 */
function buildRequestOptions(options: RequestInit, isMultipart: boolean): RequestInit {
  const headers: any = { ...getHeaders(isMultipart), ...(options.headers || {}) };

  // Для FormData браузер має сам виставити multipart-межу — Content-Type прибираємо
  if (options.body instanceof FormData) {
    delete headers['Content-Type'];
  }

  return { ...options, headers };
}

// Generic authenticated fetch wrapper with refresh token logic
async function _authenticatedFetch(
  url: string,
  options: RequestInit = {},
  isMultipart: boolean = false
): Promise<Response> {
  const isAuthUrl = url.includes('/auth/');

  // Якщо токен от-от протухне — оновлюємо його заздалегідь, ще до запиту
  if (isTokenExpired(localStorage.getItem('accessToken'))) {
    try {
      await refreshAccessTokenInternal();
    } catch (refreshError) {
      console.error('Token refresh failed:', refreshError);
      onUnauthorized();
      throw new Error('Unauthorized: Token refresh failed.');
    }
  }

  let response = await fetch(url, buildRequestOptions(options, isMultipart));

  // 401 — не викидаємо одразу, а пробуємо оновити токен і повторити запит.
  // Саме так зникали «вильоти» на логін посеред роботи зі схемою.
  if (response.status === 401 && !isAuthUrl) {
    try {
      await refreshAccessTokenInternal();
      response = await fetch(url, buildRequestOptions(options, isMultipart));
    } catch (refreshError) {
      console.error('Повторна авторизація не вдалась:', refreshError);
      onUnauthorized();
      throw new Error('Unauthorized: session expired.');
    }

    if (response.status === 401) {
      onUnauthorized();
      throw new Error('Unauthorized: session expired.');
    }
  }

  return response;
}

export const ApiService = {
  login: async (
    username: string,
    password: string
  ): Promise<{ access_token: string; refresh_token: string }> => {
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);

    const res = await fetch(`${API_URL}/auth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.detail || 'Failed to login');
    }
    return res.json();
  },

  refreshToken: async (
    token: string
  ): Promise<{ access_token: string; refresh_token: string }> => {
    const res = await fetch(`${API_URL}/auth/refresh-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: token }),
    });
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.detail || 'Failed to refresh token');
    }
    return res.json();
  },

  resetPassword: async (
    oldPassword: string,
    newPassword: string
  ): Promise<{ message: string }> => {
    const res = await _authenticatedFetch(`${API_URL}/auth/reset-password`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        old_password: oldPassword,
        new_password: newPassword,
      }),
    });
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.detail || 'Failed to reset password');
    }
    return res.json();
  },

  getProducts: async (): Promise<Product[]> => {
    const res = await _authenticatedFetch(`${API_URL}/products/?limit=10000`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch products');
    return res.json();
  },

  getProduct: async (id: string): Promise<Product> => {
    const res = await _authenticatedFetch(`${API_URL}/products/${id}`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch product');
    return res.json();
  },

  createProduct: async (product: any) => {
    const formData = new FormData();
    formData.append('name', product.name);
    formData.append('category', product.category);
    formData.append('priceUAH', product.priceUAH.toString());
    formData.append('priceUSD', (product.priceUSD || 0).toString());
    formData.append('description', product.description);
    formData.append('inStock', product.inStock.toString());
    if (product.sort_order !== undefined && product.sort_order !== null) {
      formData.append('sort_order', product.sort_order.toString());
    }
    formData.append('cross_number', product.cross_number);
    formData.append('meta_title', product.meta_title ?? '');
    formData.append('meta_description', product.meta_description ?? '');

    if (product.files && product.files.length > 0) {
      product.files.forEach((file: File) => {
        formData.append('files', file);
      });
    }

    if (product.subcategory_id) {
      formData.append('subcategory_id', product.subcategory_id.toString());
    }
    if (product.subcategory_ids && product.subcategory_ids.length > 0) {
      Array.from(new Set(product.subcategory_ids)).forEach((id: number) => {
        formData.append('subcategory_ids', id.toString());
      });
    } else {
      // Explicitly send an empty list if none are selected, so FastAPI receives the parameter
      formData.append('subcategory_ids', '');
    }

    if (product.detail_number) {
      formData.append('detail_number', product.detail_number);
    }
    if (product.search_keywords !== undefined && product.search_keywords !== null) {
      formData.append('search_keywords', product.search_keywords);
    }
    if (product.is_popular !== undefined) {
      formData.append('is_popular', product.is_popular.toString());
    }
    if (product.part_type !== undefined) {
      formData.append('part_type', product.part_type || '');
    }

    const res = await _authenticatedFetch(`${API_URL}/products/`, {
      method: 'POST',
      headers: getHeaders(true), // Pass true for multipart
      body: formData,
    });
    if (!res.ok) throw new Error('Failed to create product');
    return res.json();
  },

  updateProduct: async (id: string, product: any): Promise<Product> => {
    const formData = new FormData();
    formData.append('name', product.name);
    formData.append('category', product.category);
    formData.append('priceUAH', product.priceUAH.toString());
    formData.append('priceUSD', (product.priceUSD || 0).toString());
    formData.append('description', product.description);
    formData.append('inStock', product.inStock.toString());
    if (product.sort_order !== undefined && product.sort_order !== null) {
      formData.append('sort_order', product.sort_order.toString());
    }
    formData.append('cross_number', product.cross_number);
    formData.append('meta_title', product.meta_title ?? '');
    formData.append('meta_description', product.meta_description ?? '');

    if (product.files && product.files.length > 0) {
      product.files.forEach((file: File) => {
        formData.append('files', file);
      });
    }

    if (product.subcategory_id) {
      formData.append('subcategory_id', product.subcategory_id.toString());
    }
    if (product.subcategory_ids && product.subcategory_ids.length > 0) {
      Array.from(new Set(product.subcategory_ids)).forEach((id: number) => {
        formData.append('subcategory_ids', id.toString());
      });
    } else {
      formData.append('subcategory_ids', ''); // Explicitly send an empty value
    }

    if (product.detail_number) {
      formData.append('detail_number', product.detail_number);
    }
    if (product.search_keywords !== undefined && product.search_keywords !== null) {
      formData.append('search_keywords', product.search_keywords);
    }
    if (product.is_popular !== undefined) {
      formData.append('is_popular', product.is_popular.toString());
    }
    if (product.part_type !== undefined) {
      formData.append('part_type', product.part_type || '');
    }

    if (product.kept_images !== undefined) {
      const keptList: string[] = Array.isArray(product.kept_images)
        ? product.kept_images.filter((url: string) => Boolean(url))
        : [];

      if (keptList.length === 0) {
        formData.append('kept_images', '');
      } else {
        keptList.forEach((url: string) => {
          formData.append('kept_images', url);
        });
      }
    }

    const res = await _authenticatedFetch(`${API_URL}/products/${id}`, {
      method: 'PUT',
      headers: getHeaders(true), // Pass true for multipart
      body: formData,
    });
    if (!res.ok) throw new Error('Failed to update product');
    return res.json();
  },

  copyProduct: async (id: string): Promise<Product> => {
    const res = await _authenticatedFetch(`${API_URL}/products/${id}/copy`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to copy product');
    return res.json();
  },

  deleteProduct: async (id: string): Promise<boolean> => {
    const res = await _authenticatedFetch(`${API_URL}/products/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return res.ok;
  },

  bulkDeleteProducts: async (ids: string[]): Promise<{ deleted: number }> => {
    const res = await _authenticatedFetch(`${API_URL}/products/bulk-delete`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ product_ids: ids }),
    });
    if (!res.ok) throw new Error('Failed to delete products');
    return res.json();
  },

  reorderProducts: async (ids: string[]): Promise<{ message: string }> => {
    const res = await _authenticatedFetch(`${API_URL}/products/reorder`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ product_ids: ids }),
    });
    if (!res.ok) throw new Error('Failed to reorder products');
    return res.json();
  },

  togglePopular: async (id: string): Promise<Product> => {
    const res = await _authenticatedFetch(
      `${API_URL}/products/${id}/toggle-popular`,
      {
        method: 'POST',
        headers: getHeaders(),
      }
    );
    if (!res.ok) throw new Error('Failed to toggle popular status');
    return res.json();
  },

  getOrders: async (): Promise<Order[]> => {
    const res = await _authenticatedFetch(`${API_URL}/orders/`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch orders');
    return res.json();
  },

  updateOrderTtn: async (orderId: number, ttn: string): Promise<void> => {
    const res = await _authenticatedFetch(`${API_URL}/orders/${orderId}/ttn`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ ttn }),
    });
    if (!res.ok) throw new Error('Failed to update order TTN');
  },

  updateOrderStatus: async (orderId: number, status: string): Promise<void> => {
    const res = await _authenticatedFetch(
      `${API_URL}/orders/${orderId}/status`,
      {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ status }),
      }
    );
    if (!res.ok) throw new Error('Failed to update order status');
  },

  /**
   * Лише базовий список категорій (без підкатегорій і товарів).
   * Використовується там, де потрібен порядок і повний перелік категорій каталогу.
   */
  /** Зберігає новий порядок категорій (моделей) після перетягування. */
  /** Показати/сховати категорію в «Схемах запчастин (EPC)» */
  setCategorySchematicsVisibility: async (
    id: number,
    visible: boolean
  ): Promise<{ id: number; show_in_schematics: boolean }> => {
    const res = await _authenticatedFetch(
      `${API_URL}/categories/${id}/schematics-visibility`,
      {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ visible }),
      }
    );
    if (!res.ok) throw new Error('Failed to update schematics visibility');
    return res.json();
  },

  reorderCategories: async (
    items: { id: number; sort_order: number }[]
  ): Promise<void> => {
    const res = await _authenticatedFetch(`${API_URL}/categories/reorder`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(items),
    });
    if (!res.ok) throw new Error('Failed to reorder categories');
  },

  /** Зберігає новий порядок підкатегорій (розділів) після перетягування. */
  reorderSubcategories: async (
    items: { id: number; sort_order: number }[]
  ): Promise<void> => {
    const res = await _authenticatedFetch(`${API_URL}/categories/subcategories/reorder`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(items),
    });
    if (!res.ok) throw new Error('Failed to reorder subcategories');
  },

  getCategoriesBasic: async (): Promise<Category[]> => {
    const res = await _authenticatedFetch(`${API_URL}/categories/`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch categories');
    return res.json();
  },

  /**
   * Підкатегорія каталогу, якій відповідає шлях схеми
   * (модель → розділ → підсистема). Нею звужуємо вибір товарів.
   */
  getSubcategoryForSubsystem: async (params: {
    model?: string;
    section?: string;
    subsystem?: string;
  }): Promise<{ subcategory_id: number | null; subcategory_name?: string }> => {
    if (!params.subsystem) return { subcategory_id: null };
    const searchParams = new URLSearchParams();
    if (params.model) searchParams.append('model', params.model);
    if (params.section) searchParams.append('section', params.section);
    searchParams.append('subsystem', params.subsystem);
    try {
      const res = await _authenticatedFetch(
        `${API_URL}/schematics/subsystem-info?${searchParams.toString()}`,
        { headers: getHeaders() }
      );
      if (!res.ok) return { subcategory_id: null };
      return await res.json();
    } catch (err) {
      console.warn('Failed to resolve subsystem subcategory', err);
      return { subcategory_id: null };
    }
  },

  /**
   * Уся структура каталогу одним запитом: категорії (моделі) + їхні
   * підкатегорії. Потрібно, щоб мапити товар → модель і → розділ схеми.
   */
  getCategoriesTree: async (): Promise<
    { id: number; name: string; sort_order: number; subcategories: Subcategory[] }[]
  > => {
    const res = await _authenticatedFetch(`${API_URL}/categories/tree`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch categories tree');
    const data = await res.json();
    return data.categories || [];
  },

  getCategories: async (): Promise<Category[]> => {
    // 1. Fetch basic list to get IDs
    const res = await _authenticatedFetch(`${API_URL}/categories/`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch categories');
    const basicCategories: Category[] = await res.json();

    // 2. Fetch full structure for each category (to get subcategories)
    // AND Fetch all products to populate counts
    const productsRes = await _authenticatedFetch(
      `${API_URL}/products/?limit=10000`,
      { headers: getHeaders() }
    );
    const allProducts: Product[] = productsRes.ok
      ? await productsRes.json()
      : [];

    const categoriesDetails: Category[] = await Promise.all(
      basicCategories.map((c) =>
        _authenticatedFetch(`${API_URL}/categories/${c.id}`, {
          headers: getHeaders(),
        }).then((r) => (r.ok ? r.json() : c))
      )
    );

    // 3. Map products to subcategories
    const attachProductsToTree = (subs: Subcategory[]) => {
      subs.forEach((sub) => {
        // Find products for this subcategory (direct and linked)
        sub.products = allProducts.filter(
          (p) =>
            p.subcategory_id === sub.id ||
            (p.subcategory_ids && p.subcategory_ids.includes(sub.id))
        );

        if (sub.subcategories) {
          attachProductsToTree(sub.subcategories);
        }
      });
    };

    const finalCategories = categoriesDetails.map((catDetail) => {
      if (catDetail.subcategories) {
        attachProductsToTree(catDetail.subcategories);
      }
      // Find products that belong to this category name but have NO subcategory assigned
      catDetail.products = allProducts.filter(
        (p) =>
          p.category.includes(catDetail.name) &&
          !p.subcategory_id &&
          (!p.subcategory_ids || p.subcategory_ids.length === 0)
      );
      return catDetail;
    });

    return finalCategories;
  },

  createCategory: async (
    name: string,
    file?: File,
    sort_order?: number,
    meta_title?: string,
    meta_description?: string
  ): Promise<Category> => {
    const formData = new FormData();
    formData.append('name', name);

    if (file) {
      const preparedFile = await trimImageFile(file);
      formData.append('file', preparedFile);
    }

    if (sort_order !== undefined && sort_order !== null) {
      formData.append('sort_order', sort_order.toString());
    }
    formData.append('meta_title', meta_title ?? '');
    formData.append('meta_description', meta_description ?? '');

    const res = await _authenticatedFetch(`${API_URL}/categories/`, {
      method: 'POST',
      headers: getHeaders(true), // Pass true for multipart
      body: formData,
    });
    if (!res.ok) throw new Error('Failed to create category');
    return res.json();
  },

  updateCategory: async (
    id: number,
    name: string,
    file?: File,
    sort_order?: number,
    meta_title?: string,
    meta_description?: string
  ): Promise<Category> => {
    const formData = new FormData();
    formData.append('name', name);

    if (file) {
      const preparedFile = await trimImageFile(file);
      formData.append('file', preparedFile);
    }

    if (sort_order !== undefined && sort_order !== null) {
      formData.append('sort_order', sort_order.toString());
    }
    formData.append('meta_title', meta_title ?? '');
    formData.append('meta_description', meta_description ?? '');

    const res = await _authenticatedFetch(`${API_URL}/categories/${id}`, {
      method: 'PUT',
      headers: getHeaders(true), // Pass true for multipart
      body: formData,
    });
    if (!res.ok) throw new Error('Failed to update category');
    return res.json();
  },

  createSubcategory: async (
    categoryId: number,
    name: string,
    code?: string,
    parentId?: number,
    file?: File,
    sortOrder?: number
  ): Promise<Subcategory> => {
    const formData = new FormData();
    formData.append('name', name);
    formData.append('category_id', categoryId.toString());
    if (code) formData.append('code', code);
    if (parentId !== undefined && parentId !== null) {
      formData.append('parent_id', parentId.toString());
    }

    if (file) {
      const preparedFile = await trimImageFile(file);
      formData.append('file', preparedFile);
    }
    if (sortOrder !== undefined && sortOrder !== null) {
      formData.append('sort_order', sortOrder.toString());
    }

    const res = await _authenticatedFetch(
      `${API_URL}/categories/${categoryId}/subcategories/`,
      {
        method: 'POST',
        headers: getHeaders(true), // Pass true for multipart
        body: formData,
      }
    );
    if (!res.ok) throw new Error('Failed to create subcategory');
    return res.json();
  },

  updateSubcategory: async (
    id: number,
    name: string,
    code?: string,
    parentId?: number,
    file?: File,
    sortOrder?: number
  ): Promise<Subcategory> => {
    const formData = new FormData();
    formData.append('name', name);
    if (code) formData.append('code', code);
    if (parentId !== undefined && parentId !== null) {
      formData.append('parent_id', parentId.toString());
    }

    if (file) {
      const preparedFile = await trimImageFile(file);
      formData.append('file', preparedFile);
    }
    if (sortOrder !== undefined && sortOrder !== null) {
      formData.append('sort_order', sortOrder.toString());
    }

    const res = await _authenticatedFetch(
      `${API_URL}/categories/subcategories/${id}`,
      {
        method: 'PUT',
        headers: getHeaders(true), // Pass true for multipart
        body: formData,
      }
    );
    if (!res.ok) throw new Error('Failed to update subcategory');
    return res.json();
  },

  moveSubcategory: async (
    id: number,
    targetCategoryId: number,
    targetParentId?: number | null
  ): Promise<Subcategory> => {
    const res = await _authenticatedFetch(
      `${API_URL}/categories/subcategories/${id}/move`,
      {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          target_category_id: targetCategoryId,
          target_parent_id: targetParentId ?? null,
        }),
      }
    );
    if (!res.ok) throw new Error('Failed to move subcategory');
    return res.json();
  },

  copySubcategory: async (
    id: number,
    targetCategoryId: number,
    targetParentId?: number | null
  ): Promise<Subcategory> => {
    const res = await _authenticatedFetch(
      `${API_URL}/categories/subcategories/${id}/copy`,
      {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          target_category_id: targetCategoryId,
          target_parent_id: targetParentId ?? null,
        }),
      }
    );
    if (!res.ok) throw new Error('Failed to copy subcategory');
    return res.json();
  },

  deleteCategory: async (id: number): Promise<boolean> => {
    const res = await _authenticatedFetch(`${API_URL}/categories/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.detail || 'Failed to delete category');
    }
    return res.ok;
  },

  deleteSubcategory: async (id: number): Promise<boolean> => {
    const res = await _authenticatedFetch(
      `${API_URL}/categories/subcategories/${id}`,
      {
        method: 'DELETE',
        headers: getHeaders(),
      }
    );
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.detail || 'Failed to delete subcategory');
    }
    return res.ok;
  },

  checkAuth: () => {
    return !!localStorage.getItem('accessToken');
  },

  getSetting: async (key: string): Promise<{ key: string; value: string }> => {
    const res = await _authenticatedFetch(`${API_URL}/settings/${key}`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch setting');
    return res.json();
  },

  updateSetting: async (
    key: string,
    value: string
  ): Promise<{ key: string; value: string }> => {
    const res = await _authenticatedFetch(`${API_URL}/settings/${key}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ value }),
    });
    if (!res.ok) throw new Error('Failed to update setting');
    return res.json();
  },

  getSettings: async (): Promise<{ key: string; value: string }[]> => {
    const res = await _authenticatedFetch(`${API_URL}/settings/`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch settings');
    return res.json();
  },

  // Pages API
  getPages: async (): Promise<any[]> => {
    const res = await _authenticatedFetch(`${API_URL}/pages/`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch pages');
    return res.json();
  },

  getPage: async (slugOrId: string): Promise<any> => {
    const res = await _authenticatedFetch(`${API_URL}/pages/${slugOrId}`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch page');
    return res.json();
  },

  createPage: async (page: {
    slug: string;
    title: string;
    content: string;
    is_published?: boolean;
    location?: string;
  }): Promise<any> => {
    const res = await _authenticatedFetch(`${API_URL}/pages/`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(page),
    });
    if (!res.ok) throw new Error('Failed to create page');
    return res.json();
  },

  updatePage: async (
    id: number,
    page: {
      slug?: string;
      title?: string;
      content?: string;
      is_published?: boolean;
      location?: string;
    }
  ): Promise<any> => {
    const res = await _authenticatedFetch(`${API_URL}/pages/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(page),
    });
    if (!res.ok) throw new Error('Failed to update page');
    return res.json();
  },

  deletePage: async (id: number): Promise<boolean> => {
    const res = await _authenticatedFetch(`${API_URL}/pages/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return res.ok;
  },

  getSocialLinks: async (): Promise<{
    instagram: string;
    telegram: string;
    viber: string;
  }> => {
    const res = await _authenticatedFetch(`${API_URL}/settings/social-links`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch social links');
    return res.json();
  },

  updateSocialLinks: async (links: {
    instagram: string;
    telegram: string;
    viber: string;
  }): Promise<any> => {
    const res = await _authenticatedFetch(`${API_URL}/settings/social-links`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(links),
    });
    if (!res.ok) throw new Error('Failed to update social links');
    return res.json();
  },

  getStaticSeo: async (): Promise<
    Array<{
      id: number;
      slug: string;
      meta_title: string;
      meta_description: string;
    }>
  > => {
    const res = await _authenticatedFetch(`${API_URL}/seo/static`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch SEO records');
    return res.json();
  },

  updateStaticSeo: async (
    slug: string,
    payload: { meta_title?: string; meta_description?: string }
  ): Promise<{
    id: number;
    slug: string;
    meta_title: string;
    meta_description: string;
  }> => {
    const res = await _authenticatedFetch(`${API_URL}/seo/static/${slug}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to update SEO record');
    return res.json();
  },

  // Reviews API
  getReviews: async (): Promise<any[]> => {
    const res = await _authenticatedFetch(`${API_URL}/reviews/`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch reviews');
    return res.json();
  },

  createReview: async (file: File, sortOrder: number = 0): Promise<any> => {
    const formData = new FormData();
    formData.append('sort_order', sortOrder.toString());

    const res = await _authenticatedFetch(`${API_URL}/reviews/`, {
      method: 'POST',
      headers: getHeaders(true),
      body: formData,
    });
    if (!res.ok) throw new Error('Failed to create review');
    return res.json();
  },

  deleteReview: async (id: number): Promise<void> => {
    await _authenticatedFetch(`${API_URL}/reviews/${id}`, {
      method: 'DELETE',
    });
  },

  // --- Customers API ---
  getCustomers: async (): Promise<any[]> => {
    const res = await _authenticatedFetch(`${API_URL}/customers/`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch customers');
    return res.json();
  },

  getCustomer: async (id: number): Promise<any> => {
    const res = await _authenticatedFetch(`${API_URL}/customers/${id}`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch customer');
    return res.json();
  },

  getCustomerOrders: async (id: number): Promise<Order[]> => {
    const res = await _authenticatedFetch(`${API_URL}/customers/${id}/orders`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch customer orders');
    return res.json();
  },

  updateCustomerDiscount: async (
    id: number,
    discountType: string | null,
    discountValue: number | null
  ): Promise<any> => {
    const res = await _authenticatedFetch(
      `${API_URL}/customers/${id}/discount`,
      {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({
          discount_type: discountType,
          discount_value: discountValue,
        }),
      }
    );
    if (!res.ok) throw new Error('Failed to update discount');
    return res.json();
  },

  // --- PromoCodes API ---
  getPromoCodes: async (): Promise<any[]> => {
    const res = await _authenticatedFetch(`${API_URL}/promocodes/`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch promocodes');
    return res.json();
  },

  createPromoCode: async (data: any): Promise<any> => {
    const res = await _authenticatedFetch(`${API_URL}/promocodes/`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create promocode');
    return res.json();
  },

  updatePromoCode: async (id: number, data: any): Promise<any> => {
    const res = await _authenticatedFetch(`${API_URL}/promocodes/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update promocode');
    return res.json();
  },

  deletePromoCode: async (id: number): Promise<void> => {
    const res = await _authenticatedFetch(`${API_URL}/promocodes/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete promocode');
  },

  reorderReviews: async (ids: number[]): Promise<{ message: string }> => {
    const res = await _authenticatedFetch(`${API_URL}/reviews/reorder`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ review_ids: ids }),
    });
    if (!res.ok) throw new Error('Failed to reorder reviews');
    return res.json();
  },

  // --- Email Campaigns API ---
  getEmailLists: async (): Promise<any[]> => {
    const res = await _authenticatedFetch(`${API_URL}/email-campaigns/lists`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch email lists');
    return res.json();
  },

  createEmailList: async (data: { name: string; customer_ids: number[] }): Promise<any> => {
    const res = await _authenticatedFetch(`${API_URL}/email-campaigns/lists`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create email list');
    return res.json();
  },

  updateEmailList: async (id: number, data: { name?: string; customer_ids?: number[] }): Promise<any> => {
    const res = await _authenticatedFetch(`${API_URL}/email-campaigns/lists/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update email list');
    return res.json();
  },

  deleteEmailList: async (id: number): Promise<void> => {
    const res = await _authenticatedFetch(`${API_URL}/email-campaigns/lists/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete email list');
  },

  sendCampaignToList: async (id: number, data: { subject: string; body: string }): Promise<{ message: string }> => {
    const res = await _authenticatedFetch(`${API_URL}/email-campaigns/lists/${id}/send`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.detail || 'Failed to send campaign');
    }
    return res.json();
  },

  sendDirectCampaign: async (data: { subject: string; body: string; customer_ids: number[]; emails: string[] }): Promise<{ message: string }> => {
    const res = await _authenticatedFetch(`${API_URL}/email-campaigns/send-direct`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.detail || 'Failed to send direct campaign');
    }
    return res.json();
  },

  getSearchQueriesReport: async (limit: number = 100): Promise<{
    total_searches: number;
    zero_results_count: number;
    zero_results: { query: string; count: number; last_searched: string }[];
    popular: { query: string; count: number; results_count: number; last_searched: string }[];
    recent: { id: number; query: string; results_count: number; created_at: string }[];
  }> => {
    const res = await _authenticatedFetch(`${API_URL}/analytics/search-queries?limit=${limit}`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch search queries report');
    return res.json();
  },

  clearSearchQueries: async (): Promise<void> => {
    const res = await _authenticatedFetch(`${API_URL}/analytics/search-queries`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to clear search queries');
  },

  // --- Schematics API ---
  getSchematics: async (params?: {
    model?: string;
    generation?: string;
    section?: string;
    q?: string;
  }): Promise<SchematicSummary[]> => {
    const searchParams = new URLSearchParams();
    if (params?.model) searchParams.append('model', params.model);
    if (params?.generation) searchParams.append('generation', params.generation);
    if (params?.section) searchParams.append('section', params.section);
    if (params?.q) searchParams.append('q', params.q);
    const queryString = searchParams.toString();
    const url = `${API_URL}/schematics${queryString ? `?${queryString}` : ''}`;
    const res = await _authenticatedFetch(url, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch schematics');
    return res.json();
  },

  /**
   * Опції моделей і поколінь для редактора схем.
   * Джерело — категорії каталогу (єдине місце, де задаються моделі).
   */
  /**
   * Зміна порядку схем у списку (як у каталозі): передаємо id у потрібному
   * порядку, бекенд проставляє sort_order. Магазин показує схеми в цьому ж порядку.
   */
  reorderSchematics: async (ids: number[]): Promise<{ message: string }> => {
    const res = await _authenticatedFetch(`${API_URL}/schematics/reorder`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ schematic_ids: ids }),
    });
    if (!res.ok) throw new Error('Failed to reorder schematics');
    return res.json();
  },

  getSchematicModelOptions: async (): Promise<SchematicModelOption[]> => {
    const res = await _authenticatedFetch(`${API_URL}/schematics/model-options`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch schematic model options');
    const data = await res.json();
    return data.options || [];
  },

  /**
   * Розділи й підсистеми схем із каталогу (підкатегорії обраної категорії).
   * Використовується у списках вибору, щоб не плодити «КУЗОВ» / «Кузов».
   */
  getSchematicSectionOptions: async (
    categoryId?: number
  ): Promise<SchematicSectionOption[]> => {
    if (!categoryId) return [];
    try {
      const res = await _authenticatedFetch(
        `${API_URL}/schematics/section-options?category_id=${categoryId}`,
        { headers: getHeaders() }
      );
      if (!res.ok) return [];
      const data = await res.json();
      return data.sections || [];
    } catch (err) {
      console.warn('Failed to load schematic section options', err);
      return [];
    }
  },

  /** Завантажити зображення схеми за посиланням (напр. з EPC Tesla) */
  uploadSchematicImageFromUrl: async (
    url: string
  ): Promise<{ image_url: string; bytes?: number }> => {
    const res = await _authenticatedFetch(`${API_URL}/schematics/upload-image-url`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ url }),
    });
    if (!res.ok) {
      const msg = await res.json().catch(() => null);
      throw new Error(msg?.detail || 'Не вдалося завантажити зображення за посиланням');
    }
    return res.json();
  },

  getSchematic: async (id: number): Promise<Schematic> => {
    const res = await _authenticatedFetch(`${API_URL}/schematics/${id}`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch schematic');
    return res.json();
  },

  createSchematic: async (data: any): Promise<Schematic> => {
    const res = await _authenticatedFetch(`${API_URL}/schematics`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create schematic');
    return res.json();
  },

  updateSchematic: async (id: number, data: any): Promise<Schematic> => {
    const res = await _authenticatedFetch(`${API_URL}/schematics/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update schematic');
    return res.json();
  },

  deleteSchematic: async (id: number): Promise<void> => {
    const res = await _authenticatedFetch(`${API_URL}/schematics/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete schematic');
  },

  uploadSchematicImage: async (file: File): Promise<{ image_url: string }> => {
    const formData = new FormData();
    const res = await _authenticatedFetch(`${API_URL}/schematics/upload-image`, {
      method: 'POST',
      headers: getHeaders(true),
      body: formData,
    });
    if (!res.ok) throw new Error('Failed to upload schematic image');
    return res.json();
  },
};

export const api = ApiService;

