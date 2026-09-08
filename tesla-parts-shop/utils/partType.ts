export type PartType = 'original' | 'analog' | null;

export interface ProductPartInfo {
  name: string;
  description?: string;
  part_type?: string | null;
}

/**
 * Determine whether a product is an Original (OEM) or Analog part.
 * 1. Checks explicit part_type field.
 * 2. Checks product title (highest confidence).
 * 3. Checks product description.
 */
export function getProductPartType(product: ProductPartInfo): PartType {
  if (product.part_type === 'original' || product.part_type === 'analog') {
    return product.part_type;
  }

  const name = product.name || '';
  const desc = product.description || '';

  // 1. Check title first
  if (/аналог/i.test(name)) {
    return 'analog';
  }
  if (/ориг[іи]нал|original/i.test(name)) {
    return 'original';
  }

  // 2. Check description
  if (/аналог/i.test(desc)) {
    return 'analog';
  }
  if (/ориг[іи]нал|original/i.test(desc)) {
    return 'original';
  }

  return null;
}
