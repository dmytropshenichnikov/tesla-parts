/**
 * Мініатюра для сіток карток: `optimize_images.py --thumbs` і аплоадер
 * кладуть поруч з повним файлом `<назва>-sm.webp` (480px, ~10-15 КБ).
 *
 * Повний файл (1600px) лишається для картки товару і зуму — у сітці він
 * зайвий, саме він давав головний трафік при гортанні каталогу.
 */
import type { SyntheticEvent } from "react";

const OWN_STATIC = "/static/images/tesla-parts/";

export const thumbUrl = (url?: string | null): string | null => {
  if (!url || !url.includes(OWN_STATIC)) return null;
  const ext = url.match(/\.(webp|png|jpe?g|avif)$/i);
  if (!ext) return null;
  return url.slice(0, -ext[0].length) + "-sm.webp";
};

/** Якщо мініатюри немає на сервері — повертаємося до повного файлу. */
export const onThumbError =
  (fallback?: string | null) => (event: SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    const current = img.getAttribute("src") || "";
    if (fallback && current !== fallback) {
      img.src = fallback;
    }
  };
