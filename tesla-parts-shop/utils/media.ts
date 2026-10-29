/**
 * Абсолютні URL фото з api.* перетворюємо на шлях свого домену.
 *
 * Навіщо: окремий origin — це ще один DNS+TCP+TLS у критичному шляху першого
 * екрана (Lighthouse рахує його в LCP). nginx шлюзу проксіює /static/ у бекенд,
 * тож файл їде тим самим з'єднанням, що й сторінка.
 *
 * На інших майданчиках (напр. Vercel) такого проксі немає — там лишаємо
 * абсолютну адресу, щоб фото не зникли.
 */
const API_ORIGIN = 'https://api.teslapartscenter.com.ua';

const canProxyStatic = (): boolean => {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'teslapartscenter.com.ua' || host.endsWith('.teslapartscenter.com.ua');
};

export const mediaUrl = (url?: string | null): string => {
  if (!url) return '';
  if (url.startsWith(`${API_ORIGIN}/static/`) && canProxyStatic()) {
    return url.slice(API_ORIGIN.length);
  }
  return url;
};

/** Той самий файл у зменшеній ширині (генерується поряд з оригіналом). */
export const sizedMediaUrl = (url: string, width: number): string => {
  if (!/\.webp$/i.test(url)) return url;
  return url.replace(/\.webp$/i, `-${width}.webp`);
};
