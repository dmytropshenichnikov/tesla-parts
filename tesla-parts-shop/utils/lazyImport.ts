/**
 * Динамічні чанки ламаються з двох причин: обірвався зв'язок або після
 * деплою в кеші браузера/nginx лишився старий index.html, який посилається
 * на вже видалені файли. React у такому разі розмонтовує все дерево - і
 * користувач бачить білу сторінку.
 *
 * Тут два запобіжники: короткі повторні спроби завантажити чанк і одне
 * перезавантаження сторінки, щоб узяти свіжий index.html.
 */

const CHUNK_RELOAD_KEY = 'tp-chunk-reload-at';
const RELOAD_COOLDOWN_MS = 15000;

export const isChunkLoadError = (error: unknown): boolean => {
  const message =
    error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return /ChunkLoadError|Loading (CSS )?chunk|dynamically imported module|Importing a module script failed|error loading dynamically imported module|Failed to fetch/i.test(
    message
  );
};

/**
 * Перезавантажує сторінку не частіше одного разу за 15 секунд, щоб не
 * зациклитись, якщо проблема не в кеші.
 */
export const reloadOnceForChunks = (): boolean => {
  try {
    const last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || 0);
    if (Date.now() - last < RELOAD_COOLDOWN_MS) return false;
    sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
  } catch {
    // Без sessionStorage теж пробуємо: краще одне перезавантаження.
  }
  window.location.reload();
  return true;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Імпорт чанка з повторними спробами перед тим, як здатися. */
export const retryImport = async <T>(
  loader: () => Promise<T>,
  attempts = 3
): Promise<T> => {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await loader();
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) {
        await sleep(300 * (attempt + 1));
      }
    }
  }
  if (isChunkLoadError(lastError)) {
    reloadOnceForChunks();
  }
  throw lastError;
};
