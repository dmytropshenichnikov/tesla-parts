/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/**
 * Час збірки бандла (проставляється у vite.config.ts). Показується у
 * сайдбарі, щоб за секунду було видно, чи браузер підтягнув свіжу версію,
 * а не тримає старий бандл із кешу.
 */
declare const __BUILD_STAMP__: string;
