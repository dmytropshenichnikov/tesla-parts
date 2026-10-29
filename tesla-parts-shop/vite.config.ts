import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    build: {
      // Lighthouse «Missing source maps for large first-party JavaScript».
      // Карти завантажуються лише коли відкриті DevTools — на швидкість не впливає.
      sourcemap: true,
      rollupOptions: {
        output: {
          // Один бандл на 111 КБ парсився однією довгою задачею (Lighthouse TBT).
          // Ділимо vendor і код застосунку: дві коротші задачі, і vendor
          // лишається в кеші між релізами.
          manualChunks(id: string) {
            // Лише React-рантайм окремо: він найбільший, і його парсинг стає
            // окремою коротшою задачею. Ширший поділ давав циклічні чанки
            // (react-helmet-async падав з TDZ), тому решта — в основному бандлі.
            if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) {
              return 'vendor-react';
            }
            return undefined;
          },
        },
      },
    },
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
