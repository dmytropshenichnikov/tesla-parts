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
  part_type?: 'original' | 'analog' | null;
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
  id: number;
  schematic_id: number;
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
 * каталогу (`/schematics/model-options`) — тобто з тих самих категорій,
 * що й решта магазину.
 */
export interface SchematicModelOption {
  /** Назва категорії каталогу. */
  category: string;
  category_id: number;
  /** Значення, що зберігається у `schematic.model`. */
  model: string;
  generation: string;
  generations: string[];
  /** true — покоління визначене категорією (напр. «Model 3 Highland»). */
  pinned_generation: boolean;
  is_accessory: boolean;
  schematics_count: number;
}

/** Підсистема всередині розділу схем (напр. «Защита днища и диффузор»). */
export interface SchematicSubsystem {
  subsystem: string;
  count: number;
}

/** Розділ схем (напр. «НАРУЖНЫЕ КРЕПЛЕНИЯ») зі своїми підсистемами. */
export interface SchematicSectionGroup {
  section: string;
  count: number;
  subsystems: SchematicSubsystem[];
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

export interface VinDecodeResult {
  vin: string;
  is_valid: boolean;
  make: string;
  model: string;
  generation: string;
  year: number;
  plant: string;
  drive: string;
  body_type: string;
  description: string;
}

export interface SavedCar {
  id: string;
  vin?: string;
  plate?: string;
  model: string;
  generation: string;
  year: number;
  drive?: string;
  plant?: string;
  body_type?: string;
  description: string;
  savedAt?: string;
}

export interface PlateLookupResult {
  plate: string;
  vin: string;
  mark: string;
  model: string;
  year: number;
  is_tesla: boolean;
  tesla_specs?: VinDecodeResult | null;
  message?: string | null;
}
