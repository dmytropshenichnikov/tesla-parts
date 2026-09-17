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
  /** Чи показувати категорію в «Схемах запчастин (EPC)» */
  show_in_schematics?: boolean;
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
  part_type?: 'original' | 'analog' | null;
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

export interface HotspotVariant {
  id?: string;
  name: string;
  type?: 'original' | 'analog';
  condition?: 'used' | 'new';
  priceUAH: number;
  priceUSD: number;
  inStock: boolean;
  product_id?: string | null;
}

export interface SchematicHotspot {
  id?: number;
  schematic_id?: number;
  number: number;
  x: number;
  y: number;
  part_number?: string;
  name: string;
  product_id?: string | null;
  variants_json?: string;
  variants?: HotspotVariant[];
  product?: Product | null;
  sort_order?: number;
}

/**
 * Опція «Модель / Покоління» для схем. Формується бекендом із категорій
 * каталогу (`/schematics/model-options`), щоб не дублювати їх хардкодом.
 */
export interface SchematicModelOption {
  /** Назва категорії каталогу — саме її бачить адміністратор у списку. */
  category: string;
  category_id: number;
  /** Значення, яке зберігається у `schematic.model` (базова модель). */
  model: string;
  /** Покоління за замовчуванням для цієї категорії. */
  generation: string;
  /** Усі доступні покоління цієї категорії. */
  generations: string[];
  /** true — покоління жорстко визначене категорією і не потребує вибору. */
  pinned_generation: boolean;
  is_accessory: boolean;
  schematics_count: number;
}

export interface SchematicSummary {
  id: number;
  title: string;
  model: string;
  generation: string;
  section: string;
  subsystem: string;
  image_url: string;
  sort_order: number;
  created_at?: string;
  hotspots_count: number;
}

/**
 * Розділ схеми з каталогу: «КУЗОВ» і його підсистеми («ПЕРЕДНІЙ БАМПЕР»…).
 * Джерело — підкатегорії каталогу, щоб не було різнобою
 * «КУЗОВ» / «Кузов» / «кузов», який ламає навігацію по схемах.
 */
export interface SchematicSectionOption {
  section: string;
  subsystems: string[];
}

/** Категорія каталогу з її підкатегоріями — легке дерево одним запитом. */
export interface CatalogTreeCategory {
  id: number;
  name: string;
  sort_order: number;
  subcategories: Subcategory[];
}

export interface Schematic {
  id: number;
  title: string;
  model: string;
  generation: string;
  section: string;
  subsystem: string;
  image_url: string;
  sort_order: number;
  created_at?: string;
  hotspots: SchematicHotspot[];
}
