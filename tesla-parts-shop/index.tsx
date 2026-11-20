import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import App from './App';
import './index.css';
// Inter самохоститься (без fonts.googleapis.com): CSS не блокує рендер,
// woff2 ідуть з /assets з immutable-кешем. Так прибираємо рендер-блокуючий
// запит до Google Fonts (Lighthouse «render-blocking resources»).
import '@fontsource/inter/300.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import { AuthProvider } from './context/AppContext';
import { initInternalTrafficFlag } from './utils/analytics';
import AppErrorBoundary from './components/AppErrorBoundary';
import { isChunkLoadError, reloadOnceForChunks } from './utils/lazyImport';

// ?kit_internal=1 один раз позначає браузер менеджера в магазині; далі всі
// події отримують traffic_type=internal, щоб їх можна було відфільтрувати.
initInternalTrafficFlag();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

// Якщо чанк не завантажився (обрив звʼязку або старий index.html у кеші),
// React сам нічого не відновить - перезавантажуємо сторінку один раз.
window.addEventListener('unhandledrejection', (event) => {
  if (isChunkLoadError(event.reason) && reloadOnceForChunks()) {
    event.preventDefault();
  }
});

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AppErrorBoundary>
      <BrowserRouter>
        <HelmetProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </HelmetProvider>
      </BrowserRouter>
    </AppErrorBoundary>
  </React.StrictMode>
);
