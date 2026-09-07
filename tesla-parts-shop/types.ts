export enum Currency {
  UAH = 'UAH',
  USD = 'USD',
}

export interface Subcategory {
  id: number;
  name: string;
  code?: string;
  image?: string;
  category_id?: number;
  parent_id?: number | null;
  sort_order?: number;
  subcategories?: Subcategory[];
}

export interface Category {
  id: number;
  name: string;
  image?: string;
  sort_order?: number;
  meta_title?: string | null;
  meta_description?: string | null;
  subcategories?: Subcategory[];
}

export interface Product {
  id: string;
  name: string;
  category: string; // Comma-separated list of categories (e.g., "Model 3, Model Y")
  subcategory_id?: number;
  subcategory_ids?: number[];
  priceUAH: number;
  priceUSD?: number;
  image: string;
  images?: string[];
  description: string;
  inStock: boolean;
  sort_order?: number;
  detail_number?: string;
  cross_number?: string;
  search_keywords?: string;
  is_popular?: boolean;
  meta_title?: string | null;
  meta_description?: string | null;
}

export interface StaticSeoRecord {
  id: number;
  slug: string;
  meta_title?: string | null;
  meta_description?: string | null;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface NovaPostBranch {
  id: string;
  description: string;
}

export interface City {
  id: string;
  name: string;
  branches: NovaPostBranch[];
}

export enum PaymentMethod {
  IBAN = 'Оплата на рахунок ФОП',
  COD = 'Накладений платіж', // Cash on Delivery
}

export interface OrderData {
  items: CartItem[];
  totalUSD: number;
  customer: {
    firstName: string;
    lastName: string;
    phone: string;
  };
  delivery: {
    city: string;
    branch: string;
  };
  paymentMethod: PaymentMethod;
  createdAt: string;
  note?: string;
  promocode?: string;
}

export interface Page {
  id: number;
  slug: string;
  title: string;
  content: string;
  is_published: boolean;
  location: string;
}

export interface Review {
  id: number;
  image_url: string;
}
