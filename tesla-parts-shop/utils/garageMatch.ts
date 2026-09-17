import { useEffect, useState } from 'react';
import { Product, SavedCar } from '../types';

/**
 * Активне авто з гаража. Магазин тримає його в localStorage (ключ той самий,
 * що використовують «Мій Гараж» і сторінка схем), тому читаємо звідси й
 * підписуємось на подію `garage-car-changed`, щоб каталог оновлювався одразу
 * після зміни авто без перезавантаження сторінки.
 */
export const getActiveCar = (): SavedCar | null => {
  try {
    const raw = localStorage.getItem('tesla_garage_active_car');
    return raw ? (JSON.parse(raw) as SavedCar) : null;
  } catch {
    return null;
  }
};

export const useActiveCar = (): SavedCar | null => {
  const [car, setCar] = useState<SavedCar | null>(() => getActiveCar());

  useEffect(() => {
    const sync = () => setCar(getActiveCar());
    window.addEventListener('garage-car-changed', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('garage-car-changed', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  return car;
};

/**
 * Категорія каталогу, яка відповідає авто. У каталозі покоління — це окрема
 * категорія («Model 3 Highland», «Model Y Juniper»), тому VIN-івське
 * «Model 3» + «Highland (2024-...)» треба звести саме до неї.
 */
export const catalogModelForCar = (car: SavedCar | null | undefined): string => {
  const model = (car?.model || '').trim();
  if (!model) return '';
  const gen = (car?.generation || '').toLowerCase();
  if (model === 'Model 3' && gen.includes('highland')) return 'Model 3 Highland';
  if (model === 'Model Y' && gen.includes('juniper')) return 'Model Y Juniper';
  return model;
};

/** Моделі, вказані в товарі (`category` — список через кому). */
export const productModels = (category?: string | null): string[] =>
  (category || '')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);

/**
 * Чи підходить товар до авто. Логіка та сама, що в адмінці при привʼязці
 * товару до схеми: товар, помічений базовою моделлю («Model 3»), підходить і
 * для її покоління; але товар суто для покоління («Model 3 Highland») не
 * вважаємо сумісним із базовою моделлю — це різні кузови.
 */
export const isProductCompatibleWithCar = (
  product: Product,
  car: SavedCar | null | undefined
): boolean => {
  if (!car) return false;
  const carModel = catalogModelForCar(car).toLowerCase();
  const baseModel = (car.model || '').trim().toLowerCase();
  if (!carModel || !baseModel) return false;

  const models = productModels(product.category).map((m) => m.toLowerCase());
  if (models.length === 0) return false;

  if (models.includes(carModel)) return true;
  if (carModel !== baseModel && models.includes(baseModel)) return true;
  return false;
};
