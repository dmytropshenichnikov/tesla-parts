/**
 * Прибирає порожні поля навколо малюнка.
 *
 * Креслення вузлів часто мають великі світлі відступи (30% і більше з боків),
 * через що в картках здавалося, ніби картинка «пливе» в порожньому сірому полі.
 * Тут ми один раз вимірюємо межі малюнка на canvas і віддаємо вже обрізану
 * картинку (data URL). Результат кешується, тож повторні рендери безкоштовні.
 */
const cache = new Map<string, string>();
const inFlight = new Map<string, Promise<string>>();

/** Поріг «це фон»: усе світліше за це вважаємо порожнім полем */
const BACKGROUND_LUMA = 232;
/** Мінімальний відступ навколо малюнка (частка від розміру) */
const PADDING = 0.03;

export const trimImage = (src: string): Promise<string> => {
  if (!src) return Promise.resolve(src);
  const cached = cache.get(src);
  if (cached) return Promise.resolve(cached);
  const running = inFlight.get(src);
  if (running) return running;

  const task = new Promise<string>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';

    img.onload = () => {
      try {
        const naturalW = img.naturalWidth;
        const naturalH = img.naturalHeight;
        if (!naturalW || !naturalH) return resolve(src);

        // Вимірюємо на зменшеній копії — швидко навіть для великих PNG
        const probeW = Math.min(naturalW, 420);
        const probeH = Math.max(1, Math.round((naturalH * probeW) / naturalW));
        const probe = document.createElement('canvas');
        probe.width = probeW;
        probe.height = probeH;
        const probeCtx = probe.getContext('2d');
        if (!probeCtx) return resolve(src);
        probeCtx.drawImage(img, 0, 0, probeW, probeH);
        const { data } = probeCtx.getImageData(0, 0, probeW, probeH);

        let minX = probeW;
        let minY = probeH;
        let maxX = -1;
        let maxY = -1;

        for (let y = 0; y < probeH; y += 1) {
          for (let x = 0; x < probeW; x += 1) {
            const i = (y * probeW + x) * 4;
            const alpha = data[i + 3];
            if (alpha < 30) continue; // прозоре — теж фон
            const luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            if (luma < BACKGROUND_LUMA) {
              if (x < minX) minX = x;
              if (y < minY) minY = y;
              if (x > maxX) maxX = x;
              if (y > maxY) maxY = y;
            }
          }
        }

        if (maxX < 0 || maxY < 0) return resolve(src); // суцільний фон — не чіпаємо

        const padX = Math.round(probeW * PADDING);
        const padY = Math.round(probeH * PADDING);
        minX = Math.max(0, minX - padX);
        minY = Math.max(0, minY - padY);
        maxX = Math.min(probeW - 1, maxX + padX);
        maxY = Math.min(probeH - 1, maxY + padY);

        const cropW = maxX - minX + 1;
        const cropH = maxY - minY + 1;
        // Обрізати майже нічого — лишаємо оригінал, щоб не втратити якість
        if (cropW > probeW * 0.96 && cropH > probeH * 0.96) return resolve(src);

        const scale = naturalW / probeW;
        const out = document.createElement('canvas');
        out.width = Math.round(cropW * scale);
        out.height = Math.round(cropH * scale);
        const outCtx = out.getContext('2d');
        if (!outCtx) return resolve(src);
        outCtx.drawImage(
          img,
          minX * scale,
          minY * scale,
          cropW * scale,
          cropH * scale,
          0,
          0,
          out.width,
          out.height
        );

        const url = out.toDataURL('image/png');
        cache.set(src, url);
        resolve(url);
      } catch {
        // Канвас «заплямований» (CORS) або інша проблема — показуємо оригінал
        resolve(src);
      }
    };

    img.onerror = () => resolve(src);
    img.src = src;
  }).finally(() => {
    inFlight.delete(src);
  });

  inFlight.set(src, task);
  return task;
};
