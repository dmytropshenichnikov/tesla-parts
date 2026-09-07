export interface Subcategory {
  id: number;
  name: string;
  code?: string;
  image?: string;
  category_id: number;
  parent_id?: number | null;
  sort_order?: number;
  subcategories?: Subcategory[];
  products?: Product[];
}

export interface Category {
  id: number;
  name: string;
  image?: string;
  sort_order?: number;
  meta_title?: string | null;
  meta_description?: string | null;
  subcategories: Subcategory[];
  products?: Product[];
}

export interface Product {
  id: string;
  name: string;
  category: string;
  subcategory_id?: number;
  subcategory_ids?: number[];
  priceUAH: number;
  image: string;
  images?: string[];
  description: string;
  inStock: boolean;
  sort_order?: number;
  detail_number?: string;
  priceUSD?: number;
  cross_number: string;
  search_keywords?: string;
  meta_title?: string;
  meta_description?: string;
  is_popular: boolean;
  created_at?: string;
}

export interface OrderItem {
  product_id: string;
  product_name?: string;
  product_image?: string;
  product_detail_number?: string;
  quantity: number;
  price_at_purchase: number;
}

export interface Order {
  id: number;
  customer_first_name: string;
  customer_last_name: string;
  customer_phone: string;
  delivery_city: string;
  delivery_branch: string;
  payment_method: string;
  totalUSD: number;
  totalUAH: number;
  created_at: string;
  status: string;
  ttn?: string; // Added TTN field
  note?: string; // Added note field
  items: OrderItem[];
}

export interface DashboardStats {
  totalRevenue: number;
  totalOrders: number;
  pendingOrders: number;
  lowStockItems: number;
}
